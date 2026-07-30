import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getEarningsStartTime, getDaysEarning } from "../utils/earnings";
import { getTodaysProducts } from "../utils/products";

const REVIEWS_COLLECTION = "reviews";
const RATING_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// WAT (UTC+1) day boundary, consistent with check-in and withdrawal-hours
// conventions used elsewhere in the app.
function getWATDateString(timestamp = Date.now()) {
  const watMs = timestamp + 60 * 60 * 1000;
  const d = new Date(watMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function watDateStringToDayIndex(dateString) {
  return Math.floor(new Date(dateString + "T00:00:00Z").getTime() / (24 * 60 * 60 * 1000));
}

function todayDayIndex() {
  return watDateStringToDayIndex(getWATDateString());
}

/**
 * Fetches a user's review record: which WAT dates they've fully completed
 * (rated every featured product that day), today's in-progress ratings
 * (in case they've rated some but not all of today's products), and
 * whether they're currently locked out by the 24h rolling rating cooldown.
 *
 * IMPORTANT — two independent clocks, on purpose:
 *  - WHICH PRODUCTS ARE SHOWN and WHICH DAYS COUNT TOWARD EARNINGS still
 *    run on the existing shared WAT-calendar-day system (completedDays,
 *    getTodaysProducts) — this is UNCHANGED, since earnings math
 *    (countReviewedEarningDays in this file, calculateInvestmentEarnings
 *    in utils/earnings.js) already depends on it and was hand-verified
 *    this session; rebuilding it around a per-user rolling clock would
 *    risk reintroducing that exact class of bug.
 *  - WHETHER THE RATE BUTTONS ARE ENABLED is a SEPARATE, new 24h rolling
 *    check based on `lastRatingAt` (a precise timestamp, not a date
 *    string) — a user who rates at 11pm is locked out until 11pm the
 *    NEXT day, even though the featured products themselves may have
 *    already switched to a new calendar day's set at WAT midnight in
 *    between. They'll see new products, but can't rate until their
 *    personal 24h timer runs out.
 */
export async function getReviewStatus(userId) {
  const snap = await getDoc(doc(db, REVIEWS_COLLECTION, userId));
  const today = getWATDateString();
  const todaysProducts = getTodaysProducts(todayDayIndex());
  const now = Date.now();

  if (!snap.exists()) {
    return { completedDays: [], todaysRatings: {}, today, todaysProducts, lastRatingAt: null, cooldownActive: false, cooldownEndsAt: null };
  }

  const data = snap.data();
  const todaysRatings = data.lastRatingDate === today ? data.todaysRatings || {} : {};
  const lastRatingAt = data.lastRatingAt || null;
  const cooldownEndsAt = lastRatingAt ? lastRatingAt + RATING_COOLDOWN_MS : null;
  const cooldownActive = cooldownEndsAt != null && now < cooldownEndsAt;

  return {
    completedDays: data.completedDays || [],
    todaysRatings,
    today,
    todaysProducts,
    lastRatingAt,
    cooldownActive,
    cooldownEndsAt,
  };
}

/**
 * Records a star rating (1-5) for one of today's products. If this
 * completes ratings for ALL of today's products, marks today as a
 * completed review-day, which is what unlocks that day's VIP earnings.
 *
 * The 24h rolling cooldown only STARTS once a full day's set is
 * COMPLETED (allRated === true) — not after every individual product
 * rating. Setting it after each single rating would lock a user out
 * partway through rating today's 3 products (e.g. blocked from rating
 * product 2 just because they rated product 1 a minute earlier), which
 * defeats the purpose entirely. Enforced server-side (not just in the
 * UI) — throws if called while a previous COMPLETED day's cooldown is
 * still active, so a user can't bypass the lockout by calling this
 * directly.
 */
export async function rateProduct(userId, productId, stars) {
  if (stars < 1 || stars > 5) throw new Error("Rating must be between 1 and 5 stars.");

  const status = await getReviewStatus(userId);
  if (status.cooldownActive) {
    const hoursLeft = Math.ceil((status.cooldownEndsAt - Date.now()) / (60 * 60 * 1000));
    throw new Error(`You can rate again in about ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}.`);
  }

  const updatedRatings = { ...status.todaysRatings, [productId]: stars };

  const allRated = status.todaysProducts.every((p) => updatedRatings[p.id] != null);
  const updatedCompletedDays = allRated && !status.completedDays.includes(status.today)
    ? [...status.completedDays, status.today]
    : status.completedDays;

  const now = Date.now();
  // Only stamp lastRatingAt (which starts the 24h cooldown) once the
  // full set is complete — a partial rating (1 or 2 of 3 products)
  // should NOT start the clock, since the user still needs to rate the
  // remaining products in this same sitting.
  const docUpdate = {
    completedDays: updatedCompletedDays,
    todaysRatings: updatedRatings,
    lastRatingDate: status.today,
  };
  if (allRated) {
    docUpdate.lastRatingAt = now;
  }

  await setDoc(doc(db, REVIEWS_COLLECTION, userId), docUpdate, { merge: true });

  const cooldownEndsAt = allRated ? now + RATING_COOLDOWN_MS : status.cooldownEndsAt;
  return {
    completedDays: updatedCompletedDays,
    todaysRatings: updatedRatings,
    today: status.today,
    todaysProducts: status.todaysProducts,
    allRatedToday: allRated,
    lastRatingAt: allRated ? now : status.lastRatingAt,
    cooldownActive: allRated,
    cooldownEndsAt,
  };
}

/**
 * Counts how many of an investment's elapsed earning-days are PAID —
 * under the current catch-up rule, a missed day is not lost forever, it's
 * deferred: the next time the user completes a FULL day's review, that
 * single action pays out every unpaid day back through their last
 * completed review (or back to earnings-start, if this is their first
 * ever completed review), all at once. Days after their most recent
 * completed review are still unpaid until their next review — the user
 * still has to keep reviewing to keep earning, this only removes the
 * "gone forever" part of missing a day.
 *
 * CHANGED FROM THE ORIGINAL "NO CATCH-UP" DESIGN (per explicit site owner
 * request): the earlier version only counted days that were themselves
 * individually reviewed, with no partial credit and no way to recover a
 * missed day. Confirmed with the site owner: (1) catch-up is unlimited —
 * no cap on how many missed days can be backfilled by one review, (2) one
 * completed review clears the ENTIRE backlog up to that point in a single
 * moment, not day-by-day, (3) this is NOT a one-time unlock — a user still
 * has to review again to get paid for days after their last completed
 * review; skipping again just starts a new backlog rather than losing
 * those days outright.
 *
 * Implementation: find the LATEST WAT day, at or after earnings-start,
 * that the user has in completedDays. Every day from earnings-start
 * through that day (inclusive) is paid — that's what "the review clears
 * the whole backlog up to now" means mechanically. Days after that latest
 * completion (if any) are simply not yet paid, exactly like the original
 * design treated every unreviewed day, until the next completion moves
 * this boundary forward.
 */
export function countReviewedEarningDays(approvedAt, now, completedDays) {
  const earningsStart = getEarningsStartTime(approvedAt);
  if (now < earningsStart) return 0;

  const startDayIndex = watDateStringToDayIndex(getWATDateString(earningsStart));
  const todayDayIndex = watDateStringToDayIndex(getWATDateString(now));

  // Latest completed day index that falls within this investment's
  // earning window (on or after start, on or before today) — anything
  // completed before the investment even started, or somehow in the
  // future, isn't relevant to this investment's backlog.
  let latestPaidDayIndex = -1;
  for (const dateString of completedDays) {
    const idx = watDateStringToDayIndex(dateString);
    if (idx >= startDayIndex && idx <= todayDayIndex && idx > latestPaidDayIndex) {
      latestPaidDayIndex = idx;
    }
  }

  if (latestPaidDayIndex === -1) return 0; // never reviewed yet within this window — nothing paid
  return latestPaidDayIndex - startDayIndex + 1;
}

/**
 * Whether TODAY's WAT calendar day is currently PAID for this investment
 * under the catch-up rule — i.e. today falls within the earning window
 * (past the 24h grace period) and the days-paid count has caught up to
 * the days-elapsed count. Since today is always the most recent possible
 * elapsed day, this is only true once the user has completed today's
 * review specifically (an earlier review can't reach into the future to
 * cover a day that hadn't happened yet).
 *
 * Reuses countReviewedEarningDays() and getDaysEarning() directly so this
 * can never disagree with the cumulative figures they're drawn from.
 */
export function hasEarnedToday(approvedAt, now, completedDays) {
  const earningsStart = getEarningsStartTime(approvedAt);
  if (now < earningsStart) return false;
  const daysEarning = getDaysEarning(approvedAt, now);
  const reviewedDayCount = countReviewedEarningDays(approvedAt, now, completedDays);
  return reviewedDayCount >= daysEarning;
}
