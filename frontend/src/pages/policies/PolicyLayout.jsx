import { Link, useLocation } from "react-router-dom";
import SEO from "@/components/SEO";
import { AlertTriangle } from "lucide-react";

const NAV = [
  { to: "/legal/privacy", label: "Privacy Policy" },
  { to: "/legal/terms", label: "Terms of Service" },
  { to: "/legal/refunds", label: "Refund & Return Policy" },
  { to: "/legal/cookies", label: "Cookie Policy" },
  { to: "/legal/acceptable-use", label: "Acceptable Use" },
  { to: "/legal/contact", label: "Legal & Grievance Contact" },
];

export default function PolicyLayout({ title, description, updated = "20 February 2026", children, path }) {
  const location = useLocation();
  return (
    <>
      <SEO title={`${title} — Productify`} description={description} path={path || location.pathname} />
      <section className="page-hero policy-hero">
        <div className="eyebrow"><span className="eyebrow-line" /> LEGAL</div>
        <h1>{title}<em>.</em></h1>
        <p>{description}</p>
        <small className="policy-updated">Last updated: {updated}</small>
      </section>

      <section className="policy-shell" data-testid="policy-shell">
        <aside className="policy-nav" data-testid="policy-nav">
          <div className="policy-nav-label">DOCUMENTS</div>
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={location.pathname === n.to ? "policy-nav-link active" : "policy-nav-link"}
              data-testid={`policy-nav-${n.to.split("/").pop()}`}
            >{n.label}</Link>
          ))}
        </aside>

        <article className="policy-content">
          <div className="policy-disclaimer" data-testid="policy-disclaimer">
            <AlertTriangle size={16} />
            <div>
              <b>Legal template notice</b>
              <span>This document is a good-faith template drafted to reflect major data-protection and consumer-protection frameworks (EU/UK GDPR, US CCPA/CPRA, India DPDP Act 2023 & Consumer Protection Act 2019, Australia Privacy Act 1988). It is not legal advice. Have a licensed attorney review before you launch.</span>
            </div>
          </div>
          {children}
        </article>
      </section>
    </>
  );
}
