import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import SEO from "@/components/SEO";
import LeadForm from "@/components/LeadForm";
import { ctaProps } from "@/lib/analytics";
import { ROUTES } from "@/lib/routes";

const FIELDS = [
  { name: "name", label: "Name", required: true, half: true, autoComplete: "name" },
  { name: "contact", label: "Preferred contact (email or phone)", required: true, half: true, max: 254 },
  { name: "region", label: "Country / region", required: true, half: true, autoComplete: "country-name" },
  { name: "entity", label: "Applying as", type: "select", required: true, half: true, default: "individual", options: [["individual", "Individual"], ["business", "Business"]] },
  { name: "gpu_model", label: "GPU model", required: true, half: true, hint: "For example: RTX 3090" },
  { name: "vram", label: "VRAM", half: true, max: 50, hint: "For example: 24 GB" },
  { name: "cpu", label: "CPU", half: true },
  { name: "ram", label: "RAM", half: true, max: 50 },
  { name: "storage", label: "Free storage", half: true, max: 100 },
  { name: "os", label: "Operating system", half: true, max: 100, hint: "For example: Windows 11 Pro" },
  { name: "available_hours", label: "When could the machine be available?", hint: "For example: nights and weekends, or 24/7" },
  { name: "power_notes", label: "Power and internet notes", type: "textarea", hint: "Power cuts, connection speed, anything we should know." },
  { name: "security_concerns", label: "Any security concerns?", type: "textarea" },
  { name: "expected_compensation", label: "Expected compensation", hint: "What would make this worthwhile for you?" },
];

export default function Apply() {
  const [done, setDone] = useState(false);
  return (
    <>
      <SEO
        title="Apply as a GPU provider — Productify"
        description="Apply to make your idle NVIDIA GPU rentable on Productify. Tell us about your hardware; every application is reviewed. Earnings are not guaranteed."
        path={ROUTES.apply}
      />
      <section className="page-hero lp-hero">
        <figure className="lp-hero-fig"><img src="/img/gx-pc-dark.jpg" width="1920" height="1280" alt="The inside of a black gaming PC, lit in white" /></figure>
        <div className="eyebrow">Provider application · closed beta</div>
        <h1>{done ? "Application received" : "Apply as a provider"}</h1>
        <p>{done
          ? "Thanks. We review every application and will contact you the way you asked."
          : "Tell us about your hardware. We don't ask for ID documents or bank details here."}</p>
      </section>
      <section className="lp-section lf-wrap">
        {done ? (
          <div className="lf-done" role="status">
            <h2>What happens next</h2>
            <p>If your machine fits the closed beta, we'll help you install Productify Node and pair it. The machine is checked and reviewed before renters can see it. Earnings depend on utilisation and aren't guaranteed.</p>
            <div className="hero-actions">
              <Link to={ROUTES.earnWithHardware} className="primary-button" {...ctaProps("apply_done_learn")}>How it works for providers <ArrowRight size={17} /></Link>
            </div>
          </div>
        ) : (
          <LeadForm
            fields={FIELDS}
            endpoint="/leads/provider"
            submitEvent="provider_form_submit"
            formName="provider_application"
            submitLabel="Send application"
            consentText={<>I agree that Productify can store these details and contact me about my application. See the <Link to={ROUTES.privacy}>privacy notice</Link>.</>}
            onSuccess={() => { setDone(true); window.scrollTo(0, 0); }}
          />
        )}
      </section>
    </>
  );
}
