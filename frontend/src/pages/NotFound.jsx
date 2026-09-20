import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";

export default function NotFound() {
  return (
    <>
      <SEO title="Page not found — Productify" path="/404" />
      <section className="not-found">
        <div className="eyebrow"><span className="eyebrow-line" /> 404</div>
        <h1>This page has moved.<em>.</em></h1>
        <p>The link may be broken, or the page may have been removed.</p>
        <Link to="/" className="primary-button"><ArrowLeft size={16} /> Back to Productify</Link>
      </section>
    </>
  );
}
