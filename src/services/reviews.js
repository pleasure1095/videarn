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
 */
export function countReviewedEarningDays(approvedAt, daysEarning, completedDays) {
  if (daysEarning <= 0) return 0;
  const completedSet = new Set(completedDays.map(watDateStringToDayIndex));
  const startDayIndex = watDateStringToDayIndex(getWATDateString(getEarningsStartTime(approvedAt)));

  let count = 0;
  for (let i = 0; i < daysEarning; i++) {
    if (completedSet.has(startDayIndex + i)) count++;
  }
  return count;
}
