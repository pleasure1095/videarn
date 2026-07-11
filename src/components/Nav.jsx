import { C, buttonStyle } from "../styles/theme";
import Logo from "./Logo";

/**
 * Tab-based nav, matching the original single-file app's design exactly.
 * No react-router — the app has a small, fixed set of top-level views,
 * so a simple activeTab string in App.jsx is simpler to maintain than
 * introducing a routing library for this scale of app.
 */
export default function Nav({ user, onLogout, tab, setTab, isAdmin }) {
  const userTabs = ["dashboard", "plans", "referrals", "notifications", "settings"];
  const adminTabs = ["deposits", "users"];
  const tabs = isAdmin ? adminTabs : userTabs;

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 24px",
        borderBottom: `1px solid ${C.border}`,
        background: "rgba(10,13,11,0.92)",
        backdropFilter: "blur(20px)",
        position: "sticky",
        top: 0,
        zIndex: 50,
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <Logo size={26} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              ...buttonStyle(tab === t ? "gold" : "ghost"),
              padding: "7px 14px",
              fontSize: 12,
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12, color: C.muted }}>Hi, {user?.name?.split(" ")[0]}</span>
        <button style={{ ...buttonStyle("ghost"), padding: "7px 12px", fontSize: 12 }} onClick={onLogout}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
