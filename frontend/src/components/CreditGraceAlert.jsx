import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { api, money } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// Site-wide popup while a renter's balance is zero and their machines are in the 5-minute grace period.
export default function CreditGraceAlert() {
  const { user } = useAuth() || {};
  const [alert, setAlert] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!user) return undefined;
    let stop = false;
    const poll = () => api.get("/credits/alert")
      .then((r) => { if (!stop) setAlert(r.data && r.data.grace_until ? r.data : null); })
      .catch(() => {});
    poll();
    const t = setInterval(poll, 20000);
    return () => { stop = true; clearInterval(t); };
  }, [user]);

  useEffect(() => {
    if (!alert) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [alert]);

  if (!user || !alert || hidden) return null;
  const left = Math.max(0, Math.floor((new Date(alert.grace_until).getTime() - now) / 1000));
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <div className="gz-modal" role="alertdialog" aria-modal="true" aria-labelledby="grace-title">
      <div className="gz-modal-box">
        <h3 id="grace-title"><AlertTriangle size={18} /> Your credit balance is zero</h3>
        <p>
          {left > 0 ? <>Your rented machine will be shut down automatically in <b>{clock}</b>, and its files deleted.</>
            : <>Your rented machine is being shut down.</>}
        </p>
        <p>
          To keep it running, top up at least <b>{money(alert.min_topup)}</b>. That pays for these extra minutes and
          gives you at least 30 more minutes. We've also emailed you.
        </p>
        <div className="gz-session-actions">
          <Link className="primary-button" to="/pricing" onClick={() => setHidden(true)}>Top up credits</Link>
          <button className="secondary-button" onClick={() => setHidden(true)}>Close</button>
        </div>
      </div>
    </div>
  );
}
