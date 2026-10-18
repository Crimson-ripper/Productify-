import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import SEO from "@/components/SEO";
import { ctaProps } from "@/lib/analytics";
import { ROUTES } from "@/lib/routes";

const RENTER = [
  ["Hourly price", "Each provider sets an hourly price for their machine. You see it on the machine's page before you start."],
  ["Storage", "The disk you choose for an instance adds $0.0002 per GB per hour. A 50 GB disk adds $0.01 per hour."],
  ["When billing starts and stops", "Cost is calculated from the seconds the instance is running, at the hourly rate. It starts when the instance starts and stops when you stop it."],
  ["Bandwidth", "[TODO: confirm whether network transfer is included or charged]"],
  ["Currency", "Prices are shown in US dollars. [TODO: confirm local-currency display and taxes]"],
];

const PROVIDER = [
  ["Platform fee", "Productify keeps 10% of rental revenue on the Free seller plan. Paid seller plans aren't available yet."],
  ["Withdrawals", "Withdraw once your balance is at least $10. Each request is reviewed, then paid to bank, PayPal or UPI. [TODO: confirm payout timing]"],
  ["No guaranteed income", "Earnings depend on utilisation, your price, power costs and downtime. Your machine may not be rented at all."],
];

function Rows({ rows }) {
  return <dl className="lp-dl">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing — how GPU rental billing works · Productify"
        description="How Productify charges for GPU compute: provider-set hourly prices, per-second metering, storage, the 10% platform fee and provider withdrawals. Payments are in test mode during the closed beta."
        path={ROUTES.pricing}
      />
      <section className="page-hero lp-hero">
        <div className="eyebrow">Pricing</div>
        <h1>How billing works</h1>
        <p>There's no fixed price list: providers set their own hourly prices. This page explains how a rental is charged, and what providers receive.</p>
      </section>

      <section className="lp-section">
        <p className="lp-disclaimer">Closed beta: payments are in test mode, so no real money is charged or paid out yet.</p>
      </section>

      <section className="lp-section lp-tint" aria-labelledby="pr-renter">
        <div className="lp-cols">
          <div><div className="eyebrow">For renters</div><h2 id="pr-renter">What you pay</h2></div>
          <Rows rows={RENTER} />
        </div>
      </section>

      <section className="lp-section" aria-labelledby="pr-provider">
        <div className="lp-cols">
          <div><div className="eyebrow">For providers</div><h2 id="pr-provider">What you receive</h2></div>
          <Rows rows={PROVIDER} />
        </div>
      </section>

      <section className="lp-cta">
        <h2>See current prices</h2>
        <p>Machines in the closed beta show their hourly price on the rentals page.</p>
        <div className="hero-actions">
          <Link to={ROUTES.rentals} className="primary-button" {...ctaProps("pricing_browse")}>Browse machines <ArrowRight size={17} /></Link>
          <Link to={ROUTES.waitlist} className="text-button" {...ctaProps("pricing_waitlist")}>Join renter waitlist <ArrowRight size={15} /></Link>
        </div>
      </section>
    </>
  );
}
