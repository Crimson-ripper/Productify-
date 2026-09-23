import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import { toast } from "sonner";

import GoogleLoginButton from "@/components/GoogleLoginButton";

export default function Register() {
  const [sp] = useSearchParams();
  const { registerEmail } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(sp.get("role") === "seller" ? "seller" : "buyer");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const u = await registerEmail({ email, password, name, role });
      toast.success(`Welcome to Productify, ${u.name.split(" ")[0]}`);
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setErr(e.response?.data?.detail || "Sign-up failed");
    } finally { setBusy(false); }
  };

  return (
    <>
      <SEO title="Create your Productify account" description="Sign up for Productify — buy, sell and rent GPUs." path="/register" />
      <section className="auth-page">
        <div className="auth-card" data-testid="register-card">
          <div className="auth-mark">P</div>
          <div className="eyebrow">JOIN PRODUCTIFY</div>
          <h2>Create your account.</h2>
          <p>Buy digital tools, sell your work, or rent your GPUs.</p>
          <GoogleLoginButton text="signup_with" />
          <div className="or"><span /> or with email <span /></div>
          <form onSubmit={submit}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required data-testid="register-name-input" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" required data-testid="register-email-input" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 8 chars)" required minLength={8} data-testid="register-password-input" />
            <div className="role-toggle">
              <button type="button" className={role === "buyer" ? "selected" : ""} onClick={() => setRole("buyer")} data-testid="register-role-buyer-button">I'm buying</button>
              <button type="button" className={role === "seller" ? "selected" : ""} onClick={() => setRole("seller")} data-testid="register-role-seller-button">I'm selling</button>
            </div>
            {err && <div className="form-error" data-testid="register-error">{err}</div>}
            <button className="primary-button full" disabled={busy} data-testid="register-submit-button">{busy ? "Creating…" : "Create account"} <ArrowRight size={17} /></button>
          </form>
          <Link to="/login" className="switch-auth" data-testid="register-switch-login">Already have an account? Sign in</Link>
        </div>
      </section>
    </>
  );
}
