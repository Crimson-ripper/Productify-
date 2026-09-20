import { Link } from "react-router-dom";
import { XCircle, ArrowRight } from "lucide-react";
import SEO from "@/components/SEO";

export default function PaymentCancel() {
  return (
    <>
      <SEO title="Payment cancelled — Productify" path="/payment/cancel" />
      <section className="status-page cancel" data-testid="payment-cancel">
        <XCircle size={54} />
        <h1>Payment cancelled.</h1>
        <p>No charges were made. Your bag is still saved.</p>
        <div className="status-actions">
          <Link to="/cart" className="primary-button">Back to bag <ArrowRight size={17} /></Link>
          <Link to="/shop" className="text-button text-button-dark">Keep browsing <ArrowRight size={14} /></Link>
        </div>
      </section>
    </>
  );
}
