import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const GOOGLE_CLIENT_ID =
  process.env.REACT_APP_GOOGLE_CLIENT_ID ||
  "4814802603-c0vb27vmn19l3j3057v0qqf45mkll6rc.apps.googleusercontent.com";

export default function GoogleLoginButton({ text = "signin_with" }) {
  const containerRef = useRef(null);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCredentialResponse = async (response) => {
      try {
        const { data } = await api.post("/auth/google", {
          credential: response.credential,
        });
        if (data.token) {
          localStorage.setItem("productify-token", data.token);
        }
        if (data.user) {
          localStorage.setItem("productify-user", JSON.stringify(data.user));
          setUser(data.user);
          toast.success(`Welcome, ${data.user.name.split(" ")[0]}!`);
          navigate("/dashboard", { replace: true });
        }
      } catch (err) {
        toast.error(err.response?.data?.detail || "Google sign-in failed");
      }
    };

    const renderBtn = () => {
      if (window.google?.accounts?.id && containerRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
        });
        containerRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "filled_black",
          size: "large",
          type: "standard",
          shape: "rectangular",
          text: text,
          width: containerRef.current.offsetWidth || 340,
        });
      }
    };

    if (window.google?.accounts?.id) {
      renderBtn();
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = renderBtn;
      document.body.appendChild(script);
    }
  }, [setUser, navigate, text]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        justifyContent: "center",
        width: "100%",
        minHeight: "44px",
      }}
      data-testid="google-auth-button-container"
    />
  );
}
