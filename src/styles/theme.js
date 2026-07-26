// Crimson & Cream premium theme, restyled per the site owner's rebrand
// request. Business logic (VIP plans, earnings rules, withdrawal limits)
// is entirely unaffected by this file — this is visual tokens only.
export const C = {
  charcoal: "#181214",
  charcoalDeep: "#100C0D",
  crimson: "#B8283D",
  crimsonDeep: "#8C1E2E",
  cream: "#F3E9DD",
  creamDeep: "#E4D3BC",
  green: "#3DBE6C",
  red: "#E0685E",
  bg: "#100C0D",
  surface: "rgba(255,255,255,0.05)",
  border: "rgba(184,40,61,0.22)",
  muted: "#C9B8AE",
  dim: "#7A6B64",
  // Aliases kept so existing components referencing earlier palette names
  // don't need every single call site rewritten — they now resolve to the
  // crimson/cream equivalents instead.
  emerald: "#B8283D",
  forest: "#8C1E2E",
  lime: "#D4506A",
  gold: "#B8283D",
  navy: "#181214",
};

export const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(184,40,61,0.25)",
  borderRadius: 10,
  color: "#F3E9DD",
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
  background: "linear-gradient(160deg, rgba(184,40,61,0.16), rgba(16,12,13,0.7))",
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: 20,
};

export function buttonStyle(variant = "gold") {
  return {
    padding: "14px 22px",
    background:
      variant === "gold"
        ? "linear-gradient(135deg,#D4506A,#8C1E2E)"
        : variant === "danger"
        ? "rgba(224,104,94,0.15)"
        : variant === "ghost"
        ? "transparent"
        : "rgba(255,255,255,0.08)",
    border:
      variant === "danger"
        ? "1px solid rgba(224,104,94,0.35)"
        : variant === "ghost"
        ? "1px solid rgba(184,40,61,0.3)"
        : "none",
    borderRadius: 10,
    color: variant === "gold" ? "#F3E9DD" : variant === "danger" ? "#E0685E" : "#F3E9DD",
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
  green: "linear-gradient(135deg, #2FAE64, #1D7A46)",
  gold: "linear-gradient(135deg, #D4506A, #8C1E2E)",
  blue: "linear-gradient(135deg, #B8283D, #6E1522)",
  purple: "linear-gradient(135deg, #9E4A5C, #5C2530)",
};
