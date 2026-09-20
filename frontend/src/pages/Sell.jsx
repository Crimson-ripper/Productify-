import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Zap, Cpu } from "lucide-react";
import SEO from "@/components/SEO";

export default function Sell() {
  return (
    <>
      <SEO
        title="Sell on Productify — Digital products & GPU rentals"
        description="List your digital products or spare GPU capacity on Productify. Verified sellers, encrypted checkout, transparent payouts."
        path="/sell"
      />
      <section className="sell-hero">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> FOR BUILDERS</div>
          <h1>Turn your work<br /><em>into income.</em></h1>
          <p>Two ways to earn on Productify: sell digital products, or rent your spare GPU capacity to a global network of creators and engineers.</p>
          <div className="hero-actions">
            <Link to="/register?role=seller" className="primary-button" data-testid="sell-signup-button">Become a seller <ArrowRight size={17} /></Link>
            <Link to="/dashboard" className="text-button text-button-dark">Go to seller studio <ArrowRight size={14} /></Link>
          </div>
        </div>
      </section>

      <section className="pillars">
        <div className="pillar">
          <div className="pillar-icon"><Zap size={22} /></div>
          <h3>Digital products</h3>
          <p>Sell software, design kits, templates, LUTs, ebooks. Uploads, licensing and refunds handled for you.</p>
        </div>
        <div className="pillar">
          <div className="pillar-icon"><Cpu size={22} /></div>
          <h3>GPU / system rental</h3>
          <p>Rent out spare compute by the hour. We verify every node before it goes live and take care of billing.</p>
        </div>
        <div className="pillar">
          <div className="pillar-icon"><ShieldCheck size={22} /></div>
          <h3>Verified & protected</h3>
          <p>Every listing is reviewed. Every buyer is covered by our refund guarantee.</p>
        </div>
      </section>

      <section className="how-it-works">
        <h2>How it works<em>.</em></h2>
        <ol>
          <li><b>Create an account</b><span>Sign up with email or Google in seconds.</span></li>
          <li><b>List your item</b><span>Digital product? Publish instantly. GPU node? Submit specs for verification.</span></li>
          <li><b>We verify</b><span>Our team reviews new nodes and premium listings within 24 hours.</span></li>
          <li><b>Get paid</b><span>Weekly payouts in your preferred currency via Stripe, Razorpay or PayPal.</span></li>
        </ol>
      </section>
    </>
  );
}
