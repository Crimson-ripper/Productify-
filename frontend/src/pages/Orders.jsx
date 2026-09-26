import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import { api, money } from "@/lib/api";
import SEO from "@/components/SEO";

export default function Orders() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get("/orders").then((r) => setRows(r.data)).finally(() => setLoading(false));
  }, []);
  return (
    <>
      <SEO title="Your orders — Productify" path="/orders" />
      <section className="dashboard-page">
        <div className="eyebrow"><span className="eyebrow-line" /> ORDERS</div>
        <h1>Order history<em>.</em></h1>
        {loading ? <div className="loading-block">Loading…</div> :
          rows.length === 0 ? (
            <div className="empty-block">No orders yet. <Link to="/shop">Browse products</Link></div>
          ) : (
            <div className="orders-table" data-testid="orders-table">
              {rows.map((o) => {
                const isRentalOrder = o.items?.some((it) => it.kind === "rental" || it.item_type === "rental" || it.product_type === "rental");
                return (
                  <div className="order-row" key={o.id}>
                    <div>
                      <b>{o.id}</b>
                      <small>{new Date(o.created_at).toLocaleString()}</small>
                      {isRentalOrder && (
                        <div style={{ marginTop: 6 }}>
                          <Link to="/instances" className="text-button" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#10b981", fontSize: 13, fontWeight: 600 }}>
                            <Zap size={14} /> Connect to Rented GPU →
                          </Link>
                        </div>
                      )}
                    </div>
                    <div>{o.items.length} item{o.items.length > 1 ? "s" : ""} · {o.provider}</div>
                    <strong>{money(o.total, o.currency)}</strong>
                    <span className={`pill pill-${o.status}`}>{o.status}</span>
                  </div>
                );
              })}
            </div>
          )
        }
      </section>
    </>
  );
}
