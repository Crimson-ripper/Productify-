import { useEffect, useState, useCallback } from "react";
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
