// Crimson & Cream premium theme, restyled per the site owner's rebrand
// request. Business logic (VIP plans, earnings rules, withdrawal limits)
// is entirely unaffected by this file — this is visual tokens only.
//
// Lightened further in this pass — the previous nudge (charcoal
// #181214 -> #211A1D) wasn't enough; the site owner called the whole
// app "dull" across backgrounds, cards, AND text, not just one screen.
// This raises contrast throughout: a lighter base background, more
// visible card surfaces, and brighter muted/dim text tones so secondary
// text is actually readable rather than blending into the background.
// More white/cream now shows through card gradients and borders too.
export const C = {
  charcoal: "#2A2225",
  charcoalDeep: "#1D1719",
  crimson: "#C43852",
  crimsonDeep: "#9C2438",
  cream: "#F9F1E7",
  creamDeep: "#EDE0CC",
  green: "#46CE7C",
  red: "#E87A70",
  bg: "#1D1719",
  surface: "rgba(255,255,255,0.09)",
  border: "rgba(249,241,231,0.16)",
  muted: "#E4D6C9",
  dim: "#B5A79C",
  // Subtle tech accent for the "gadget hub" feel on the Dashboard header
  // only — kept separate from the crimson brand palette rather than
  // replacing it, so the rest of the app (auth, admin, forms) is
  // untouched and the accent reads as a deliberate, contained detail.
  techGlow: "#5AD1E0",
  // Aliases kept so existing components referencing earlier palette names
  // don't need every single call site rewritten — they now resolve to the
  // crimson/cream equivalents instead.
  emerald: "#C43852",
  forest: "#9C2438",
  lime: "#DE6178",
  gold: "#C43852",
  navy: "#211A1D",
};

export const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  background: "rgba(255,255,255,0.09)",
  border: "1px solid rgba(249,241,231,0.18)",
  borderRadius: 10,
  color: "#F9F1E7",
  fontSize: 16,
  outline: "none",
};

export const labelStyle = {
  display: "block",
  fontSize: 12,
  letterSpacing: "0.1em",
  color: C.muted,
  marginBottom: 8,
  textTransform: "uppercase",
};

export const cardStyle = {
  background: "linear-gradient(160deg, rgba(196,56,82,0.2), rgba(29,23,25,0.65))",
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: 20,
};

export function buttonStyle(variant = "gold") {
  return {
    padding: "14px 22px",
    background:
      variant === "gold"
        ? "linear-gradient(135deg,#DE6178,#9C2438)"
        : variant === "danger"
        ? "rgba(232,122,112,0.18)"
        : variant === "ghost"
        ? "transparent"
        : "rgba(255,255,255,0.11)",
    border:
      variant === "danger"
        ? "1px solid rgba(232,122,112,0.4)"
        : variant === "ghost"
        ? "1px solid rgba(249,241,231,0.22)"
        : "none",
    borderRadius: 10,
    color: variant === "gold" ? "#F9F1E7" : variant === "danger" ? "#E87A70" : "#F9F1E7",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.02em",
    transition: "opacity 0.15s",
    minHeight: 44,
  };
}

// A few named gradient presets used for stat cards / VIP cards.
export const GRADIENTS = {
  green: "linear-gradient(135deg, #3FC97A, #237F4B)",
  gold: "linear-gradient(135deg, #DE6178, #9C2438)",
  blue: "linear-gradient(135deg, #C43852, #7A1B2C)",
  purple: "linear-gradient(135deg, #B15A6C, #6E2E3A)",
};
