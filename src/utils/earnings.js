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
// 5. DAILY REVIEWS GATE: a day's earning is conditional on the user having
//    rated ALL of that day's featured products (see services/reviews.js).
//    CATCH-UP RULE (confirmed with the project owner): a missed day is not
//    lost — it's deferred. The next time the user completes a full day's
//    review, that single action pays out every unpaid day back through
//    their last completed review, all at once, with no cap on how many
//    days can be backfilled. The user still has to keep reviewing to keep
//    earning going forward — this only removes the "gone forever" part of
//    missing a day, it is not a one-time unlock.

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
 * @param {number} reviewedDayCount - count of earning-days currently PAID
 *   under the catch-up rule (paid-through-day boundary, not a literal
 *   per-day tally) — see countReviewedEarningDays() in services/reviews.js
 *   for how this is derived. Capped by the caller at daysEarning (can't
 *   exceed total days elapsed).
 * @param {number} now - defaults to current time; parameterized for testing
 */
export function calculateInvestmentEarnings(dailyRate, approvedAt, lifetimeWithdrawn = 0, reviewedDayCount = 0, now = Date.now()) {
  const daysEarning = getDaysEarning(approvedAt, now);
  const totalEarnings = dailyRate * daysEarning; // theoretical max if every day were reviewed

  const cappedReviewedDays = Math.min(reviewedDayCount, daysEarning);
  const availableEarnings = dailyRate * cappedReviewedDays;
  // PENDING (not forfeited) — under the catch-up rule, this is the
  // backlog of days not yet paid because the user hasn't reviewed since
  // then. It clears out to ₦0 the moment they next complete a full day's
  // review (see countReviewedEarningDays in services/reviews.js), so this
  // figure is a "not yet unlocked" balance, not money that's gone.
  const missedEarnings = dailyRate * (daysEarning - cappedReviewedDays);

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
