import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Code2, SlidersHorizontal, FlaskConical, Box, ShieldCheck, Gauge, LifeBuoy } from "lucide-react";
import { api, money } from "@/lib/api";
import { ctaProps } from "@/lib/analytics";
import { ROUTES } from "@/lib/routes";
import SEO from "@/components/SEO";
import GpuVisual from "@/components/GpuVisual";
import Availability, { availabilityOf } from "@/components/Availability";

const USE_CASES = [
  { icon: Code2, title: "AI development", text: "Run Python and PyTorch code on an NVIDIA GPU when your laptop isn't enough. JupyterLab is on the way." },
  { icon: SlidersHorizontal, title: "Fine-tuning", text: "Fine-tune models on a machine with the VRAM the job needs, and stop it when the job is done." },
  { icon: FlaskConical, title: "Model testing", text: "Try a model on real GPU hardware before you commit to buying or reserving your own." },
];

const STEPS = [
  ["Choose a resource", "Pick a machine by GPU, VRAM and price."],
  ["Start a rental", "Launch a PyTorch environment on it."],
  ["Connect securely", "Work in the browser; your job runs in an isolated container."],
  ["Track usage", "See runtime and cost while it runs."],
  ["Stop", "Stop when you're done. The container and its files are deleted."],
];

const PROVIDER_POINTS = [
  ["Apply", "Tell us about your hardware. Productify reviews every application."],
  ["Hardware verification", "The Productify Node app reports your GPU, memory and CPU directly from the machine."],
  ["Availability controls", "Pause renting, set limits or stop all jobs from the app at any time."],
  ["Operating requirements", "An NVIDIA GPU, Windows with Docker Desktop, and a steady internet connection."],
  ["Payments", "Providers are paid for rented time minus the platform fee. Earnings depend on utilisation, price, power costs and downtime; nothing is guaranteed."],
];

function MachineCard({ r }) {
  return (
    <article className="hm-card">
      <Link to={`/rental/${r.id}`} className="hm-card-visual" aria-label={r.title}><GpuVisual rental={r} /></Link>
      <div className="hm-card-body">
        <div className="hm-card-top">
          <Availability r={r} />
          <span className="dash-pill muted">Closed beta</span>
        </div>
        <dl className="hm-specs">
          <div><dt>GPU</dt><dd>{r.gpu}</dd></div>
          <div><dt>VRAM</dt><dd>{r.vram || "—"}</dd></div>
          <div><dt>Region</dt><dd>{r.location || "—"}</dd></div>
          <div><dt>Price</dt><dd>{money(r.price)}/hr</dd></div>
        </dl>
        <Link className="text-button text-button-dark" to={`/rental/${r.id}`} {...ctaProps("home_machine_card", { rental_id: r.id })}>View machine <ArrowRight size={14} /></Link>
      </div>
    </article>
  );
}

export default function Home() {
  const [machines, setMachines] = useState(null);

  useEffect(() => {
    api.get("/rentals")
      .then((res) => setMachines([...res.data].sort((a, b) => Number(availabilityOf(b) === "available") - Number(availabilityOf(a) === "available") || Number(b.is_online) - Number(a.is_online) || a.price - b.price)))
      .catch(() => setMachines([]));
  }, []);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Productify",
    "url": "https://www.productifynow.com",
  };

  return (
    <>
      <SEO
        title="Productify — Rent GPU compute · Earn with your hardware"
        description="Productify is a marketplace for renting GPU compute. Rent an NVIDIA GPU for AI development by the hour, or apply to make your idle GPU rentable. Closed beta."
        path="/"
        jsonLd={jsonLd}
      />

      {/* 1. Hero */}
      <section className="hero hm-hero" data-testid="home-hero">
        <div className="hero-copy">
          <div className="eyebrow">PRODUCTIFY / Rent Compute · Earn with Hardware</div>
          <h1>Computing power when you need it.</h1>
          <p>
            Rent an NVIDIA GPU by the hour for AI development, or make your own idle GPU
            available to others. Productify handles matching, isolation and billing.
            We're in closed beta.
          </p>
          <div className="hero-actions">
            <Link to={ROUTES.waitlist} className="primary-button" {...ctaProps("hero_join_waitlist")}>
              Join renter waitlist <ArrowRight size={17} />
            </Link>
            <Link to={ROUTES.apply} className="text-button" {...ctaProps("hero_apply_provider")}>
              Apply as a provider <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Browse compute */}
      <section className="hm-section" aria-labelledby="hm-browse">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Browse compute</div>
            <h2 id="hm-browse">Machines in the closed beta</h2>
          </div>
          <Link to={ROUTES.rentals} className="text-button text-button-dark" {...ctaProps("home_all_machines")}>All machines <ArrowRight size={15} /></Link>
        </div>
        <p className="hm-note">
          These machines are listed by providers and were checked by the Productify Node app on
          the machine itself. Renting is in closed beta: availability changes as providers go
          online and offline, and payments are in test mode.
        </p>
        {machines === null ? (
          <p className="hm-empty">Loading machines…</p>
        ) : machines.length === 0 ? (
          <p className="hm-empty">
            No machines are listed yet. <Link to={ROUTES.waitlist} {...ctaProps("browse_empty_waitlist")}>Join the waitlist</Link> and we'll tell you when there are.
          </p>
        ) : (
          <div className="hm-cards">{machines.slice(0, 3).map((r) => <MachineCard key={r.id} r={r} />)}</div>
        )}
      </section>

      {/* 3. Use cases */}
      <section className="hm-section hm-tint" aria-labelledby="hm-uses">
        <div className="eyebrow">Use cases</div>
        <h2 id="hm-uses">What you can run</h2>
        <div className="hm-grid3">
          {USE_CASES.map(({ icon: Icon, title, text }) => (
            <div className="hm-tile" key={title}>
              <Icon size={20} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
        <div className="hm-later">
          <Box size={18} aria-hidden="true" />
          <p><b>3D rendering — future pilot.</b> Blender rendering isn't supported yet. We plan to pilot it later; the waitlist form lets you tell us you're interested.</p>
        </div>
      </section>

      {/* 4. How it works */}
      <section className="hm-section" aria-labelledby="hm-how">
        <div className="eyebrow">How it works</div>
        <h2 id="hm-how">From choosing a machine to stopping it</h2>
        <ol className="hm-steps">
          {STEPS.map(([title, text], i) => (
            <li key={title}><span className="hm-step-n">{i + 1}</span><b>{title}</b><p>{text}</p></li>
          ))}
        </ol>
        <Link to={ROUTES.rentCompute} className="text-button text-button-dark" {...ctaProps("home_how_rent_compute")}>More about renting compute <ArrowRight size={14} /></Link>
      </section>

      {/* 5. For providers */}
      <section className="hm-section hm-dark" aria-labelledby="hm-providers">
        <div className="hm-split">
          <div>
            <div className="eyebrow">For providers</div>
            <h2 id="hm-providers">Have an idle NVIDIA GPU?</h2>
            <p className="hm-lead">
              Apply to make it rentable. You stay in control of when it's available and what
              renters can use.
            </p>
            <div className="hero-actions">
              <Link to={ROUTES.apply} className="primary-button" {...ctaProps("providers_apply")}>Apply as a provider <ArrowRight size={17} /></Link>
              <Link to={ROUTES.earnWithHardware} className="text-button" {...ctaProps("providers_learn_more")}>How it works for providers <ArrowRight size={15} /></Link>
            </div>
          </div>
          <dl className="hm-points">
            {PROVIDER_POINTS.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </div>
      </section>

      {/* 6. Trust & support */}
      <section className="hm-section" aria-labelledby="hm-trust">
        <div className="eyebrow">Trust &amp; support</div>
        <h2 id="hm-trust">Status, security and help</h2>
        <div className="hm-grid3">
          <Link to={ROUTES.security} className="hm-tile hm-link" {...ctaProps("trust_security")}>
            <ShieldCheck size={20} aria-hidden="true" /><h3>Security</h3>
            <p>How renter jobs are isolated from the provider's computer, and what providers can and can't see.</p>
          </Link>
          <Link to={ROUTES.pricing} className="hm-tile hm-link" {...ctaProps("trust_pricing")}>
            <Gauge size={20} aria-hidden="true" /><h3>Pricing</h3>
            <p>How hourly billing works, when it starts and stops, and the platform fee.</p>
          </Link>
          <Link to={ROUTES.faq} className="hm-tile hm-link" {...ctaProps("trust_faq")}>
            <LifeBuoy size={20} aria-hidden="true" /><h3>FAQ &amp; contact</h3>
            <p>Answers to common questions, and how to reach us.</p>
          </Link>
        </div>
        <p className="hm-status">
          <b>Product status:</b> closed beta. GPU compute for AI/ML development (JupyterLab, Python,
          PyTorch on NVIDIA GPUs). Payments are in test mode. Read our <Link to={ROUTES.privacy}>privacy notice</Link> or <Link to={ROUTES.contact}>contact us</Link>.
        </p>
      </section>
    </>
  );
}
