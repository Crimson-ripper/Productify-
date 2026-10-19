import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { api, money, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { track } from "@/lib/analytics";
import { toast } from "sonner";

// Fallback copy of the backend's CREDIT_PLANS (GET /credits/plans). 1 credit = US$1.
const DEFAULT_PLANS = [
  { id: "free", name: "Free", price_usd: 0, credits: 5, available: true, points: ["One-time $5 of credit per account", "About 10 hours on a $0.50/hr GPU", "PyTorch and Python environments"] },
  { id: "starter", name: "Starter", price_usd: 20, credits: 21, available: false, points: ["$21 of credit for $20", "Credits don't expire", "Email support"] },
  { id: "builder", name: "Builder", price_usd: 50, credits: 53, available: false, points: ["$53 of credit for $50", "Credits don't expire", "Priority email support"] },
];

/** Credit tiers. onBalance(newBalance) is called after a successful free claim. */
export default function CreditPlans({ claimed, onBalance }) {
  const { user } = useAuth();
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get("/credits/plans").then((r) => Array.isArray(r.data) && r.data.length && setPlans(r.data)).catch(() => {});
  }, []);

  const claim = async () => {
    setBusy(true);
    try {
      const r = await api.post("/credits/claim-free");
      setDone(true);
      toast.success(`${money(r.data.added)} of free credit added.`);
      track("free_credits_claimed");
      onBalance?.(r.data.compute_credits);
    } catch (err) {
      if (err?.response?.status === 409) setDone(true);
      toast.error(getErrorMessage(err, "Couldn't add credits"));
    } finally {
      setBusy(false);
    }
  };

  const freeUsed = claimed || done;
  return (
    <div className="cp-grid">
      {plans.map((p) => (
        <div className={p.id === "free" ? "cp-plan cp-free" : "cp-plan"} key={p.id}>
          <div className="cp-name">{p.name}</div>
          <div className="cp-price">{p.price_usd ? money(p.price_usd) : "Free"}{p.id !== "free" && <small> one-time</small>}</div>
          <div className="cp-credits">{money(p.credits)} credit</div>
          <ul>{p.points.map((pt) => <li key={pt}><Check size={14} aria-hidden="true" /> {pt}</li>)}</ul>
          {p.id === "free" ? (
            !user ? (
              <Link to="/register" className="primary-button">Sign up to claim</Link>
            ) : (
              <button type="button" className="primary-button" onClick={claim} disabled={busy || freeUsed}>
                {freeUsed ? "Claimed" : busy ? "Adding…" : `Claim ${money(p.credits)} free`}
              </button>
            )
          ) : (
            <button type="button" className="secondary-button" disabled aria-disabled="true" title="Payments aren't live yet">
              Buy now — coming soon
            </button>
          )}
        </div>
      ))}
      <p className="cp-note">1 credit = US$1. Instances use credits at the machine's hourly price, by the second, and stop automatically when your credits run out. Paid packs aren't on sale yet: payments are in test mode during the closed beta.</p>
    </div>
  );
}
