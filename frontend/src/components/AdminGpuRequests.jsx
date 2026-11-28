import { useCallback, useEffect, useState } from "react";
import { api, getErrorMessage } from "@/lib/api";
import { Panel } from "@/components/DashboardShell";
import { toast } from "sonner";

// Staff side of advance GPU requests: arrange the machine with our partner, then mark it ready,
// offer another time, or hand over access details once the renter has paid.
const rupees = (n) => "₹" + Number(n).toLocaleString("en-IN");
const fmt = (iso) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const CH = { email: "Email", site: "Site", whatsapp: "WhatsApp", sms: "SMS" };

function Row({ r, onChange }) {
  const [offer, setOffer] = useState("");
  const [access, setAccess] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const move = async (status, extra = {}) => {
    setBusy(true);
    try {
      await api.post(`/admin/gpu-requests/${r.id}`, { status, note: note || undefined, ...extra });
      toast.success(`Moved to ${status.replace("_", " ")}`);
      onChange();
    } catch (e) {
      toast.error(getErrorMessage(e, "Couldn't update the request"));
    } finally {
      setBusy(false);
    }
  };
  const markSent = async () => {
    try {
      await api.post(`/admin/gpu-requests/${r.id}/messages-sent`);
      onChange();
    } catch (e) {
      toast.error(getErrorMessage(e, "Couldn't update"));
    }
  };
  const pending = (r.manual_messages || []).filter((m) => !m.sent);
  const s = r.status;

  return (
    <div style={{ border: "1px solid var(--line)", padding: 16, display: "grid", gap: 10, background: "var(--surface)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <b>{r.gpu} · {r.hours} h · {rupees(r.price)}</b>
        <span style={{ fontWeight: 700 }}>{r.status_label}</span>
      </div>
      <div style={{ fontSize: 14, color: "var(--muted)" }}>
        Starts {fmt(r.start_at)} · {r.name || "—"} ({r.email}){r.phone ? ` · ${r.phone}` : ""} · remind by {r.notify.map((c) => CH[c] || c).join(", ")}
      </div>
      {r.offered_start && <div style={{ fontSize: 14 }}>Offered new time: <b>{fmt(r.offered_start)}</b> (waiting for renter)</div>}
      {r.notes && <div style={{ fontSize: 14 }}>Renter note: {r.notes}</div>}
      {pending.length > 0 && (
        <div style={{ background: "var(--warn-bg)", color: "var(--warn-text)", padding: 10, fontSize: 14 }}>
          Send by hand on {pending[pending.length - 1].channels.map((c) => CH[c]).join(" + ")} to {pending[pending.length - 1].phone}: “{pending[pending.length - 1].text}”
          <div><button type="button" onClick={markSent} style={{ marginTop: 8, background: "none", border: 0, padding: 0, color: "var(--warn-text)", fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}>Mark as sent</button></div>
        </div>
      )}

      {["requested", "arranging", "new_time", "ready", "paid"].includes(s) && (
        <div style={{ display: "grid", gap: 8 }}>
          <input placeholder="Note for the renter (optional, shown if cancelled)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {s === "requested" && <button type="button" className="secondary-button" disabled={busy} onClick={() => move("arranging")}>Start arranging</button>}
            {["requested", "arranging", "new_time"].includes(s) && <button type="button" className="primary-button" disabled={busy} onClick={() => move("ready")}>Mark ready (renter pays)</button>}
            {["requested", "arranging", "new_time", "ready"].includes(s) && (
              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <input type="datetime-local" value={offer} onChange={(e) => setOffer(e.target.value)} aria-label="New start time to offer" />
                <button type="button" className="secondary-button" disabled={busy || !offer} onClick={() => move("new_time", { offered_start: new Date(offer).toISOString() })}>Offer this time</button>
              </span>
            )}
            <button type="button" className="text-button" disabled={busy} onClick={() => move("cancelled")}>Cancel request</button>
          </div>
        </div>
      )}
      {s === "paid" && (
        <div style={{ display: "grid", gap: 8 }}>
          <textarea rows={3} placeholder="Access details: Jupyter link, SSH command, password…" value={access} onChange={(e) => setAccess(e.target.value)} />
          <button type="button" className="primary-button" style={{ justifySelf: "start" }} disabled={busy || !access.trim()} onClick={() => move("active", { access })}>Send access details</button>
        </div>
      )}
      {s === "active" && <button type="button" className="secondary-button" style={{ justifySelf: "start" }} disabled={busy} onClick={() => move("completed")}>Mark completed</button>}
    </div>
  );
}

export default function AdminGpuRequests() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("open");
  const load = useCallback(async () => {
    try {
      setRows((await api.get(`/admin/gpu-requests?status=${status}`)).data);
    } catch (e) {
      toast.error(getErrorMessage(e, "Couldn't load GPU requests"));
    }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  return (
    <Panel title="GPU requests">
      <p style={{ color: "var(--muted)", marginTop: 0 }}>Renters ask at least 12 hours ahead. Arrange the GPU with our partner, then mark it ready or offer another time.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {[["open", "Open"], ["requested", "New"], ["paid", "Paid, needs access"], ["all", "All"]].map(([k, t]) => (
          <button key={k} type="button" className={status === k ? "primary-button" : "secondary-button"} onClick={() => setStatus(k)}>{t}</button>
        ))}
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {rows.length === 0 && <p style={{ color: "var(--muted)" }}>No requests here.</p>}
        {rows.map((r) => <Row key={r.id} r={r} onChange={load} />)}
      </div>
    </Panel>
  );
}
