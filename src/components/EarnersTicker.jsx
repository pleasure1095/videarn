import { useEffect, useState } from "react";
import { C } from "../styles/theme";
import { VIP_LIST } from "../utils/vipPlans";

/**
 * Scrolling "recent earners" ticker for social proof / atmosphere.
 *
 * IMPORTANT: this is illustrative placeholder content, not real user data.
 * Wiring this to actual withdrawal/earnings records would expose real
 * users' financial activity (even masked) and needs an explicit product
 * decision, not something to bolt on silently during a polish pass.
 * If real data is ever wanted here, swap PLACEHOLDER_FEED below for a
 * Firestore query — the render logic doesn't need to change.
 */
const PLACEHOLDER_FEED = [
  { phone: "080***4521", amount: 2000 },
  { phone: "081***3310", amount: 5000 },
  { phone: "090***7892", amount: 900 },
  { phone: "070***2214", amount: 1200 },
  { phone: "091***6603", amount: 3500 },
  { phone: "080***9048", amount: 2600 },
  { phone: "081***1177", amount: 900 },
  { phone: "070***5529", amount: 5000 },
];

export default function EarnersTicker() {
  const [visibleIndex, setVisibleIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setVisibleIndex((i) => (i + 1) % PLACEHOLDER_FEED.length);
    }, 2800);
    return () => clearInterval(t);
  }, []);

  const entry = PLACEHOLDER_FEED[visibleIndex];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        borderRadius: 10,
        background: "rgba(46,204,113,0.06)",
        border: `1px solid ${C.emerald}22`,
        marginBottom: 20,
        overflow: "hidden",
      }}
    >
      <span style={{ fontSize: 15 }}>💸</span>
      <div key={visibleIndex} style={{ fontSize: 12.5, color: C.muted, animation: "tickerFade 0.4s ease" }}>
        <strong style={{ color: "#E4F0E7" }}>{entry.phone}</strong> just withdrew{" "}
        <strong style={{ color: C.emerald }}>₦{entry.amount.toLocaleString()}</strong>
      </div>
      <style>{`
        @keyframes tickerFade {
          from { opacity: 0; transform: translateX(6px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
