import { C } from "../styles/theme";

const ACTIONS = [
  { key: "deposit", label: "Deposit", icon: "⬇️", color: "#3DBE6C" },
  { key: "withdraw", label: "Withdraw", icon: "⬆️", color: "#E8B84B" },
  { key: "migrate", label: "Migrate", icon: "🔁", color: "#3D5FA8" },
  { key: "support", label: "Support", icon: "💬", color: "#7A5FC7" },
];

/**
 * Quick-action grid — deliberately kept to 4 items, each leading somewhere
 * genuinely different from what's already one tap away on the bottom nav.
 * "Portfolio" and "Network"/"Leaders" were considered and dropped: they'd
 * either duplicate the Dashboard itself or duplicate the Referrals tab,
 * adding taps without adding capability.
 */
export default function ActionGrid({ onDeposit, onMigrate, onWithdraw, onSupport }) {
  const handlers = { deposit: onDeposit, withdraw: onWithdraw, migrate: onMigrate, support: onSupport };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 10,
        marginBottom: 20,
      }}
    >
      {ACTIONS.map((a) => (
        <button
          key={a.key}
          onClick={handlers[a.key]}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            padding: "14px 6px",
            borderRadius: 14,
            border: "none",
            background: `${a.color}1c`,
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 20 }}>{a.icon}</span>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#F9F1E7" }}>{a.label}</span>
        </button>
      ))}
    </div>
  );
}
