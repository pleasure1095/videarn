import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { reauthenticateUser } from "../services/auth";
import { C, buttonStyle, cardStyle, labelStyle } from "../styles/theme";
import FormInput from "../components/FormInput";
import { ErrorBox, SuccessBox } from "../components/MessageBox";

const PASSWORD_RULE = /^\d{8}$/;
const APP_VERSION = "1.0.0";

/**
 * Settings page — the usual home for "Account", "Security", and general
 * app actions that most apps in this space have. Built on top of the
 * existing profile-edit and password-change logic from Stage 2 (unchanged
 * below), just organized under clearer section headers and with a general
 * "App" card added for sign out / version / support, since that's the
 * standard shape for a settings screen.
 */
export default function SettingsPage() {
  const { user, updateProfile, updatePassword, logout } = useAuth();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || "");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [needsReauth, setNeedsReauth] = useState(false);
  const [profileErr, setProfileErr] = useState("");
  const [profileOk, setProfileOk] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwOk, setPwOk] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveProfile() {
    setProfileErr("");
    setProfileOk("");
    if (!name.trim()) {
      setProfileErr("Name is required.");
      return;
    }
    setBusy(true);
    try {
      await updateProfile({ name, phone });
      setProfileOk("Profile updated successfully.");
    } catch (e) {
      console.error(e);
      setProfileErr("Could not update profile. Please try again.");
    }
    setBusy(false);
  }

  async function savePassword() {
    setPwErr("");
    setPwOk("");
    if (!PASSWORD_RULE.test(newPassword)) {
      setPwErr("Password must be exactly 8 numeric digits e.g. 12345678");
      return;
    }
    setBusy(true);
    try {
      await updatePassword(newPassword);
      setPwOk("Password updated successfully.");
      setNewPassword("");
      setNeedsReauth(false);
      setCurrentPassword("");
    } catch (e) {
      if (e.code === "auth/requires-recent-login") {
        // Firebase needs a fresh sign-in proof before allowing sensitive
        // changes like a password update. Prompt for current password
        // instead of forcing a full logout/login round trip.
        setNeedsReauth(true);
        setPwErr("For security, please confirm your current password to continue.");
      } else {
        console.error(e);
        setPwErr("Could not update password. Please try again.");
      }
    }
    setBusy(false);
  }

  async function confirmReauthAndRetry() {
    setPwErr("");
    if (!currentPassword) {
      setPwErr("Enter your current password to continue.");
      return;
    }
    setBusy(true);
    try {
      await reauthenticateUser(currentPassword);
      await savePassword();
    } catch (e) {
      console.error(e);
      setPwErr(
        e.code === "auth/wrong-password" || e.code === "auth/invalid-credential"
          ? "Current password is incorrect."
          : "Could not verify your identity. Please try again."
      );
    }
    setBusy(false);
  }

  return (
    <div style={{ maxWidth: 460 }}>
      <h2 style={{ fontSize: 18, fontWeight: 400, marginBottom: 18, fontFamily: "Georgia,serif" }}>
        Settings
      </h2>

      <h3
        style={{
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: C.dim,
          marginBottom: 10,
        }}
      >
        Account
      </h3>
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <ErrorBox msg={profileErr} />
        <SuccessBox msg={profileOk} />
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Full Name</label>
          <FormInput value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Phone Number</label>
          <FormInput
            value={phone}
            inputMode="numeric"
            maxLength={14}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))}
          />
        </div>
        <div style={{ marginBottom: 6 }}>
          <label style={labelStyle}>Email (fixed)</label>
          <FormInput value={user.email} disabled style={{ opacity: 0.5 }} />
        </div>
        <button style={{ ...buttonStyle("gold"), width: "100%", marginTop: 12 }} onClick={saveProfile} disabled={busy}>
          Save Changes
        </button>
      </div>

      <h3
        style={{
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: C.dim,
          marginBottom: 10,
        }}
      >
        Security
      </h3>
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <ErrorBox msg={pwErr} />
        <SuccessBox msg={pwOk} />

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>New Password (8 digits)</label>
          <FormInput
            inputMode="numeric"
            placeholder="e.g. 12345678"
            value={newPassword}
            maxLength={8}
            onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, "").slice(0, 8))}
          />
        </div>

        {needsReauth && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Current Password</label>
            <FormInput
              type="password"
              placeholder="Confirm your current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmReauthAndRetry()}
            />
          </div>
        )}

        <p style={{ fontSize: 11, color: C.dim, marginBottom: 16 }}>
          Must be exactly 8 numbers e.g. 12345678
        </p>

        <button
          style={{ ...buttonStyle("gold"), width: "100%" }}
          onClick={needsReauth ? confirmReauthAndRetry : savePassword}
          disabled={busy}
        >
          {needsReauth ? "Confirm & Update Password" : "Update Password"}
        </button>
      </div>

      <h3
        style={{
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: C.dim,
          marginBottom: 10,
        }}
      >
        App
      </h3>
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: 14,
            marginBottom: 14,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <span style={{ fontSize: 13, color: C.muted }}>App Version</span>
          <span style={{ fontSize: 13, color: "#E4F0E7" }}>{APP_VERSION}</span>
        </div>
        <a
          href="https://wa.me/2347042749274"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            fontSize: 13,
            color: C.emerald,
            textDecoration: "none",
            paddingBottom: 14,
            marginBottom: 14,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          Contact Support →
        </a>
        <button style={{ ...buttonStyle("danger"), width: "100%" }} onClick={logout}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
