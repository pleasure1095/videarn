import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { MIN_WITHDRAWAL, validateWithdrawalAmount } from "../utils/earnings";
import { createNotification } from "./notifications";

const CHECKINS_COLLECTION = "checkins";
export const CHECKIN_DAILY_REWARD = 100;
export const CHECKIN_STREAK_TARGET = 7;
export const CHECKIN_MAX_REWARD = CHECKIN_DAILY_REWARD * CHECKIN_STREAK_TARGET; // ₦700

// Uses WAT (UTC+1) as the reference timezone for "what day is it", staying
// consistent with the withdrawal-hours convention used elsewhere in the
// app, rather than the user's local device timezone (which could let
// someone game the streak by changing their phone's clock/timezone).
function getWATDateString(timestamp = Date.now()) {
  const watMs = timestamp + 60 * 60 * 1000; // UTC+1
  const d = new Date(watMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function daysBetweenDateStrings(a, b) {
  const dateA = new Date(a + "T00:00:00Z");
  const dateB = new Date(b + "T00:00:00Z");
  return Math.round((dateB - dateA) / (1000 * 60 * 60 * 24));
}

const DEFAULT_STATUS = {
  currentStreak: 0,
  longestStreak: 0,
  totalCheckIns: 0,
  lastCheckInDate: null,
  pendingReward: 0, // accumulating toward the 7-day unlock, lost if streak breaks early
  unlockedBalance: 0, // withdrawable once a 7-day streak completes
  lifetimeWithdrawn: 0,
};

/**
 * Fetches a user's check-in record, or a default zeroed-out shape if
 * they've never checked in before.
 */
export async function getCheckInStatus(userId) {
  const snap = await getDoc(doc(db, CHECKINS_COLLECTION, userId));
  const today = getWATDateString();

  if (!snap.exists()) {
    return { ...DEFAULT_STATUS, checkedInToday: false, today };
  }

  const data = snap.data();
  return { ...DEFAULT_STATUS, ...data, checkedInToday: data.lastCheckInDate === today, today };
}

/**
 * Records today's check-in, updates the streak, and applies the reward
 * rules:
 *  - ₦100/day accrues into `pendingReward` for each of the first 7
 *    consecutive days. No reward accrues past day 7 within a single
 *    streak — a completed 7-day streak's reward is already fully
 *    accounted for in unlockedBalance by that point.
 *  - Reaching exactly 7 consecutive days moves the full ₦700 from
 *    pendingReward into unlockedBalance (withdrawable) and resets the
 *    streak counter to 0, so a new 7-day cycle can begin.
 *  - Breaking the streak before day 7 forfeits pendingReward entirely —
 *    it resets to 0 along with the streak. Already-unlocked balance from
 *    a previous completed cycle is never affected.
 */
export async function performCheckIn(userId) {
  const status = await getCheckInStatus(userId);
  if (status.checkedInToday) return status;

  const today = status.today;
  const continuingStreak = status.lastCheckInDate && daysBetweenDateStrings(status.lastCheckInDate, today) === 1;

  let newStreak = continuingStreak ? status.currentStreak + 1 : 1;
  let newPendingReward = continuingStreak ? status.pendingReward : 0;
  let newUnlockedBalance = status.unlockedBalance;
  let justUnlocked = false;

  if (newStreak <= CHECKIN_STREAK_TARGET) {
    newPendingReward += CHECKIN_DAILY_REWARD;
  }

  if (newStreak === CHECKIN_STREAK_TARGET) {
    // 7-day streak completed — unlock the accumulated reward and start a
    // fresh cycle.
    newUnlockedBalance += newPendingReward;
    newPendingReward = 0;
    newStreak = 0;
    justUnlocked = true;
  }

  const updated = {
    currentStreak: newStreak,
    longestStreak: Math.max(continuingStreak ? status.currentStreak + 1 : 1, status.longestStreak || 0),
    totalCheckIns: (status.totalCheckIns || 0) + 1,
    lastCheckInDate: today,
    pendingReward: newPendingReward,
    unlockedBalance: newUnlockedBalance,
    lifetimeWithdrawn: status.lifetimeWithdrawn || 0,
  };

  await setDoc(doc(db, CHECKINS_COLLECTION, userId), updated);

  if (justUnlocked) {
    await createNotification(
      userId,
      "checkin",
      `🎉 7-day check-in streak complete! ₦${CHECKIN_MAX_REWARD.toLocaleString()} is now available to withdraw.`
    );
  }

  return { ...updated, checkedInToday: true, today };
}

/**
 * Withdraws from the unlocked check-in balance. Follows the same rules as
 * VIP profit withdrawals: minimum withdrawal amount and the 8AM-10PM WAT
 * window (validated by the caller before calling this, same pattern as
 * WithdrawModal for VIP investments).
 */
export async function withdrawCheckInBalance(userId, amount, currentUnlockedBalance, currentLifetimeWithdrawn) {
  const validation = validateWithdrawalAmount(amount, currentUnlockedBalance);
  if (!validation.valid) throw new Error(validation.reason);

  await updateDoc(doc(db, CHECKINS_COLLECTION, userId), {
    unlockedBalance: currentUnlockedBalance - amount,
    lifetimeWithdrawn: (currentLifetimeWithdrawn || 0) + amount,
  });

  await createNotification(userId, "withdrawal", `Check-in bonus withdrawal of ₦${amount.toLocaleString()} submitted.`);
}
