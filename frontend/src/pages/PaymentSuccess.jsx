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

  const hasRentals = tx?.items?.some((it) => it.kind === "rental" || it.item_type === "rental" || it.product_type === "rental");

  return (
    <>
      <SEO title="Order confirmed — Productify" path="/payment/success" />
      <section className="status-page success" data-testid="payment-success">
        <CheckCircle2 size={48} />
        <h1>Order confirmed</h1>
        <p>{hasRentals ? "Your GPU time is booked. Start it from My instances." : "Your order is saved in your account."}</p>
        {tx && <div className="status-line">{money(tx.amount, tx.currency)} · {tx.provider}</div>}
        <div className="status-actions">
          {hasRentals ? (
            <Link to="/instances" className="primary-button" data-testid="success-instances-button">Go to My instances <ArrowRight size={17} /></Link>
          ) : (
            <Link to="/orders" className="primary-button" data-testid="success-view-orders-button">View orders <ArrowRight size={17} /></Link>
          )}
          {hasRentals && <Link to="/orders" className="text-button text-button-dark">View orders <ArrowRight size={14} /></Link>}
          <Link to="/shop" className="text-button text-button-dark">Back to the shop <ArrowRight size={14} /></Link>
        </div>
      </section>
    </>
  );
}
