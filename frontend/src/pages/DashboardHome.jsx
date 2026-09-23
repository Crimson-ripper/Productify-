import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import SellerDashboard from "@/pages/SellerDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import { Navigate } from "react-router-dom";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { toast } from "sonner";

export default function DashboardHome() {
  const { user, becomeSeller } = useAuth();
  const [upgrading, setUpgrading] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin" || user.role === "sub-admin") return <AdminDashboard />;
  if (user.role === "seller") return <SellerDashboard />;

  const handleBecomeSeller = async () => {
    setUpgrading(true);
    try {
      await becomeSeller();
      toast.success("Welcome to Seller Studio! You can now publish digital products & GPU nodes.");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not activate seller account");
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <>
      <SEO title="Dashboard — Productify" path="/dashboard" />
      <section className="dashboard-page">
        <div className="eyebrow"><span className="eyebrow-line" /> BUYER DASHBOARD</div>
        <h1>Welcome, {user.name.split(" ")[0]}<em>.</em></h1>
        <p className="subtitle">Track orders, manage your profile and become a seller anytime.</p>
        <div className="buyer-tiles">
          <Link to="/orders" className="tile"><b>Orders</b><small>View your recent purchases</small></Link>
          <Link to="/profile" className="tile"><b>Profile</b><small>Update your name & avatar</small></Link>
          <Link to="/seller-studio" className="tile" data-testid="tile-seller-studio"><b>Seller Studio</b><small>Open seller dashboard & listings</small></Link>
          <Link to="/rentals" className="tile"><b>Browse GPUs</b><small>Rent compute by the hour</small></Link>
        </div>
      </section>
    </>
  );
}
