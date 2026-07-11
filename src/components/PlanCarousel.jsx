import { useEffect, useState } from "react";
import { C } from "../styles/theme";
import { VIP_LIST } from "../utils/vipPlans";

/**
 * Auto-rotating banner showcasing each VIP plan in turn. Purely
 * presentational — reads from the shared VIP_LIST constants, doesn't
 * touch user data, deposits, or earnings logic at all.
 *
 * Advances every 3.5s, pauses on hover/touch so it doesn't fight someone
 * trying to read a specific plan's numbers.
 */
export default function PlanCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % VIP_LIST.length);
    }, 3500);
    return () => clearInterval(t);
  }, [paused]);

  const plan = VIP_LIST[index];

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      style={{
        position: "relative",
        borderRadius: 16,
        padding: "20px 22px",
        marginBottom: 20,
        overflow: "hidden",
        border: `1px solid ${plan.color}35`,
        background: `linear-gradient(135deg, ${plan.color}14, rgba(255,255,255,0.02))`,
        transition: "border-color 0.5s ease, background 0.5s ease",
      }}
    >
      <div
        key={plan.id}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 14,
          animation: "planFadeIn 0.5s ease",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-block",
              padding: "3px 12px",
              borderRadius: 20,
              background: `${plan.color}22`,
              color: plan.color,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            {plan.label}
          </div>
          <div style={{ fontSize: 13, color: C.muted }}>
            Invest <strong style={{ color: "#E4F0E7" }}>₦{plan.amount.toLocaleString()}</strong> · Earn{" "}
            <strong style={{ color: plan.color }}>₦{plan.daily.toLocaleString()}/day</strong>
          </div>
        </div>
        <div style={{ fontSize: 24, fontWeight: 300, color: plan.color, whiteSpace: "nowrap" }}>
          ₦{plan.daily.toLocaleString()}
          <span style={{ fontSize: 11, color: C.dim, fontWeight: 400 }}> /day</span>
        </div>
      </div>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: 5, marginTop: 14 }}>
        {VIP_LIST.map((p, i) => (
          <div
            key={p.id}
            style={{
              height: 3,
              flex: 1,
              borderRadius: 2,
              background: i === index ? plan.color : "rgba(255,255,255,0.1)",
              transition: "background 0.3s ease",
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes planFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
