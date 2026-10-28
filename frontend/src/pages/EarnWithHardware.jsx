import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import SEO from "@/components/SEO";
import { ctaProps } from "@/lib/analytics";
import { ROUTES } from "@/lib/routes";

const ELIGIBILITY = [
  ["GPU", "An NVIDIA GPU. [TODO: confirm minimum GPU model and VRAM]"],
  ["Operating system", "Windows 10 or 11 (64-bit)"],
  ["Software", "Docker Desktop and a current NVIDIA driver"],
  ["Connection", "A steady internet connection. [TODO: confirm minimum upload speed]"],
  ["Region", "[TODO: confirm supported regions]"],
];

const VERIFY = [
  ["Apply or pair", "Apply with the form, or — if you already have a seller account — create a pairing code in Seller Studio."],
  ["Install Productify Node", "Install the Windows app on the machine and enter the pairing code."],
  ["Hardware report", "The app reports GPU, VRAM, CPU and memory directly from the machine. You don't type specs in by hand."],
  ["Review", "Productify reviews the machine before it appears to renters."],
];

const CONTROL = [
  ["Pause or go live", "Take the machine off the market whenever you want to use it yourself."],
  ["Limits", "Set limits on what renters can use."],
  ["Emergency stop", "Stop every running job from the app straight away."],
  ["Removing a machine", "You can delete a listing yourself before it's reviewed. After review, email hosts@productifynow.com to remove it."],
];

const SECURITY = [
  "Renter jobs run in containers that don't run as administrator/root.",
  "Containers can't see your folders or files — no host folders are shared with them.",
  "No ports are opened on your network; the app connects out to Productify.",
  "Each container and its files are deleted when the job ends.",
  "Renter jobs can't reach your computer or other devices on your home network. Each job gets its own sealed network and can only connect to public internet addresses (Productify Node 2.1 or later).",
];

export default function EarnWithHardware() {
  return (
    <>
      <SEO
        title="Earn with your GPU — become a Productify provider"
        description="Make your idle NVIDIA GPU rentable for AI developers. Eligibility, hardware verification, provider controls, security and how payouts work. Earnings depend on utilisation."
        path={ROUTES.earnWithHardware}
      />

      <section className="page-hero lp-hero">
        <figure className="lp-hero-fig"><img src="/img/gx-pc-dark.jpg" width="1920" height="1280" alt="The inside of a black gaming PC, lit in white" /></figure>
        <div className="eyebrow">Earn with hardware · closed beta</div>
        <h1>Make your idle GPU rentable</h1>
        <p>Rent out an NVIDIA GPU you already own to AI developers, on your terms. You decide when it's available.</p>
        <div className="hero-actions">
          <Link to={ROUTES.apply} className="primary-button" {...ctaProps("earn_hero_apply")}>Apply as a provider <ArrowRight size={17} /></Link>
        </div>
      </section>

      <section className="lp-section" aria-labelledby="lp-elig">
        <div className="lp-cols">
          <div>
            <div className="eyebrow">Eligibility</div>
            <h2 id="lp-elig">What you need</h2>
          </div>
          <dl className="lp-dl">
            {ELIGIBILITY.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </div>
      </section>

      <section className="lp-section lp-tint" aria-labelledby="lp-verify">
        <div className="eyebrow">Verification</div>
        <h2 id="lp-verify">How a machine gets listed</h2>
        <ol className="hm-steps">
          {VERIFY.map(([t, d], i) => <li key={t}><span className="hm-step-n">{i + 1}</span><b>{t}</b><p>{d}</p></li>)}
        </ol>
        <p className="lp-small">Already a seller? You can pair a machine yourself from <Link to="/seller" {...ctaProps("earn_seller_studio")}>Seller Studio</Link> — it still goes through review.</p>
      </section>

      <section className="lp-section" aria-labelledby="lp-control">
        <div className="eyebrow">Provider control</div>
        <h2 id="lp-control">You stay in charge of the machine</h2>
        <dl className="lp-grid2">
          {CONTROL.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </section>

      <section className="lp-section lp-tint" aria-labelledby="lp-sec">
        <div className="lp-cols">
          <div>
            <div className="eyebrow">Security approach</div>
            <h2 id="lp-sec">How renter jobs stay contained</h2>
          </div>
          <ul className="lp-bullets">{SECURITY.map((s, i) => <li key={s} className={i === SECURITY.length - 1 ? "warn" : undefined}>{s}</li>)}</ul>
        </div>
      </section>

      <section className="lp-section" aria-labelledby="lp-pay">
        <div className="lp-cols">
          <div>
            <div className="eyebrow">Payouts</div>
            <h2 id="lp-pay">How payouts will work</h2>
          </div>
          <div className="lp-prose">
            <p><b>What you earn.</b> You set an hourly price. For time your machine is rented, you receive that price minus the platform fee (10% on the Free plan).</p>
            <p><b>Withdrawals.</b> Request a withdrawal once your balance is at least $10. Each request is reviewed and paid to bank, PayPal or UPI. [TODO: confirm payout timing]</p>
            <p><b>Right now.</b> Payments are in test mode during the closed beta, so no real money moves yet.</p>
            <p className="lp-disclaimer">Earnings depend on utilisation, your price, power costs and downtime. There's no guaranteed income, and your machine may not be rented at all.</p>
          </div>
        </div>
      </section>

      <section className="lp-cta">
        <h2>Have an NVIDIA GPU sitting idle?</h2>
        <p>Tell us about your hardware. We'll get back to you about the closed beta.</p>
        <Link to={ROUTES.apply} className="primary-button" {...ctaProps("earn_footer_apply")}>Apply as a provider <ArrowRight size={17} /></Link>
      </section>
    </>
  );
}
