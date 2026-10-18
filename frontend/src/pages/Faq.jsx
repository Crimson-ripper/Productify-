import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import SEO from "@/components/SEO";
import { ctaProps } from "@/lib/analytics";
import { ROUTES } from "@/lib/routes";

const GROUPS = [
  ["About Productify", [
    ["What is Productify?", "A marketplace for renting GPU compute. Renters use NVIDIA GPUs by the hour for AI development; providers make their idle GPUs rentable. Productify also has a separate marketplace for digital products."],
    ["Is it live?", "It's in closed beta. Some machines are listed, availability changes as providers go online and offline, and payments are in test mode."],
    ["Where are the machines?", "Each machine shows its region. [TODO: confirm supported regions]"],
  ]],
  ["Renting", [
    ["What can I run?", "Python and PyTorch on an NVIDIA GPU. JupyterLab is on the way and Blender rendering is a future pilot. Gaming, full remote desktops and Adobe or Autodesk apps aren't supported."],
    ["How am I charged?", "By the provider's hourly price, metered per second while the instance runs, plus a small storage charge. See Pricing."],
    ["What happens to my files when I stop?", "The container and its files are deleted. Download anything you need before stopping."],
    ["Can the provider see my work?", "Jobs run in isolated containers without access to the provider's files, but the provider owns the hardware. Don't upload secrets. See Security."],
  ]],
  ["Providing", [
    ["What do I need?", "An NVIDIA GPU, Windows 10 or 11, Docker Desktop, a current NVIDIA driver and a steady internet connection."],
    ["How much will I earn?", "We can't promise an amount. You set your price; earnings depend on how often your machine is rented, power costs and downtime. Productify keeps a 10% fee on the Free plan."],
    ["Can I use my computer while it's listed?", "Yes. You can pause renting or stop all jobs from the Productify Node app at any time."],
    ["How do I get paid?", "Once your balance reaches $10 you can request a withdrawal to bank, PayPal or UPI; each request is reviewed. Payments are in test mode during the beta."],
  ]],
];

export default function Faq() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: GROUPS.flatMap(([, qs]) => qs.filter(([, a]) => !a.includes("[TODO")).map(([q, a]) => ({
      "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a },
    }))),
  };
  return (
    <>
      <SEO
        title="FAQ — renting and providing GPU compute · Productify"
        description="Answers about Productify's closed beta: what you can run, how billing works, provider requirements, earnings and payouts."
        path={ROUTES.faq}
        jsonLd={jsonLd}
      />
      <section className="page-hero lp-hero">
        <div className="eyebrow">FAQ</div>
        <h1>Questions and answers</h1>
        <p>Can't find your answer? Email <a className="lp-hero-link" href="mailto:support@productifynow.com">support@productifynow.com</a>.</p>
      </section>
      {GROUPS.map(([title, qs], i) => (
        <section className={i % 2 ? "lp-section lp-tint" : "lp-section"} key={title} aria-label={title}>
          <h2>{title}</h2>
          <div className="lp-faq">
            {qs.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </section>
      ))}
      <section className="lp-cta">
        <h2>Ready to take part?</h2>
        <div className="hero-actions">
          <Link to={ROUTES.waitlist} className="primary-button" {...ctaProps("faq_waitlist")}>Join renter waitlist <ArrowRight size={17} /></Link>
          <Link to={ROUTES.apply} className="text-button" {...ctaProps("faq_apply")}>Apply as a provider <ArrowRight size={15} /></Link>
        </div>
      </section>
    </>
  );
}
