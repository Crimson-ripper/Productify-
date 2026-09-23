import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="loading-screen" data-testid="loading-screen"><span /></div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (role) {
    const isPermitted = user.role === role || user.role === "admin" || (role === "admin" && user.role === "sub-admin") || (role === "seller" && user.role === "sub-admin");
    if (!isPermitted) return <Navigate to="/" replace />;
  }
  return children;
}
