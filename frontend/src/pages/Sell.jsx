import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, Zap, Cpu, Sparkles, CheckCircle2, Lock, Flame } from "lucide-react";
import SEO from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import SellerVerificationModal from "@/components/SellerVerificationModal";

export default function Sell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const handleActivateClick = () => {
    if (!user) {
      navigate("/register?role=seller");
    } else {
      setModalOpen(true);
    }
  };

  const isSeller = user && (user.role === "seller" || user.role === "admin" || user.role === "sub-admin");

  return (
    <>
      <SEO
        title="Sell on Productify — Monetize your GPUs & Digital Tools"
        description="GPUs are an asset, don't let your asset sit idle. Start earning now — just register. Activate your seller account for free."
        path="/sell"
      />

      <section className="sell-hero">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> FOR CREATORS & HARDWARE HOSTS
          </div>

          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.35)", color: "#FBBF24", padding: "4px 12px", borderRadius: "100px", fontSize: "0.82rem", fontWeight: 700, marginBottom: "16px", letterSpacing: "0.5px" }}>
            <Flame size={14} /> NOW OR NEVER
          </div>

          <h1>
            Turn your work & hardware<br />
            <em>into passive income.</em>
          </h1>

          <p style={{ fontSize: "1.15rem", lineHeight: "1.6", maxWidth: "680px", color: "var(--muted, #94A3B8)", margin: "0 auto 24px" }}>
            <b>GPUs are an asset, don’t let your asset sit idle — start earning now, just register!</b> Whether selling cutting-edge design packs or renting raw compute power to AI researchers, start monetizing today.
          </p>

          <div className="hero-actions" style={{ justifyContent: "center", gap: "14px" }}>
            {isSeller ? (
              <Link to="/seller-studio" className="primary-button" data-testid="sell-dashboard-button" style={{ padding: "14px 26px", fontSize: "1rem" }}>
                Open Seller Studio <ArrowRight size={18} />
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleActivateClick}
                className="primary-button"
                data-testid="sell-activate-free-button"
                style={{ padding: "14px 28px", fontSize: "1.05rem", fontWeight: 700, background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)", boxShadow: "0 4px 18px rgba(99, 102, 241, 0.35)" }}
              >
                Activate seller account for free <ArrowRight size={18} />
              </button>
            )}

            {!user ? (
              <Link to="/login" className="text-button text-button-dark" style={{ padding: "14px 20px" }}>
                Sign in <ArrowRight size={14} />
              </Link>
            ) : !isSeller ? (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="text-button text-button-dark"
                style={{ padding: "14px 20px" }}
              >
                Recover access <ArrowRight size={14} />
              </button>
            ) : null}
          </div>

          <div style={{ marginTop: "20px", display: "flex", justifyContent: "center", gap: "20px", fontSize: "0.85rem", color: "var(--muted, #94A3B8)" }}>
            <span>✓ 100% Free Activation</span>
            <span>✓ 1 Seller = 1 Email & 1 Phone</span>
            <span>✓ Instant Direct Payouts</span>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="pillars">
        <div className="pillar">
          <div className="pillar-icon"><Zap size={22} /></div>
          <h3>Digital Products Shelf</h3>
          <p>Sell software packages, design kits, shaders, 3D meshes, and eBooks with zero hosting fees and automated licensing delivery.</p>
        </div>
        <div className="pillar">
          <div className="pillar-icon"><Cpu size={22} /></div>
          <h3>GPU Compute Rental</h3>
          <p>Rent idle RTX 4090s, RTX 3090s, and A100 rigs by the hour. We verify nodes, monitor uptime, and handle client payment escrow.</p>
        </div>
        <div className="pillar">
          <div className="pillar-icon"><ShieldCheck size={22} /></div>
          <h3>Verified & Protected</h3>
          <p>Every seller passes 1:1 mobile & email verification with anti-fraud protections and automated weekly bank payouts.</p>
        </div>
      </section>

      {/* Free vs Pro Comparison */}
      <section style={{ maxWidth: 960, margin: "60px auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div className="eyebrow" style={{ justifyContent: "center" }}>MEMBERSHIP TIERS</div>
          <h2 style={{ fontSize: "2rem", margin: "8px 0" }}>Start free, scale with Pro<em>.</em></h2>
          <p style={{ color: "var(--muted, #94A3B8)", fontSize: "0.95rem" }}>
            Every builder gets access to unlimited listings and transparent payouts from day one.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
          {/* Free Tier */}
          <div style={{ background: "var(--card, #121520)", border: "1px solid var(--border, #272A38)", borderRadius: "14px", padding: "28px" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--muted, #94A3B8)", textTransform: "uppercase", letterSpacing: "1px" }}>STARTER SELLER</div>
            <div style={{ fontSize: "2.2rem", fontWeight: 800, margin: "10px 0" }}>$0 <span style={{ fontSize: "0.9rem", fontWeight: 400, color: "var(--muted, #94A3B8)" }}>/ forever</span></div>
            <p style={{ fontSize: "0.85rem", color: "var(--muted, #94A3B8)", marginBottom: "20px" }}>Ideal for developers and creators getting started with their first listings.</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", fontSize: "0.9rem", display: "flex", flexDirection: "column", gap: "10px" }}>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><CheckCircle2 size={16} color="#10B981" /> Unlimited digital product listings</li>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><CheckCircle2 size={16} color="#10B981" /> List GPU compute nodes for rental</li>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><CheckCircle2 size={16} color="#10B981" /> Bank & E-Wallet payouts (Stripe, PayPal, UPI)</li>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><CheckCircle2 size={16} color="#10B981" /> Real-time earnings analytics</li>
              <li style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted, #94A3B8)" }}><span>10% standard marketplace commission</span></li>
            </ul>
            <button onClick={handleActivateClick} className="secondary-button full" style={{ width: "100%", padding: "12px" }}>
              {isSeller ? "Current Plan" : "Activate Free Account"}
            </button>
          </div>

          {/* Pro Tier (Locked Preview) */}
          <div style={{ background: "linear-gradient(180deg, rgba(99, 102, 241, 0.1) 0%, var(--card, #121520) 100%)", border: "1px solid rgba(99, 102, 241, 0.4)", borderRadius: "14px", padding: "28px", position: "relative" }}>
            <div style={{ position: "absolute", top: 18, right: 18, background: "var(--primary, #6366F1)", color: "#fff", fontSize: "0.75rem", fontWeight: 700, padding: "3px 10px", borderRadius: "100px" }}>POPULAR</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--primary, #6366F1)", textTransform: "uppercase", letterSpacing: "1px" }}>SELLER PRO</div>
            <div style={{ fontSize: "2.2rem", fontWeight: 800, margin: "10px 0" }}>$29 <span style={{ fontSize: "0.9rem", fontWeight: 400, color: "var(--muted, #94A3B8)" }}>/ month</span></div>
            <p style={{ fontSize: "0.85rem", color: "var(--muted, #94A3B8)", marginBottom: "20px" }}>For serious GPU operators and top software publishers demanding scale.</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", fontSize: "0.9rem", display: "flex", flexDirection: "column", gap: "10px" }}>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><Sparkles size={16} color="#F59E0B" /> <b>0% Marketplace Fee</b> (Keep 100% of sales)</li>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><Sparkles size={16} color="#F59E0B" /> Priority Algorithmic & Search Ranking Boost</li>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><Sparkles size={16} color="#F59E0B" /> Real-time GPU Hardware Telemetry & SLA</li>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><Sparkles size={16} color="#F59E0B" /> Instant Automated 15-Minute Bank Payouts</li>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><Sparkles size={16} color="#F59E0B" /> Verified Pro Seller Golden Badge</li>
            </ul>
            <button onClick={handleActivateClick} className="primary-button full" style={{ width: "100%", padding: "12px" }}>
              Unlock Pro Features <Lock size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="how-it-works">
        <h2>How it works<em>.</em></h2>
        <ol>
          <li><b>Verify your Identity</b><span>Quick 2-step verification for your email and mobile phone number.</span></li>
          <li><b>List your Products & GPUs</b><span>Upload software assets or link your GPU specs for remote compute rental.</span></li>
          <li><b>We Verify & Match</b><span>Automated verification connects your listings to a global buyer network.</span></li>
          <li><b>Cash Out Earnings</b><span>Direct weekly deposits into your connected Bank Account, PayPal, or UPI.</span></li>
        </ol>
      </section>

      {/* Verification Modal */}
      <SellerVerificationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
