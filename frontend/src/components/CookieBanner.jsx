import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie, X } from "lucide-react";

const KEY = "productify-cookie-consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) setVisible(true); } catch {}
  }, []);
  const set = (choice) => {
    try { localStorage.setItem(KEY, JSON.stringify({ choice, at: new Date().toISOString() })); } catch {}
    setVisible(false);
  };
  if (!visible) return null;
  return (
    <div className="cookie-banner" data-testid="cookie-banner" role="dialog" aria-live="polite">
      <div className="cookie-copy">
        <Cookie size={22} />
        <div>
          <b>We use cookies</b>
          <p>Strictly necessary cookies keep you signed in. With your consent, we also use analytics cookies to improve Productify. See our <Link to="/legal/cookies">Cookie Policy</Link> and <Link to="/legal/privacy">Privacy Policy</Link>.</p>
        </div>
      </div>
      <div className="cookie-actions">
        <button className="cookie-reject" onClick={() => set("necessary")} data-testid="cookie-reject-button">Necessary only</button>
        <button className="cookie-accept" onClick={() => set("all")} data-testid="cookie-accept-button">Accept all</button>
        <button className="cookie-close" onClick={() => set("dismissed")} aria-label="Dismiss" data-testid="cookie-close-button"><X size={16} /></button>
      </div>
    </div>
  );
}
