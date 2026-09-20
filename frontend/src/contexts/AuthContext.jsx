import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // If returning from Emergent OAuth, AuthCallback will handle it.
    if (typeof window !== "undefined" && window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const loginEmail = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("productify-token", data.token);
    localStorage.setItem("productify-user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const registerEmail = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("productify-token", data.token);
    localStorage.setItem("productify-user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("productify-token");
    localStorage.removeItem("productify-user");
    setUser(null);
  };

  const refresh = checkAuth;

  return (
    <AuthCtx.Provider value={{ user, loading, loginEmail, registerEmail, logout, refresh, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}
