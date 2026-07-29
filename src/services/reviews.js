import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getEarningsStartTime } from "../utils/earnings";
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
 * Counts how many of an investment's elapsed earning-days fall on a WAT
 * date the user FULLY completed (rated every featured product) — this is
 * the `reviewedDayCount` figure utils/earnings.js needs. Unlike the
 * earlier Read to Earn design, there is no partial credit and no
 * catch-up: a day not fully reviewed earns nothing for that day,
 * permanently.
 *
 * FIXED this session: the previous version computed a single
 * `startDayIndex` from the earnings-start moment, then checked indices
 * `startDayIndex + i` for `i` in `[0, daysEarning)` — treating daysEarning
 * (a count of elapsed 24-HOUR PERIODS from the exact approval timestamp)
 * as if it lined up with elapsed WAT CALENDAR DAYS. These two clocks
 * drift apart depending on what time of day the deposit was approved: a
 * deposit approved at, say, 10am WAT has its 24h-period boundaries
 * falling mid-day, not at the WAT midnight boundary the review system
 * actually uses — so a user who genuinely reviewed "today" could have
 * their review land on a calendar-day index the old math never checked,
 * making it look like 0 days were reviewed even when they weren't.
 *
 * Fixed by walking WAT calendar days directly, from the earnings-start
 * date through TODAY's WAT date (inclusive), checking each real calendar
 * day rather than an elapsed-period count. Takes `now` instead of
 * `daysEarning` for this reason — callers should pass the same `now`
 * they used for getDaysEarning(), not its result.
 */
export function countReviewedEarningDays(approvedAt, now, completedDays) {
  const earningsStart = getEarningsStartTime(approvedAt);
  if (now < earningsStart) return 0;

  const completedSet = new Set(completedDays.map(watDateStringToDayIndex));
  const startDayIndex = watDateStringToDayIndex(getWATDateString(earningsStart));
  const todayDayIndex = watDateStringToDayIndex(getWATDateString(now));

  let count = 0;
  for (let idx = startDayIndex; idx <= todayDayIndex; idx++) {
    if (completedSet.has(idx)) count++;
  }
  return count;
}
