import {
  collection,
  doc,
  addDoc,
  updateDoc,
  runTransaction,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { createNotification } from "./notifications";
import { MIN_WITHDRAWAL } from "../utils/earnings";

const WITHDRAWAL_REQUESTS_COLLECTION = "withdrawalRequests";
const DEPOSITS_COLLECTION = "deposits";
const CHECKINS_COLLECTION = "checkins";
const USERS_COLLECTION = "users";

function genRef() {
  return "GWD-" + Math.random().toString(36).toUpperCase().slice(2, 8) + "-" + Date.now().toString(36).toUpperCase().slice(-4);
}

/**
 * Combines every withdrawable balance a user has — VIP investment
 * profit (across all their approved deposits), Referral Bonus, Welcome
 * Bonus, and Check-in balance — into ONE total, per the site owner's
 * explicit request to stop showing these as separate "tags" the user
 * has to withdraw individually.
 *
 * This is a pure display/summary helper — it does NOT deduct anything.
 * `investments` is expected to already carry each deposit's live
 * `withdrawableBalance` (as computed by utils/earnings.js), the same
 * shape DashboardPage.jsx already builds.
 */
export function getCombinedWithdrawableBalance({ investments, referralBonusTotal, welcomeBonus, checkInBalance }) {
  const vipProfit = investments.reduce((sum, inv) => sum + (inv.withdrawableBalance || 0), 0);
  const referral = referralBonusTotal || 0;
  const welcome = welcomeBonus || 0;
  const checkIn = checkInBalance || 0;
  return {
    total: vipProfit + referral + welcome + checkIn,
    breakdown: { vipProfit, referral, welcome, checkIn },
  };
}

/**
 * Submits ONE combined withdrawal request that draws from potentially
 * several underlying balance sources to cover the requested amount.
 *
 * Draw order (doesn't affect the total, only which pot empties first for
 * a PARTIAL withdrawal): Referral Bonus -> Welcome Bonus -> Check-in ->
 * VIP investment profit (oldest-approved investment first, since that's
 * a stable, deterministic tie-breaker). VIP profit is drawn last since
 * it's the most "durable" balance; bonuses are cleared first.
 *
 * Each source's deduction is written directly to its own document (same
 * as the individual withdraw flows already did — deposits'
 * lifetimeWithdrawn, checkins' unlockedBalance, users'
 * referralBonusTotal/welcomeBonus), so double-spending during a pending
 * request is still prevented exactly as before. What's NEW is that all
 * of this is now coordinated by one function and reported to admin as
 * ONE withdrawalRequests document with a `breakdown` field, instead of
 * the user submitting up to 4 separate requests across different admin
 * screens.
 *
 * Uses a single Firestore transaction so either everything succeeds
 * together or nothing is deducted at all — no risk of a partial failure
 * leaving money deducted from one pot but not reflected in the combined
 * request record.
 */
export async function requestCombinedWithdrawal({
  userId,
  userName,
  amount,
  bankDetails,
  investments, // [{ id: depositId, withdrawableBalance, lifetimeWithdrawn }, ...]
  referralBonusTotal,
  welcomeBonus,
  checkInBalance,
  checkInLifetimeWithdrawn,
}) {
  if (!amount || amount < MIN_WITHDRAWAL) {
    throw new Error(`Minimum withdrawal is ₦${MIN_WITHDRAWAL.toLocaleString()}.`);
  }

  const { total, breakdown: available } = getCombinedWithdrawableBalance({
    investments,
    referralBonusTotal,
    welcomeBonus,
    checkInBalance,
  });

  if (amount > total) {
    throw new Error(`This exceeds your available balance of ₦${total.toLocaleString()}.`);
  }

  // Determine how much to draw from each pot, in order, without
  // exceeding what's actually available in that pot.
  let remaining = amount;
  const draw = { referral: 0, welcome: 0, checkIn: 0, vipProfit: 0 };

  draw.referral = Math.min(available.referral, remaining);
  remaining -= draw.referral;

  draw.welcome = Math.min(available.welcome, remaining);
  remaining -= draw.welcome;

  draw.checkIn = Math.min(available.checkIn, remaining);
  remaining -= draw.checkIn;

  draw.vipProfit = Math.min(available.vipProfit, remaining);
  remaining -= draw.vipProfit;

  // Spread the vipProfit draw across individual investments, oldest
  // (lowest id sort isn't meaningful — use array order as given, which
  // callers should pass oldest-approved-first for a deterministic,
  // explainable draw order) first, until the vipProfit portion is fully
  // covered.
  const perInvestmentDraws = [];
  let vipRemaining = draw.vipProfit;
  for (const inv of investments) {
    if (vipRemaining <= 0) break;
    const take = Math.min(inv.withdrawableBalance || 0, vipRemaining);
    if (take > 0) {
      perInvestmentDraws.push({ depositId: inv.id, amount: take, newLifetimeWithdrawn: (inv.lifetimeWithdrawn || 0) + take });
      vipRemaining -= take;
    }
  }

  const ref = genRef();

  await runTransaction(db, async (transaction) => {
    // Re-read the user doc inside the transaction for referral/welcome —
    // these two are the only sources also writable elsewhere concurrently
    // (deposits/checkins are keyed per-document per-source already).
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) throw new Error("User not found.");
    const userData = userSnap.data();
    const currentReferral = userData.referralBonusTotal || 0;
    const currentWelcome = userData.welcomeBonus || 0;

    if (draw.referral > currentReferral || draw.welcome > currentWelcome) {
      throw new Error("Your balance changed — please refresh and try again.");
    }

    if (draw.referral > 0 || draw.welcome > 0) {
      transaction.update(userRef, {
        referralBonusTotal: currentReferral - draw.referral,
        welcomeBonus: currentWelcome - draw.welcome,
      });
    }

    if (draw.checkIn > 0) {
      const checkinRef = doc(db, CHECKINS_COLLECTION, userId);
      transaction.update(checkinRef, {
        unlockedBalance: (checkInBalance || 0) - draw.checkIn,
        lifetimeWithdrawn: (checkInLifetimeWithdrawn || 0) + draw.checkIn,
      });
    }

    for (const d of perInvestmentDraws) {
      const depositRef = doc(db, DEPOSITS_COLLECTION, d.depositId);
      transaction.update(depositRef, { lifetimeWithdrawn: d.newLifetimeWithdrawn });
    }

    const requestRef = doc(collection(db, WITHDRAWAL_REQUESTS_COLLECTION));
    transaction.set(requestRef, {
      ref,
      userId,
      userName,
      amount,
      bankDetails,
      breakdown: { ...draw, perInvestmentDraws },
      status: "pending",
      requestedAt: Date.now(),
    });
  });

  await createNotification(userId, "withdrawal", `Withdrawal request for ₦${amount.toLocaleString()} submitted — awaiting processing.`);

  return { ref };
}

/**
 * Fetches all combined withdrawal requests (admin view), newest first.
 */
export async function getAllWithdrawalRequests() {
  const snap = await getDocs(collection(db, WITHDRAWAL_REQUESTS_COLLECTION));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => b.requestedAt - a.requestedAt);
  return list;
}

/**
 * Admin action: mark a combined withdrawal request as paid. This does
 * NOT touch the underlying balance documents — those were already
 * deducted at request time (same pattern as the original per-source
 * withdraw flows), so marking paid is purely a status update reflecting
 * that the admin has sent the money outside the app.
 */
export async function markCombinedWithdrawalPaid(requestId) {
  await updateDoc(doc(db, WITHDRAWAL_REQUESTS_COLLECTION, requestId), {
    status: "paid",
    paidAt: Date.now(),
  });
}

/**
 * Admin action: reject a combined withdrawal request and restore every
 * balance it drew from — reversing exactly the amounts recorded in
 * `breakdown` at request time, so a rejected request always fully
 * refunds the user regardless of what their balance has done since
 * (e.g. new deposits, new bonuses) in the meantime.
 */
export async function rejectCombinedWithdrawal(request) {
  const { userId, breakdown } = request;

  await runTransaction(db, async (transaction) => {
    if (breakdown.referral > 0 || breakdown.welcome > 0) {
      const userRef = doc(db, USERS_COLLECTION, userId);
      const userSnap = await transaction.get(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        transaction.update(userRef, {
          referralBonusTotal: (userData.referralBonusTotal || 0) + breakdown.referral,
          welcomeBonus: (userData.welcomeBonus || 0) + breakdown.welcome,
        });
      }
    }

    if (breakdown.checkIn > 0) {
      const checkinRef = doc(db, CHECKINS_COLLECTION, userId);
      const checkinSnap = await transaction.get(checkinRef);
      if (checkinSnap.exists()) {
        const checkinData = checkinSnap.data();
        transaction.update(checkinRef, {
          unlockedBalance: (checkinData.unlockedBalance || 0) + breakdown.checkIn,
          lifetimeWithdrawn: Math.max(0, (checkinData.lifetimeWithdrawn || 0) - breakdown.checkIn),
        });
      }
    }

    if (breakdown.vipProfit > 0 && breakdown.perInvestmentDraws) {
      for (const d of breakdown.perInvestmentDraws) {
        const depositRef = doc(db, DEPOSITS_COLLECTION, d.depositId);
        const depositSnap = await transaction.get(depositRef);
        if (depositSnap.exists()) {
          const depositData = depositSnap.data();
          transaction.update(depositRef, {
            lifetimeWithdrawn: Math.max(0, (depositData.lifetimeWithdrawn || 0) - d.amount),
          });
        }
      }
    }

    const requestRef = doc(db, WITHDRAWAL_REQUESTS_COLLECTION, request.id);
    transaction.update(requestRef, { status: "rejected", decidedAt: Date.now() });
  });

  await createNotification(userId, "withdrawal", `Your withdrawal request for ₦${request.amount.toLocaleString()} was rejected and refunded to your balance.`);
}
