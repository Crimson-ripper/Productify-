import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import SEO from "@/components/SEO";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function VerifyEmail() {
  const [sp] = useSearchParams();
  const token = sp.get("token") || "";
  const { refresh } = useAuth() || {};
  const [state, setState] = useState(token ? "checking" : "missing");
  const [msg, setMsg] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true; // the link is single-use; don't send it twice in strict mode
    api.post("/auth/verify-email", { token })
      .then(() => { setState("ok"); refresh?.(); })
      .catch((e) => { setState("error"); setMsg(e?.response?.data?.detail || "Something went wrong. Try again later."); });
  }, [token, refresh]);

  return (
    <>
      <SEO title="Confirm your email — Productify" description="Confirm the email address for your Productify account." path="/verify-email" />
      <section className="page-hero lp-hero">
        <div className="eyebrow">Your account</div>
        <h1>{state === "ok" ? "Email confirmed" : state === "checking" ? "Confirming…" : "Couldn't confirm your email"}</h1>
        <p role="status">
          {state === "ok" && "Thanks — your email address is confirmed."}
          {state === "checking" && "One moment."}
          {state === "error" && msg}
          {state === "missing" && "This link is incomplete. Open the link from the email again, or sign in and ask for a new one."}
        </p>
        <div className="hero-actions">
          <Link to="/rentals" className="primary-button">Browse GPUs <ArrowRight size={17} /></Link>
        </div>
      </section>
    </>
  );
}
