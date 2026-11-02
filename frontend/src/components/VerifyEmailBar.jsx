import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// Shown to signed-in users who haven't confirmed their email address yet.
export default function VerifyEmailBar() {
  const { user } = useAuth() || {};
  const [state, setState] = useState("");
  if (!user || user.email_verified !== false || state === "hidden") return null;

  const resend = () => {
    setState("sending");
    api.post("/auth/resend-verification")
      .then(() => setState("sent"))
      .catch((e) => setState(e?.response?.data?.detail || "Couldn't send it. Try again later."));
  };

  return (
    <div className="ve-bar" role="status">
      <span>
        {state === "sent" ? `We've sent a new link to ${user.email}. Check your inbox (and spam).`
          : state && state !== "sending" ? state
          : `Please confirm your email (${user.email}) using the link we sent you.`}
      </span>
      {state !== "sent" && (
        <button type="button" onClick={resend} disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send a new link"}</button>
      )}
      <button type="button" className="ve-x" aria-label="Hide" onClick={() => setState("hidden")}>×</button>
    </div>
  );
}
