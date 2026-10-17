import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Package, Cpu, Check } from "lucide-react";
import SEO from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import SellerVerificationModal from "@/components/SellerVerificationModal";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    note: "No monthly fee",
    commission: "10%",
    points: ["Unlimited product listings", "List GPU machines for rent", "Earnings analytics in Seller studio", "Payouts to bank, PayPal or UPI"],
  },
  {
    name: "Pro",
    price: "$29",
    note: "per month",
    commission: "0%",
    points: ["Everything in Free", "No commission on sales or rentals"],
  },
];

export default function Sell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const isSeller = user && ["seller", "admin", "sub-admin"].includes(user.role);
  const start = () => navigate(isSeller ? "/seller-studio" : "/seller/onboarding");

  return (
    <>
      <SEO
        title="Sell on Productify"
        description="Sell digital products or rent out your GPU by the hour on Productify. Opening a seller account is free."
        path="/sell"
      />

      <section className="sell-hero">
        <div className="eyebrow">Selling on Productify</div>
        <h1>Sell your work.<br />Rent out your <em>GPU.</em></h1>
        <p>
          Two ways to earn: list digital products in the shop, or connect a machine with
          the Productify Node app and rent its GPU by the hour. Opening a seller account is free.
        </p>
        <div className="hero-actions">
          {isSeller ? (
            <Link to="/seller-studio" className="primary-button" data-testid="sell-dashboard-button">Open Seller studio <ArrowRight size={17} /></Link>
          ) : (
            <button type="button" onClick={start} className="primary-button" data-testid="sell-activate-free-button">Open a seller account <ArrowRight size={17} /></button>
          )}
          {!user && <Link to="/login" className="text-button text-button-dark">I already have an account <ArrowRight size={14} /></Link>}
          {user && !isSeller && (
            <button type="button" onClick={() => setModalOpen(true)} className="text-button text-button-dark">Recover a seller account <ArrowRight size={14} /></button>
          )}
        </div>
      </section>

      <section className="pillars two">
        <div className="pillar">
          <div className="pillar-icon"><Package size={20} /></div>
          <h3>Digital products</h3>
          <p>Software, templates, design kits, presets, 3D assets, e-books. Upload the listing in Seller studio; it goes live after an admin approves it.</p>
        </div>
        <div className="pillar">
          <div className="pillar-icon"><Cpu size={20} /></div>
          <h3>GPU rental</h3>
          <p>Install Productify Node on the machine, pair it with your account, and set an hourly price. Renters' jobs run in containers with the RAM, disk and temperature limits you choose.</p>
        </div>
      </section>

      <section className="plans">
        <h2>Plans</h2>
        <div className="plan-grid">
          {PLANS.map((p) => (
            <div className="plan" key={p.name}>
              <div className="plan-name">{p.name}</div>
              <div className="plan-price">{p.price} <small>{p.note}</small></div>
              <div className="plan-commission"><b>{p.commission}</b> commission</div>
              <ul>
                {p.points.map((pt) => <li key={pt}><Check size={14} /> {pt}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <p className="plans-note">You can switch plans any time from Seller studio.</p>
      </section>

      <section className="how-it-works">
        <h2>How it works</h2>
        <ol>
          <li><b>Verify your email and phone</b><span>One seller account per person — it keeps scammers out.</span></li>
          <li><b>Create a listing</b><span>Upload a product, or pair a machine running Productify Node.</span></li>
          <li><b>Get approved</b><span>An admin reviews new listings before they appear in the shop.</span></li>
          <li><b>Withdraw earnings</b><span>Request a payout from Seller studio to your bank, PayPal or UPI.</span></li>
        </ol>
      </section>

      <SellerVerificationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
