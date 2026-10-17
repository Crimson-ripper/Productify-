import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api, money } from "@/lib/api";
import SEO from "@/components/SEO";

const isRental = (o) => o.items?.some((it) => it.kind === "rental" || it.item_type === "rental" || it.product_type === "rental");

export default function Orders() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get("/orders").then((r) => setRows(r.data)).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  return (
    <>
      <SEO title="Your orders — Productify" path="/orders" />
      <section className="dashboard-page">
        <div className="eyebrow">Account</div>
        <h1>Orders</h1>
        {loading ? <div className="loading-block">Loading…</div> :
          rows.length === 0 ? (
            <div className="empty-block">You haven't ordered anything yet. <Link to="/shop">Browse the shop</Link></div>
          ) : (
            <div className="orders-table" data-testid="orders-table">
              {rows.map((o) => (
                <div className="order-row" key={o.id}>
                  <div>
                    <b>{o.items.map((it) => it.title).filter(Boolean).join(", ") || o.id}</b>
                    <small>{new Date(o.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} · #{o.id.slice(0, 8)}</small>
                    {isRental(o) && <Link to="/instances" className="order-link">Open in My instances <ArrowRight size={12} /></Link>}
                  </div>
                  <div>{o.items.length} item{o.items.length > 1 ? "s" : ""} · {o.provider}</div>
                  <strong>{money(o.total, o.currency)}</strong>
                  <span className={`pill pill-${o.status}`}>{o.status}</span>
                </div>
              ))}
            </div>
          )
        }
      </section>
    </>
  );
}
