import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { ROUTES } from "@/lib/routes";

const DONE = [
  ["Isolated containers", "Renter jobs run inside Docker containers on the provider's machine, not as programs on the provider's Windows desktop."],
  ["No administrator rights", "Containers run as a non-root user with extra privileges removed."],
  ["No access to the provider's files", "No folders from the provider's computer are shared into the container."],
  ["No open ports", "The Productify Node app connects out to Productify over an encrypted connection. Providers don't open ports on their router."],
  ["Wiped after each job", "When a rental stops, its container and files are deleted."],
  ["Machine checks", "Hardware is reported by the app on the machine itself, and every machine is reviewed before renters can see it. Offline machines can't start new rentals."],
  ["Paired machines only", "Each machine has its own pairing token. Only paired, approved machines receive jobs."],
];

const NOT_YET = [
  ["Blocking home-network access", "Stopping renter jobs from reaching other devices on the provider's local network is still being built. Providers should keep sensitive devices on a separate network for now."],
  ["Signed installer", "The Productify Node installer isn't code-signed yet, so Windows may show a warning when you install it."],
  ["Independent review", "Productify's isolation hasn't had an external security audit yet."],
];

export default function Security() {
  return (
    <>
      <SEO
        title="Security — how GPU rentals are isolated · Productify"
        description="How Productify keeps renter jobs isolated from providers' computers: containers, no host folders, no open ports, wiped after each job — and what isn't finished yet."
        path={ROUTES.security}
      />
      <section className="page-hero lp-hero">
        <figure className="lp-hero-fig"><img src="/img/node-app.jpg" width="1380" height="560" alt="The Productify Node app on a provider's laptop, paused, with the emergency stop" /></figure>
        <div className="eyebrow">Security</div>
        <h1>How isolation works</h1>
        <p>What's in place today, and what's still being built. We'd rather tell you now than have you find out later.</p>
      </section>

      <section className="lp-section" aria-labelledby="sec-done">
        <div className="eyebrow">In place</div>
        <h2 id="sec-done">What protects each side today</h2>
        <dl className="lp-grid2">{DONE.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </section>

      <section className="lp-section lp-tint" aria-labelledby="sec-todo">
        <div className="eyebrow">Not finished yet</div>
        <h2 id="sec-todo">Known gaps</h2>
        <dl className="lp-dl">{NOT_YET.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </section>

      <section className="lp-section" aria-labelledby="sec-advice">
        <div className="lp-cols">
          <div><div className="eyebrow">Good practice</div><h2 id="sec-advice">During the beta</h2></div>
          <ul className="lp-bullets">
            <li>Renters: the provider owns the hardware. Don't upload secrets or data you can't afford to expose.</li>
            <li>Providers: don't run Productify Node on a computer that holds sensitive work data.</li>
            <li>Found a problem? Email <a href="mailto:security@productifynow.com">security@productifynow.com</a>. See <Link to={ROUTES.contact}>contact</Link> for other addresses.</li>
          </ul>
        </div>
      </section>
    </>
  );
}
