import { useState } from "react";
import { Flag, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const REASONS = [
  { value: "illegal", label: "Illegal item or activity" },
  { value: "infringing", label: "Copyright / IP infringement" },
  { value: "malware", label: "Malware or unsafe software" },
  { value: "scam", label: "Scam or fraud" },
  { value: "csam", label: "Child sexual abuse material" },
  { value: "other", label: "Something else" },
];

export default function ReportButton({ listingId, listingKind }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("illegal");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/reports", {
        listing_id: listingId, listing_kind: listingKind, reason, details,
        reporter_email: user ? undefined : (email || undefined),
      });
      setDone(true);
      toast.success("Report received — our team will review it.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Report failed");
    } finally { setBusy(false); }
  };

  const close = () => { setOpen(false); setTimeout(() => { setDone(false); setDetails(""); setReason("illegal"); }, 200); };

  return (
    <>
      <button type="button" className="report-button" onClick={() => setOpen(true)} data-testid="report-listing-button">
        <Flag size={13} /> Report this listing
      </button>
      {open && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div className="modal-card" data-testid="report-modal">
            <button className="close-button" onClick={close} aria-label="Close" data-testid="report-close-button"><X size={18} /></button>
            {!done ? (
              <>
                <div className="eyebrow"><span className="eyebrow-line" /> REPORT</div>
                <h2>Tell us what's wrong.</h2>
                <p className="modal-desc">Reports are reviewed manually by our team. The listing stays live until an admin decides.</p>
                <form onSubmit={submit} className="report-form">
                  <label>Reason
                    <select value={reason} onChange={(e) => setReason(e.target.value)} data-testid="report-reason-select">
                      {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </label>
                  <label>Details (optional)
                    <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Explain what you saw, include links or screenshots URLs if you have them." maxLength={2000} data-testid="report-details-input" />
                  </label>
                  {!user && (
                    <label>Your email (optional, for follow-up)
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" data-testid="report-email-input" />
                    </label>
                  )}
                  <button type="submit" className="primary-button full" disabled={busy} data-testid="report-submit-button">{busy ? "Sending…" : "Submit report"}</button>
                  <small className="mock-note">Our team may contact law enforcement for CSAM or credible threats.</small>
                </form>
              </>
            ) : (
              <div className="report-done" data-testid="report-done">
                <Flag size={30} />
                <h3>Report received.</h3>
                <p>Thank you. Our team reviews every report manually. The listing stays visible until an admin decides.</p>
                <button className="primary-button" onClick={close} data-testid="report-close-done-button">Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
