import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { ctaProps } from "@/lib/analytics";
import { ROUTES } from "@/lib/routes";
import SEO from "@/components/SEO";

// Redesign prototype v2 (branch redesign-prototype).
// Direction: "dressed as something else" — GPU rental art-directed like a graphics-card launch.
// Idea: the real afternoon a provider's RTX 4060 laptop was rented out (19 Oct 2026) becomes the
// launch page's spec sheet and timeline.

const POWERS = [
  { img: "/img/og-veloren-horizon.jpg", w: 1000, h: 562, label: "Games", name: "Veloren", alt: "Veloren: a voxel character overlooking mountains and forest" },
  { img: "/img/og-0ad.jpg", w: 1000, h: 750, label: "Games", name: "0 A.D.", alt: "0 A.D.: ships off a tropical beach, seen from above" },
  { img: "/img/og-stk-track.jpg", w: 1000, h: 562, label: "Games", name: "SuperTuxKart", alt: "SuperTuxKart: a racer on a desert track at the start line" },
  { img: "/img/gx-blender.jpg", w: 1000, h: 500, label: "3D", name: "Blender", alt: "Blender 3.0 splash art: an animated girl holding a small yellow bird" },
  { img: "/img/og-red-eclipse.jpg", w: 1000, h: 562, label: "Games", name: "Red Eclipse 2", alt: "Red Eclipse 2: a first-person arena with a fireball" },
  { img: "/img/og-minetest.jpg", w: 1000, h: 552, label: "Games", name: "Luanti (Minetest)", alt: "Luanti: a blocky desert landscape under the game logo" },
  { img: "/img/og-unvanquished.jpg", w: 1000, h: 562, label: "Games", name: "Unvanquished", alt: "Unvanquished: a first-person view inside a sci-fi base" },
  { img: "/img/og-veloren-night.jpg", w: 1000, h: 562, label: "Games", name: "Veloren", alt: "Veloren: a glider flying over a forest at night" },
  { img: "/img/gx-sprite.jpg", w: 700, h: 933, label: "Film", name: "Sprite Fright", alt: "Poster for Sprite Fright, a Blender open movie: teenagers in a forest of glowing mushrooms" },
  { img: "/img/og-openttd.jpg", w: 1000, h: 562, label: "Games", name: "OpenTTD", alt: "OpenTTD: a busy isometric city with railways and bridges" },
  { img: "/img/og-xonotic.jpg", w: 1000, h: 562, label: "Games", name: "Xonotic", alt: "Xonotic: a first-person arena shooter in a dim corridor" },
  { img: "/img/og-wesnoth.jpg", w: 1000, h: 750, label: "Games", name: "Battle for Wesnoth", alt: "Battle for Wesnoth: a hex map with units and a character portrait" },
  { img: "/img/og-stk-beach.jpg", w: 1000, h: 537, label: "Games", name: "SuperTuxKart", alt: "SuperTuxKart: a go-kart on a sunny beach track" },
];

function Powers() {
  const row = [...POWERS, ...POWERS]; // doubled so the strip loops seamlessly
  return (
    <section className="gx-powers" aria-labelledby="gx-powers-h">
      <div className="gx-powers-head">
        <h2 id="gx-powers-h" className="gx-h2 gx-h2-s">What GPUs like these power</h2>
        <p className="gx-powers-note">Games, 3D and film are what a provider's GPU is built for. On Productify, renters run AI work: PyTorch and Python today, Blender rendering later.</p>
      </div>
      <div className="gx-strip" aria-hidden="false">
        <ul className="gx-strip-track">
          {row.map((m, i) => (
            <li key={m.name + i} aria-hidden={i >= POWERS.length ? "true" : undefined}>
              <img src={m.img} width={m.w} height={m.h} alt={i >= POWERS.length ? "" : m.alt} loading="lazy" />
              <span><b>{m.label}</b> {m.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const CHAPTERS = [
  {
    title: ["This is a", "graphics card."],
    text: "Gamers buy them to play. The same chips run modern AI: training models, fine-tuning them, testing them.",
    img: "/img/gx-rtx3070.jpg", w: 1920, h: 855,
    alt: "An MSI GeForce RTX 3070 graphics card with three fans, standing on a desk",
    side: "wide",
  },
  {
    title: ["Most days,", "it sits idle."],
    text: "While its owner is at work or asleep, the GPU inside a gaming PC does nothing at all.",
    img: "/img/gx-pc-dark.jpg", w: 1920, h: 1280,
    alt: "The inside of a black gaming PC: cooler, memory and graphics card slots, lit in white",
    side: "right",
  },
  {
    title: ["Your laptop", "can't train it."],
    text: "AI work needs a GPU with enough memory. Buying one for a single project rarely makes sense.",
    img: "/img/smi.jpg", w: 1090, h: 330,
    alt: "nvidia-smi output in a terminal: NVIDIA GeForce RTX 4060, 54 degrees, 754 of 8188 MiB memory used",
    side: "left", ui: true,
  },
  {
    title: ["We connect", "the two."],
    text: "The owner pairs their PC with our app and decides when it's available. You rent its GPU in a locked-down container, billed by the second.",
    img: "/img/node-app.jpg", w: 1380, h: 560,
    alt: "The Productify Node app on a provider's laptop: Docker running, GeForce RTX 4060, 52 °C, limits for renters, activity log",
    side: "right", contain: true,
  },
];

// The real test afternoon, 19 October 2026, from the app's activity log and the renter's terminal.
const LOG = [
  ["4:29 pm", "Agent started", "Productify Node on the provider's RTX 4060 laptop", "OK", "ok", "The app runs as a Windows service. It never opens a port: it connects out to Productify."],
  ["4:29 pm", "Tunnel connected", "Machine shows online on productifynow.com", "OK", "ok", "From here the website can start, run and stop jobs on the laptop — only through the agent."],
  ["4:40 pm", "Instance started", "PyTorch container, 50 GB disk", "Running", "go", "A renter clicked Start. The laptop pulled the PyTorch image and started a locked-down container."],
  ["4:46 pm", "PyTorch sees CUDA", "True · NVIDIA GeForce RTX 4060 Laptop GPU", "OK", "ok", "torch.cuda.is_available() returned True on the first try. No drivers or setup on the renter's side."],
  ["4:48 pm", "8000 × 8000 matrix multiply", "tensor(1.2798e+11) in 1.7 s", "OK", "ok", "Real work on the real GPU: the renter's code ran on the provider's card, and the GPU graph moved in Task Manager."],
  ["4:48 pm", "whoami", "user ID 1000, not root", "OK", "ok", "Jobs run as an unprivileged user. ls /mnt showed an empty folder: none of the laptop's drives were visible."],
  ["4:57 pm", "Network probe", "Laptop's file sharing reachable", "Fixed", "warn", "The container could reach port 445 on the laptop itself. Productify Node 2.1.0 now puts every job on a private network with a filtered way out to public websites only."],
  ["5:09 pm", "Second renter started", "Same GPU, second account", "Fixed", "warn", "Two renters could share one GPU. Since 2.1.0 it's one renter per machine; a busy machine shows as in use."],
  ["5:15 pm", "Emergency stop", "Both jobs removed from the laptop", "Done", "ok", "One click in the app removed every renter container. Since 2.1.0 the website stops the instance and its billing the same moment."],
];

const SPEC = [
  ["What renters get", [
    ["GPU", "Your NVIDIA card, via CUDA"],
    ["Environments", "PyTorch or Python"],
    ["Internet", "Public sites, ports 80 & 443"],
  ]],
  ["What renters can't do", [
    ["See your files", "No access"],
    ["Reach your PC or router", "Blocked"],
    ["Run as administrator", "User 1000"],
    ["Share your GPU", "One renter at a time"],
  ]],
  ["What you control", [
    ["Availability", "Pause any time"],
    ["Emergency stop", "One click"],
    ["Hourly price", "You set it"],
    ["Platform fee", "10% (Free plan)"],
    ["Earnings", "Not guaranteed"],
  ]],
];

const PLANS = [
  { name: "Free", price: "$0", credit: "$5 credit, once", lines: ["About 10 hours on a $0.50/hr GPU", "PyTorch and Python environments"], cta: "Claim it on the pricing page", to: ROUTES.pricing, live: true },
  { name: "Starter", price: "$20", credit: "$21 credit", lines: ["5% extra credit", "Credits don't expire", "Email support"], cta: "Coming soon" },
  { name: "Builder", price: "$50", credit: "$53 credit", lines: ["6% extra credit", "Credits don't expire", "Priority email support", "For longer training runs"], cta: "Coming soon" },
];

const FAQ = [
  ["What can I run?", "Python and PyTorch on an NVIDIA GPU, from a browser terminal. JupyterLab is on the way. Gaming and full remote desktops aren't supported."],
  ["How am I charged?", "The machine's hourly price, metered by the second while the instance runs, plus $0.0002 per GB of disk per hour. Instances stop automatically when your credits run out."],
  ["Can the provider see my work?", "Your job runs in an isolated container without access to the provider's files, but the provider owns the hardware. Don't upload secrets you can't afford to expose."],
  ["Is it live?", "It's a closed beta: some machines are listed, they go online and offline, and payments are in test mode."],
  ["What does a provider need?", "An NVIDIA GPU, Windows 10 or 11, Docker Desktop, a current NVIDIA driver and a steady internet connection."],
];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    document.documentElement.classList.add("gx-motion");
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }), { rootMargin: "0px 0px -8% 0px" });
    els.forEach((el) => io.observe(el));
    const t = setTimeout(() => els.forEach((el) => el.classList.add("is-in")), 2500);
    return () => { io.disconnect(); clearTimeout(t); };
  }, []);
}

function Hero({ online }) {
  return (
    <section className="gx-hero" aria-labelledby="gx-title">
      <h1 id="gx-title" className="gx-shout">
        <span className="gx-line"><span>Rent a GPU</span></span>
        <span className="gx-line"><span>by the hour</span></span>
      </h1>
      <div className="gx-hero-row">
        <Link to={ROUTES.rentals} className="gx-big-btn gx-big-rent" {...ctaProps("hero_rent_now")}>Rent now <ArrowRight size={22} /></Link>
        <figure className="gx-hero-fig">
          <img src="/img/gx-rgb-pc.jpg" width="1200" height="1600" alt="Inside a gaming PC lit in rainbow colours, with a white GeForce RTX graphics card across the middle" />
        </figure>
        <figure className="gx-hero-chip">
          <img src="/img/gx-charge.jpg" width="700" height="933" alt="Poster for Charge, an animated short made in Blender: an old man and a robot in neon light" />
          <figcaption>Rendered on GPUs: <i>Charge</i>, a Blender open movie</figcaption>
        </figure>
      </div>
      <p className="gx-hero-say">
        Run your AI code on real NVIDIA graphics cards in people's PCs. Pay by the second.
      </p>
      <div className="gx-hero-act">
        <p className="gx-hero-fact"><b>$5</b> free credit to start{online != null && <> · {online} online now</>}</p>
        <Link to={ROUTES.waitlist} className="gx-link" {...ctaProps("hero_join_waitlist")}>Or join the waitlist</Link>
      </div>
    </section>
  );
}

function Chapter({ c }) {
  return (
    <section className={`gx-ch gx-ch-${c.side}`} aria-label={c.title.join(" ")}>
      <div className="gx-ch-text">
        <h2 className="gx-h2" data-reveal>{c.title[0]}<br />{c.title[1]}</h2>
        <p className="gx-say" data-reveal>{c.text}</p>
      </div>
      <figure className="gx-ch-fig" data-reveal {...(c.ui ? { "data-ui": "" } : {})}>
        <img src={c.img} width={c.w} height={c.h} alt={c.alt} loading="lazy" className={c.contain ? "is-app" : undefined} />
      </figure>
    </section>
  );
}

function Board() {
  const [open, setOpen] = useState(4);
  return (
    <section className="gx-board" aria-labelledby="gx-board-h">
      <div className="gx-board-head">
        <h2 id="gx-board-h" className="gx-h2" data-reveal>One afternoon,<br />one RTX 4060.</h2>
        <p className="gx-say" data-reveal>
          On 19 October 2026 we rented out a provider's gaming laptop end to end. This is the log — including the
          two things we found and fixed. Tap a row.
        </p>
      </div>
      <ol className="gx-rows" data-ui>
        {LOG.map(([time, name, fact, status, tone, more], i) => (
          <li key={time + name} className={i === open ? "is-open" : ""}>
            <button type="button" onClick={() => setOpen(i)} aria-expanded={i === open}>
              <span className="gx-r-time">{time}</span>
              <span className="gx-r-name">{name}</span>
              <span className="gx-r-fact">{fact}</span>
              <span className={`gx-r-status s-${tone}`}>{status}</span>
            </button>
            {i === open && <p className="gx-r-more">{more}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Plans() {
  return (
    <section className="gx-plans" aria-labelledby="gx-plans-h">
      <div className="gx-plans-head">
        <h2 id="gx-plans-h" className="gx-h2" data-reveal>Start free.</h2>
        <p className="gx-say" data-reveal>
          1 credit is US$1. Instances use it at the machine's hourly price, by the second, and stop when it runs out.
          Paid packs open when payments go live — we're in test mode during the beta.
        </p>
      </div>
      <div className="gx-tiles">
        {PLANS.map((p, i) => (
          <div key={p.name} className={`gx-tile t-${i}`} data-reveal>
            <div className="gx-tile-body">
              <h3>{p.name}</h3>
              <p className="gx-tile-price">{p.price}</p>
              <p className="gx-tile-credit">{p.credit}</p>
              <ul>{p.lines.map((l) => <li key={l}>{l}</li>)}</ul>
            </div>
            {p.live
              ? <Link to={p.to} className="gx-tile-btn" {...ctaProps("plans_free")}>{p.cta} <ArrowRight size={16} /></Link>
              : <span className="gx-tile-btn is-off" aria-disabled="true">{p.cta}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Spec() {
  return (
    <section className="gx-spec" aria-labelledby="gx-spec-h">
      <figure className="gx-spec-fig">
        <img src="/img/gx-rtx3090.jpg" width="1600" height="1067" loading="lazy" alt="A Gigabyte GeForce RTX 3090 graphics card on a wooden desk" />
      </figure>
      <div className="gx-sheet" data-reveal>
        <h2 id="gx-spec-h">Provider spec sheet</h2>
        {SPEC.map(([group, items]) => (
          <div className="gx-sheet-group" key={group}>
            <h3>{group}</h3>
            <dl>
              {items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </div>
        ))}
        <Link to={ROUTES.earnWithHardware} className="gx-sheet-link" {...ctaProps("spec_learn_more")}>How providing works <ArrowRight size={16} /></Link>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="gx-faq" aria-labelledby="gx-faq-h">
      <div className="gx-faq-title"><h2 id="gx-faq-h" className="gx-shout gx-shout-s">Questions</h2></div>
      {FAQ.map(([q, a]) => (
        <div className="gx-faq-band" key={q} data-reveal>
          <h3>{q}</h3>
          <p>{a}</p>
        </div>
      ))}
      <div className="gx-faq-band gx-faq-more">
        <h3>Still curious?</h3>
        <p>Read the <Link to={ROUTES.faq}>full FAQ</Link>, how isolation works on the <Link to={ROUTES.security}>security page</Link>, or <Link to={ROUTES.contact}>contact us</Link>.</p>
      </div>
    </section>
  );
}

function Reply() {
  return (
    <section className="gx-reply" aria-labelledby="gx-reply-h">
      <p className="gx-reply-say">Have an NVIDIA GPU at home? Make it rentable while you're not using it — on your hours, at your price.</p>
      <div className="gx-card">
        <h2 id="gx-reply-h">Become a provider</h2>
        <p>Tell us about your hardware. We review every application and help you pair your PC.</p>
        <Link to={ROUTES.apply} className="gx-card-btn" {...ctaProps("reply_apply_provider")}>Apply as a provider</Link>
      </div>
      <details className="gx-credits">
        <summary>Photo credits</summary>
        Photographs via Wikimedia Commons: "2025 Wnętrze komputera PC" by Jacek Halicki (CC BY-SA 4.0);
        "MSI GeForce RTX 3070 VENTUS 3X OC" by TheStriker (CC BY 4.0); "Gaming-PC 20240426 HOF2514" and
        "Gigabyte GeForce RTX 3090 Eagle OC" by PantheraLeo1359531 (CC BY 4.0); "Charge" and "Sprite Fright" posters and Blender 3.0 splash by Blender Studio (CC BY 4.0);
        Game screenshots via Wikimedia Commons: Veloren by Antimundo (CC0); 0 A.D. by Wildfire Games (CC BY-SA 3.0); SuperTuxKart by the SuperTuxKart contributors (CC BY 1.0, CC BY 3.0); Red Eclipse 2 by TucanHolmes (CC BY-SA 4.0); Luanti (Minetest) by cisoun (CC BY-SA 4.0); Unvanquished by the Unvanquished developers (CC BY-SA 2.5); OpenTTD by the OpenTTD contributors (GPLv2); Xonotic by OliwierJaszczyszyn (GPL); Battle for Wesnoth by the Wesnoth developers (CC BY-SA 3.0). Screenshots and app photo: Productify test, 19 Oct 2026.
      </details>
    </section>
  );
}

export default function Home() {
  const [online, setOnline] = useState(null);
  useReveal();
  useEffect(() => {
    api.get("/rentals").then((r) => setOnline(r.data.filter((m) => m.is_online).length)).catch(() => {});
  }, []);
  return (
    <div className="gx">
      <SEO
        title="Productify — Rent a GPU by the hour · Earn with your hardware"
        description="Run AI code on real NVIDIA GPUs in people's PCs, billed by the second, with $5 of free credit — or make your idle gaming GPU rentable. Closed beta."
        path="/"
        jsonLd={{ "@context": "https://schema.org", "@type": "WebSite", name: "Productify", url: "https://www.productifynow.com" }}
      />
      <Hero online={online} />
      <Chapter c={CHAPTERS[0]} />
      <Powers />
      {CHAPTERS.slice(1).map((c) => <Chapter key={c.img} c={c} />)}
      <Board />
      <Plans />
      <Spec />
      <Faq />
      <Reply />
    </div>
  );
}
