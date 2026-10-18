import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import SEO from "@/components/SEO";
import LeadForm from "@/components/LeadForm";
import { ctaProps } from "@/lib/analytics";
import { ROUTES } from "@/lib/routes";

const FIELDS = [
  { name: "name", label: "Name", required: true, half: true, autoComplete: "name" },
  { name: "email", label: "Email", type: "email", required: true, half: true, autoComplete: "email" },
  { name: "role", label: "Role", type: "select", required: true, half: true, options: [
    ["independent_dev", "Independent developer"], ["startup", "Startup"], ["research", "Research / student"], ["3d_artist", "3D artist"], ["other", "Other"],
  ] },
  { name: "frequency", label: "How often would you need a GPU?", type: "select", half: true, options: [
    ["once", "Once / one project"], ["monthly", "A few times a month"], ["weekly", "Weekly"], ["daily", "Most days"],
  ] },
  { name: "workload", label: "What do you want to run?", type: "textarea", required: true, max: 500, hint: "For example: fine-tune a 7B model with LoRA, PyTorch training, model testing." },
  { name: "gpu_needed", label: "GPU / VRAM needed", half: true, hint: "For example: 24 GB VRAM, RTX 4090" },
  { name: "region", label: "Your region", half: true, autoComplete: "country-name" },
  { name: "current_provider", label: "What do you use now?", half: true, hint: "Your laptop, a cloud provider, nothing yet…" },
  { name: "monthly_spend", label: "Approximate monthly GPU spend", half: true, max: 100 },
];

export default function Waitlist() {
  const [done, setDone] = useState(false);
  return (
    <>
      <SEO
        title="Join the renter waitlist — Productify"
        description="Join the Productify waitlist to rent NVIDIA GPU compute for Python and PyTorch work during the closed beta."
        path={ROUTES.waitlist}
      />
      <section className="page-hero lp-hero">
        <div className="eyebrow">Renter waitlist · closed beta</div>
        <h1>{done ? "You're on the waitlist" : "Join the renter waitlist"}</h1>
        <p>{done
          ? "Thanks. We'll email you when there's a machine that fits what you need. We won't share your details or send marketing."
          : "Tell us what you need to run. It takes about a minute."}</p>
      </section>
      <section className="lp-section lf-wrap">
        {done ? (
          <div className="lf-done" role="status">
            <h2>What happens next</h2>
            <p>We read every entry and invite people in batches as providers' machines are approved. Meanwhile you can see which machines are in the beta.</p>
            <div className="hero-actions">
              <Link to={ROUTES.rentals} className="primary-button" {...ctaProps("waitlist_done_browse")}>Browse machines <ArrowRight size={17} /></Link>
              <Link to={ROUTES.rentCompute} className="text-button text-button-dark">How renting works <ArrowRight size={15} /></Link>
            </div>
          </div>
        ) : (
          <LeadForm
            fields={FIELDS}
            endpoint="/leads/waitlist"
            submitEvent="waitlist_submit"
            formName="waitlist"
            submitLabel="Join waitlist"
            consentText={<>I agree that Productify can store these details and email me about the closed beta. See the <Link to={ROUTES.privacy}>privacy notice</Link>.</>}
            onSuccess={() => { setDone(true); window.scrollTo(0, 0); }}
          />
        )}
      </section>
    </>
  );
}
