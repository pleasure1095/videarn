// Ported directly from the original single-file VIDEARN app so the visual
// identity (premium dark + emerald green) carries over unchanged.
export const C = {
  emerald: "#2ECC71",
  forest: "#1E8449",
  lime: "#A4E86B",
  green: "#2ECC71",
  blue: "#7B9ED9",
  red: "#CF7878",
  bg: "#0A0D0B",
  surface: "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.08)",
  muted: "#8A9A8E",
  dim: "#5C6B60",
};

export const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  color: "#E4F0E7",
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
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 14,
  padding: 20,
};

export function buttonStyle(variant = "gold") {
  return {
    padding: "14px 22px",
    background:
      variant === "gold"
        ? "linear-gradient(135deg,#2ECC71,#1E8449)"
        : variant === "danger"
        ? "rgba(207,120,120,0.15)"
        : variant === "ghost"
        ? "transparent"
        : "rgba(255,255,255,0.06)",
    border:
      variant === "danger"
        ? "1px solid rgba(207,120,120,0.3)"
        : variant === "ghost"
        ? "1px solid rgba(255,255,255,0.1)"
        : "none",
    borderRadius: 10,
    color: variant === "gold" ? "#06110A" : variant === "danger" ? "#CF7878" : "#E4F0E7",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    letterSpacing: "0.02em",
    transition: "opacity 0.15s",
    minHeight: 44,
  };
}
