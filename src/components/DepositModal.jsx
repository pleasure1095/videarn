import { useState } from "react";
import { C, buttonStyle, labelStyle, inputStyle } from "../styles/theme";
import { VIP_LIST } from "../utils/vipPlans";
import { OPAY_DETAILS } from "../utils/paymentInfo";
import { submitDeposit } from "../services/deposits";
import FormInput from "./FormInput";
import { ErrorBox } from "./MessageBox";
import Overlay from "./Overlay";
import CopyRow from "./CopyRow";

function chipStyle(color) {
  return {
    display: "inline-block",
    padding: "3px 12px",
    borderRadius: 20,
    background: `${color}22`,
    color,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
  };
}

export default function DepositModal({ user, onClose, onDone, initialPlanId }) {
  const [step, setStep] = useState(1);
  const [planId, setPlanId] = useState(initialPlanId || "vip1");
  const [senderName, setSenderName] = useState("");
  const [proof, setProof] = useState("");
  const [txRef, setTxRef] = useState("");
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotName, setScreenshotName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [savedRef, setSavedRef] = useState("");

  const plan = VIP_LIST.find((p) => p.id === planId);

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setScreenshotFile(f);
    setScreenshotName(f.name);
  }

  async function submitProof() {
    setErr("");
    if (!senderName.trim()) {
      setErr("Enter the name used for the transfer.");
      return;
    }
    if (!proof.trim()) {
      setErr("Describe your payment.");
      return;
    }
    if (!txRef.trim() && !screenshotFile) {
      setErr("Provide a transaction reference/ID or upload a payment screenshot.");
      return;
    }

    setBusy(true);
    try {
      const result = await submitDeposit({
        userId: user.uid,
        userName: user.name,
        userEmail: user.email,
        planId,
        senderName,
        proof,
        txRef,
        screenshotFile,
      });
      setSavedRef(result.ref);
      setDone(true);
    } catch (e) {
      console.error(e);
      setErr(e.message || "Could not submit deposit. Please try again.");
    }
    setBusy(false);
  }

  const steps = ["Choose Plan", "Payment Details", "Submit Proof"];

  if (done) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 22, color: C.green, fontFamily: "Georgia,serif", marginBottom: 10 }}>
            Proof Submitted!
          </h2>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
            Your deposit is under review. Once approved, your VIP plan activates — earnings begin
            24 hours after approval.
          </p>
          <div
            style={{
              background: "rgba(46,204,113,0.08)",
              border: `1px solid ${C.emerald}30`,
              borderRadius: 10,
              padding: 14,
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Your Reference
            </div>
            <div style={{ fontSize: 18, color: C.emerald, fontWeight: 700, letterSpacing: "0.1em" }}>{savedRef}</div>
          </div>
          <button
            style={{ ...buttonStyle("gold"), width: "100%" }}
            onClick={() => {
              onDone();
              onClose();
            }}
          >
            Done
          </button>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center" }}>
            <div
              style={{
                height: 3,
                borderRadius: 2,
                marginBottom: 5,
                background: step >= i + 1 ? C.emerald : "rgba(255,255,255,0.1)",
              }}
            />
            <div style={{ fontSize: 9, color: step === i + 1 ? C.emerald : C.dim, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {s}
            </div>
          </div>
        ))}
      </div>

      {step === 1 && (
        <>
          <h2 style={{ fontSize: 18, color: C.emerald, fontFamily: "Georgia,serif", marginBottom: 16 }}>
            Choose a VIP Plan
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
            {VIP_LIST.map((p) => (
              <div
                key={p.id}
                onClick={() => setPlanId(p.id)}
                style={{
                  background: planId === p.id ? `${p.color}14` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${planId === p.id ? p.color : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 12,
                  padding: 14,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <div style={chipStyle(p.color)}>{p.label}</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: p.color, margin: "6px 0 2px" }}>
                  ₦{p.amount.toLocaleString()}
                </div>
                <div style={{ fontSize: 13, color: C.green }}>
                  ₦{p.daily.toLocaleString()}
                  <span style={{ fontSize: 11, fontWeight: 400 }}>/day</span>
                </div>
              </div>
            ))}
          </div>
          <button style={{ ...buttonStyle("gold"), width: "100%" }} onClick={() => setStep(2)}>
            Continue →
          </button>
          <button style={{ ...buttonStyle("ghost"), width: "100%", marginTop: 8 }} onClick={onClose}>
            Cancel
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <h2 style={{ fontSize: 18, color: C.emerald, fontFamily: "Georgia,serif", marginBottom: 4 }}>
            Make Your Transfer
          </h2>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
            Send exactly the amount below to this account.
          </p>
          <div
            style={{
              background: "rgba(46,204,113,0.07)",
              border: "1px solid rgba(46,204,113,0.28)",
              borderRadius: 14,
              padding: 18,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
              Payment Account
            </div>
            <CopyRow label="Bank" value={OPAY_DETAILS.bank} />
            <CopyRow label="Account Number" value={OPAY_DETAILS.accountNumber} />
            <CopyRow label="Account Name" value={OPAY_DETAILS.accountName} />
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", marginTop: 12, paddingTop: 12 }}>
              <CopyRow label="Amount to Send" value={`₦${plan.amount.toLocaleString()}`} accent={C.green} big />
            </div>
          </div>
          <button style={{ ...buttonStyle("gold"), width: "100%" }} onClick={() => setStep(3)}>
            I've Made the Transfer →
          </button>
          <button style={{ ...buttonStyle("ghost"), width: "100%", marginTop: 8 }} onClick={() => setStep(1)}>
            ← Back
          </button>
        </>
      )}

      {step === 3 && (
        <>
          <h2 style={{ fontSize: 18, color: C.emerald, fontFamily: "Georgia,serif", marginBottom: 4 }}>
            Submit Proof
          </h2>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
            Confirm your transfer details below.
          </p>
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: 14,
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            <div>
              Plan: <span style={{ color: plan.color }}>{plan.label} — ₦{plan.daily.toLocaleString()}/day</span>
            </div>
            <div style={{ marginTop: 4 }}>
              Amount: <span style={{ color: C.green }}>₦{plan.amount.toLocaleString()}</span>
            </div>
          </div>
          <ErrorBox msg={err} />
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Your Sender Name (as on OPay)</label>
            <FormInput placeholder="e.g. Chioma Adebayo" value={senderName} maxLength={60} onChange={(e) => setSenderName(e.target.value)} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Payment Description</label>
            <textarea
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              placeholder="Time sent, amount, your OPay name, any other details…"
              style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Transaction Reference / ID (optional if uploading screenshot)</label>
            <FormInput placeholder="e.g. OPay TXN12345678" value={txRef} maxLength={60} onChange={(e) => setTxRef(e.target.value)} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Upload Payment Screenshot (optional)</label>
            <input type="file" accept="image/*" onChange={handleFile} style={{ ...inputStyle, padding: "8px 10px" }} />
            {screenshotName && <div style={{ marginTop: 8, fontSize: 11, color: C.green }}>✓ {screenshotName} attached</div>}
          </div>
          <button style={{ ...buttonStyle("gold"), width: "100%" }} onClick={submitProof} disabled={busy}>
            {busy ? "Submitting…" : "Submit for Review ✓"}
          </button>
          <button style={{ ...buttonStyle("ghost"), width: "100%", marginTop: 8 }} onClick={() => setStep(2)}>
            ← Back
          </button>
        </>
      )}
    </Overlay>
  );
}
