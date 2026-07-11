import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { C, buttonStyle, cardStyle } from "../styles/theme";
import { VIPS, VIP_LIST } from "../utils/vipPlans";
import { calculateInvestmentEarnings } from "../utils/earnings";
import { isWithinWithdrawalHours } from "../utils/paymentInfo";
import { getUserDeposits } from "../services/deposits";
import PlanCarousel from "../components/PlanCarousel";
import EarnersTicker from "../components/EarnersTicker";
import DepositModal from "../components/DepositModal";
import WithdrawModal from "../components/WithdrawModal";

function chipStyle(color) {
  return {
    display: "inline-block",
    padding: "3px 12px",
    borderRadius: 20,
    background: `${color}22`,
    color,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
  };
}

function fmt(n) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default function DashboardPage() {
  const { user, refreshUser } = useAuth();
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeposit, setShowDeposit] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState(null);
  const [tick, setTick] = useState(0);

  async function load() {
    try {
      const all = await getUserDeposits(user.uid);
      setDeposits(all);
      // Also refresh the user profile — referralBonusTotal can change from
      // an admin approving someone else's deposit (this user acting as the
      // referrer), which this session wouldn't otherwise see until re-login.
      await refreshUser();
    } catch (e) {
      console.error("Failed to load deposits:", e);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Re-render periodically so accruing earnings and the withdrawal-hours
  // window stay live without requiring a manual refresh. `tick` itself
  // isn't used for any value — incrementing it just forces this component
  // to re-run calculateInvestmentEarnings() with a fresh Date.now() below.
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 60000);
    return () => clearInterval(t);
  }, []);
  void tick; // referenced so its purpose is explicit, not silently relied upon

  const approved = deposits.filter((d) => d.status === "approved");
  const pending = deposits.filter((d) => d.status === "pending");
  const rejected = deposits.filter((d) => d.status === "rejected");

  // Enrich each approved deposit with live earnings figures using the
  // shared calculation utility — the single source of truth for the
  // 24h-delay, capital-locked, profit-only-withdrawal rules.
  const investments = approved.map((d) => {
    const plan = VIPS[d.planId] || { label: d.planLabel, daily: d.planDaily, color: C.emerald };
    const calc = calculateInvestmentEarnings(d.planDaily, d.approvedAt, d.lifetimeWithdrawn || 0);
    return { ...d, plan, ...calc };
  });

  const totalInvested = investments.reduce((s, i) => s + i.amount, 0);
  const totalDaily = investments.reduce((s, i) => s + i.plan.daily, 0);
  const totalEarnings = investments.reduce((s, i) => s + i.totalEarnings, 0);
  const totalWithdrawableProfit = investments.reduce((s, i) => s + i.withdrawableBalance, 0);
  const referralBonus = user.referralBonusTotal || 0;

  const withinHours = isWithinWithdrawalHours();

  if (loading) {
    return <div style={{ textAlign: "center", padding: 60, color: C.dim }}>Loading your portfolio…</div>;
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 400, marginBottom: 18, fontFamily: "Georgia,serif" }}>
        Dashboard
      </h2>

      <EarnersTicker />
      <PlanCarousel />

      {pending.length > 0 && (
        <div
          style={{
            background: "rgba(46,204,113,0.08)",
            border: "1px solid rgba(46,204,113,0.3)",
            borderRadius: 12,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <strong style={{ color: C.emerald }}>
            ⏳ {pending.length} deposit{pending.length > 1 ? "s" : ""} pending admin approval
          </strong>
        </div>
      )}
      {rejected.length > 0 && (
        <div
          style={{
            background: "rgba(207,120,120,0.08)",
            border: "1px solid rgba(207,120,120,0.25)",
            borderRadius: 12,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <strong style={{ color: C.red }}>
            ❌ {rejected.length} deposit{rejected.length > 1 ? "s" : ""} rejected
          </strong>
        </div>
      )}

      {/* Summary stat cards */}
      <div
        style={{ marginBottom: 24 }}
        className="stat-grid"
      >
        {[
          { label: "Total Investment", value: `₦${fmt(totalInvested)}`, color: C.emerald },
          { label: "Daily Earnings", value: `₦${fmt(totalDaily)}`, color: C.green },
          { label: "Total Earnings", value: `₦${fmt(totalEarnings)}`, color: C.lime },
          { label: "Referral Bonus", value: `₦${fmt(referralBonus)}`, color: C.forest },
          { label: "Withdrawable Profit", value: `₦${fmt(totalWithdrawableProfit + referralBonus)}`, color: C.emerald },
          { label: "Active VIP Plans", value: investments.length, color: C.green },
        ].map((s, i) => (
          <div key={i} style={{ ...cardStyle, border: `1px solid ${s.color}28`, padding: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.1em", color: C.dim, textTransform: "uppercase", marginBottom: 8 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 300, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ fontSize: 16, fontWeight: 400, fontFamily: "Georgia,serif" }}>My VIP Plans</h3>
        <button style={{ ...buttonStyle("gold"), padding: "9px 18px", fontSize: 13 }} onClick={() => setShowDeposit(true)}>
          + New Deposit
        </button>
      </div>

      {investments.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "50px 20px",
            background: C.surface,
            border: `1px dashed ${C.border}`,
            borderRadius: 14,
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>📈</div>
          <div style={{ fontSize: 15, color: C.dim, marginBottom: 8, fontFamily: "Georgia,serif" }}>No active VIP plans yet</div>
          <div style={{ fontSize: 13, color: "#4A5A50", marginBottom: 18 }}>Make a deposit and wait for admin approval</div>
          <button style={{ ...buttonStyle("gold"), padding: "9px 20px" }} onClick={() => setShowDeposit(true)}>
            Make First Deposit
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
          {investments.map((inv) => (
            <div key={inv.id} style={{ ...cardStyle, border: `1px solid ${inv.plan.color}28` }} className="fade">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={chipStyle(inv.plan.color)}>{inv.plan.label}</span>
                    <span style={chipStyle(C.green)}>ACTIVE</span>
                  </div>
                  <div style={{ fontSize: 12, color: inv.plan.color, fontWeight: 600 }}>
                    ₦{inv.plan.daily.toLocaleString()} daily earnings
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                    Invested ₦{inv.amount.toLocaleString()} (locked) · Approved {fmtDate(inv.approvedAt)}
                  </div>
                  {inv.stillInGracePeriod && (
                    <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>
                      Earnings begin 24h after approval
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 24, fontWeight: 300, color: C.green }}>₦{fmt(inv.withdrawableBalance)}</div>
                  <div style={{ fontSize: 11, color: C.dim }}>withdrawable profit</div>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <button
                  style={{ ...buttonStyle(withinHours && inv.withdrawableBalance > 0 ? "gold" : "ghost"), padding: "9px 20px", fontSize: 13 }}
                  onClick={() => setWithdrawTarget(inv)}
                  disabled={!withinHours || inv.withdrawableBalance <= 0}
                >
                  💰 {withinHours ? "Withdraw Profit" : "Withdraw (8AM–10PM WAT only)"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deposits.length > 0 && (
        <>
          <h3 style={{ fontSize: 15, fontWeight: 400, fontFamily: "Georgia,serif", marginBottom: 14, color: C.muted }}>
            Deposit History
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {deposits.map((d) => {
              const sc = d.status === "approved" ? C.green : d.status === "rejected" ? C.red : C.emerald;
              return (
                <div
                  key={d.id}
                  style={{
                    ...cardStyle,
                    border: `1px solid ${sc}20`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 10,
                    padding: 16,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={chipStyle(sc)}>{d.status.toUpperCase()}</span>
                      <span style={{ fontSize: 11, color: C.dim }}>{d.ref}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(d.submittedAt)}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 300, color: sc }}>₦{d.amount.toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showDeposit && <DepositModal user={user} onClose={() => setShowDeposit(false)} onDone={load} />}
      {withdrawTarget && (
        <WithdrawModal investment={withdrawTarget} userId={user.uid} onClose={() => setWithdrawTarget(null)} onDone={load} />
      )}
    </div>
  );
}
