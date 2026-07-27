// Earnings & withdrawal rules — single source of truth for the money math.
// Any component calculating investment value should import from here rather
// than recomputing this logic, so the rules only ever live in one place.
//
// RULES (confirmed with the project owner):
// 1. Earnings do NOT start accruing until 24 hours after admin approval —
//    this is a grace/activation period, not a multi-day lock. After that
//    24h window, earnings accrue daily as before (flat daily rate, no
//    compounding).
// 2. Capital (the original investment amount) is NEVER withdrawable — it
//    stays invested permanently and only generates daily profit.
// 3. Only profit/earnings can be withdrawn, and withdrawals are tracked as
//    a running lifetime total per investment (not reset to zero on each
//    withdrawal) — so withdrawable balance = lifetime earnings minus
//    lifetime withdrawn.
// 4. Minimum withdrawal is ₦1,200, checked against the withdrawable
//    profit balance (not the locked capital).
// 5. DAILY REVIEWS GATE: a day's earning is fully conditional on the user
//    having rated ALL of that day's featured products (see
//    services/reviews.js). No rating that day = ₦0 earned for that day —
//    this is an intentional, confirmed design choice (not a bonus-on-top
//    model). Missed days are gone permanently; there is no catch-up
//    mechanism, unlike the earlier Read to Earn design this replaced.

export const EARNINGS_START_DELAY_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MIN_WITHDRAWAL = 1200;

/**
 * Returns the timestamp at which an investment's earnings actually begin,
 * given when it was approved.
 */
export function getEarningsStartTime(approvedAt) {
  return approvedAt + EARNINGS_START_DELAY_MS;
}

/**
 * Whole days of earnings accrued since approval, counting the day that
 * completes AT the 24h grace-period mark as day 1 (not day 0).
 *
 * FIXED this session: the previous version returned 0 until a full
 * additional 24h had passed AFTER the grace period ended — meaning a
 * user's first day's earning didn't actually appear until ~48h after
 * approval, contradicting the app's own stated promise ("earnings begin
 * 24 hours after admin approval") shown in VIP Plans copy and elsewhere.
 * Confirmed with the site owner: the first day's earning should be
 * visible right at the 24h mark, not 48h.
 *
 * The fix: once `now` has reached the grace-period end time, day 1 has
 * already completed — so we count elapsed time from the ORIGINAL
 * approval timestamp (not from the grace-period end) and add 1 once the
 * grace period has passed, rather than starting the elapsed-day count
 * from zero at the grace-period boundary.
 */
export function getDaysEarning(approvedAt, now = Date.now()) {
  const start = getEarningsStartTime(approvedAt);
  if (now < start) return 0;
  // At the exact 24h mark (now === start), one full day (the grace
  // period itself) has elapsed since approval — that counts as day 1.
  // Each additional 24h beyond that adds one more day.
  return Math.floor((now - approvedAt) / (24 * 60 * 60 * 1000));
}

/**
 * Full earnings breakdown for a single investment/deposit.
 *
 * @param {number} dailyRate - the VIP plan's daily earning amount
 * @param {number} approvedAt - timestamp the deposit was approved
 * @param {number} lifetimeWithdrawn - total profit already withdrawn from
 *   this specific investment
 * @param {number} reviewedDayCount - count of distinct earning-days for
 *   which the user completed that day's full product review set. Callers
 *   get this from services/reviews.js by comparing the investment's
 *   earning-day range against the user's completed-review-day records.
 *   Capped by the caller at daysEarning (can't exceed total days elapsed).
 *   Unreviewed days earn nothing — there is no partial credit and no
 *   catch-up, unlike the guaranteed/pending split this replaced.
 * @param {number} now - defaults to current time; parameterized for testing
 */
export function calculateInvestmentEarnings(dailyRate, approvedAt, lifetimeWithdrawn = 0, reviewedDayCount = 0, now = Date.now()) {
  const daysEarning = getDaysEarning(approvedAt, now);
  const totalEarnings = dailyRate * daysEarning; // theoretical max if every day were reviewed

  const cappedReviewedDays = Math.min(reviewedDayCount, daysEarning);
  const availableEarnings = dailyRate * cappedReviewedDays;
  const missedEarnings = dailyRate * (daysEarning - cappedReviewedDays); // forfeited permanently, shown for transparency only

  const withdrawableBalance = Math.max(0, availableEarnings - lifetimeWithdrawn);
  const earningsStartTime = getEarningsStartTime(approvedAt);
  const stillInGracePeriod = now < earningsStartTime;

  return {
    daysEarning,
    totalEarnings,
    availableEarnings,
    missedEarnings,
    withdrawableBalance,
    earningsStartTime,
    stillInGracePeriod,
  };
}

/**
 * Validates a withdrawal request against the profit-only balance.
 * Capital is intentionally excluded — this function only ever checks
 * against withdrawable PROFIT, never the locked investment amount.
 */
export function validateWithdrawalAmount(requestedAmount, withdrawableBalance) {
  if (requestedAmount < MIN_WITHDRAWAL) {
    return { valid: false, reason: `Minimum withdrawal is ₦${MIN_WITHDRAWAL.toLocaleString()}.` };
  }
  if (requestedAmount > withdrawableBalance) {
    return {
      valid: false,
      reason: `This exceeds your available profit balance of ₦${withdrawableBalance.toLocaleString()}. Capital cannot be withdrawn.`,
    };
  }
  return { valid: true, reason: "" };
}
