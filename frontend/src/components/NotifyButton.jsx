import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { track } from "@/lib/analytics";

// "Email me when it's free" for one machine (rentalId) or for any machine (rentalId="any").
export default function NotifyButton({ rentalId, label = "Email me when it's free" }) {
  const { user } = useAuth() || {};
  const loc = useLocation();
  const [state, setState] = useState("");

  if (!user) {
    return (
      <Link className="nf-btn" to="/login" state={{ from: loc }}>
        <Bell size={15} aria-hidden="true" /> Sign in to get an email when it's free
      </Link>
    );
  }
  if (state === "on") {
    return <p className="nf-done" role="status"><Bell size={15} aria-hidden="true" /> We'll email {user.email} once when it's available.</p>;
  }
  const go = () => {
    setState("busy");
    track("cta_click", { cta_name: rentalId === "any" ? "notify_any_gpu" : "notify_gpu" });
    api.post(`/rentals/${rentalId}/notify`)
      .then(() => setState("on"))
      .catch((e) => setState(e?.response?.data?.detail || "Couldn't save that. Try again."));
  };
  return (
    <span className="nf-wrap">
      <button type="button" className="nf-btn" onClick={go} disabled={state === "busy"}>
        <Bell size={15} aria-hidden="true" /> {state === "busy" ? "Saving…" : label}
      </button>
      {state && state !== "busy" && <small className="nf-err" role="alert">{state}</small>}
    </span>
  );
}
