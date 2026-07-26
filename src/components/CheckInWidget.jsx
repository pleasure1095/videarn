import { useEffect, useState } from "react";
import { C, buttonStyle } from "../styles/theme";
import {
  getCheckInStatus,
  performCheckIn,
  withdrawCheckInBalance,
  CHECKIN_DAILY_REWARD,
  CHECKIN_STREAK_TARGET,
  CHECKIN_MAX_REWARD,
} from "../services/checkins";
import { isWithinWithdrawalHours } from "../utils/paymentInfo";
import { MIN_WITHDRAWAL } from "../utils/earnings";

/**
 * Daily check-in streak widget. Gated to VIP members only (users with at
 * least one ever-approved deposit) — non-VIP users see an explanatory
 * locked state instead of the check-in button, rather than the widget
 * disappearing entirely, so the incentive to become VIP is visible.
 */
export default function CheckInWidget({ userId, isVipMember }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function load() {
    try {
      const s = await getCheckInStatus(userId);
      setStatus(s);
    } catch (e) {
      console.error("Failed to load check-in status:", e);
    }
  }

  useEffect(() => {
    if (isVipMember) load();
  }, [isVipMember]);

  async function handleCheckIn() {
    if (busy || !status || status.checkedInToday) return;
    setBusy(true);
    setErr("");
    try {
      const updated = await performCheckIn(userId);
      setStatus(updated);
    } catch (e) {
      console.error("Check-in failed:", e);
      setErr("Could not check in. Please try again.");
    }
    setBusy(false);
  }

  async function handleWithdraw() {
    setErr("");
    setOk("");
    if (!isWithinWithdrawalHours()) {
      setErr("Withdrawals are available daily between 8:00 AM and 10:00 PM (WAT).");
      return;
    }
    setBusy(true);
    try {
      await withdrawCheckInBalance(userId, status.unlockedBalance, status.unlockedBalance, status.lifetimeWithdrawn);
      setOk(`₦${status.unlockedBalance.toLocaleString()} withdrawal submitted!`);
      await load();
    } catch (e) {
      console.error("Check-in withdrawal failed:", e);
      setErr(e.message || "Could not submit withdrawal.");
    }
    setBusy(false);
  }

  if (!isVipMember) {
    return (
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: `1px dashed ${C.border}`,
          borderRadius: 16,
          padding: "16px 18px",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 18 }}>🔒</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.muted }}>Daily Check-In</span>
        </div>
        <div style={{ fontSize: 12, color: C.dim, fontWeight: 600 }}>
          Available to VIP members — make your first deposit to unlock daily check-in rewards.
        </div>
      </div>
    );
  }

  if (!status) return null;

  const canWithdraw = status.unlockedBalance >= MIN_WITHDRAWAL;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(232,184,75,0.14), rgba(30,58,110,0.3))",
        border: `1px solid ${C.gold}30`,
        borderRadius: 16,
        padding: "16px 18px",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>🔥</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#F3E9DD" }}>
              Day {status.currentStreak} of {CHECKIN_STREAK_TARGET}
            </span>
          </div>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>
            {status.checkedInToday
              ? `Checked in today · ₦${status.pendingReward.toLocaleString()} pending unlock`
              : `Check in daily to earn ₦${CHECKIN_DAILY_REWARD}/day — unlocks ₦${CHECKIN_MAX_REWARD.toLocaleString()} after ${CHECKIN_STREAK_TARGET} days straight`}
          </div>
        </div>
        <button
          style={{ ...buttonStyle(status.checkedInToday ? "ghost" : "gold"), padding: "10px 20px", fontSize: 13 }}
          onClick={handleCheckIn}
          disabled={busy || status.checkedInToday}
        >
          {status.checkedInToday ? "✓ Checked In" : busy ? "…" : "Check In"}
        </button>
      </div>

      {err && <p style={{ fontSize: 11, color: C.red, marginTop: 10, fontWeight: 600 }}>{err}</p>}
      {ok && <p style={{ fontSize: 11, color: C.green, marginTop: 10, fontWeight: 600 }}>{ok}</p>}

      {status.unlockedBalance > 0 && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${C.gold}20`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>
              ₦{status.unlockedBalance.toLocaleString()} unlocked
            </div>
            <button
              style={{ ...buttonStyle(canWithdraw ? "gold" : "ghost"), padding: "8px 16px", fontSize: 12 }}
              onClick={handleWithdraw}
              disabled={busy || !canWithdraw}
            >
              {canWithdraw ? "Withdraw" : `Min ₦${MIN_WITHDRAWAL.toLocaleString()}`}
            </button>
          </div>
          {!canWithdraw && (
            <p style={{ fontSize: 11, color: C.dim, marginTop: 8, fontWeight: 600 }}>
              Complete another {CHECKIN_STREAK_TARGET}-day streak to reach the ₦{MIN_WITHDRAWAL.toLocaleString()}{" "}
              withdrawal minimum.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
