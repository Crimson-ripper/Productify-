import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import { toast } from "sonner";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Login() {
  const { loginEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const u = await loginEmail(email, password);
      toast.success(`Welcome back, ${u.name.split(" ")[0]}`);
      navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
    } catch (e) {
      setErr(e.response?.data?.detail || "Login failed");
    } finally { setBusy(false); }
  };

  const google = () => {
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <>
      <SEO title="Sign in — Productify" description="Sign in to Productify to shop, sell and manage rentals." path="/login" />
      <section className="auth-page">
        <div className="auth-card" data-testid="login-card">
          <div className="auth-mark">P</div>
          <div className="eyebrow">WELCOME BACK</div>
          <h2>Sign in.</h2>
          <p>Buy better tools, or build a business around yours.</p>

          <button className="google-button" onClick={google} data-testid="google-login-button">
            <span>G</span> Continue with Google
          </button>
          <div className="or"><span /> or continue with email <span /></div>

          <form onSubmit={submit}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" required data-testid="login-email-input" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required data-testid="login-password-input" />
            {err && <div className="form-error" data-testid="login-error">{err}</div>}
            <button className="primary-button full" disabled={busy} data-testid="login-submit-button">{busy ? "Signing in…" : "Sign in"} <ArrowRight size={17} /></button>
          </form>

          <Link to="/register" className="switch-auth" data-testid="login-switch-register">New to Productify? Create an account</Link>
        </div>
      </section>
    </>
  );
}
