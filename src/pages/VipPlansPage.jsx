import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { C, buttonStyle, cardStyle } from "../styles/theme";
import { VIP_LIST } from "../utils/vipPlans";
import DepositModal from "../components/DepositModal";

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

export default function VipPlansPage({ onJoined }) {
  const { user } = useAuth();
  const [showDeposit, setShowDeposit] = useState(false);
  const [preselectedPlan, setPreselectedPlan] = useState(null);

  function joinPlan(planId) {
    setPreselectedPlan(planId);
    setShowDeposit(true);
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 400, marginBottom: 8, fontFamily: "Georgia,serif" }}>
        VIP Plans
      </h2>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 22 }}>
        Earnings begin 24 hours after admin approval. Only profit is ever withdrawable — capital
        stays invested. Pay via OPay transfer.
      </p>

      <div className="plan-grid">
        {VIP_LIST.map((p) => (
          <div
            key={p.id}
            style={{
              ...cardStyle,
              border: `1px solid ${p.color}30`,
              background: `linear-gradient(160deg, ${p.color}0c, rgba(255,255,255,0.02))`,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: 18,
            }}
          >
            <div style={chipStyle(p.color)}>{p.label}</div>
            <div style={{ fontSize: 22, fontWeight: 300, color: "#E4F0E7" }}>₦{p.amount.toLocaleString()}</div>
            <div
              style={{
                background: `${p.color}18`,
                border: `1px solid ${p.color}30`,
                borderRadius: 10,
                padding: 12,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, color: p.color }}>₦{p.daily.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: C.muted }}>daily earnings</div>
            </div>
            <div style={{ fontSize: 11, color: C.dim }}>✓ Earnings start 24h after approval</div>
            <div style={{ fontSize: 11, color: C.dim }}>✓ Withdraw profit daily, 8AM–10PM (WAT)</div>
            <button style={{ ...buttonStyle("gold"), fontSize: 12, padding: "10px 14px" }} onClick={() => joinPlan(p.id)}>
              Join Now
            </button>
          </div>
        ))}
      </div>

      {showDeposit && (
        <DepositModal
          user={user}
          initialPlanId={preselectedPlan}
          onClose={() => setShowDeposit(false)}
          onDone={() => onJoined && onJoined()}
        />
      )}
    </div>
  );
}
