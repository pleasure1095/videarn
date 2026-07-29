import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getEarningsStartTime } from "../utils/earnings";
import { getTodaysProducts } from "../utils/products";

const REVIEWS_COLLECTION = "reviews";

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
 * (rated every featured product that day), and today's in-progress
 * ratings (in case they've rated some but not all of today's products).
 */
export async function getReviewStatus(userId) {
  const snap = await getDoc(doc(db, REVIEWS_COLLECTION, userId));
  const today = getWATDateString();
  const todaysProducts = getTodaysProducts(todayDayIndex());

  if (!snap.exists()) {
    return { completedDays: [], todaysRatings: {}, today, todaysProducts };
  }

  const data = snap.data();
  const todaysRatings = data.lastRatingDate === today ? data.todaysRatings || {} : {};
  return {
    completedDays: data.completedDays || [],
    todaysRatings,
    today,
    todaysProducts,
  };
}

/**
 * Records a star rating (1-5) for one of today's products. If this
 * completes ratings for ALL of today's products, marks today as a
 * completed review-day, which is what unlocks that day's VIP earnings.
 */
export async function rateProduct(userId, productId, stars) {
  if (stars < 1 || stars > 5) throw new Error("Rating must be between 1 and 5 stars.");

  const status = await getReviewStatus(userId);
  const updatedRatings = { ...status.todaysRatings, [productId]: stars };

  const allRated = status.todaysProducts.every((p) => updatedRatings[p.id] != null);
  const updatedCompletedDays = allRated && !status.completedDays.includes(status.today)
    ? [...status.completedDays, status.today]
    : status.completedDays;

  await setDoc(doc(db, REVIEWS_COLLECTION, userId), {
    completedDays: updatedCompletedDays,
    todaysRatings: updatedRatings,
    lastRatingDate: status.today,
  });

  return {
    completedDays: updatedCompletedDays,
    todaysRatings: updatedRatings,
    today: status.today,
    todaysProducts: status.todaysProducts,
    allRatedToday: allRated,
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
