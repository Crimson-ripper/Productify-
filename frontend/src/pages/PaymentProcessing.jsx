import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useCart } from "@/contexts/CartContext";
import SEO from "@/components/SEO";

export default function PaymentProcessing() {
  const [sp] = useSearchParams();
  const sid = sp.get("session_id");
  const provider = sp.get("provider");
  const { clear } = useCart();
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Simulate provider confirmation delay
      await new Promise((r) => setTimeout(r, 1500));
      try {
        await api.post(`/payments/confirm/${sid}`, {});
        if (!cancelled) { clear(); navigate(`/payment/success?session_id=${sid}`, { replace: true }); }
      } catch {
        if (!cancelled) navigate(`/payment/cancel`, { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [sid, clear, navigate]);
  return (
    <>
      <SEO title="Processing payment — Productify" path="/payment/processing" />
      <div className="processing" data-testid="processing-screen">
        <div className="spinner" />
        <h2>Confirming your {provider ? `${provider} ` : ""}payment…</h2>
        <p>Keep this page open — it only takes a few seconds.</p>
      </div>
    </>
  );
}
