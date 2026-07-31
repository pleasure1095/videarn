import { collection, getDocs, doc, updateDoc, getDoc, runTransaction, query, where, orderBy } from "firebase/firestore";
import { db } from "./firebase";

const USERS_COLLECTION = "users";

/**
 * Fetches all user profiles, newest first. Fine for now given expected
 * user volumes; if the user base grows large, this should be paginated
 * (Firestore startAfter/limit) rather than loading everything at once.
 */
export async function listAllUsers() {
  const q = query(collection(db, USERS_COLLECTION), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

/**
 * Promotes or demotes a user's role. Only callable successfully by an
 * existing admin — Firestore security rules are the real enforcement here;
 * this function just makes the intent explicit and reusable across the UI.
 */
export async function setUserRole(uid, role) {
  if (role !== "user" && role !== "admin") {
    throw new Error('Role must be "user" or "admin".');
  }
  await updateDoc(doc(db, USERS_COLLECTION, uid), { role });
}

/**
 * Finds a single user document by uid. Used during deposit approval to
 * check referral status.
 */
export async function getUserByUid(uid) {
  const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

function findUserByReferralCode(users, code) {
  return users.find((u) => u.referralCode === code) || null;
}

const LEVEL_1_REFERRAL_PERCENT = 0.09; // direct referrer
const LEVEL_2_REFERRAL_PERCENT = 0.02; // referrer's own referrer ("referral of the referred")

/**
 * Credits a ONE-TIME two-level referral bonus when a referred user's
 * FIRST VIP deposit is approved:
 *   - Level 1 (the direct referrer): 9% of the referred user's planDaily
 *   - Level 2 (that referrer's own referrer, if any): 2% of planDaily
 * CHANGED (per site owner request): previously a flat bonus equal to
 * 100% of planDaily, paid to the direct referrer only. Replaced entirely
 * — there is no flat-bonus fallback.
 *
 * Uses a Firestore transaction to atomically check and set the referred
 * user's firstVipRewarded flag — this closes a race condition where two
 * near-simultaneous approve actions (e.g. an admin double-tapping
 * Approve, or two admin sessions approving the same deposit) could both
 * read firstVipRewarded as false before either write completes, resulting
 * in referrers being paid twice.
 *
 * Called from the deposit approval flow, after a deposit's status is set
 * to "approved" — not before, so we never credit a bonus for a deposit
 * that turns out to fail approval.
 */
export async function creditReferralBonusIfEligible(depositUserId, planDaily) {
  const depositUserRef = doc(db, USERS_COLLECTION, depositUserId);

  // Step 1: atomically claim the "first VIP reward" slot for this user.
  // If another concurrent call already claimed it, this transaction
  // detects that and bails out before any bonus is credited.
  let referrerCode = null;
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(depositUserRef);
      if (!snap.exists()) throw new Error("User not found.");
      const data = snap.data();
      if (data.firstVipRewarded) throw new Error("ALREADY_REWARDED");
      referrerCode = data.referrerCode || null;
      transaction.update(depositUserRef, { firstVipRewarded: true });
    });
  } catch (e) {
    if (e.message === "ALREADY_REWARDED") return { credited: false, reason: "Already rewarded." };
    throw e;
  }

  if (!referrerCode) return { credited: false, reason: "No referrer." };

  const allUsers = await listAllUsers();
  const level1Referrer = findUserByReferralCode(allUsers, referrerCode);
  if (!level1Referrer) return { credited: false, reason: "Referrer not found." };

  // Level 2: the direct referrer's OWN referrer, one hop further up the
  // same referrerCode chain. May not exist (level1Referrer might have
  // joined with no referrer of their own) — that's fine, level 2 simply
  // doesn't get paid in that case.
  const level2Referrer = level1Referrer.referrerCode
    ? findUserByReferralCode(allUsers, level1Referrer.referrerCode)
    : null;

  const level1Bonus = Math.round(planDaily * LEVEL_1_REFERRAL_PERCENT);
  const level2Bonus = Math.round(planDaily * LEVEL_2_REFERRAL_PERCENT);

  // Step 2: credit each referrer's bonus. These writes aren't part of the
  // same transaction as step 1 (Firestore transactions work best when
  // reads/writes are on documents known up front), but the critical
  // double-payment guard is the atomic claim above — by the time we reach
  // here, only one caller can ever have referrerCode in hand for this user.
  const level1Ref = doc(db, USERS_COLLECTION, level1Referrer.uid);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(level1Ref);
    const currentBonus = snap.exists() ? snap.data().referralBonusTotal || 0 : 0;
    transaction.update(level1Ref, { referralBonusTotal: currentBonus + level1Bonus });
  });

  if (level2Referrer) {
    const level2Ref = doc(db, USERS_COLLECTION, level2Referrer.uid);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(level2Ref);
      const currentBonus = snap.exists() ? snap.data().referralBonusTotal || 0 : 0;
      transaction.update(level2Ref, { referralBonusTotal: currentBonus + level2Bonus });
    });
  }

  return {
    credited: true,
    referrer: level1Referrer,
    bonus: level1Bonus,
    level2Referrer: level2Referrer || null,
    level2Bonus: level2Referrer ? level2Bonus : 0,
  };
}

/**
 * Withdraws from a user's combined bonus balance (referralBonusTotal +
 * welcomeBonus). This is separate from the per-investment withdrawal path
 * in services/deposits.js because bonus money isn't tied to any specific
 * VIP deposit — it lives directly on the user profile. Uses a transaction
 * so the balance check and decrement happen atomically, closing the same
 * class of race condition as creditReferralBonusIfEligible (e.g. rapid
 * double-tapping the withdraw button).
 *
 * Deducts from referralBonusTotal first, then welcomeBonus, for any
 * amount that doesn't fit in referralBonusTotal alone — the split doesn't
 * matter functionally since both are pooled into one withdrawable total
 * anywhere they're displayed, this just picks a consistent order.
 */
export async function withdrawBonusBalance(uid, amount) {
  const userRef = doc(db, USERS_COLLECTION, uid);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) throw new Error("User not found.");
    const data = snap.data();
    const referralBonusTotal = data.referralBonusTotal || 0;
    const welcomeBonus = data.welcomeBonus || 0;
    const totalAvailable = referralBonusTotal + welcomeBonus;

    if (amount > totalAvailable) {
      throw new Error(`This exceeds your available bonus balance of ₦${totalAvailable.toLocaleString()}.`);
    }

    const fromReferral = Math.min(referralBonusTotal, amount);
    const fromWelcome = amount - fromReferral;

    transaction.update(userRef, {
      referralBonusTotal: referralBonusTotal - fromReferral,
      welcomeBonus: welcomeBonus - fromWelcome,
    });
  });
}
