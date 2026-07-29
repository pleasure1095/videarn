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

function formatCooldownRemaining(cooldownEndsAt) {
  const msLeft = cooldownEndsAt - Date.now();
  if (msLeft <= 0) return null;
  const hours = Math.floor(msLeft / (60 * 60 * 1000));
  const minutes = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * VIP-gated daily product-rating widget. Rating ALL of today's featured
 * products unlocks that day's VIP earnings entirely — a confirmed,
 * intentional design where missing the rating means ₦0 earned that day,
 * permanently (no partial credit, no catch-up).
 *
 * 24H ROLLING RATING COOLDOWN: once a user completes a full day's set
 * (rates all featured products), they're locked out from rating again
 * for a full 24 hours from that completion — NOT tied to the WAT
 * calendar day boundary. The featured PRODUCTS shown still rotate at
 * WAT midnight same as before (unchanged, since earnings math depends
 * on that), so a user can see a new day's products appear before their
 * personal 24h cooldown has actually expired — in that case they'll see
 * the new products but the star buttons stay disabled with a countdown
 * until they're eligible to rate again.
 *
 * `onEarningsUnlocked` (optional) fires the moment a review day
 * COMPLETES (not on every individual star click) — this lets
 * DashboardPage.jsx immediately refresh its earnings stat cards, so the
 * unlocked amount shows up right away instead of only appearing after a
 * manual page reload.
 */
export default function DailyReviewsWidget({ userId, isVipMember, onEarningsUnlocked }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!isVipMember) return;
    getReviewStatus(userId).then(setStatus).catch((e) => console.error("Failed to load review status:", e));
  }, [isVipMember, userId]);

  // Re-render once a minute while a cooldown is active, so the "time
  // remaining" text stays roughly accurate without needing a manual
  // refresh, and so the widget correctly unlocks itself the moment the
  // cooldown actually expires rather than staying stuck disabled until
  // the next full page load.
  useEffect(() => {
    if (!status?.cooldownActive) return;
    const t = setInterval(() => forceTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, [status?.cooldownActive]);

  async function handleRate(productId, stars) {
    setBusy(true);
    setErr("");
    try {
      const wasAlreadyComplete = status.completedDays.includes(status.today);
      const result = await rateProduct(userId, productId, stars);
      setStatus((prev) => ({ ...prev, ...result }));

      // Only refresh the Dashboard's earnings figures at the exact moment
      // a day transitions from incomplete to complete — not on every
      // single star click leading up to it, since earnings are all-or-
      // nothing per day and nothing changes for the Dashboard until the
      // last product of the day is rated.
      const justCompleted = result.allRatedToday && !wasAlreadyComplete;
      if (justCompleted && onEarningsUnlocked) {
        onEarningsUnlocked();
      }
    } catch (e) {
      console.error("Failed to submit rating:", e);
      setErr(e.message || "Could not submit rating. Please try again.");
    }
    setBusy(false);
  }

  if (!isVipMember || !status) return null;

  const ratedCount = Object.keys(status.todaysRatings).length;
  const totalCount = status.todaysProducts.length;
  const allRatedToday = ratedCount === totalCount;
  // Re-derive live rather than trusting a possibly-stale cooldownActive
  // flag from the last fetch — cooldownEndsAt is a fixed timestamp, so
  // comparing it against Date.now() on every render (including the
  // once-a-minute forced re-renders above) keeps this accurate without
  // needing a fresh Firestore read just to notice the cooldown expired.
  const cooldownActive = status.cooldownEndsAt != null && Date.now() < status.cooldownEndsAt;
  const cooldownRemaining = cooldownActive ? formatCooldownRemaining(status.cooldownEndsAt) : null;

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
        {cooldownActive
          ? `You can rate again in ${cooldownRemaining}`
          : allRatedToday
          ? "All rated — today's earnings are unlocked ✓"
          : `Rate all ${totalCount} products today to unlock today's VIP earnings (${ratedCount}/${totalCount} done)`}
      </div>
      {err && <p style={{ fontSize: 11, color: C.red, marginBottom: 12, fontWeight: 600 }}>{err}</p>}

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
              opacity: cooldownActive ? 0.6 : 1,
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
              disabled={busy || cooldownActive || status.todaysRatings[p.id] != null}
            />
          </div>
        ))}
      </div>

      {!allRatedToday && !cooldownActive && (
        <p style={{ fontSize: 11, color: C.dim, marginTop: 12, fontWeight: 600 }}>
          Unrated days earn ₦0 for that day — this can't be made up later.
        </p>
      )}
    </div>
  );
}
