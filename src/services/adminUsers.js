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

/**
 * Credits a ONE-TIME referral bonus when a referred user's FIRST VIP
 * deposit is approved. Uses a Firestore transaction to atomically check
 * and set the referred user's firstVipRewarded flag — this closes a race
 * condition where two near-simultaneous approve actions (e.g. an admin
 * double-tapping Approve, or two admin sessions approving the same
 * deposit) could both read firstVipRewarded as false before either write
 * completes, resulting in the referrer being paid twice.
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
  const referrer = findUserByReferralCode(allUsers, referrerCode);
  if (!referrer) return { credited: false, reason: "Referrer not found." };

  // Step 2: credit the referrer's bonus. This second write is not part of
  // the same transaction as step 1 (Firestore transactions work best when
  // reads/writes are on documents known up front), but the critical
  // double-payment guard is the atomic claim above — by the time we reach
  // here, only one caller can ever have referrerCode in hand for this user.
  const referrerRef = doc(db, USERS_COLLECTION, referrer.uid);
  await runTransaction(db, async (transaction) => {
    const referrerSnap = await transaction.get(referrerRef);
    const currentBonus = referrerSnap.exists() ? referrerSnap.data().referralBonusTotal || 0 : 0;
    transaction.update(referrerRef, { referralBonusTotal: currentBonus + planDaily });
  });

  return { credited: true, referrer, bonus: planDaily };
}
