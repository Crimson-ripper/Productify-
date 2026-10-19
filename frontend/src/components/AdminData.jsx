import { Fragment, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { api, money, getErrorMessage } from "@/lib/api";
import { Stat, Panel } from "@/components/DashboardShell";
import { toast } from "sonner";

const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const ago = (secs) => {
  if (!secs) return "never";
  const s = Math.max(0, Math.round(Date.now() / 1000 - secs));
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

function useAdminData(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    api.get(path)
      .then((r) => setData(r.data))
      .catch((err) => { setData(null); toast.error(getErrorMessage(err, "Couldn't load data")); })
      .finally(() => setLoading(false));
  }, [path]);
  useEffect(() => { load(); }, [load]);
  return [data, loading, load];
}

const Refresh = ({ onClick, loading }) => (
  <button className="secondary-button" onClick={onClick} disabled={loading}><RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh</button>
);

const Empty = ({ loading, children }) => <p className="dash-empty">{loading ? "Loading…" : children}</p>;

const STATE_PILL = {
  approved: ["ok", "Live"], pending: ["wait", "In review"], rejected: ["bad", "Rejected"],
  awaiting_pairing: ["muted", "Waiting to pair"], paired: ["wait", "Needs a price"],
  completed: ["ok", "Completed"], refunded: ["bad", "Refunded"], running: ["ok", "Running"],
  stopped: ["muted", "Stopped"], terminated: ["muted", "Ended"],
};
const Pill = ({ s }) => {
  const [cls, label] = STATE_PILL[s] || ["muted", s || "—"];
  return <span className={`dash-pill ${cls}`}>{label}</span>;
};

// ---------- Overview: recent activity ----------
export function AdminActivity() {
  const [d, loading] = useAdminData("/admin/activity");
  if (!d) return <Panel title="Recent activity"><Empty loading={loading}>Couldn't load recent activity.</Empty></Panel>;
  return (
    <>
      <dl className="dash-stats">
        <Stat label="New users (7 days)" value={d.new_users_7d} />
        <Stat label="Orders (30 days)" value={d.orders_30d} />
        <Stat label="Revenue (30 days)" value={money(d.revenue_30d)} tone="good" />
        <Stat label="Machines online" value={`${d.machines_online} / ${d.machines_total}`} />
        <Stat label="Instances running" value={d.instances_running} />
      </dl>
      <div className="dash-split three">
        <Panel title="Newest accounts" flush>
          {!d.users.length ? <Empty>No accounts yet.</Empty> : (
            <ul className="dash-feed">
              {d.users.map((u) => <li key={u.id}><b>{u.name}</b><small>{u.email} · {u.role} · {when(u.created_at)}</small></li>)}
            </ul>
          )}
        </Panel>
        <Panel title="Latest orders" flush>
          {!d.orders.length ? <Empty>No orders yet.</Empty> : (
            <ul className="dash-feed">
              {d.orders.map((o) => <li key={o.id}><b>{money(o.total, o.currency)} · {o.buyer_name}</b><small>{o.titles || "—"} · {when(o.created_at)}</small></li>)}
            </ul>
          )}
        </Panel>
        <Panel title="Latest listings" flush>
          {!d.listings.length ? <Empty>No listings yet.</Empty> : (
            <ul className="dash-feed">
              {d.listings.map((l) => <li key={l.kind + l.id}><b>{l.title}</b><small>{l.kind === "gpu" ? "GPU" : "Product"} · {l.who || "—"} · {l.state} · {when(l.created_at)}</small></li>)}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

// ---------- Orders ----------
export function AdminOrders() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [rows, loading, load] = useAdminData(`/admin/orders?status=${status}&q=${encodeURIComponent(q)}`);
  const total = (rows || []).filter((o) => o.status === "completed").reduce((s, o) => s + Number(o.total || 0), 0);
  return (
    <Panel
      title={rows ? `${rows.length} order${rows.length === 1 ? "" : "s"} · ${money(total)} completed` : "Orders"}
      flush
      actions={<Refresh onClick={load} loading={loading} />}
    >
      <div className="dash-search" style={{ padding: "14px 22px", borderBottom: "1px solid var(--line)" }}>
        <input placeholder="Search buyer, email, order id or item" defaultValue={q} onKeyDown={(e) => e.key === "Enter" && setQ(e.currentTarget.value)} aria-label="Search orders" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="all">All statuses</option><option value="completed">Completed</option><option value="refunded">Refunded</option>
        </select>
      </div>
      {!rows?.length ? <Empty loading={loading}>No orders found.</Empty> : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead><tr><th>Order</th><th>Buyer</th><th>Items</th><th>Paid with</th><th>Status</th><th className="num">Total</th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td><div className="cell-title"><div><b>#{o.id.slice(0, 8)}</b><small>{when(o.created_at)}</small></div></div></td>
                  <td><b>{o.buyer_name}</b><div><small>{o.buyer_email}</small></div></td>
                  <td>{(o.items || []).map((it) => it.title).join(", ")}</td>
                  <td>{o.provider || "—"}</td>
                  <td><Pill s={o.status} /></td>
                  <td className="num">{money(o.total, o.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ---------- Leads: renter waitlist + provider applications (ROADMAP Task 9) ----------
const LEAD_STAGES = ["new", "contacted", "qualified", "onboarding", "active", "closed"];
const LEAD_QUAL = [["unreviewed", "Unreviewed"], ["qualified", "Qualified"], ["not_a_fit", "Not a fit"]];
const LEAD_OUTCOMES = [["", "—"], ["converted", "Converted"], ["not_interested", "Not interested"], ["no_response", "No response"], ["not_a_fit", "Not a fit"]];
const STAGE_TONE = { new: "wait", contacted: "muted", qualified: "ok", onboarding: "ok", active: "ok", closed: "muted" };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "—");

function leadProfile(l) {
  if (l.kind === "provider") return [l.gpu_model, l.vram, l.cpu, l.ram, l.os].filter(Boolean).join(" · ");
  return [l.workload, l.gpu_needed && `needs ${l.gpu_needed}`, l.frequency].filter(Boolean).join(" · ");
}

function LeadEditor({ lead, onSaved }) {
  const [f, setF] = useState({
    stage: lead.stage, qualification: lead.qualification, owner: lead.owner || "",
    last_contact: (lead.last_contact || "").slice(0, 10), next_action: lead.next_action || "",
    outcome: lead.outcome || "", notes: lead.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const save = async () => {
    setBusy(true);
    try {
      const r = await api.patch(`/admin/leads/${lead.id}`, f);
      toast.success("Lead updated");
      onSaved(r.data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save"));
    } finally {
      setBusy(false);
    }
  };
  const detail = lead.kind === "provider"
    ? [["Contact", lead.contact], ["Applying as", lead.entity], ["Storage", lead.storage], ["Available", lead.available_hours], ["Power / internet", lead.power_notes], ["Security concerns", lead.security_concerns], ["Expected compensation", lead.expected_compensation]]
    : [["Email", lead.email], ["Role", lead.role], ["Workload", lead.workload], ["GPU / VRAM", lead.gpu_needed], ["How often", lead.frequency], ["Uses now", lead.current_provider], ["Monthly spend", lead.monthly_spend]];
  return (
    <div className="lead-editor">
      <dl className="lead-detail">
        {detail.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        <div><dt>Source</dt><dd>{lead.source}{lead.campaign ? ` · ${lead.campaign}` : ""}</dd></div>
      </dl>
      <div className="lead-fields">
        <label>Qualification<select value={f.qualification} onChange={set("qualification")}>{LEAD_QUAL.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>Stage<select value={f.stage} onChange={set("stage")}>{LEAD_STAGES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}</select></label>
        <label>Owner<input value={f.owner} onChange={set("owner")} maxLength={120} /></label>
        <label>Last contact<input type="date" value={f.last_contact} onChange={set("last_contact")} /></label>
        <label className="wide">Next action<input value={f.next_action} onChange={set("next_action")} maxLength={500} /></label>
        <label>Outcome<select value={f.outcome} onChange={set("outcome")}>{LEAD_OUTCOMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="wide">Notes<textarea rows={2} value={f.notes} onChange={set("notes")} maxLength={2000} /></label>
      </div>
      <button className="primary-button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
    </div>
  );
}

export function AdminLeads() {
  const [kind, setKind] = useState("all");
  const [stage, setStage] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const query = `kind=${kind}&stage=${stage}&q=${encodeURIComponent(q)}`;
  const [rows, loading, load] = useAdminData(`/admin/leads?${query}`);
  const [list, setList] = useState(null);
  useEffect(() => { setList(rows); }, [rows]);

  const exportCsv = async () => {
    try {
      const r = await api.get(`/admin/leads/export.csv?${query}`, { responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `productify-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't export"));
    }
  };

  const counts = (list || []).reduce((c, l) => ({ ...c, [l.kind]: (c[l.kind] || 0) + 1 }), {});
  return (
    <Panel
      title={list ? `${list.length} lead${list.length === 1 ? "" : "s"} · ${counts.waitlist || 0} renters · ${counts.provider || 0} providers` : "Leads"}
      flush
      actions={<><button className="secondary-button" onClick={exportCsv} disabled={!list?.length}>Export CSV</button><Refresh onClick={load} loading={loading} /></>}
    >
      <div className="dash-search" style={{ padding: "14px 22px", borderBottom: "1px solid var(--line)" }}>
        <input placeholder="Search name, email, GPU, region, notes" defaultValue={q} onKeyDown={(e) => e.key === "Enter" && setQ(e.currentTarget.value)} aria-label="Search leads" />
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type">
          <option value="all">Renters and providers</option><option value="waitlist">Renter waitlist</option><option value="provider">Provider applications</option>
        </select>
        <select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Stage">
          <option value="all">All stages</option>{LEAD_STAGES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
        </select>
      </div>
      {!list?.length ? <Empty loading={loading}>No leads yet. Waitlist entries and provider applications will appear here.</Empty> : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead><tr><th>Lead</th><th>Type</th><th>Region</th><th>Use case / hardware</th><th>Source</th><th>Stage</th><th>Next action</th></tr></thead>
            <tbody>
              {list.map((l) => (
                <Fragment key={l.id}>
                  <tr className="lead-row" onClick={() => setOpen(open === l.id ? null : l.id)}>
                    <td>
                      <button type="button" className="link-button" aria-expanded={open === l.id} onClick={(e) => { e.stopPropagation(); setOpen(open === l.id ? null : l.id); }}>
                        <b>{l.name}</b>
                      </button>
                      <div><small>{l.email || l.contact} · {when(l.created_at)}</small></div>
                    </td>
                    <td>{l.kind === "provider" ? "Provider" : "Renter"}</td>
                    <td>{l.region || "—"}</td>
                    <td className="lead-profile">{leadProfile(l) || "—"}</td>
                    <td>{l.source}</td>
                    <td><span className={`dash-pill ${STAGE_TONE[l.stage] || "muted"}`}>{cap(l.stage)}</span>{l.qualification === "not_a_fit" && <div><small>Not a fit</small></div>}</td>
                    <td>{l.next_action || "—"}{l.owner && <div><small>{l.owner}</small></div>}</td>
                  </tr>
                  {open === l.id && (
                    <tr><td colSpan={7}><LeadEditor lead={l} onSaved={(u) => setList((s) => s.map((x) => (x.id === u.id ? u : x)))} /></td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ---------- Machines ----------
export function AdminMachines() {
  const [rows, loading, load] = useAdminData("/admin/machines");
  const online = (rows || []).filter((m) => m.is_online).length;
  return (
    <Panel title={rows ? `${rows.length} machine${rows.length === 1 ? "" : "s"} · ${online} online` : "Machines"} flush actions={<Refresh onClick={load} loading={loading} />}>
      {!rows?.length ? <Empty loading={loading}>No GPU machines yet.</Empty> : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead><tr><th>Machine</th><th>Owner</th><th>Hardware</th><th>Listing</th><th>Connection</th><th className="num">Price</th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td><div className="cell-title"><div><b>{m.title || "New machine"}</b><small>{m.id}{m.agent_version ? ` · Node ${m.agent_version}` : ""}</small></div></div></td>
                  <td><b>{m.owner}</b><div><small>{m.owner_email}</small></div></td>
                  <td>{m.gpu || "—"}{m.vram ? ` · ${m.vram}` : ""}<div><small>{[m.specs?.cpu_model, m.specs?.cpu, m.specs?.ram].filter(Boolean).join(" · ")}</small></div></td>
                  <td><Pill s={m.status} /></td>
                  <td>
                    <span className={m.is_online ? "node-status online" : "node-status"}><span className={m.is_online ? "live-dot" : "live-dot off"} />{m.is_online ? (m.live === false ? "Online · paused" : "Online") : "Offline"}</span>
                    <div><small>{m.is_online && m.jobs != null ? `${m.jobs} job${m.jobs === 1 ? "" : "s"} · ` : ""}{m.gpu_temp_c != null ? `${m.gpu_temp_c} °C · ` : ""}seen {ago(m.last_seen)}</small></div>
                  </td>
                  <td className="num">{m.price ? `${money(m.price)}/hr` : "—"}{m.status === "approved" && <div><Link className="link-button" to={`/rental/${m.id}`}>View</Link></div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ---------- Instances ----------
export function AdminInstances() {
  const [status, setStatus] = useState("all");
  const [rows, loading, load] = useAdminData(`/admin/instances?status=${status}`);
  return (
    <Panel
      title={rows ? `${rows.length} instance${rows.length === 1 ? "" : "s"}` : "Instances"}
      flush
      actions={<>
        <select className="dash-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="all">All</option><option value="running">Running</option><option value="stopped">Stopped</option><option value="terminated">Ended</option>
        </select>
        <Refresh onClick={load} loading={loading} />
      </>}
    >
      {!rows?.length ? <Empty loading={loading}>No GPU instances yet.</Empty> : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead><tr><th>Instance</th><th>Renter</th><th>Machine</th><th>Status</th><th className="num">Runtime</th><th className="num">Billed</th></tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td><div className="cell-title"><div><b>{i.template_name || "Container"}</b><small>{i.id} · {when(i.created_at)}</small></div></div></td>
                  <td><b>{i.renter_name || "—"}</b><div><small>{i.renter_email}</small></div></td>
                  <td>{i.rental_title || i.gpu}<div><small>{i.seller_name}</small></div></td>
                  <td><Pill s={i.status} /></td>
                  <td className="num">{(i.live_runtime_seconds / 3600).toFixed(1)} h</td>
                  <td className="num">{money(i.live_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
