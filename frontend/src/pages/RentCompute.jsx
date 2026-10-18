import { Link } from "react-router-dom";
import { ArrowRight, Check, X } from "lucide-react";
import SEO from "@/components/SEO";
import { ctaProps } from "@/lib/analytics";
import { ROUTES } from "@/lib/routes";

const SUPPORTED = [
  "Python and PyTorch on an NVIDIA GPU",
  "Training, fine-tuning and testing models that fit in the machine's VRAM",
  "Running your own scripts and notebooks-style code from the browser",
];
const NOT_YET = [
  ["JupyterLab", "on the way"],
  ["Blender / 3D rendering", "future pilot"],
  ["Gaming, full remote desktops, Adobe or Autodesk apps", "not supported"],
];

const STEPS = [
  ["Choose a machine", "Compare GPU, VRAM, region and hourly price on the rentals page."],
  ["Start a rental", "Pick a PyTorch environment and launch it on that machine."],
  ["Connect securely", "Work from your browser. Your code runs in a locked-down container that can't reach the provider's files."],
  ["Track usage", "Runtime and cost update while the instance runs."],
  ["Stop", "Stop the instance when you're done. The container and its files are deleted."],
];

const FAQ = [
  ["Who owns the machines?", "Independent providers who list their own NVIDIA GPUs. Each machine is paired with the Productify Node app, which reports its hardware, and is reviewed before it appears."],
  ["Can the provider see my work?", "Your job runs in an isolated container with no access to the provider's files, and the provider can't open it from the Productify app. The provider still owns the computer, so don't upload secrets you can't afford to expose. See Security for details."],
  ["What if a machine goes offline?", "Providers' computers can go offline. Offline machines are marked as such and can't start new rentals."],
  ["Is this ready for production work?", "Not yet. Productify is in closed beta and payments are in test mode. Use it for experiments and evaluation."],
];

export default function RentCompute() {
  return (
    <>
      <SEO
        title="Rent GPU compute for AI development — Productify"
        description="Rent an NVIDIA GPU by the hour for Python and PyTorch work. See supported workloads, how renting works and how billing is calculated. Closed beta — join the waitlist."
        path={ROUTES.rentCompute}
      />

      <section className="page-hero lp-hero">
        <div className="eyebrow">Rent compute · closed beta</div>
        <h1>A GPU for your AI work, by the hour</h1>
        <p>For developers, researchers and students whose laptop can't train or test the model they're working on.</p>
        <div className="hero-actions">
          <Link to={ROUTES.waitlist} className="primary-button" {...ctaProps("rent_hero_waitlist")}>Join renter waitlist <ArrowRight size={17} /></Link>
          <Link to={ROUTES.rentals} className="text-button" {...ctaProps("rent_hero_browse")}>Browse machines <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-cols">
          <div>
            <div className="eyebrow">The problem</div>
            <h2>Buying a GPU for occasional work rarely makes sense</h2>
          </div>
          <div className="lp-prose">
            <p>Most laptops can't train or even run modern models. A capable GPU costs a lot up front, and sits idle between projects.</p>
            <p>Productify lets you rent one by the hour from people who already own one, and stop paying the moment you stop the machine.</p>
          </div>
        </div>
      </section>

      <section className="lp-section lp-tint" aria-labelledby="lp-workloads">
        <div className="eyebrow">Supported workloads</div>
        <h2 id="lp-workloads">What you can run today</h2>
        <div className="lp-cols">
          <ul className="lp-list ok">
            {SUPPORTED.map((s) => <li key={s}><Check size={16} aria-hidden="true" />{s}</li>)}
          </ul>
          <ul className="lp-list no">
            {NOT_YET.map(([s, why]) => <li key={s}><X size={16} aria-hidden="true" /><span>{s} <small>— {why}</small></span></li>)}
          </ul>
        </div>
      </section>

      <section className="lp-section" aria-labelledby="lp-how">
        <div className="eyebrow">How it works</div>
        <h2 id="lp-how">Five steps</h2>
        <ol className="hm-steps">
          {STEPS.map(([t, d], i) => <li key={t}><span className="hm-step-n">{i + 1}</span><b>{t}</b><p>{d}</p></li>)}
        </ol>
      </section>

      <section className="lp-section lp-tint" aria-labelledby="lp-pricing">
        <div className="lp-cols">
          <div>
            <div className="eyebrow">Pricing logic</div>
            <h2 id="lp-pricing">You pay for the time the machine runs</h2>
          </div>
          <div className="lp-prose">
            <p><b>Hourly price.</b> Each provider sets an hourly price for their machine. It's shown on the machine's page before you start.</p>
            <p><b>Storage.</b> The disk you choose for an instance adds $0.0002 per GB per hour.</p>
            <p><b>Metering.</b> Cost is calculated from the seconds the instance is running, at the hourly rate. It starts when the instance starts and stops when you stop it.</p>
            <p><b>Bandwidth.</b> [TODO: confirm whether network transfer is included or charged].</p>
            <p className="lp-small">Payments are in test mode during the closed beta. See <Link to={ROUTES.pricing}>Pricing</Link> for details.</p>
          </div>
        </div>
      </section>

      <section className="lp-section" aria-labelledby="lp-faq">
        <div className="eyebrow">FAQ</div>
        <h2 id="lp-faq">Common questions</h2>
        <div className="lp-faq">
          {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </div>
        <p className="lp-small">More answers in the <Link to={ROUTES.faq}>FAQ</Link>, and how isolation works on the <Link to={ROUTES.security}>Security</Link> page.</p>
      </section>

      <section className="lp-cta">
        <h2>Want a GPU when the beta opens up?</h2>
        <p>Tell us what you need to run. We'll contact you when there's a machine that fits.</p>
        <Link to={ROUTES.waitlist} className="primary-button" {...ctaProps("rent_footer_waitlist")}>Join renter waitlist <ArrowRight size={17} /></Link>
      </section>
    </>
  );
}
