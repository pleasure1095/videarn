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
        background: "linear-gradient(135deg, rgba(196,56,82,0.2), rgba(29,23,25,0.5))",
        border: `1px solid ${C.crimson}30`,
        borderRadius: 16,
        padding: "16px 18px",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 18 }}>⭐</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#F9F1E7" }}>Daily Reviews</span>
      </div>
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 14 }}>
        {allRatedToday
          ? "All rated — today's earnings are unlocked ✓"
          : `Rate all ${totalCount} products today to unlock today's VIP earnings (${ratedCount}/${totalCount} done)`}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {status.todaysProducts.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: 12,
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <img
                src={p.image}
                alt={p.name}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 10,
                  objectFit: "cover",
                  flexShrink: 0,
                  background: "rgba(255,255,255,0.05)",
                }}
                onError={(e) => {
                  // Falls back to the emoji placeholder if a hotlinked
                  // photo URL ever goes stale — keeps the card usable
                  // instead of showing a broken image icon.
                  e.target.style.display = "none";
                  e.target.nextSibling.style.display = "flex";
                }}
              />
              <div
                style={{
                  display: "none",
                  width: 64,
                  height: 64,
                  borderRadius: 10,
                  flexShrink: 0,
                  background: "rgba(255,255,255,0.05)",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                }}
              >
                {p.emoji}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#F9F1E7" }}>{p.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.crimson, whiteSpace: "nowrap" }}>
                    ₦{p.price.toLocaleString()}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: C.dim, marginBottom: 4 }}>{p.category}</div>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{p.description}</div>
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
