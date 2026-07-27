import { C } from "../styles/theme";
import { WHATSAPP_GROUP_LINK } from "../utils/paymentInfo";

/**
 * Permanent (non-dismissible) welcome banner shown at the top of the
 * Dashboard, per the site owner's request — distinct from WelcomeModal,
 * which is a one-time popup shown only on a user's first login. This
 * banner is always visible, every time the Dashboard loads.
 */
export default function WelcomeBanner({ userName }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(184,40,61,0.2), rgba(16,12,13,0.6))",
        border: `1px solid ${C.crimson}35`,
        borderRadius: 16,
        padding: "16px 18px",
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#F3E9DD", marginBottom: 4 }}>
          Welcome{userName ? `, ${userName.split(" ")[0]}` : ""} 👋
        </div>
        <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>
          Join our community for updates, support, and announcements.
        </div>
      </div>
      <a
        href={WHATSAPP_GROUP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          padding: "10px 18px",
          borderRadius: 10,
          background: "linear-gradient(135deg,#D4506A,#8C1E2E)",
          color: "#F3E9DD",
          fontSize: 13,
          fontWeight: 700,
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        💬 Join WhatsApp
      </a>
    </div>
  );
}
