import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Wallet } from "lucide-react";
import { api, money } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// The renter's compute credit balance (1 credit = US$1). Running instances are charged when they stop.
export default function CreditBalance() {
  const { user } = useAuth() || {};
  const [credits, setCredits] = useState(null);

  useEffect(() => {
    if (!user?.id) return undefined;
    const load = () => api.get("/credits/balance").then((r) => setCredits(r.data?.compute_credits ?? 0)).catch(() => {});
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    load();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user?.id]);

  if (!user?.id || credits == null) return null;
  return (
    <div className="credit-balance" data-testid="credit-balance">
      <Wallet size={16} aria-hidden="true" />
      <span>Credit balance</span>
      <b>{money(credits)}</b>
      <small>Running instances are charged when they stop.</small>
      <Link to="/pricing">Get credits</Link>
    </div>
  );
}
