import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import { toast } from "sonner";

import GoogleLoginButton from "@/components/GoogleLoginButton";
import SellerVerificationModal from "@/components/SellerVerificationModal";

export default function Register() {
  const [sp] = useSearchParams();
  const { registerEmail, user, becomeSeller } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(sp.get("role") === "seller" ? "seller" : "buyer");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && (user.role !== "buyer" || sp.get("role") !== "seller")) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, sp, navigate]);

  const handleUpgrade = async () => {
    setBusy(true); setErr("");
    try {
      await becomeSeller();
      toast.success("Welcome to Seller Studio! You can now publish digital products & GPU nodes.");
      navigate("/seller-studio", { replace: true });
    } catch (e) {
      setErr(e.response?.data?.detail || "Upgrade failed");
    } finally {
      setBusy(false);
    }
  };

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

  const [modalOpen, setModalOpen] = useState(false);

  if (user && user.role === "buyer" && sp.get("role") === "seller") {
    return (
      <>
        <SEO title="Activate Seller Studio — Productify" description="Verify your identity and upgrade your Productify account to start selling." path="/register" />
        <section className="auth-page">
          <div className="auth-card" data-testid="register-upgrade-card">
            <div className="auth-mark">P</div>
            <div className="eyebrow">SELLER IDENTITY VERIFICATION</div>
            <h2>Verify & activate seller account.</h2>
            <p>You are signed in as <b>{user.name}</b> ({user.email}). Complete 1:1 email & phone verification to unlock listing digital products and renting GPU capacity.</p>
            {err && <div className="form-error" data-testid="register-error">{err}</div>}
            <button className="primary-button full" onClick={() => setModalOpen(true)} data-testid="register-upgrade-button">
              Start Seller Verification <ArrowRight size={17} />
            </button>
            <Link to="/dashboard" className="switch-auth" data-testid="register-switch-dashboard">Back to dashboard</Link>
          </div>
        </section>
        <SellerVerificationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

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
