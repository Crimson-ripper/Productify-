import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { api, money } from "@/lib/api";
import SEO from "@/components/SEO";

export default function PaymentSuccess() {
  const [sp] = useSearchParams();
  const sid = sp.get("session_id");
  const [tx, setTx] = useState(null);
  useEffect(() => { if (sid) api.get(`/payments/status/${sid}`).then((r) => setTx(r.data)).catch(() => {}); }, [sid]);
  return (
    <>
      <SEO title="Payment successful — Productify" path="/payment/success" />
      <section className="status-page success" data-testid="payment-success">
        <CheckCircle2 size={54} />
        <h1>Payment successful.</h1>
        <p>Thank you — your order is confirmed and ready in your account.</p>
        {tx && <div className="status-line">Paid {money(tx.amount, tx.currency)} via {tx.provider}</div>}
        <div className="status-actions">
          <Link to="/orders" className="primary-button" data-testid="success-view-orders-button">View orders <ArrowRight size={17} /></Link>
          <Link to="/shop" className="text-button text-button-dark">Keep shopping <ArrowRight size={14} /></Link>
        </div>
      </section>
    </>
  );
}
