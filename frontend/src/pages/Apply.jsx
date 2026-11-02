import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, X, AlertTriangle } from "lucide-react";
import SEO from "@/components/SEO";
import LeadForm from "@/components/LeadForm";
import { ctaProps, track } from "@/lib/analytics";
import { ROUTES } from "@/lib/routes";

// Ways to host. Only the Windows app is released; Productify OS methods are in testing and say so
// (CLAUDE.md honesty rule 3.5). No download links until a release exists.
const METHODS = [
  {
    id: "windows_app",
    name: "Productify Node app for Windows",
    status: "available",
    badge: "Available now",
    oneLine: "Install an app on your normal Windows PC. Nothing on your disk changes.",
    cost: "Free",
    need: ["Windows 10 or 11 (64-bit)", "An NVIDIA GPU with a current driver", "Docker Desktop (free)"],
    good: ["Quickest way to start", "Keep using your PC as usual", "Pause or stop renting any time from the app"],
    watch: ["Docker Desktop has to be installed and running", "Renters share the PC with Windows, so it's best when you're not using it heavily"],
  },
  {
    id: "boot_key",
    name: "Productify OS with a boot key",
    status: "testing",
    badge: "In testing · recommended when released",
    oneLine: "A small pen drive starts Productify OS from space Windows sets aside on your own drive.",
    cost: "₹0–300 (any 2 GB pen drive)",
    need: ["Any USB pen drive, 2 GB or more", "At least 60 GB free on C: (Productify takes 40 GB or more, and Windows keeps 20 GB)", "An NVIDIA GPU"],
    good: ["Cheapest way to host full-time", "Fast: runs from your internal drive", "Windows' own start-up is never changed; without the pen drive your PC starts Windows as normal", "Your Windows files are never opened", "\"Remove Productify\" gives the space back to C:"],
    watch: ["Windows shrinks C: to make room: back up first and keep the laptop plugged in", "You choose the pen drive in your PC's boot menu (we'll show the key for your brand)"],
  },
  {
    id: "external_ssd",
    name: "Productify OS on an external SSD",
    status: "testing",
    badge: "In testing",
    oneLine: "Plug in a USB SSD with Productify OS and start from it. Your internal drive is never touched.",
    cost: "₹3,000–5,000 (256 GB USB SSD)",
    need: ["A 256 GB or larger USB 3 / USB-C SSD", "An NVIDIA GPU"],
    good: ["Your computer's own drive is never changed", "Unplug it and your PC is exactly as before"],
    watch: ["You need to buy an SSD", "A slow USB port or pen drive makes it sluggish: use a real SSD on a USB 3 port"],
  },
  {
    id: "dual_boot",
    name: "Dual-boot (advanced)",
    status: "testing",
    badge: "In testing · for experienced users",
    oneLine: "Install Productify OS next to Windows on your internal drive and pick it at start-up.",
    cost: "Free",
    need: ["Comfortable with BIOS settings and partitions", "A full backup of your files", "An NVIDIA GPU"],
    good: ["Fastest setup", "Nothing to plug in", "Can start Productify OS automatically during hosting hours"],
    watch: ["Highest risk of the four (see the risks below)"],
  },
];

const DUAL_BOOT_RISKS = [
  ["Data loss while resizing", "Back up everything first, keep the laptop plugged in, and don't resize a disk that's nearly full."],
  ["BitLocker recovery-key prompt", "Save your recovery key (aka.ms/myrecoverykey) before changing anything, or suspend BitLocker during setup."],
  ["Secure Boot", "Follow our steps for your PC, or turn Secure Boot off temporarily."],
  ["Windows updates can remove the boot menu", "Our repair tool puts it back; the boot key method avoids this entirely."],
  ["Fast Startup and hibernation can damage a shared disk", "Turn both off (setup does this for you)."],
];

const CHOOSER = [
  ["Start today", "windows_app"],
  ["Spend as little as possible", "boot_key"],
  ["Don't touch my computer's drive", "external_ssd"],
  ["Best speed, I know my way around PCs", "dual_boot"],
];

const FIELDS = [
  { name: "name", label: "Name", required: true, half: true, autoComplete: "name" },
  { name: "contact", label: "Preferred contact (email or phone)", required: true, half: true, max: 254 },
  { name: "region", label: "Country / region", required: true, half: true, autoComplete: "country-name" },
  { name: "entity", label: "Hosting as", type: "select", required: true, half: true, default: "individual", options: [["individual", "Individual"], ["business", "Business"]] },
  { name: "setup_method", label: "Which way would you like to host?", type: "select", required: true, half: true, default: "not_sure",
    options: [["not_sure", "Not sure yet"], ["windows_app", "Windows app (available now)"], ["boot_key", "Boot key (in testing)"], ["external_ssd", "External SSD (in testing)"], ["dual_boot", "Dual-boot (in testing)"]] },
  { name: "gpu_model", label: "GPU model", required: true, half: true, hint: "For example: RTX 3060" },
  { name: "vram", label: "VRAM", half: true, max: 50, hint: "For example: 12 GB" },
  { name: "cpu", label: "CPU", half: true },
  { name: "ram", label: "RAM", half: true, max: 50 },
  { name: "storage", label: "Free storage", half: true, max: 100 },
  { name: "os", label: "Operating system", half: true, max: 100, hint: "For example: Windows 11 Home" },
  { name: "available_hours", label: "When could the machine be available?", hint: "For example: nights and weekends, or 24/7" },
  { name: "power_notes", label: "Power and internet notes", type: "textarea", hint: "Power cuts, connection speed (especially upload), anything we should know." },
  { name: "security_concerns", label: "Any security concerns?", type: "textarea" },
  { name: "expected_compensation", label: "Expected compensation", hint: "What would make this worthwhile for you?" },
];

function MethodCard({ m, picked }) {
  return (
    <article id={`hs-${m.id}`} className={`hs-card${picked ? " picked" : ""}${m.status === "available" ? " live" : ""}`}>
      <div className="hs-badge">{m.badge}</div>
      <h3>{m.name}</h3>
      <p className="hs-one">{m.oneLine}</p>
      <dl className="hs-facts">
        <div><dt>Cost</dt><dd>{m.cost}</dd></div>
        <div><dt>You need</dt><dd><ul>{m.need.map((n) => <li key={n}>{n}</li>)}</ul></dd></div>
      </dl>
      <ul className="lp-list ok">{m.good.map((g) => <li key={g}><Check size={18} aria-hidden="true" />{g}</li>)}</ul>
      <ul className="lp-list no">{m.watch.map((w) => <li key={w}><X size={18} aria-hidden="true" />{w}</li>)}</ul>
    </article>
  );
}

export default function Apply() {
  const [done, setDone] = useState(false);
  const [picked, setPicked] = useState("");

  const pick = (id) => {
    setPicked(id);
    track("cta_click", { cta_name: `host_chooser_${id}` });
    document.getElementById(`hs-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <>
      <SEO
        title="Start hosting — ways to rent out your GPU · Productify"
        description="All the ways to rent out your NVIDIA GPU on Productify: the Windows app (available now), and Productify OS with a boot key, an external SSD or dual-boot (in testing). Costs, needs, pros and risks."
        path={ROUTES.apply}
      />
      <section className="page-hero lp-hero">
        <figure className="lp-hero-fig"><img src="/img/gx-pc-dark.jpg" width="1920" height="1280" alt="The inside of a black gaming PC, lit in white" /></figure>
        <div className="eyebrow">Start hosting · closed beta</div>
        <h1>{done ? "You're on the list" : "Choose how you'll host"}</h1>
        <p>{done
          ? "Thanks. We review every request and will contact you the way you asked, with the setup that fits your machine."
          : "There's more than one way to rent out your GPU. Pick the one that fits your computer and budget, then register below. Earnings depend on how often your machine is rented and aren't guaranteed."}</p>
        {!done && <div className="hero-actions"><a href="#hs-register" className="primary-button" {...ctaProps("host_hero_register")}>Register as a host <ArrowRight size={17} /></a></div>}
      </section>

      {!done && (
        <>
          <section className="lp-section" aria-labelledby="hs-choose">
            <div className="eyebrow">Not sure where to start?</div>
            <h2 id="hs-choose">What matters most to you?</h2>
            <div className="hs-chooser" role="group" aria-label="Pick what matters most">
              {CHOOSER.map(([label, id]) => (
                <button key={id} type="button" className={`hs-pick${picked === id ? " on" : ""}`} aria-pressed={picked === id} onClick={() => pick(id)}>{label}</button>
              ))}
            </div>
            <p className="lp-small">Tip: if you're new, start with the Windows app today. You can switch to Productify OS later without losing your listing.</p>
          </section>

          <section className="lp-section lp-tint" aria-labelledby="hs-ways">
            <div className="eyebrow">The options</div>
            <h2 id="hs-ways">Four ways to host</h2>
            <p className="lp-small">Productify OS is a lightweight system built only for hosting. It's in testing and not available to download yet; register below to be told when it's ready.</p>
            <div className="hs-grid">{METHODS.map((m) => <MethodCard key={m.id} m={m} picked={picked === m.id} />)}</div>
          </section>

          <section className="lp-section" aria-labelledby="hs-compare">
            <div className="eyebrow">Side by side</div>
            <h2 id="hs-compare">Compare</h2>
            <div className="hs-table-wrap">
              <table className="hs-table">
                <thead><tr><th scope="col">Method</th><th scope="col">Cost</th><th scope="col">Changes your drive?</th><th scope="col">Speed</th><th scope="col">Risk</th><th scope="col">Status</th></tr></thead>
                <tbody>
                  <tr><th scope="row">Windows app</th><td>Free</td><td>No</td><td>Good</td><td>Lowest</td><td>Available now</td></tr>
                  <tr><th scope="row">Boot key</th><td>₹0–300</td><td>Windows makes a separate partition</td><td>Fast</td><td>Low</td><td>In testing</td></tr>
                  <tr><th scope="row">External SSD</th><td>₹3–5k</td><td>No</td><td>Fast (on USB 3)</td><td>Lowest</td><td>In testing</td></tr>
                  <tr><th scope="row">Dual-boot</th><td>Free</td><td>Yes, resized</td><td>Fastest</td><td>Higher</td><td>In testing</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="lp-section lp-tint" aria-labelledby="hs-risks">
            <div className="lp-cols">
              <div>
                <div className="eyebrow">Before you dual-boot</div>
                <h2 id="hs-risks">Risks, and how to avoid them</h2>
                <p className="lp-small"><AlertTriangle size={16} aria-hidden="true" /> These apply to dual-boot. The boot key method avoids most of them, and the external SSD avoids all of them.</p>
              </div>
              <dl className="lp-dl">{DUAL_BOOT_RISKS.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            </div>
          </section>

          <section className="lp-section" aria-labelledby="hs-safe">
            <div className="lp-cols">
              <div>
                <div className="eyebrow">Whichever you choose</div>
                <h2 id="hs-safe">What stays the same</h2>
              </div>
              <ul className="lp-bullets">
                <li>Renters only get the GPU, CPU, memory and storage you allow.</li>
                <li>Renter jobs run in isolated containers and can't reach your files or the other devices on your home network. <Link to={ROUTES.security}>How isolation works</Link>.</li>
                <li>Every machine is checked and reviewed before renters can see it.</li>
                <li>You can pause or stop renting at any time.</li>
                <li>Questions? Email <a href="mailto:hosts@productifynow.com">hosts@productifynow.com</a>.</li>
              </ul>
            </div>
          </section>
        </>
      )}

      <section id="hs-register" className="lp-section lf-wrap" aria-labelledby="hs-reg-title">
        {done ? (
          <div className="lf-done" role="status">
            <h2>What happens next</h2>
            <p>If your machine fits the closed beta, we'll help you set up the method you picked — or suggest a better one for your hardware. The machine is checked and reviewed before renters can see it. Earnings depend on utilisation and aren't guaranteed.</p>
            <div className="hero-actions">
              <Link to={ROUTES.earnWithHardware} className="primary-button" {...ctaProps("apply_done_learn")}>How it works for providers <ArrowRight size={17} /></Link>
            </div>
          </div>
        ) : (
          <>
            <div className="eyebrow">Register</div>
            <h2 id="hs-reg-title">Register as a host</h2>
            <p className="lp-small">Tell us about your machine. We don't ask for ID documents or bank details here.</p>
            <LeadForm
              fields={FIELDS}
              endpoint="/leads/provider"
              submitEvent="provider_form_submit"
              formName="provider_application"
              submitLabel="Register"
              consentText={<>I agree that Productify can store these details and contact me about hosting. See the <Link to={ROUTES.privacy}>privacy notice</Link>.</>}
              onSuccess={() => { setDone(true); window.scrollTo(0, 0); }}
            />
          </>
        )}
      </section>
    </>
  );
}
