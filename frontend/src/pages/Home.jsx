import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api, money } from "@/lib/api";
import { ctaProps } from "@/lib/analytics";
import { ROUTES } from "@/lib/routes";
import SEO from "@/components/SEO";
import { availabilityOf } from "@/components/Availability";

// Redesign prototype (branch redesign-prototype). Direction: "the sentence is the layout" —
// the headline carries a live piece of the product (a real listed GPU) where a word would be.

// Real output recorded on a provider's RTX 4060 laptop during closed-beta testing, 19 Oct 2026.
const RECORDED = [
  {
    cmd: "nvidia-smi",
    out: `NVIDIA-SMI 610.55        KMD Version: 610.78     CUDA UMD Version: 13.3
GPU  Name                     Persistence-M | Bus-Id          Disp.A
 0   NVIDIA GeForce RTX 4060 ...       On   | 00000000:01:00.0  On
N/A  54C  P0   16W /  85W   |   754MiB /  8188MiB   |   0%   Default`,
    note: "The renter's container sees the provider's GPU directly.",
  },
  {
    cmd: `python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"`,
    out: "True NVIDIA GeForce RTX 4060 Laptop GPU",
    note: "PyTorch finds CUDA without any setup.",
  },
  {
    cmd: `python -c "import torch; x=torch.rand(8000,8000,device='cuda'); print((x@x).sum())"`,
    out: "tensor(1.2798e+11, device='cuda:0')\nProcess finished with exit code 0 in 1.703s",
    note: "An 8000 × 8000 matrix multiply on the GPU.",
  },
  {
    cmd: "whoami",
    out: "whoami: cannot find name for user ID 1000",
    note: "Jobs run as an unprivileged user, never as administrator.",
  },
  {
    cmd: "ls -la /mnt",
    out: "total 8\ndrwxr-xr-x 2 root root 4096 Jun 27  2024 .\ndrwxr-xr-x 1 root root 4096 Oct 19 11:10 ..",
    note: "None of the provider's drives are visible.",
  },
];

const STAGES = [
  { name: "Choose", clause: "Choose a machine that fits" },
  { name: "Start", clause: "Start PyTorch in a container" },
  { name: "Run", clause: "Run your code from the browser" },
  { name: "Stop", clause: "Stop, and billing stops too" },
];

const PROVIDER_LINES = [
  ["Renters never see your files.", "Jobs run in a container with no access to your folders, as user 1000 — not as administrator."],
  ["Renters can't reach your network.", "Internet only through a filter: public sites on ports 80 and 443. Your PC and router are blocked."],
  ["One renter uses your GPU at a time.", "A machine in use shows as busy; nobody else can start on it."],
  ["You can stop everything, instantly.", "Pause or emergency-stop from the Productify Node app. Billing ends the same moment."],
  ["Earnings aren't guaranteed.", "You get your hourly price minus a 10% fee, for the time your machine is rented."],
];

const FAQ = [
  ["What can I run?", "Python and PyTorch on an NVIDIA GPU, from a browser terminal. JupyterLab is on the way; Blender rendering is a future pilot. Gaming and full remote desktops aren't supported."],
  ["How am I charged?", "The machine's hourly price, metered by the second while the instance runs, plus $0.0002 per GB of disk per hour. Instances stop automatically when your credits run out."],
  ["Is it live?", "It's a closed beta. Some machines are listed, they go online and offline, and payments are in test mode."],
  ["Can the provider see my work?", "Your job runs in an isolated container without access to the provider's files, but the provider owns the hardware. Don't upload secrets you can't afford to expose."],
  ["What happens to my files when I stop?", "The container and its files are deleted. Download anything you need before stopping."],
  ["What does a provider need?", "An NVIDIA GPU, Windows 10 or 11, Docker Desktop, a current NVIDIA driver and a steady internet connection."],
];


function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    document.documentElement.classList.add("hp-motion");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px" });
    els.forEach((el) => io.observe(el));
    // Never leave content hidden: reveal everything after a moment even if the observer misses it.
    const t = setTimeout(() => els.forEach((el) => el.classList.add("is-in")), 2500);
    return () => { io.disconnect(); clearTimeout(t); };
  }, []);
}

/* ---------- Hero: the GPU sits in the sentence ---------- */
// The word "GPU" is shown, not said: a crop of the real nvidia-smi output from a provider's RTX 4060.
function HeroSlot() {
  return (
    <span className="hp-slot">
      <img src="/img/smi-gpu.jpg" width="904" height="158" alt="GPU" />
    </span>
  );
}

function Hero({ machines }) {
  const online = machines.filter((m) => m.is_online).length;
  return (
    <section className="hp-hero" aria-labelledby="hp-title">
      <h1 id="hp-title" className="hp-title">
        <span className="hp-line"><span>Rent a <HeroSlot /></span></span>
        <span className="hp-line"><span>by the hour.</span></span>
      </h1>
      <p className="hp-lead">
        Productify connects AI developers with people who have an idle NVIDIA GPU at home. Run PyTorch on it,
        billed by the second. We're in closed beta.
      </p>
      <div className="hp-actions">
        <Link to={ROUTES.waitlist} className="hp-btn" {...ctaProps("hero_join_waitlist")}>Join the renter waitlist <ArrowRight size={18} /></Link>
        <Link to={ROUTES.apply} className="hp-link-on-ink" {...ctaProps("hero_apply_provider")}>Apply as a provider</Link>
      </div>
      <p className="hp-live" data-ui>
        {machines.length
          ? <><b>{machines.length}</b> machine{machines.length === 1 ? "" : "s"} listed · <b>{online}</b> online right now · <Link to={ROUTES.rentals}>see them all</Link></>
          : "Checking which machines are online…"}
      </p>
    </section>
  );
}

/* ---------- Showcase: type a command, see the real output ---------- */
function Showcase() {
  const [cmd, setCmd] = useState(RECORDED[1].cmd);
  const hit = RECORDED.find((r) => r.cmd.trim() === cmd.trim());
  return (
    <section className="hp-show" aria-labelledby="hp-show-h">
      <h2 id="hp-show-h" className="hp-h2" data-reveal>This ran on a rented GPU.</h2>
      <p className="hp-body" data-reveal>
        These are real commands and their real output, recorded on a provider's RTX 4060 laptop during closed-beta
        testing on 19 October 2026. Pick one, or type it yourself.
      </p>
      <label className="hp-show-field" data-ui data-reveal>
        <span className="hp-sr">Command</span>
        <span className="hp-prompt" aria-hidden="true">$</span>
        <input value={cmd} onChange={(e) => setCmd(e.target.value)} spellCheck={false} autoCapitalize="off" autoComplete="off" />
      </label>
      <div className="hp-show-out" data-ui data-reveal aria-live="polite">
        {hit ? (
          <>
            {hit.cmd === "nvidia-smi"
              ? <img className="hp-show-img" src="/img/smi.jpg" width="1090" height="330" alt="nvidia-smi output: NVIDIA GeForce RTX 4060, 54°C, 16 W of 85 W, 754 MiB of 8188 MiB memory used" />
              : <pre>{hit.out}</pre>}
            <p>{hit.note}</p>
          </>
        ) : (
          <p>That command isn't in this recording. Start an instance to run your own — any command, two minutes each.</p>
        )}
      </div>
      <div className="hp-show-try" data-reveal>
        {RECORDED.map((r) => (
          <button type="button" key={r.cmd} onClick={() => setCmd(r.cmd)} aria-pressed={r.cmd === cmd}>
            {r.cmd.startsWith("python") ? (r.cmd.includes("rand") ? "a GPU matrix multiply" : "PyTorch sees CUDA") : r.cmd}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------- How it works: drag through the stages ---------- */
function StageFragment({ stage, machine }) {
  if (stage === 0) {
    return (
      <div className="hp-frag" data-ui>
        <div className="hp-frag-row"><b>{machine ? machine.gpu : "NVIDIA GeForce RTX 4060 Laptop GPU"}</b></div>
        <dl className="hp-frag-dl">
          <div><dt>VRAM</dt><dd>{machine?.vram || "8 GB"}</dd></div>
          <div><dt>Region</dt><dd>{machine?.location || "—"}</dd></div>
          <div><dt>Price</dt><dd>{money(machine?.price ?? 0.4)}/hr</dd></div>
          <div><dt>Status</dt><dd>{machine ? (availabilityOf(machine) === "available" ? "Available now" : availabilityOf(machine) === "offline" ? "Offline" : "In use") : "Available now"}</dd></div>
        </dl>
        <span className="hp-frag-btn">Start instance</span>
      </div>
    );
  }
  if (stage === 1) {
    return (
      <div className="hp-frag" data-ui>
        <div className="hp-frag-row"><b>Environment</b></div>
        <div className="hp-frag-opt is-on"><b>PyTorch (CUDA)</b><span>Python with PyTorch and CUDA on the machine's GPU.</span></div>
        <div className="hp-frag-opt"><b>Python</b><span>A plain Python environment for scripts and tools.</span></div>
        <div className="hp-frag-row hp-frag-sub">Disk 50 GB · +$0.01/hr</div>
      </div>
    );
  }
  if (stage === 2) {
    return (
      <div className="hp-frag hp-frag-term" data-ui>
        <pre>{`$ python -c "import torch; print(torch.cuda.is_available())"
True
Process finished with exit code 0 in 1.863s`}</pre>
      </div>
    );
  }
  return (
    <div className="hp-frag" data-ui>
      <div className="hp-frag-row"><b>Instance stopped</b></div>
      <dl className="hp-frag-dl">
        <div><dt>Runtime</dt><dd>00:11:06</dd></div>
        <div><dt>Rate</dt><dd>$0.41/hr</dd></div>
        <div><dt>Charged</dt><dd>$0.0759</dd></div>
        <div><dt>Files</dt><dd>Deleted</dd></div>
      </dl>
      <div className="hp-frag-row hp-frag-sub">From the 19 Oct test: $0.40 compute + $0.01 disk, billed by the second.</div>
    </div>
  );
}

function HowItWorks({ machine }) {
  const [stage, setStage] = useState(0);
  return (
    <section className="hp-how" aria-labelledby="hp-how-h">
      <div className="hp-how-text">
        <h2 id="hp-how-h" className="hp-h2" key={stage}>{STAGES[stage].clause}</h2>
        <ol className="hp-how-names">
          {STAGES.map((s, i) => <li key={s.name} className={i === stage ? "is-on" : ""}>{s.name}</li>)}
        </ol>
      </div>
      <div className="hp-how-frag"><StageFragment stage={stage} machine={machine} /></div>
      <label className="hp-how-range" data-ui>
        <span className="hp-sr">How it works, step {stage + 1} of 4</span>
        <input type="range" min="0" max="3" step="1" value={stage} onChange={(e) => setStage(Number(e.target.value))}
          aria-valuetext={STAGES[stage].clause} style={{ "--p": `${(stage / 3) * 100}%` }} />
      </label>
    </section>
  );
}

/* ---------- Pricing as one sentence ---------- */
function Pricing() {
  return (
    <section className="hp-price" aria-labelledby="hp-price-h">
      <h2 id="hp-price-h" className="hp-display" data-reveal>Start with <span className="hp-price-chip">$5</span> free.</h2>
      <figure className="hp-price-fig" data-reveal>
        <img src="/img/instance-meter.jpg" width="1600" height="252" loading="lazy"
          alt="An instance page: runtime 00:11:06, accrued cost $0.0759 at $0.41 an hour, NVIDIA GeForce RTX 4060 Laptop GPU, 8 GB, machine connected" />
        <figcaption>The cost meter on a test instance, 19 October 2026: eleven minutes on an RTX 4060 came to under 8 cents.</figcaption>
      </figure>
      <div className="hp-price-foot" data-reveal>
        <p className="hp-body">
          Every account gets $5 of credit once — about 10 hours on a $0.50/hr GPU. After that you pay the machine's
          hourly price, by the second. Payments are in test mode during the closed beta.
        </p>
        <Link to={ROUTES.pricing} className="hp-btn hp-btn-ink" {...ctaProps("home_pricing")}>See how pricing works</Link>
      </div>
    </section>
  );
}

/* ---------- For providers: sentences that open ---------- */
function Providers() {
  const [open, setOpen] = useState(() => new Set([0, 1]));
  const toggle = (i) => setOpen((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  return (
    <section className="hp-prov" aria-labelledby="hp-prov-h">
      <div className="hp-prov-head">
        <h2 id="hp-prov-h" className="hp-h2" data-reveal>Have an idle NVIDIA GPU?</h2>
        <p className="hp-body" data-reveal>
          Make it rentable while you're not using it. You install Productify Node, pair it with your listing, and
          decide when renters can connect. Here's what keeps your computer safe.
        </p>
        <div className="hp-actions" data-reveal>
          <Link to={ROUTES.apply} className="hp-btn" {...ctaProps("providers_apply")}>Apply as a provider <ArrowRight size={18} /></Link>
          <Link to={ROUTES.earnWithHardware} className="hp-link" {...ctaProps("providers_learn_more")}>How providing works</Link>
        </div>
      </div>
      <figure className="hp-prov-fig" data-reveal>
        <img src="/img/node-app.jpg" width="1380" height="560" loading="lazy"
          alt="The Productify Node app on a provider's laptop: paused, Docker running, NVIDIA GeForce RTX 4060 Laptop GPU, 52 °C, limits for renters, and an activity log" />
        <figcaption>Productify Node on a provider's RTX 4060 laptop during testing: paused, with the emergency stop one click away.</figcaption>
      </figure>
      <ul className="hp-bands">
        {PROVIDER_LINES.map(([line, more], i) => (
          <li key={line} className={open.has(i) ? `is-on tone-${i % 3}` : ""}>
            <button type="button" onClick={() => toggle(i)} aria-expanded={open.has(i)}>
              <span className="hp-band-line">{line}</span>
              <span className="hp-switch" aria-hidden="true"><span /></span>
            </button>
            {open.has(i) && <p>{more}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Faq() {
  return (
    <section className="hp-faq" aria-labelledby="hp-faq-h">
      <h2 id="hp-faq-h" className="hp-display-s" data-reveal>Questions, answered.</h2>
      <div className="hp-faq-list">
        {FAQ.map(([q, a]) => (
          <details key={q} data-reveal>
            <summary>{q}<span className="hp-chev" aria-hidden="true" /></summary>
            <p>{a}</p>
          </details>
        ))}
        <p className="hp-body hp-faq-more">More in the <Link to={ROUTES.faq}>full FAQ</Link>, the <Link to={ROUTES.security}>security page</Link> and the <Link to={ROUTES.privacy}>privacy notice</Link>.</p>
      </div>
    </section>
  );
}

function Close() {
  return (
    <section className="hp-close" aria-labelledby="hp-close-h">
      <h2 id="hp-close-h" className="hp-display" data-reveal>Or rent out<br />your own GPU.</h2>
      <div className="hp-close-foot" data-reveal>
        <p>Your machine, your hours, your price. Renters only get a locked-down container, one at a time.</p>
        <Link to={ROUTES.apply} className="hp-btn" {...ctaProps("close_apply_provider")}>Apply as a provider</Link>
      </div>
    </section>
  );
}

export default function Home() {
  const [machines, setMachines] = useState([]);
  useReveal();
  useEffect(() => {
    api.get("/rentals")
      .then((res) => setMachines([...res.data].sort((a, b) =>
        Number(availabilityOf(b) === "available") - Number(availabilityOf(a) === "available") || a.price - b.price)))
      .catch(() => setMachines([]));
  }, []);
  const first = useMemo(() => machines[0], [machines]);
  const ref = useRef(null);

  return (
    <div className="hp" ref={ref}>
      <SEO
        title="Productify — Rent GPU compute · Earn with your hardware"
        description="Rent an NVIDIA GPU by the hour for AI development, billed by the second, or make your own idle GPU rentable. Start with $5 of free credit. Closed beta."
        path="/"
        jsonLd={{ "@context": "https://schema.org", "@type": "WebSite", name: "Productify", url: "https://www.productifynow.com" }}
      />
      <Hero machines={machines} />
      <Showcase />
      <HowItWorks machine={first} />
      <Pricing />
      <Providers />
      <Faq />
      <Close />
    </div>
  );
}
