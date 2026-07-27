import { useEffect, useState } from "react";
import { C, buttonStyle } from "../styles/theme";
import { getReviewStatus, rateProduct } from "../services/reviews";

function StarRow({ productId, currentRating, onRate, disabled }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => !disabled && onRate(productId, n)}
          disabled={disabled}
          style={{
            background: "none",
            border: "none",
            cursor: disabled ? "default" : "pointer",
            fontSize: 20,
            padding: 2,
            minHeight: "auto",
            color: n <= (currentRating || 0) ? C.crimson : "rgba(255,255,255,0.2)",
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/**
 * VIP-gated daily product-rating widget. Rating ALL of today's featured
 * products unlocks that day's VIP earnings entirely — a confirmed,
 * intentional design where missing the rating means ₦0 earned that day,
 * permanently (no partial credit, no catch-up).
 */
export default function DailyReviewsWidget({ userId, isVipMember }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isVipMember) return;
    getReviewStatus(userId).then(setStatus).catch((e) => console.error("Failed to load review status:", e));
  }, [isVipMember, userId]);

  async function handleRate(productId, stars) {
    setBusy(true);
    try {
      const result = await rateProduct(userId, productId, stars);
      setStatus((prev) => ({ ...prev, ...result }));
    } catch (e) {
      console.error("Failed to submit rating:", e);
    }
    setBusy(false);
  }

  if (!isVipMember || !status) return null;

  const ratedCount = Object.keys(status.todaysRatings).length;
  const totalCount = status.todaysProducts.length;
  const allRatedToday = ratedCount === totalCount;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(184,40,61,0.16), rgba(16,12,13,0.5))",
        border: `1px solid ${C.crimson}30`,
        borderRadius: 16,
        padding: "16px 18px",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 18 }}>⭐</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#F3E9DD" }}>Daily Reviews</span>
      </div>
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 14 }}>
        {allRatedToday
          ? "All rated — today's earnings are unlocked ✓"
          : `Rate all ${totalCount} products today to unlock today's VIP earnings (${ratedCount}/${totalCount} done)`}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {status.todaysProducts.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "10px 12px",
              background: "rgba(255,255,255,0.03)",
              borderRadius: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ fontSize: 18 }}>{p.emoji}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#F3E9DD" }}>{p.name}</div>
                <div style={{ fontSize: 10, color: C.dim }}>{p.category}</div>
              </div>
            </div>
            <StarRow
              productId={p.id}
              currentRating={status.todaysRatings[p.id]}
              onRate={handleRate}
              disabled={busy || status.todaysRatings[p.id] != null}
            />
          </div>
        ))}
      </div>

      {!allRatedToday && (
        <p style={{ fontSize: 11, color: C.dim, marginTop: 12, fontWeight: 600 }}>
          Unrated days earn ₦0 for that day — this can't be made up later.
        </p>
      )}
    </div>
  );
}
