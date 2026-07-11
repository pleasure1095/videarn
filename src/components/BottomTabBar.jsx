import { C } from "../styles/theme";

// Small inline icon set — avoids adding an icon library dependency for
// just five simple glyphs. Each is a minimal 24x24 stroke icon.
function IconHome({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? C.emerald : C.dim} strokeWidth="2">
      <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconInvest({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? C.emerald : C.dim} strokeWidth="2">
      <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 15l4-4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconWallet({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? C.emerald : C.dim} strokeWidth="2">
      <rect x="3" y="6" width="18" height="13" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 12h2" strokeLinecap="round" />
      <path d="M3 9h18" strokeLinecap="round" />
    </svg>
  );
}
function IconUsers({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? C.emerald : C.dim} strokeWidth="2">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M21 20v-.7a4 4 0 0 0-3-3.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconSettings({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? C.emerald : C.dim} strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V19a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const USER_ITEMS = [
  { key: "dashboard", label: "Home", Icon: IconHome },
  { key: "settings", label: "Settings", Icon: IconSettings },
];

const ADMIN_ITEMS = [
  { key: "deposits", label: "Deposits", Icon: IconWallet },
  { key: "users", label: "Users", Icon: IconUsers },
];

/**
 * Mobile-only bottom tab bar, shown alongside (not instead of) the existing
 * top Nav. Purely a navigation convenience for small screens — every tab
 * here already exists in Nav.jsx; this doesn't introduce any new routes
 * or pages, just a second, thumb-friendly way to reach them.
 */
export default function BottomTabBar({ tab, setTab, isAdmin }) {
  const items = isAdmin ? ADMIN_ITEMS : USER_ITEMS;

  return (
    <>
      <nav
        className="bottom-tab-bar"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          display: "none",
          justifyContent: "space-around",
          alignItems: "center",
          padding: "10px 8px calc(10px + env(safe-area-inset-bottom))",
          background: "rgba(10,13,11,0.96)",
          backdropFilter: "blur(20px)",
          borderTop: `1px solid ${C.border}`,
          zIndex: 60,
        }}
      >
        {items.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 14px",
                minWidth: 56,
              }}
            >
              <Icon active={active} />
              <span
                style={{
                  fontSize: 10,
                  color: active ? C.emerald : C.dim,
                  fontWeight: active ? 600 : 400,
                  letterSpacing: "0.02em",
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>
      <style>{`
        @media (max-width: 640px) {
          .bottom-tab-bar { display: flex !important; }
        }
      `}</style>
    </>
  );
}
