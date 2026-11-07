import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// Email sign-ups see only this until they confirm their address.
function CheckEmail({ user, logout }) {
  const [state, setState] = useState("");
  const resend = () => {
    setState("sending");
    api.post("/auth/resend-verification")
      .then(() => setState("sent"))
      .catch((e) => setState(e?.response?.data?.detail || "Couldn't send it. Try again later."));
  };
  return (
    <section className="dashboard-page" data-testid="check-email">
      <h1>Check your email<em>.</em></h1>
      <p className="subtitle">
        We sent a confirmation link to <b>{user.email}</b>. Open it to start using your account. Check your spam folder too.
      </p>
      {state && state !== "sending" && <p role="status">{state === "sent" ? "We've sent a new link." : state}</p>}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16 }}>
        <button type="button" className="primary-button" onClick={resend} disabled={state === "sending" || state === "sent"}>
          {state === "sending" ? "Sending…" : "Send a new link"}
        </button>
        <button type="button" className="secondary-button" onClick={logout}>Use a different email</button>
      </div>
    </section>
  );
}

export default function ProtectedRoute({ children, role }) {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  if (loading) return <div className="loading-screen" data-testid="loading-screen"><span /></div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.email_verified === false) return <CheckEmail user={user} logout={logout} />;
  if (role) {
    const isPermitted = user.role === role || user.role === "admin" || (role === "admin" && user.role === "sub-admin") || (role === "seller" && user.role === "sub-admin");
    if (!isPermitted) return <Navigate to="/" replace />;
  }
  return children;
}
