import { useEffect, useState } from "react";
import { C, buttonStyle } from "../styles/theme";
import Logo from "./Logo";

const SEEN_KEY = "videarn_welcome_seen";

/**
 * One-time welcome modal shown after a user's first successful login in
 * this browser. Purely a polish/atmosphere touch — no bonus, credit, or
 * financial logic attached. Uses localStorage only to remember "have they
 * dismissed this before" (a UI preference), not application data, which is
 * consistent with the project's move away from localStorage for real data.
 */
export default function WelcomeModal({ userName }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable (private browsing, etc.) — just skip
      // the modal rather than throwing.
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Non-fatal if this fails — worst case the modal reappears next visit.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && dismiss()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
        backdropFilter: "blur(8px)",
        padding: 20,
      }}
    >
      <div
        className="fade"
        style={{
          background: "#0F1611",
          border: `1px solid ${C.emerald}30`,
          borderRadius: 20,
          padding: 32,
          width: "100%",
          maxWidth: 380,
          textAlign: "center",
          boxShadow: "0 40px 80px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <Logo size={30} />
        </div>
        <h2 style={{ fontSize: 20, color: C.emerald, fontFamily: "Georgia,serif", marginBottom: 8 }}>
          Welcome, {userName?.split(" ")[0] || "there"}
        </h2>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 24, lineHeight: 1.6 }}>
          Your account is ready. Explore VIP plans, track your earnings, and
          grow your portfolio — all in one place.
        </p>
        <button style={{ ...buttonStyle("gold"), width: "100%" }} onClick={dismiss}>
          Get Started
        </button>
      </div>
    </div>
  );
}
