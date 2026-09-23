import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, Zap, Cpu } from "lucide-react";
import SEO from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Sell() {
  const { user, becomeSeller } = useAuth();
  const navigate = useNavigate();
  const [upgrading, setUpgrading] = useState(false);

  const handleBecomeSeller = async () => {
    setUpgrading(true);
    try {
      await becomeSeller();
      toast.success("Welcome to Seller Studio! You can now publish digital products & GPU nodes.");
      navigate("/dashboard");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not activate seller account");
    } finally {
      setUpgrading(false);
    }
  };

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
            {!user ? (
              <>
                <Link to="/register?role=seller" className="primary-button" data-testid="sell-signup-button">Become a seller <ArrowRight size={17} /></Link>
                <Link to="/login" className="text-button text-button-dark">Sign in <ArrowRight size={14} /></Link>
              </>
            ) : user.role === "buyer" ? (
              <>
                <button
                  type="button"
                  onClick={handleBecomeSeller}
                  disabled={upgrading}
                  className="primary-button"
                  data-testid="sell-activate-button"
                >
                  {upgrading ? "Activating Seller Studio…" : "Activate Seller Studio"} <ArrowRight size={17} />
                </button>
                <Link to="/dashboard" className="text-button text-button-dark">Go to Dashboard <ArrowRight size={14} /></Link>
              </>
            ) : (
              <Link to="/dashboard" className="primary-button" data-testid="sell-dashboard-button">Open Seller Studio <ArrowRight size={17} /></Link>
            )}
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
