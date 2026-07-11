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
//    stays invested permanently and only generates daily profit. This is a
//    deliberate reversal of the original "Withdrawable = Capital + Earnings"
//    rule.
// 3. Only profit/earnings can be withdrawn, and withdrawals are tracked as
//    a running lifetime total per investment (not reset to zero on each
//    withdrawal) — so withdrawable balance = lifetime earnings minus
//    lifetime withdrawn.
// 4. Minimum withdrawal is ₦1,200, checked against the withdrawable
//    profit balance (not the locked capital).

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
 * Whole days of earnings accrued since the 24h grace period ended.
 * Returns 0 if still within the grace period (no earnings yet).
 */
export function getDaysEarning(approvedAt, now = Date.now()) {
  const start = getEarningsStartTime(approvedAt);
  if (now < start) return 0;
  return Math.floor((now - start) / (24 * 60 * 60 * 1000));
}

/**
 * Full earnings breakdown for a single investment/deposit.
 *
 * @param {number} dailyRate - the VIP plan's daily earning amount
 * @param {number} approvedAt - timestamp the deposit was approved
 * @param {number} lifetimeWithdrawn - total profit already withdrawn from
 *   this specific investment (new field — defaults to 0 for investments
 *   that predate this rule)
 * @param {number} now - defaults to current time; parameterized for testing
 */
export function calculateInvestmentEarnings(dailyRate, approvedAt, lifetimeWithdrawn = 0, now = Date.now()) {
  const daysEarning = getDaysEarning(approvedAt, now);
  const totalEarnings = dailyRate * daysEarning;
  const withdrawableBalance = Math.max(0, totalEarnings - lifetimeWithdrawn);
  const earningsStartTime = getEarningsStartTime(approvedAt);
  const stillInGracePeriod = now < earningsStartTime;

  return {
    daysEarning,
    totalEarnings,
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
