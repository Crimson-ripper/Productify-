import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const LABELS = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  refunds: "Refund Policy",
  acceptable_use: "Acceptable Use Policy",
  cookies: "Cookie Policy",
};
const PATHS = {
  terms: "/legal/terms",
  privacy: "/legal/privacy",
  refunds: "/legal/refunds",
  acceptable_use: "/legal/acceptable-use",
  cookies: "/legal/cookies",
};

export default function PolicyBumpModal() {
  const { user } = useAuth();
  const [pending, setPending] = useState([]);
  const [busy, setBusy] = useState(false);
  const [acked, setAcked] = useState(false);

  useEffect(() => {
    if (!user) { setPending([]); return; }
    api.get("/consents/status").then((r) => setPending(r.data.pending || [])).catch(() => setPending([]));
  }, [user]);

  if (!user || pending.length === 0) return null;

  const accept = async () => {
    if (!acked) return;
    setBusy(true);
    try {
      await Promise.all(pending.map((p) =>
        api.post("/consents", { consent_type: p.consent_type, choice: "accepted", version: p.current_version, metadata: { source: "bump_modal" } })
      ));
      setPending([]);
    } finally { setBusy(false); }
  };

  return (
    <div className="overlay" data-testid="policy-bump-overlay" role="dialog" aria-modal="true">
      <div className="modal-card wide">
        <div className="bump-icon"><ShieldCheck size={26} /></div>
        <div className="eyebrow"><span className="eyebrow-line" /> POLICY UPDATE</div>
        <h2>We've updated our policies.</h2>
        <p className="modal-desc">Please review and accept the latest versions to keep using Productify. Your acceptance is logged for compliance.</p>
        <ul className="bump-list" data-testid="policy-bump-list">
          {pending.map((p) => (
            <li key={p.consent_type}>
              <Link to={PATHS[p.consent_type]} target="_blank" rel="noreferrer">{LABELS[p.consent_type] || p.consent_type}</Link>
              <span>v{p.current_version}{p.accepted_version ? ` · you last accepted v${p.accepted_version}` : " · new"}</span>
            </li>
          ))}
        </ul>
        <label className="bump-check">
          <input type="checkbox" checked={acked} onChange={(e) => setAcked(e.target.checked)} data-testid="policy-bump-checkbox" />
          <span>I have read and accept the updated policies listed above.</span>
        </label>
        <button className="primary-button full" onClick={accept} disabled={!acked || busy} data-testid="policy-bump-accept-button">{busy ? "Saving…" : "Accept & continue"}</button>
      </div>
    </div>
  );
}
