import { useEffect, useState } from "react";
import { C, buttonStyle, cardStyle, labelStyle } from "../styles/theme";
import { getAllDeposits, approveDeposit, rejectDeposit, markWithdrawalPaid, rejectWithdrawal } from "../services/deposits";
import FormInput from "../components/FormInput";
import { ErrorBox, SuccessBox } from "../components/MessageBox";

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

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [notes, setNotes] = useState({});
  const [searchName, setSearchName] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [searchRef, setSearchRef] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const all = await getAllDeposits();
      setDeposits(all);
    } catch (e) {
      console.error(e);
      setErr("Could not load deposits.");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(dep) {
    setErr("");
    setOk("");
    setBusyId(dep.id);
    try {
      const result = await approveDeposit(dep, notes[dep.id] || "");
      setOk(
        result.credited
          ? `Approved. Referral bonus of ₦${result.bonus.toLocaleString()} credited to ${result.referrer.name}.`
          : "Deposit approved."
      );
      await load();
    } catch (e) {
      console.error(e);
      setErr("Could not approve deposit.");
    }
    setBusyId(null);
  }

  async function handleReject(dep) {
    setErr("");
    setOk("");
    setBusyId(dep.id);
    try {
      await rejectDeposit(dep, notes[dep.id] || "");
      setOk("Deposit rejected.");
      await load();
    } catch (e) {
      console.error(e);
      setErr("Could not reject deposit.");
    }
    setBusyId(null);
  }

  async function handleMarkPaid(dep) {
    setBusyId(dep.id);
    try {
      await markWithdrawalPaid(dep.id, dep.lastWithdrawalRequest);
      setOk("Withdrawal marked as paid.");
      await load();
    } catch (e) {
      console.error(e);
      setErr("Could not update withdrawal.");
    }
    setBusyId(null);
  }

  async function handleRejectWithdrawal(dep) {
    setBusyId(dep.id);
    try {
      await rejectWithdrawal(dep.id, dep.lifetimeWithdrawn, dep.lastWithdrawalRequest);
      setOk("Withdrawal rejected and balance restored.");
      await load();
    } catch (e) {
      console.error(e);
      setErr("Could not reject withdrawal.");
    }
    setBusyId(null);
  }

  let filtered = deposits.filter((d) => tab === "all" || d.status === tab);
  if (searchName.trim()) filtered = filtered.filter((d) => d.userName?.toLowerCase().includes(searchName.trim().toLowerCase()));
  if (searchEmail.trim()) filtered = filtered.filter((d) => d.userEmail?.toLowerCase().includes(searchEmail.trim().toLowerCase()));
  if (searchRef.trim())
    filtered = filtered.filter(
      (d) => (d.ref || "").toLowerCase().includes(searchRef.trim().toLowerCase()) || (d.txRef || "").toLowerCase().includes(searchRef.trim().toLowerCase())
    );

  const counts = {
    pending: deposits.filter((d) => d.status === "pending").length,
    approved: deposits.filter((d) => d.status === "approved").length,
    rejected: deposits.filter((d) => d.status === "rejected").length,
  };
  const pendingWithdrawals = deposits.filter((d) => d.lastWithdrawalRequest?.status === "pending");

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: C.dim }}>Loading deposits…</div>;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 400, marginBottom: 4, fontFamily: "Georgia,serif" }}>
        Deposit Management
      </h1>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Review and approve user deposit requests</p>

      <ErrorBox msg={err} />
      <SuccessBox msg={ok} />

      <div className="admin-grid" style={{ marginBottom: 20 }}>
        {[
          { label: "Pending", value: counts.pending, color: C.emerald },
          { label: "Approved", value: counts.approved, color: C.green },
          { label: "Rejected", value: counts.rejected, color: C.red },
        ].map((s, i) => (
          <div key={i} style={{ ...cardStyle, border: `1px solid ${s.color}28`, padding: 14 }}>
            <div style={{ fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 300, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {pendingWithdrawals.length > 0 && (
        <>
          <h3 style={{ fontSize: 15, color: C.muted, fontFamily: "Georgia,serif", marginBottom: 12 }}>
            Pending Withdrawal Requests
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {pendingWithdrawals.map((d) => (
              <div key={d.id} style={{ ...cardStyle, border: "1px solid rgba(123,158,217,0.3)", padding: 14 }}>
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  <strong style={{ color: "#E4F0E7" }}>{d.userName}</strong> — ₦{d.lastWithdrawalRequest.amount.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
                  {d.lastWithdrawalRequest.bank} · {d.lastWithdrawalRequest.accNo} · {d.lastWithdrawalRequest.accName}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...buttonStyle("gold"), flex: 1, fontSize: 12, padding: "8px" }} onClick={() => handleMarkPaid(d)} disabled={busyId === d.id}>
                    Mark Paid
                  </button>
                  <button style={{ ...buttonStyle("danger"), flex: 1, fontSize: 12, padding: "8px" }} onClick={() => handleRejectWithdrawal(d)} disabled={busyId === d.id}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="admin-search-grid" style={{ marginBottom: 20 }}>
        <FormInput placeholder="Search by Name" value={searchName} onChange={(e) => setSearchName(e.target.value)} />
        <FormInput placeholder="Search by Email" value={searchEmail} onChange={(e) => setSearchEmail(e.target.value)} />
        <FormInput placeholder="Search by Reference" value={searchRef} onChange={(e) => setSearchRef(e.target.value)} />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {["pending", "approved", "rejected", "all"].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ ...buttonStyle(tab === t ? "gold" : "ghost"), padding: "7px 14px", fontSize: 12, textTransform: "capitalize" }}>
            {t} ({t === "all" ? deposits.length : counts[t] || 0})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 50, background: C.surface, border: `1px dashed ${C.border}`, borderRadius: 14, color: C.dim }}>
          No deposits found
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filtered.map((dep) => {
            const sc = dep.status === "approved" ? C.green : dep.status === "rejected" ? C.red : C.emerald;
            return (
              <div key={dep.id} style={{ ...cardStyle, border: `1px solid ${sc}20` }} className="fade">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15, color: "#E4F0E7", fontWeight: 500 }}>{dep.userName}</span>
                      <span style={chipStyle(sc)}>{dep.status.toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.muted }}>{dep.userEmail}</div>
                    <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>Submitted: {fmtDate(dep.submittedAt)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 22, fontWeight: 300, color: C.green }}>₦{dep.amount.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{dep.planLabel} · ₦{dep.planDaily.toLocaleString()}/day</div>
                  </div>
                </div>

                <div style={{ marginTop: 14, padding: 12, background: "rgba(255,255,255,0.025)", borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Payment Details</div>
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: C.dim }}>Ref: </span>
                    <span style={{ color: C.emerald }}>{dep.ref}</span>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    <span style={{ color: C.dim }}>Sender: </span>
                    <span style={{ color: "#E4F0E7" }}>{dep.senderName}</span>
                  </div>
                  {dep.txRef && (
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      <span style={{ color: C.dim }}>Transaction ID: </span>
                      {dep.txRef}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{dep.proof}</div>
                  {dep.screenshotUrl && (
                    <div style={{ marginTop: 10 }}>
                      <img src={dep.screenshotUrl} alt="Payment proof" style={{ maxWidth: 200, borderRadius: 8, border: `1px solid ${C.border}` }} />
                    </div>
                  )}
                </div>

                {dep.status === "pending" && (
                  <>
                    <div style={{ marginTop: 12 }}>
                      <label style={labelStyle}>Admin Note (optional)</label>
                      <FormInput
                        placeholder="Reason for approval or rejection…"
                        value={notes[dep.id] || ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [dep.id]: e.target.value }))}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                      <button style={{ ...buttonStyle("gold"), flex: 1 }} onClick={() => handleApprove(dep)} disabled={busyId === dep.id}>
                        ✓ Approve
                      </button>
                      <button style={{ ...buttonStyle("danger"), flex: 1 }} onClick={() => handleReject(dep)} disabled={busyId === dep.id}>
                        ✗ Reject
                      </button>
                    </div>
                  </>
                )}
                {dep.status !== "pending" && dep.adminNote && (
                  <div style={{ marginTop: 10, fontSize: 11, color: C.dim }}>Note: {dep.adminNote}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
