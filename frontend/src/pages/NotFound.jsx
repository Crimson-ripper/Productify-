import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";

export default function NotFound() {
  return (
    <>
      <SEO title="Page not found — Productify" path="/404" />
      <section className="not-found">
        <div className="eyebrow">Error 404</div>
        <h1>There's nothing at this address</h1>
        <p>The link may be old, or the listing may have been taken down.</p>
        <div className="status-actions">
          <Link to="/" className="primary-button"><ArrowLeft size={16} /> Home</Link>
          <Link to="/shop" className="text-button text-button-dark">Browse the shop</Link>
        </div>
      </section>
    </>
  );
}
