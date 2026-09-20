import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    const hash = window.location.hash || "";
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const sid = params.get("session_id");
    if (!sid) { navigate("/", { replace: true }); return; }
    (async () => {
      try {
        const { data } = await api.post("/auth/session", { session_id: sid });
        setUser(data.user);
        toast.success(`Welcome, ${data.user.name.split(" ")[0]}`);
        // Clear the hash and land on dashboard
        window.history.replaceState(null, "", window.location.pathname);
        navigate("/dashboard", { replace: true, state: { user: data.user } });
      } catch (err) {
        toast.error("Google sign-in failed. Please try again.");
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="loading-screen" data-testid="auth-callback">
      <span />
      <p>Signing you in…</p>
    </div>
  );
}
