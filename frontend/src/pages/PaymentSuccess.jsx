import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, ArrowRight, Zap } from "lucide-react";
import { api, money } from "@/lib/api";
import SEO from "@/components/SEO";

export default function PaymentSuccess() {
  const [sp] = useSearchParams();
  const sid = sp.get("session_id");
  const [tx, setTx] = useState(null);
  useEffect(() => { if (sid) api.get(`/payments/status/${sid}`).then((r) => setTx(r.data)).catch(() => {}); }, [sid]);

  const hasRentals = tx?.items?.some((it) => it.kind === "rental" || it.item_type === "rental" || it.product_type === "rental");

  return (
    <>
      <SEO title="Payment successful — Productify" path="/payment/success" />
      <section className="status-page success" data-testid="payment-success">
        <CheckCircle2 size={54} />
        <h1>Payment successful.</h1>
        <p>Thank you — your transaction is confirmed and ready in your account.</p>
        {tx && <div className="status-line">Paid {money(tx.amount, tx.currency)} via {tx.provider}</div>}

        {hasRentals && (
          <div style={{ margin: "24px 0", padding: "18px 22px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.35)", borderRadius: 12, textAlign: "center", maxWidth: 500 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#10b981", fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
              <Zap size={18} /> GPU Node Reserved & Ready!
            </div>
            <p style={{ margin: "0 0 14px 0", fontSize: 13, color: "#cbd5e1" }}>
              Your rental instance is active. Head to your GPU Workspaces to configure templates, copy SSH keys, or 1-click launch your web terminal.
            </p>
            <Link to="/instances" className="primary-button" style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: "0 auto" }}>
              <Zap size={16} /> Open GPU Instances Workspace
            </Link>
          </div>
        )}

        <div className="status-actions">
          {hasRentals ? (
            <Link to="/instances" className="primary-button"><Zap size={17} /> Go to Instances</Link>
          ) : (
            <Link to="/orders" className="primary-button" data-testid="success-view-orders-button">View orders <ArrowRight size={17} /></Link>
          )}
          <Link to="/orders" className="text-button text-button-dark">View all orders <ArrowRight size={14} /></Link>
          <Link to="/rentals" className="text-button text-button-dark">Explore more GPUs <ArrowRight size={14} /></Link>
        </div>
      </section>
    </>
  );
}
