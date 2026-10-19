import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie, X } from "lucide-react";
import { api } from "@/lib/api";
import { CONSENT_KEY, grantAnalyticsConsent, revokeAnalyticsConsent } from "@/lib/analytics";

const ANON_KEY = "productify-anon-id";
export const OPEN_COOKIE_SETTINGS = "productify:cookie-settings";

function anonId() {
  try {
    let a = localStorage.getItem(ANON_KEY);
    if (!a) {
      a = "anon_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(ANON_KEY, a);
    }
    return a;
  } catch { return "anon_" + Date.now(); }
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem(CONSENT_KEY)) setVisible(true); } catch {}
    const open = () => setVisible(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS, open);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, open);
  }, []);
  const set = async (choice) => {
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, at: new Date().toISOString() })); } catch {}
    setVisible(false);
    if (choice === "accepted") grantAnalyticsConsent();
    else revokeAnalyticsConsent();
    // Server-side consent log — best-effort, never blocks UX
    try {
      await api.post("/consents", { consent_type: "cookies", choice, anon_id: anonId(), version: "2026-10-19" });
    } catch {}
  };
  if (!visible) return null;
  return (
    <div className="cookie-banner" data-testid="cookie-banner" role="dialog" aria-live="polite" aria-label="Cookie choices">
      <div className="cookie-copy">
        <Cookie size={22} />
        <div>
          <b>We use cookies</b>
          <p>Strictly necessary cookies keep you signed in. If you choose "Accept all", we also use Google Analytics cookies to see which pages and buttons are used, and to measure future Google Ads. You can change this any time from "Cookie settings" in the footer. See our <Link to="/legal/cookies">Cookie Policy</Link> and <Link to="/legal/privacy">Privacy Policy</Link>.</p>
        </div>
      </div>
      <div className="cookie-actions">
        <button className="cookie-reject" onClick={() => set("necessary_only")} data-testid="cookie-reject-button">Necessary only</button>
        <button className="cookie-accept" onClick={() => set("accepted")} data-testid="cookie-accept-button">Accept all</button>
        <button className="cookie-close" onClick={() => set("dismissed")} aria-label="Dismiss (necessary cookies only)" data-testid="cookie-close-button"><X size={16} /></button>
      </div>
    </div>
  );
}
