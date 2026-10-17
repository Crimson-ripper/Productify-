import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CreditCard, Wallet, Landmark } from "lucide-react";
import { api, money, getErrorMessage } from "@/lib/api";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import { toast } from "sonner";

const REGIONS = [
  { code: "US", label: "United States", default: "stripe" },
  { code: "IN", label: "India", default: "razorpay" },
  { code: "GB", label: "United Kingdom", default: "stripe" },
  { code: "EU", label: "European Union", default: "stripe" },
  { code: "AU", label: "Australia", default: "paypal" },
  { code: "OTHER", label: "Other", default: "paypal" },
];

const providersFor = (region) => {
  if (region === "IN") return ["razorpay", "paypal"];
  return ["stripe", "paypal"];
};

const providerCopy = {
  stripe: { name: "Card (Stripe)", desc: "Visa, Mastercard, Amex", icon: CreditCard },
  razorpay: { name: "UPI / Cards (Razorpay)", desc: "UPI · Netbanking · Cards", icon: Landmark },
  paypal: { name: "PayPal", desc: "Pay with your PayPal balance", icon: Wallet },
};

export default function Checkout() {
  const { cart, subtotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [region, setRegion] = useState("US");
  const available = useMemo(() => providersFor(region), [region]);
  const [provider, setProvider] = useState(available[0]);
  const [busy, setBusy] = useState(false);

  const onRegion = (r) => { setRegion(r); setProvider(providersFor(r)[0]); };

  const submit = async () => {
    if (!cart.length) return;
    if (!user) { navigate("/login"); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/payments/checkout", {
        items: cart.map((x) => ({ id: x.id, kind: x.kind, quantity: x.quantity || 1 })),
        provider,
        region,
        origin_url: window.location.origin,
      });
      window.location.href = data.checkout_url;
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not start checkout"));
    } finally {
      setBusy(false);
    }
  };

  if (cart.length === 0) {
    return <div className="empty-block">Your bag is empty. <Link to="/shop">Browse the shop</Link></div>;
  }

  return (
    <>
      <SEO title="Checkout — Productify" description="Complete your purchase securely." path="/checkout" />
      <section className="checkout-page">
        <div className="checkout-main">
          <div className="eyebrow">Checkout</div>
          <h1>How would you like to pay?</h1>
          <div className="test-mode-note" data-testid="checkout-test-mode">
            <b>Test mode</b> — payments aren't live yet, so no card or account will be charged.
          </div>

          <div className="ck-block">
            <h3>Billing region</h3>
            <div className="region-grid">
              {REGIONS.map((r) => (
                <button
                  key={r.code}
                  className={region === r.code ? "region-tab active" : "region-tab"}
                  onClick={() => onRegion(r.code)}
                  data-testid={`checkout-region-${r.code.toLowerCase()}-button`}
                >{r.label}</button>
              ))}
            </div>
            <small className="ck-hint">Available payment methods depend on your region.</small>
          </div>

          <div className="ck-block">
            <h3>Payment provider</h3>
            <div className="provider-list">
              {available.map((pid) => {
                const P = providerCopy[pid];
                const Icon = P.icon;
                return (
                  <button
                    key={pid}
                    className={provider === pid ? "provider active" : "provider"}
                    onClick={() => setProvider(pid)}
                    data-testid={`checkout-provider-${pid}-button`}
                  >
                    <Icon size={20} />
                    <div><b>{P.name}</b><small>{P.desc}</small></div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="checkout-summary">
          <h3>Order summary</h3>
          <div className="cs-lines">
            {cart.map((x, i) => (
              <div key={i} className="cs-line"><img src={x.image} alt="" /><div><b>{x.title}</b><small>{x.kind === "rental" ? "Rental" : "Digital"}</small></div><span>{money(x.price)}</span></div>
            ))}
          </div>
          <div className="row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
          <div className="row muted"><span>Tax (5%)</span><span>{money(subtotal * 0.05)}</span></div>
          <div className="row total"><span>Total</span><strong>{money(subtotal * 1.05)}</strong></div>
          <button className="primary-button full" onClick={submit} disabled={busy} data-testid="checkout-submit-button">
            {busy ? "Redirecting…" : `Pay ${money(subtotal * 1.05)}`} <ArrowRight size={17} />
          </button>
        </aside>
      </section>
    </>
  );
}
