import { useState } from "react";
import { useAuth } from "./context/AuthContext";
import { C } from "./styles/theme";
import AuthPage from "./pages/AuthPage";
import Nav from "./components/Nav";
import BottomTabBar from "./components/BottomTabBar";
import WelcomeModal from "./components/WelcomeModal";
import DashboardPage from "./pages/DashboardPage";
import VipPlansPage from "./pages/VipPlansPage";
import ReferralsPage from "./pages/ReferralsPage";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage from "./pages/SettingsPage";
import AdminDepositsPage from "./pages/AdminDepositsPage";
import ManageUsersPage from "./pages/ManageUsersPage";

export default function App() {
  const { user, booting, isAdmin, logout } = useAuth();
  const [tab, setTab] = useState(null);

  if (booting) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: C.dim,
        }}
      >
        Loading…
      </div>
    );
  }

  if (!user) return <AuthPage />;

  // Default landing tab depends on role, and resets whenever the signed-in
  // user's role changes (e.g. immediately after being promoted to admin).
  const activeTab = tab || (isAdmin ? "deposits" : "dashboard");

  function renderTab() {
    if (isAdmin) {
      if (activeTab === "users") return <ManageUsersPage />;
      return <AdminDepositsPage />;
    }
    if (activeTab === "plans") return <VipPlansPage onJoined={() => setTab("dashboard")} />;
    if (activeTab === "referrals") return <ReferralsPage />;
    if (activeTab === "notifications") return <NotificationsPage />;
    if (activeTab === "settings") return <SettingsPage />;
    return <DashboardPage />;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: "#E4F0E7" }}>
      <Nav user={user} onLogout={logout} tab={activeTab} setTab={setTab} isAdmin={isAdmin} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px", paddingBottom: 90 }}>
        {renderTab()}
      </div>
      {/* Mobile-only bottom nav — hidden on wider screens where the top Nav
          tabs are already comfortably reachable. */}
      <BottomTabBar tab={activeTab} setTab={setTab} isAdmin={isAdmin} />
      <WelcomeModal userName={user.name} />
    </div>
  );
}


