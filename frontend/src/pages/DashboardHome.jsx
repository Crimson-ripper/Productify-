import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SellerDashboard from "@/pages/SellerDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import DashboardShell, { Stat, Panel } from "@/components/DashboardShell";
import TemplateIcon from "@/components/TemplateIcon";
import { api, money } from "@/lib/api";

const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

function BuyerDashboard({ user }) {
  const [orders, setOrders] = useState(null);
  const [instances, setInstances] = useState(null);
  const [credits, setCredits] = useState(null);

  useEffect(() => {
    api.get("/orders").then((r) => setOrders(r.data)).catch(() => setOrders([]));
    api.get("/instances").then((r) => setInstances(r.data)).catch(() => setInstances([]));
    api.get("/credits/balance").then((r) => setCredits(r.data?.compute_credits ?? 0)).catch(() => setCredits(null));
  }, []);

  const running = (instances || []).filter((i) => i.status === "running");
  const spent = (orders || []).reduce((sum, o) => sum + Number(o.total || 0), 0);

  return (
    <DashboardShell
      seoTitle="Dashboard — Productify"
      path="/dashboard"
      eyebrow="Your account"
      title={`Hi, ${user.name.split(" ")[0]}`}
      subtitle={user.email}
      actions={<Link to="/shop" className="secondary-button">Browse the shop</Link>}
    >
      <dl className="dash-stats">
        <Stat label="Orders" value={orders ? orders.length : "—"} note={orders?.length ? `${money(spent)} in total` : null} />
        <Stat label="GPU instances running" value={instances ? running.length : "—"} tone={running.length ? "good" : undefined} />
        <Stat label="Credits" value={credits == null ? "—" : Number(credits).toFixed(2)} note="for Gamezone and GPU time" />
      </dl>

      <div className="dash-grid">
        <Panel title="Recent orders" flush actions={<Link className="link-button" to="/orders">All orders</Link>}>
          {!orders ? <p className="dash-empty">Loading…</p> : !orders.length ? (
            <p className="dash-empty">No orders yet. <Link className="link-button" to="/shop">Find something in the shop</Link></p>
          ) : (
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead><tr><th>Order</th><th>Date</th><th>Status</th><th className="num">Total</th></tr></thead>
                <tbody>
                  {orders.slice(0, 5).map((o) => (
                    <tr key={o.id}>
                      <td><div className="cell-title"><div><b>{o.items.map((it) => it.title).filter(Boolean).join(", ") || "Order"}</b><small>#{o.id.slice(0, 8)}</small></div></div></td>
                      <td>{shortDate(o.created_at)}</td>
                      <td><span className={o.status === "completed" ? "dash-pill ok" : "dash-pill muted"}>{o.status}</span></td>
                      <td className="num">{money(o.total, o.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div>
          <Panel title="GPU instances" actions={<Link className="link-button" to="/instances">All instances</Link>}>
            {!instances ? <p className="dash-clear">Loading…</p> : !instances.length ? (
              <p className="dash-clear">You haven't rented a GPU yet. <Link className="link-button" to="/rentals">See what's available</Link></p>
            ) : (
              <ul className="dash-attention plain">
                {instances.slice(0, 4).map((i) => (
                  <li key={i.id}>
                    <TemplateIcon id={i.template_id} size={16} />
                    <span><Link to={`/instances/${i.id}`}><b>{i.template_name || "Container"}</b></Link> · {i.gpu || i.rental_title}</span>
                    <span className={i.status === "running" ? "dash-pill ok" : "dash-pill muted"}>{i.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Sell on Productify">
            <p className="dash-clear" style={{ marginBottom: 14 }}>List digital products, or rent out a GPU you're not using. Opening a seller account is free.</p>
            <Link to="/seller/onboarding" className="primary-button" data-testid="tile-seller-studio">Open a seller account <ArrowRight size={15} /></Link>
          </Panel>

          <Panel title="Account">
            <ul className="dash-attention plain">
              <li><span><Link to="/profile">Profile</Link> — name, phone and photo</span></li>
              <li><span><Link to="/legal/refunds">Refunds</Link> — how to ask for one</span></li>
              <li><span><Link to="/legal/contact">Contact support</Link></span></li>
            </ul>
          </Panel>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function DashboardHome() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin" || user.role === "sub-admin") return <AdminDashboard />;
  if (user.role === "seller") return <SellerDashboard />;
  return <BuyerDashboard user={user} />;
}
