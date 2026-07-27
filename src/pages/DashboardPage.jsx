import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { C, buttonStyle, cardStyle } from "../styles/theme";
import { VIPS, VIP_LIST } from "../utils/vipPlans";
import { calculateInvestmentEarnings, getDaysEarning } from "../utils/earnings";
import { isWithinWithdrawalHours, WHATSAPP_GROUP_LINK } from "../utils/paymentInfo";
import { getUserDeposits } from "../services/deposits";
import { getReviewStatus, countReviewedEarningDays } from "../services/reviews";
import { getCheckInStatus } from "../services/checkins";
import PlanCarousel from "../components/PlanCarousel";
import EarnersTicker from "../components/EarnersTicker";
import CheckInWidget from "../components/CheckInWidget";
import DailyReviewsWidget from "../components/DailyReviewsWidget";
import PromoBanner from "../components/PromoBanner";
import ActionGrid from "../components/ActionGrid";
import ActivityFeed from "../components/ActivityFeed";
import WelcomeBanner from "../components/WelcomeBanner";
import DepositModal from "../components/DepositModal";
import WithdrawModal from "../components/WithdrawModal";
import BonusWithdrawModal from "../components/BonusWithdrawModal";
import { getActivityFeed } from "../services/activityFeed";

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
  const [activityEvents, setActivityEvents] = useState([]);
  const [completedReviewDays, setCompletedReviewDays] = useState([]);
  const [checkInBalance, setCheckInBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showDeposit, setShowDeposit] = useState(false);
  const [preselectedPlanId, setPreselectedPlanId] = useState(null);
  const [withdrawTarget, setWithdrawTarget] = useState(null);
  const [showBonusWithdraw, setShowBonusWithdraw] = useState(false);
  const [statScrollPaused, setStatScrollPaused] = useState(false);
  const [tick, setTick] = useState(0);

  async function load() {
    try {
      const all = await getUserDeposits(user.uid);
      setDeposits(all);
      // Reuses the deposits we just fetched rather than querying twice.
      const events = await getActivityFeed(user.uid, all);
      setActivityEvents(events);
      const reviewStatus = await getReviewStatus(user.uid);
      setCompletedReviewDays(reviewStatus.completedDays);
      // Check-in balance lives in its own Firestore collection, separate
      // from VIP investments/bonuses — without fetching it here, the
      // Dashboard's top-level "Withdrawable Profit" stat card would stay
      // blind to check-in earnings entirely (CheckInWidget shows its own
      // balance correctly, but the summary cards never knew about it).
      const checkInStatus = await getCheckInStatus(user.uid);
      setCheckInBalance(checkInStatus.unlockedBalance || 0);
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

  // VIP membership for check-in eligibility: having at least one deposit
  // that was EVER approved, regardless of whether that specific investment
  // is still active, fully withdrawn, or otherwise — membership, once
  // earned, doesn't expire.
  const isVipMember = approved.length > 0;

  // "Migrate" suggests the next tier above the user's current highest
  // active plan, since GADJIZ plans don't expire (unlike the reference
  // design's 30-day cycles) — this is just a friendlier entry point into
  // the same deposit flow as a fresh deposit, defaulting to an upgrade
  // rather than starting back at VIP 1.
  function openMigrate() {
    const ownedPlanIds = new Set(deposits.filter((d) => d.status === "approved" || d.status === "pending").map((d) => d.planId));
    const nextTier = VIP_LIST.find((p) => !ownedPlanIds.has(p.id));
    setPreselectedPlanId(nextTier ? nextTier.id : VIP_LIST[VIP_LIST.length - 1].id);
    setShowDeposit(true);
  }

  function openNewDeposit() {
    setPreselectedPlanId(null);
    setShowDeposit(true);
  }

  // Picks the investment with the largest withdrawable balance as the
  // default target when withdrawing via the quick-action grid (which,
  // unlike the per-investment withdraw button, has no specific investment
  // context of its own). If nothing is withdrawable yet, this is a no-op —
  // there's nothing sensible to open.
  function openQuickWithdraw() {
    const best = [...investments].sort((a, b) => b.withdrawableBalance - a.withdrawableBalance)[0];
    if (best && best.withdrawableBalance > 0) setWithdrawTarget(best);
  }

  function openSupport() {
    // Points to the community WhatsApp GROUP (same link used in
    // WelcomeModal/WelcomeBanner), not a 1:1 chat with a specific number
    // — per the site owner's request that Support lead directly to the
    // group rather than a personal DM.
    window.open(WHATSAPP_GROUP_LINK, "_blank", "noopener,noreferrer");
  }

  // Enrich each approved deposit with live earnings figures using the
  // shared calculation utility — the single source of truth for the
  // 24h-delay, capital-locked, profit-only-withdrawal, and daily-review
  // gate rules. Computing this needs two passes: first getDaysEarning() to
  // know how many earning-days have elapsed, then countReviewedEarningDays()
  // to see how many of those specific days the user fully completed their
  // product reviews, before calculateInvestmentEarnings() can determine
  // how much is actually available (unreviewed days earn ₦0, permanently).
  const investments = approved.map((d) => {
    const plan = VIPS[d.planId] || { label: d.planLabel, daily: d.planDaily, color: C.emerald };
    const daysEarningSoFar = getDaysEarning(d.approvedAt);
    const reviewedDayCount = countReviewedEarningDays(d.approvedAt, daysEarningSoFar, completedReviewDays);
    const calc = calculateInvestmentEarnings(d.planDaily, d.approvedAt, d.lifetimeWithdrawn || 0, reviewedDayCount);
    return { ...d, plan, ...calc };
  });

  const totalInvested = investments.reduce((s, i) => s + i.amount, 0);
  const totalDaily = investments.reduce((s, i) => s + i.plan.daily, 0);
  const totalAvailableEarnings = investments.reduce((s, i) => s + i.availableEarnings, 0);
  const totalWithdrawableProfit = investments.reduce((s, i) => s + i.withdrawableBalance, 0);
  const totalMissedEarnings = investments.reduce((s, i) => s + i.missedEarnings, 0);
  const referralBonus = user.referralBonusTotal || 0;
  const welcomeBonus = user.welcomeBonus || 0;

  const withinHours = isWithinWithdrawalHours();

  if (loading) {
    return <div style={{ textAlign: "center", padding: 60, color: C.dim }}>Loading your portfolio…</div>;
  }

  return (
    <div>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 800,
          marginBottom: 18,
          color: "#F9F1E7",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: C.techGlow,
            boxShadow: `0 0 8px ${C.techGlow}`,
            display: "inline-block",
          }}
        />
        Dashboard
      </h2>

      <WelcomeBanner />

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

      {/* Balance & bonus overview — 4 "major" figures get real visual
          weight up top (Total Earnings, Withdrawable Profit, Welcome
          Bonus, Referral Bonus), then ALL 8 stats (majors + the rest)
          flow together in a single auto-scrolling row below. No swipe
          needed — the row scrolls itself continuously and loops, so a
          narrow phone screen doesn't collapse everything into one long
          column. The full data array is defined once and reused by both
          rows so the two views can never drift out of sync with each
          other. */}
      {(() => {
        const allStats = [
          { key: "totalInvestment", label: "Total Investment", value: `₦${fmt(totalInvested)}`, color: C.emerald },
          { key: "dailyEarnings", label: "Daily Earnings", value: `₦${fmt(totalDaily)}`, color: C.green },
          { key: "totalEarnings", label: "Total Earnings", value: `₦${fmt(totalAvailableEarnings + checkInBalance)}`, color: C.lime },
          { key: "missed", label: "Missed (Unreviewed)", value: `₦${fmt(totalMissedEarnings)}`, color: C.dim },
          { key: "referralBonus", label: "Referral Bonus", value: `₦${fmt(referralBonus)}`, color: C.forest },
          { key: "welcomeBonus", label: "Welcome Bonus", value: `₦${fmt(welcomeBonus)}`, color: "#D4506A" },
          { key: "withdrawable", label: "Withdrawable Profit", value: `₦${fmt(totalWithdrawableProfit + referralBonus + welcomeBonus + checkInBalance)}`, color: C.emerald },
          { key: "activePlans", label: "Active VIP Plans", value: investments.length, color: C.green },
        ];
        const majorKeys = new Set(["totalEarnings", "withdrawable", "welcomeBonus", "referralBonus"]);
        const majorStats = allStats.filter((s) => majorKeys.has(s.key));
        // Duplicated once so the CSS scroll-loop animation can slide from
        // 0% to -50% and land back exactly where it started, giving a
        // seamless infinite loop instead of a visible jump/reset.
        const loopStats = [...allStats, ...allStats];

        return (
          <>
            <div className="major-stat-grid" style={{ marginBottom: 16 }}>
              {majorStats.map((s) => (
                <div key={s.key} style={{ ...cardStyle, border: `1px solid ${s.color}35`, padding: 18 }}>
                  <div style={{ fontSize: 10.5, letterSpacing: "0.1em", color: C.dim, textTransform: "uppercase", marginBottom: 8, fontWeight: 700 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 23, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
              <button
                onClick={() => setStatScrollPaused((p) => !p)}
                style={{
                  background: "none",
                  border: "none",
                  color: C.dim,
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: "2px 6px",
                  minHeight: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {statScrollPaused ? "▶ Resume scroll" : "⏸ Pause scroll"}
              </button>
            </div>
            <div className="stat-scroll-viewport" style={{ marginBottom: 24 }}>
              <div className={`stat-scroll-track${statScrollPaused ? " stat-scroll-paused" : ""}`}>
                {loopStats.map((s, i) => (
                  <div key={`${s.key}-${i}`} className="stat-scroll-card" style={{ border: `1px solid ${s.color}28` }}>
                    <div style={{ fontSize: 9.5, letterSpacing: "0.08em", color: C.dim, textTransform: "uppercase", marginBottom: 6, whiteSpace: "nowrap" }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: s.color, whiteSpace: "nowrap" }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      })()}

      {(referralBonus + welcomeBonus) > 0 && (
        <div
          style={{
            ...cardStyle,
            border: `1px solid ${C.crimson}28`,
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, marginBottom: 2 }}>
              Referral + Welcome Bonus (not tied to any VIP plan)
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.crimson }}>
              ₦{fmt(referralBonus + welcomeBonus)}
            </div>
          </div>
          <button
            style={{ ...buttonStyle(withinHours && (referralBonus + welcomeBonus) > 0 ? "gold" : "ghost"), padding: "9px 20px", fontSize: 13 }}
            onClick={() => setShowBonusWithdraw(true)}
            disabled={!withinHours}
          >
            💰 {withinHours ? "Withdraw Bonus" : "Withdraw (8AM–10PM WAT only)"}
          </button>
        </div>
      )}

      <PromoBanner />
      <ActionGrid
        onDeposit={openNewDeposit}
        onMigrate={openMigrate}
        onWithdraw={openQuickWithdraw}
        onSupport={openSupport}
      />
      <ActivityFeed events={activityEvents} />
      <CheckInWidget userId={user.uid} isVipMember={isVipMember} />
      <DailyReviewsWidget userId={user.uid} isVipMember={isVipMember} />
      <EarnersTicker />
      <PlanCarousel />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: "#F9F1E7" }}>My VIP Plans</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {investments.length > 0 && (
            <button style={{ ...buttonStyle("ghost"), padding: "9px 18px", fontSize: 13 }} onClick={openMigrate}>
              ⇧ Migrate
            </button>
          )}
          <button style={{ ...buttonStyle("gold"), padding: "9px 18px", fontSize: 13 }} onClick={openNewDeposit}>
            + New Deposit
          </button>
        </div>
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
          <div style={{ fontSize: 15, color: C.dim, marginBottom: 8 }}>No active VIP plans yet</div>
          <div style={{ fontSize: 13, color: "#4A5A50", marginBottom: 18 }}>Make a deposit and wait for admin approval</div>
          <button style={{ ...buttonStyle("gold"), padding: "9px 20px" }} onClick={openNewDeposit}>
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
                    Invested ₦{(inv.amount || 0).toLocaleString()} (locked) · Approved {fmtDate(inv.approvedAt)}
                  </div>
                  {inv.stillInGracePeriod && (
                    <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>
                      Earnings begin 24h after approval
                    </div>
                  )}
                  {inv.missedEarnings > 0 && (
                    <div style={{ fontSize: 11, color: C.dim, marginTop: 4, fontWeight: 600 }}>
                      ₦{fmt(inv.missedEarnings)} missed on unreviewed days
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: C.green }}>₦{fmt(inv.withdrawableBalance)}</div>
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
          <h3 style={{ fontSize: 15, fontWeight: 800, color: C.muted, marginBottom: 14 }}>
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
                  <div style={{ fontSize: 18, fontWeight: 800, color: sc }}>₦{(d.amount || 0).toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showDeposit && (
        <DepositModal
          user={user}
          initialPlanId={preselectedPlanId}
          onClose={() => {
            setShowDeposit(false);
            setPreselectedPlanId(null);
          }}
          onDone={load}
        />
      )}
      {withdrawTarget && (
        <WithdrawModal investment={withdrawTarget} userId={user.uid} savedBankDetails={user.savedBankDetails} onClose={() => setWithdrawTarget(null)} onDone={load} />
      )}
      {showBonusWithdraw && (
        <BonusWithdrawModal
          userId={user.uid}
          availableBalance={referralBonus + welcomeBonus}
          onClose={() => setShowBonusWithdraw(false)}
          onDone={load}
        />
      )}
    </div>
  );
}
