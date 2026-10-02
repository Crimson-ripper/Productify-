import { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  Users,
  Package,
  CreditCard,
  Flag,
  CheckCircle2,
  XCircle,
  Search,
  ExternalLink,
  Trash2,
  RefreshCw,
  Clock,
  Sparkles,
  Gamepad2,
  Plus,
  Play,
  Server,
  Layers,
  ShieldAlert,
  Edit2,
  Check
} from "lucide-react";
import { api, money } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import { toast } from "sonner";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview"); // "overview" | "users" | "reviews" | "payouts" | "catalog" | "reports" | "gamezone"

  // Platform Stats
  const [stats, setStats] = useState({
    total_users: 0,
    sellers_count: 0,
    buyers_count: 0,
    staff_count: 0,
    pending_reviews_count: 0,
    pending_rentals_count: 0,
    pending_products_count: 0,
    pending_payouts_count: 0,
    pending_payouts_amount: 0,
    total_orders_count: 0,
    total_gmv: 0,
    open_reports_count: 0,
    active_products: 0,
    active_rentals: 0
  });

  // Users tab state
  const [users, setUsers] = useState([]);
  const [userQuery, setUserQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [usersLoading, setUsersLoading] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);

  // Reviews tab state
  const [pendingReviews, setPendingReviews] = useState([]);
  const [reviewFilter, setReviewFilter] = useState("all"); // "all" | "product" | "rental"
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // Payouts tab state
  const [payouts, setPayouts] = useState([]);
  const [payoutFilter, setPayoutFilter] = useState("all"); // "all" | "processing" | "completed"
  const [payoutsLoading, setPayoutsLoading] = useState(false);

  // Catalog tab state
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogKind, setCatalogKind] = useState("all"); // "all" | "product" | "rental"
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Reports tab state
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Gamezone tab state
  const [gamezoneTab, setGamezoneTab] = useState("catalog"); // "catalog" | "submissions" | "sessions"
  const [adminGames, setAdminGames] = useState([]);
  const [adminGamesLoading, setAdminGamesLoading] = useState(false);
  const [editingGameId, setEditingGameId] = useState(null);
  const [editPrice, setEditPrice] = useState(1.0);
  const [newGameModal, setNewGameModal] = useState(false);
  const [newGameForm, setNewGameForm] = useState({
    title: "",
    genre: "Action",
    description: "",
    hourly_rate_credits: 1.25,
    cover_image: "",
    banner_image: "",
    min_gpu_vram: "8 GB",
    recommended_gpu: "NVIDIA RTX 3070",
    docker_image: "productify/game-runner:generic",
    storage_required_gb: 40,
    tags: "action,fps",
    featured: false,
    status: "published",
  });
  const [creatingGame, setCreatingGame] = useState(false);

  const [submissions, setSubmissions] = useState([]);
  const [submissionFilter, setSubmissionFilter] = useState("all"); // "all" | "pending_review" | "approved" | "rejected"
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    decision: "approve",
    antivirus_scanned: true,
    no_crypto_miners: true,
    headless_gpu_tested: true,
    content_policy_passed: true,
    admin_notes: "",
    assigned_hourly_rate: 1.0,
  });
  const [submittingReview, setSubmittingReview] = useState(false);

  const [activeGameSessions, setActiveGameSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Load platform stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/admin/stats");
      setStats(res.data);
    } catch {
      // Fallback preview metrics if backend is cold
      setStats((prev) => ({ ...prev }));
    }
  }, []);

  // Load users
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await api.get(`/admin/users?q=${encodeURIComponent(userQuery)}&role=${userRoleFilter}`);
      setUsers(res.data.users || []);
    } catch {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [userQuery, userRoleFilter]);

  // Load pending reviews
  const fetchPendingReviews = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const res = await api.get("/admin/reviews/pending");
      setPendingReviews(res.data || []);
    } catch {
      setPendingReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  // Load payouts
  const fetchPayouts = useCallback(async () => {
    setPayoutsLoading(true);
    try {
      const res = await api.get(`/admin/payouts?status=${payoutFilter}`);
      setPayouts(res.data || []);
    } catch {
      setPayouts([]);
    } finally {
      setPayoutsLoading(false);
    }
  }, [payoutFilter]);

  // Load catalog
  const fetchCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const res = await api.get(`/admin/listings/all?q=${encodeURIComponent(catalogQuery)}&kind=${catalogKind}`);
      setCatalogItems(res.data || []);
    } catch {
      setCatalogItems([]);
    } finally {
      setCatalogLoading(false);
    }
  }, [catalogQuery, catalogKind]);

  // Load reports
  const fetchReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const res = await api.get("/admin/reports?status=open");
      setReports(res.data || []);
    } catch {
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  // Load Admin Games
  const fetchAdminGames = useCallback(async () => {
    setAdminGamesLoading(true);
    try {
      const res = await api.get("/admin/games");
      setAdminGames(res.data?.games || []);
    } catch {
      setAdminGames([]);
    } finally {
      setAdminGamesLoading(false);
    }
  }, []);

  // Update Game Price / Status / Featured
  const handleUpdateGame = async (gameId, payload) => {
    try {
      await api.put(`/admin/games/${gameId}`, payload);
      toast.success("Game settings updated!");
      setEditingGameId(null);
      fetchAdminGames();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update game.");
    }
  };

  // Delete Game
  const handleDeleteGame = async (gameId, title) => {
    if (!window.confirm(`Delete game "${title}" from the Gamezone library?`)) return;
    try {
      await api.delete(`/admin/games/${gameId}`);
      toast.success("Game removed from library.");
      fetchAdminGames();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete game.");
    }
  };

  // Create Curated Game
  const handleCreateGame = async (e) => {
    e.preventDefault();
    setCreatingGame(true);
    try {
      const payload = {
        ...newGameForm,
        hourly_rate_credits: parseFloat(newGameForm.hourly_rate_credits) || 1.0,
        storage_required_gb: parseFloat(newGameForm.storage_required_gb) || 20.0,
        tags: typeof newGameForm.tags === "string" ? newGameForm.tags.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) : ["gaming"]
      };
      await api.post("/admin/games", payload);
      toast.success(`Game "${newGameForm.title}" added to Gamezone!`);
      setNewGameModal(false);
      setNewGameForm({
        title: "",
        genre: "Action",
        description: "",
        hourly_rate_credits: 1.25,
        cover_image: "",
        banner_image: "",
        min_gpu_vram: "8 GB",
        recommended_gpu: "NVIDIA RTX 3070",
        docker_image: "productify/game-runner:generic",
        storage_required_gb: 40,
        tags: "action,fps",
        featured: false,
        status: "published",
      });
      fetchAdminGames();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add game.");
    } finally {
      setCreatingGame(false);
    }
  };

  // Load Submissions
  const fetchSubmissions = useCallback(async () => {
    setSubmissionsLoading(true);
    try {
      const params = submissionFilter !== "all" ? `?status=${submissionFilter}` : "";
      const res = await api.get(`/admin/games/submissions${params}`);
      setSubmissions(res.data?.submissions || []);
    } catch {
      setSubmissions([]);
    } finally {
      setSubmissionsLoading(false);
    }
  }, [submissionFilter]);

  // Review Submission
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewModal) return;
    setSubmittingReview(true);
    try {
      const payload = {
        ...reviewForm,
        assigned_hourly_rate: parseFloat(reviewForm.assigned_hourly_rate) || 1.0
      };
      const res = await api.post(`/admin/games/submissions/${reviewModal.id}/review`, payload);
      toast.success(res.data?.message || `Submission ${reviewForm.decision}!`);
      setReviewModal(null);
      fetchSubmissions();
      fetchAdminGames();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit review decision.");
    } finally {
      setSubmittingReview(false);
    }
  };

  // Load Active Gaming Sessions
  const fetchActiveGameSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await api.get("/admin/games/active-sessions");
      setActiveGameSessions(res.data?.sessions || []);
    } catch {
      setActiveGameSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  // Admin Force Stop Gaming Session
  const handleForceStopSession = async (sessionId) => {
    if (!window.confirm(`Force terminate gaming session ${sessionId}?`)) return;
    try {
      await api.post(`/games/session/${sessionId}/stop`);
      toast.success(`Session ${sessionId} terminated.`);
      fetchActiveGameSessions();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to terminate session.");
    }
  };

  // Initial load
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Tab-dependent data fetching
  useEffect(() => {
    if (tab === "overview") fetchStats();
    if (tab === "users") fetchUsers();
    if (tab === "reviews") fetchPendingReviews();
    if (tab === "payouts") fetchPayouts();
    if (tab === "catalog") fetchCatalog();
    if (tab === "reports") fetchReports();
    if (tab === "gamezone") {
      if (gamezoneTab === "catalog") fetchAdminGames();
      if (gamezoneTab === "submissions") fetchSubmissions();
      if (gamezoneTab === "sessions") fetchActiveGameSessions();
    }
  }, [tab, gamezoneTab, fetchStats, fetchUsers, fetchPendingReviews, fetchPayouts, fetchCatalog, fetchReports, fetchAdminGames, fetchSubmissions, fetchActiveGameSessions]);

  // User Role Switcher
  const handleRoleChange = async (targetUser, newRole) => {
    if (targetUser.role === newRole) return;
    setUpdatingUserId(targetUser.id);
    try {
      await api.patch(`/admin/users/${targetUser.id}/role`, { role: newRole });
      toast.success(`Role for ${targetUser.email} updated to ${newRole.toUpperCase()}!`);
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole, seller_verified: newRole === "seller" ? true : u.seller_verified } : u)));
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not update user role.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  // User Ban / Unban Toggle
  const handleStatusToggle = async (targetUser) => {
    const isBanning = !targetUser.banned;
    if (isBanning && !window.confirm(`Are you sure you want to suspend account for ${targetUser.email}? They will be immediately signed out.`)) {
      return;
    }
    setUpdatingUserId(targetUser.id);
    try {
      await api.patch(`/admin/users/${targetUser.id}/status`, { banned: isBanning });
      toast.success(`Account for ${targetUser.email} is now ${isBanning ? "SUSPENDED" : "ACTIVE"}.`);
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, banned: isBanning } : u)));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not update user status.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Review Decisions (Products & GPU Rentals)
  const handleDecideReview = async (item, decision) => {
    try {
      if (item.kind === "product") {
        await api.post(`/admin/products/${item.id}/${decision}`);
      } else {
        await api.post(`/admin/rentals/${item.id}/${decision}`);
      }
      toast.success(`${item.kind === "product" ? "Product" : "GPU Rig"} was ${decision}!`);
      setPendingReviews((prev) => prev.filter((x) => x.id !== item.id));
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to ${decision} listing`);
    }
  };

  // Payout Decision
  const handleDecidePayout = async (withdrawalId, decision) => {
    try {
      await api.post(`/admin/payouts/${withdrawalId}/decision`, { decision });
      toast.success(`Payout ${withdrawalId} marked as ${decision.toUpperCase()}!`);
      setPayouts((prev) => prev.map((p) => (p.id === withdrawalId ? { ...p, status: decision } : p)));
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update payout request");
    }
  };

  // Delete / Delist from Catalog
  const handleDeleteListing = async (item) => {
    if (!window.confirm(`Delete listing "${item.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/listings/${item.kind}/${item.id}`);
      toast.success(`Listing removed from ${item.kind === "product" ? "Shop" : "Rentals"}.`);
      setCatalogItems((prev) => prev.filter((x) => x.id !== item.id));
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete listing.");
    }
  };

  // Resolve Abuse Report
  const handleResolveReport = async (reportId, decision) => {
    const notes = decision === "remove_listing" ? prompt("Optional audit note (reason for removal):") || "" : "";
    try {
      await api.post(`/admin/reports/${reportId}/resolve`, { decision, notes });
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      toast.success(decision === "dismiss" ? "Report dismissed." : "Infringing listing removed.");
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to resolve report.");
    }
  };

  const filteredReviews = reviewFilter === "all" ? pendingReviews : pendingReviews.filter((r) => r.kind === reviewFilter);

  return (
    <>
      <SEO title="Operations Console — Productify Admin" path="/admin" />

      <section className="dashboard-page admin-wide" style={{ padding: "32px 5% 80px", maxWidth: 1200, margin: "0 auto" }}>
        
        {/* Header Ribbon */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
          <div>
            <div className="eyebrow" style={{ color: "var(--violet, #6556e8)" }}>
              <ShieldCheck size={14} /> OPERATIONS CONSOLE · {user?.role?.toUpperCase()}
            </div>
            <h1 style={{ font: "600 clamp(26px, 3.5vw, 36px) 'Space Grotesk', sans-serif", margin: "6px 0 6px", letterSpacing: "-0.04em" }}>
              Platform governance<em>.</em>
            </h1>
            <p style={{ color: "var(--muted, #747570)", margin: 0, fontSize: "0.92rem" }}>
              Control user roles, moderate digital software & GPU nodes, approve seller payouts, and audit reports.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => { fetchStats(); toast.info("Platform stats refreshed"); }}
              className="secondary-button"
              style={{ padding: "8px 14px", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw size={13} /> Refresh Data
            </button>
          </div>
        </div>

        {/* Top Quick Stats Ribbon */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 28 }}>
          
          <div style={{ background: "#ffffff", border: "1px solid var(--line, #dedfd9)", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--muted, #747570)", fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
              <span>Total Users</span>
              <Users size={16} color="var(--violet, #6556e8)" />
            </div>
            <div style={{ font: "800 28px 'Space Grotesk'", margin: "6px 0 2px" }}>{stats.total_users}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted, #747570)" }}>
              <b>{stats.sellers_count}</b> sellers · <b>{stats.buyers_count}</b> buyers
            </div>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid var(--line, #dedfd9)", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--muted, #747570)", fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
              <span>Pending Reviews</span>
              <Package size={16} color="#F59E0B" />
            </div>
            <div style={{ font: "800 28px 'Space Grotesk'", margin: "6px 0 2px", color: stats.pending_reviews_count > 0 ? "#D97706" : "inherit" }}>
              {stats.pending_reviews_count}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted, #747570)" }}>
              {stats.pending_reviews_count > 0 ? "Awaiting moderation" : "All clear ✓"}
            </div>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid var(--line, #dedfd9)", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--muted, #747570)", fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
              <span>Pending Payouts</span>
              <CreditCard size={16} color="var(--green, #277c50)" />
            </div>
            <div style={{ font: "800 28px 'Space Grotesk'", margin: "6px 0 2px" }}>
              {money(stats.pending_payouts_amount)}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted, #747570)" }}>
              <b>{stats.pending_payouts_count}</b> withdrawal requests
            </div>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid var(--line, #dedfd9)", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--muted, #747570)", fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
              <span>Platform GMV</span>
              <Sparkles size={16} color="var(--lime, #84cc16)" />
            </div>
            <div style={{ font: "800 28px 'Space Grotesk'", margin: "6px 0 2px" }}>
              {money(stats.total_gmv)}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted, #747570)" }}>
              <b>{stats.total_orders_count}</b> completed orders
            </div>
          </div>

        </div>

        {/* Tab Navigation */}
        <div className="dashboard-tabs" style={{ display: "flex", flexWrap: "wrap", gap: 8, borderBottom: "1px solid var(--line, #dedfd9)", paddingBottom: 12, marginBottom: 24 }}>
          <button className={tab === "overview" ? "selected" : ""} onClick={() => setTab("overview")}>
            <Sparkles size={14} /> Overview
          </button>
          <button className={tab === "users" ? "selected" : ""} onClick={() => setTab("users")}>
            <Users size={14} /> Users & Roles <b className="tab-count">{stats.total_users}</b>
          </button>
          <button className={tab === "reviews" ? "selected" : ""} onClick={() => setTab("reviews")}>
            <Package size={14} /> Review Queue <b className="tab-count" style={{ background: stats.pending_reviews_count > 0 ? "var(--lime)" : "inherit" }}>{stats.pending_reviews_count}</b>
          </button>
          <button className={tab === "payouts" ? "selected" : ""} onClick={() => setTab("payouts")}>
            <CreditCard size={14} /> Payout Approvals <b className="tab-count">{stats.pending_payouts_count}</b>
          </button>
          <button className={tab === "catalog" ? "selected" : ""} onClick={() => setTab("catalog")}>
            <Search size={14} /> Catalog ({stats.active_products + stats.active_rentals})
          </button>
          <button className={tab === "reports" ? "selected" : ""} onClick={() => setTab("reports")}>
            <Flag size={14} /> Abuse Reports <b className="tab-count">{stats.open_reports_count}</b>
          </button>
          <button className={tab === "gamezone" ? "selected" : ""} onClick={() => setTab("gamezone")}>
            <Gamepad2 size={14} /> Gamezone Hub
          </button>
        </div>

        {/* ===================== TAB: OVERVIEW ===================== */}
        {tab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
              
              {/* Quick Actions Card */}
              <div style={{ background: "#ffffff", border: "1px solid var(--line, #dedfd9)", borderRadius: 12, padding: 24 }}>
                <h3 style={{ font: "600 18px 'Space Grotesk'", margin: "0 0 12px" }}>Operational Status</h3>
                <p style={{ color: "var(--muted, #747570)", fontSize: "0.88rem", marginBottom: 16 }}>
                  Summary of items requiring administrative review or settlement.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#fafaf8", borderRadius: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Package size={18} color="#F59E0B" />
                      <div>
                        <b>{stats.pending_reviews_count} Listings</b>
                        <small style={{ display: "block", color: "var(--muted)" }}>{stats.pending_products_count} software · {stats.pending_rentals_count} GPU nodes</small>
                      </div>
                    </div>
                    <button onClick={() => setTab("reviews")} className="secondary-button" style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
                      Review Queue →
                    </button>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#fafaf8", borderRadius: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <CreditCard size={18} color="#10B981" />
                      <div>
                        <b>{stats.pending_payouts_count} Payouts Awaiting</b>
                        <small style={{ display: "block", color: "var(--muted)" }}>Totaling {money(stats.pending_payouts_amount)}</small>
                      </div>
                    </div>
                    <button onClick={() => setTab("payouts")} className="secondary-button" style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
                      Approve Payouts →
                    </button>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#fafaf8", borderRadius: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Flag size={18} color="#EF4444" />
                      <div>
                        <b>{stats.open_reports_count} Open Reports</b>
                        <small style={{ display: "block", color: "var(--muted)" }}>Community flagged content</small>
                      </div>
                    </div>
                    <button onClick={() => setTab("reports")} className="secondary-button" style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
                      Inspect Reports →
                    </button>
                  </div>
                </div>
              </div>

              {/* Roles Breakdown Card */}
              <div style={{ background: "#ffffff", border: "1px solid var(--line, #dedfd9)", borderRadius: 12, padding: 24 }}>
                <h3 style={{ font: "600 18px 'Space Grotesk'", margin: "0 0 12px" }}>Platform Membership</h3>
                <p style={{ color: "var(--muted, #747570)", fontSize: "0.88rem", marginBottom: 16 }}>
                  Total accounts registered across Productify.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--line, #dedfd9)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--violet, #6556e8)" }} /> Sellers / Vendors</span>
                    <b>{stats.sellers_count}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--line, #dedfd9)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6B7280" }} /> Buyers / Customers</span>
                    <b>{stats.buyers_count}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--line, #dedfd9)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ink, #101112)" }} /> Administrators & Staff</span>
                    <b>{stats.staff_count}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--line, #dedfd9)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green, #277c50)" }} /> Live Catalog Items</span>
                    <b>{stats.active_products + stats.active_rentals}</b>
                  </div>
                </div>

                <button onClick={() => setTab("users")} className="primary-button" style={{ width: "100%", marginTop: 20, padding: 10 }}>
                  Manage All Users & Roles →
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ===================== TAB: USERS & ROLES ===================== */}
        {tab === "users" && (
          <div>
            {/* Search and Filter Controls */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 260, maxWidth: 420 }}>
                <input
                  type="text"
                  placeholder="Search user by name, email, or handle…"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--line, #dedfd9)", background: "#ffffff" }}
                />
                <button type="button" onClick={fetchUsers} className="primary-button" style={{ padding: "10px 18px", fontSize: "0.85rem" }}>
                  Search
                </button>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { id: "all", label: "All Users" },
                  { id: "seller", label: "Sellers" },
                  { id: "buyer", label: "Buyers" },
                  { id: "staff", label: "Staff (Admins)" }
                ].map((rf) => (
                  <button
                    key={rf.id}
                    onClick={() => setUserRoleFilter(rf.id)}
                    className={userRoleFilter === rf.id ? "primary-button" : "secondary-button"}
                    style={{ padding: "8px 14px", fontSize: "0.82rem" }}
                  >
                    {rf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Users Table */}
            {usersLoading ? (
              <div className="loading-block">Loading users…</div>
            ) : users.length === 0 ? (
              <div className="empty-state">
                <Users size={32} />
                <p>No users found matching your criteria.</p>
              </div>
            ) : (
              <div style={{ background: "#ffffff", border: "1px solid var(--line, #dedfd9)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                    <thead>
                      <tr style={{ background: "#fafaf8", borderBottom: "1px solid var(--line, #dedfd9)", color: "var(--muted, #747570)", font: "700 11px 'DM Mono'", textTransform: "uppercase" }}>
                        <th style={{ padding: "14px 18px" }}>User</th>
                        <th style={{ padding: "14px 18px" }}>Verification Badges</th>
                        <th style={{ padding: "14px 18px" }}>Current Role</th>
                        <th style={{ padding: "14px 18px" }}>Change Role</th>
                        <th style={{ padding: "14px 18px", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => {
                        const isSelf = u.id === user?.id;
                        return (
                          <tr key={u.id} style={{ borderBottom: "1px solid var(--line, #dedfd9)", opacity: u.banned ? 0.6 : 1 }}>
                            
                            {/* User details */}
                            <td style={{ padding: "14px 18px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 36, height: 36, borderRadius: "50%", background: u.avatar_url ? `url(${u.avatar_url}) center/cover` : "var(--ink, #101112)", color: "var(--lime, #c8f04c)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "0.85rem", flexShrink: 0 }}>
                                  {!u.avatar_url && (u.name ? u.name[0].toUpperCase() : "U")}
                                </div>
                                <div>
                                  <b style={{ display: "block", color: "var(--ink, #101112)" }}>
                                    {u.name} {isSelf && <small style={{ color: "var(--violet, #6556e8)" }}>(You)</small>}
                                  </b>
                                  <span style={{ fontSize: "0.8rem", color: "var(--muted, #747570)" }}>{u.email}</span>
                                  {u.username && (
                                    <small style={{ display: "block", font: "11px 'DM Mono'", color: "var(--violet, #6556e8)" }}>
                                      @{u.username}
                                    </small>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Verification Badges */}
                            <td style={{ padding: "14px 18px" }}>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {u.email_verified && (
                                  <span style={{ background: "#e9f3e5", color: "#277c50", fontSize: "11px", fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>
                                    Email ✓
                                  </span>
                                )}
                                {u.phone_verified && (
                                  <span style={{ background: "#e9f3e5", color: "#277c50", fontSize: "11px", fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>
                                    Phone ✓
                                  </span>
                                )}
                                {u.seller_verified && (
                                  <span style={{ background: "rgba(101, 86, 232, 0.1)", color: "var(--violet, #6556e8)", fontSize: "11px", fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>
                                    Seller ✓
                                  </span>
                                )}
                                {u.banned && (
                                  <span style={{ background: "#fee2e2", color: "#b91c1c", fontSize: "11px", fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>
                                    SUSPENDED
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Role Badge */}
                            <td style={{ padding: "14px 18px" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: 4,
                                  font: "700 11px 'DM Mono'",
                                  textTransform: "uppercase",
                                  background:
                                    u.role === "admin"
                                      ? "var(--ink, #101112)"
                                      : u.role === "sub-admin"
                                      ? "var(--violet, #6556e8)"
                                      : u.role === "seller"
                                      ? "#dcfce7"
                                      : "#f3f4f6",
                                  color:
                                    u.role === "admin" || u.role === "sub-admin"
                                      ? "#ffffff"
                                      : u.role === "seller"
                                      ? "#166534"
                                      : "#374151"
                                }}
                              >
                                {u.role}
                              </span>
                            </td>

                            {/* Instant Role Change Selector */}
                            <td style={{ padding: "14px 18px" }}>
                              <select
                                value={u.role}
                                disabled={updatingUserId === u.id || (isSelf && u.role === "admin")}
                                onChange={(e) => handleRoleChange(u, e.target.value)}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 6,
                                  border: "1px solid var(--line, #dedfd9)",
                                  background: "#ffffff",
                                  color: "#101112",
                                  fontSize: "0.82rem",
                                  fontWeight: 600
                                }}
                              >
                                <option value="buyer">Buyer</option>
                                <option value="seller">Seller</option>
                                <option value="sub-admin">Sub-Admin</option>
                                <option value="admin">Admin</option>
                              </select>
                            </td>

                            {/* Actions: Ban / Unban */}
                            <td style={{ padding: "14px 18px", textAlign: "right" }}>
                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() => handleStatusToggle(u)}
                                  disabled={updatingUserId === u.id || u.role === "admin"}
                                  className="secondary-button"
                                  style={{
                                    padding: "6px 12px",
                                    fontSize: "0.78rem",
                                    color: u.banned ? "#166534" : "#b91c1c",
                                    borderColor: u.banned ? "#86efac" : "#fca5a5"
                                  }}
                                >
                                  {u.banned ? "Unban Account" : "Suspend"}
                                </button>
                              )}
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB: REVIEW QUEUE (Products & GPU Rentals) ===================== */}
        {tab === "reviews" && (
          <div>
            {/* Filter buttons */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setReviewFilter("all")}
                  className={reviewFilter === "all" ? "primary-button" : "secondary-button"}
                  style={{ padding: "8px 14px", fontSize: "0.82rem" }}
                >
                  All Pending ({pendingReviews.length})
                </button>
                <button
                  onClick={() => setReviewFilter("product")}
                  className={reviewFilter === "product" ? "primary-button" : "secondary-button"}
                  style={{ padding: "8px 14px", fontSize: "0.82rem" }}
                >
                  Digital Software ({pendingReviews.filter((r) => r.kind === "product").length})
                </button>
                <button
                  onClick={() => setReviewFilter("rental")}
                  className={reviewFilter === "rental" ? "primary-button" : "secondary-button"}
                  style={{ padding: "8px 14px", fontSize: "0.82rem" }}
                >
                  GPU Nodes ({pendingReviews.filter((r) => r.kind === "rental").length})
                </button>
              </div>

              <button onClick={fetchPendingReviews} className="secondary-button" style={{ padding: "8px 14px", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 6 }}>
                <RefreshCw size={13} /> Refresh Queue
              </button>
            </div>

            {reviewsLoading ? (
              <div className="loading-block">Loading review queue…</div>
            ) : filteredReviews.length === 0 ? (
              <div className="empty-state" style={{ background: "#ffffff", border: "1px solid var(--line, #dedfd9)", borderRadius: 12, padding: 48, textAlign: "center" }}>
                <CheckCircle2 size={36} color="#277c50" style={{ margin: "0 auto 10px" }} />
                <h3 style={{ margin: 0, font: "600 20px 'Space Grotesk'" }}>All Clear!</h3>
                <p style={{ color: "var(--muted, #747570)", margin: "6px 0 0" }}>There are no listings awaiting administrative moderation.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18 }}>
                {filteredReviews.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: "#ffffff",
                      border: "1px solid var(--line, #dedfd9)",
                      borderRadius: 12,
                      overflow: "hidden",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
                      display: "flex",
                      flexDirection: "column"
                    }}
                  >
                    {/* Item Image Preview */}
                    <div style={{ height: 160, background: "#f0f0ed", position: "relative" }}>
                      <img
                        src={item.image || "https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=900"}
                        alt={item.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          top: 12,
                          left: 12,
                          background: item.kind === "product" ? "var(--violet, #6556e8)" : "var(--ink, #101112)",
                          color: item.kind === "product" ? "#ffffff" : "var(--lime, #c8f04c)",
                          font: "800 10px 'DM Mono'",
                          textTransform: "uppercase",
                          padding: "3px 8px",
                          borderRadius: 4
                        }}
                      >
                        {item.kind === "product" ? "Digital Software" : "GPU Rig"}
                      </span>
                    </div>

                    {/* Card Content */}
                    <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <h4 style={{ margin: 0, font: "600 17px 'Space Grotesk'" }}>{item.title}</h4>
                        <b style={{ font: "800 16px 'Space Grotesk'", color: "var(--ink)" }}>
                          {item.kind === "product" ? `$${item.price}` : `$${item.price}/hr`}
                        </b>
                      </div>

                      <div style={{ fontSize: "0.8rem", color: "var(--muted, #747570)", marginBottom: 10 }}>
                        {item.kind === "product" ? (
                          <span>Category: <b>{item.category}</b> · Seller: <b>{item.seller}</b></span>
                        ) : (
                          <span>GPU: <b>{item.gpu}</b> ({item.vram}) · Loc: <b>{item.location}</b> · Owner: <b>{item.owner}</b></span>
                        )}
                      </div>

                      <p style={{ fontSize: "0.82rem", color: "var(--ink)", lineHeight: 1.4, flex: 1, margin: "0 0 14px" }}>
                        {item.description ? item.description.substring(0, 140) + "…" : "No description provided."}
                      </p>

                      {/* Approval Actions */}
                      <div style={{ display: "flex", gap: 10, borderTop: "1px solid var(--line, #dedfd9)", paddingTop: 14 }}>
                        <button
                          type="button"
                          onClick={() => handleDecideReview(item, "approved")}
                          className="primary-button"
                          style={{ flex: 1, padding: "10px", fontSize: "0.82rem", background: "var(--green, #277c50)", color: "#ffffff", borderColor: "#277c50" }}
                        >
                          <CheckCircle2 size={14} /> Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecideReview(item, "rejected")}
                          className="secondary-button"
                          style={{ flex: 1, padding: "10px", fontSize: "0.82rem", color: "#b91c1c", borderColor: "#fca5a5" }}
                        >
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB: PAYOUT APPROVALS ===================== */}
        {tab === "payouts" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setPayoutFilter("all")}
                  className={payoutFilter === "all" ? "primary-button" : "secondary-button"}
                  style={{ padding: "8px 14px", fontSize: "0.82rem" }}
                >
                  All Requests
                </button>
                <button
                  onClick={() => setPayoutFilter("processing")}
                  className={payoutFilter === "processing" ? "primary-button" : "secondary-button"}
                  style={{ padding: "8px 14px", fontSize: "0.82rem" }}
                >
                  Awaiting Settlement ({payouts.filter((p) => p.status === "processing").length})
                </button>
                <button
                  onClick={() => setPayoutFilter("completed")}
                  className={payoutFilter === "completed" ? "primary-button" : "secondary-button"}
                  style={{ padding: "8px 14px", fontSize: "0.82rem" }}
                >
                  Completed
                </button>
              </div>

              <button onClick={fetchPayouts} className="secondary-button" style={{ padding: "8px 14px", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 6 }}>
                <RefreshCw size={13} /> Refresh Payouts
              </button>
            </div>

            {payoutsLoading ? (
              <div className="loading-block">Loading payouts…</div>
            ) : payouts.length === 0 ? (
              <div className="empty-state" style={{ background: "#ffffff", border: "1px solid var(--line, #dedfd9)", borderRadius: 12, padding: 40, textAlign: "center" }}>
                <CreditCard size={32} />
                <p>No payout requests found.</p>
              </div>
            ) : (
              <div style={{ background: "#ffffff", border: "1px solid var(--line, #dedfd9)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                    <thead>
                      <tr style={{ background: "#fafaf8", borderBottom: "1px solid var(--line, #dedfd9)", color: "var(--muted, #747570)", font: "700 11px 'DM Mono'", textTransform: "uppercase" }}>
                        <th style={{ padding: "14px 18px" }}>ID & Date</th>
                        <th style={{ padding: "14px 18px" }}>Seller</th>
                        <th style={{ padding: "14px 18px" }}>Amount</th>
                        <th style={{ padding: "14px 18px" }}>Destination Method</th>
                        <th style={{ padding: "14px 18px" }}>Status</th>
                        <th style={{ padding: "14px 18px", textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map((p) => (
                        <tr key={p.id} style={{ borderBottom: "1px solid var(--line, #dedfd9)" }}>
                          <td style={{ padding: "14px 18px" }}>
                            <code style={{ font: "700 12px 'DM Mono'", display: "block" }}>{p.id}</code>
                            <small style={{ color: "var(--muted)" }}>{new Date(p.created_at).toLocaleString()}</small>
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            <b>{p.seller_name || "Seller"}</b>
                            <small style={{ display: "block", color: "var(--muted)" }}>{p.seller_email}</small>
                          </td>
                          <td style={{ padding: "14px 18px", font: "800 16px 'Space Grotesk'" }}>
                            {money(p.amount)}
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            <span style={{ textTransform: "uppercase", font: "700 11px 'DM Mono'", display: "block" }}>
                              {p.method}
                            </span>
                            <small style={{ color: "var(--muted)" }}>{p.destination}</small>
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: 4,
                                font: "700 11px 'DM Mono'",
                                textTransform: "uppercase",
                                background: p.status === "completed" ? "#dcfce7" : p.status === "rejected" ? "#fee2e2" : "#fef3c7",
                                color: p.status === "completed" ? "#166534" : p.status === "rejected" ? "#b91c1c" : "#92400e"
                              }}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "right" }}>
                            {p.status === "processing" ? (
                              <button
                                type="button"
                                onClick={() => handleDecidePayout(p.id, "completed")}
                                className="primary-button"
                                style={{ padding: "6px 14px", fontSize: "0.82rem", background: "#277c50", borderColor: "#277c50" }}
                              >
                                <CheckCircle2 size={13} /> Mark Paid
                              </button>
                            ) : (
                              <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Settled</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB: GLOBAL CATALOG ===================== */}
        {tab === "catalog" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 260, maxWidth: 400 }}>
                <input
                  type="text"
                  placeholder="Search catalog title, seller, or tags…"
                  value={catalogQuery}
                  onChange={(e) => setCatalogQuery(e.target.value)}
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--line, #dedfd9)", background: "#ffffff" }}
                />
                <button type="button" onClick={fetchCatalog} className="primary-button" style={{ padding: "10px 16px", fontSize: "0.85rem" }}>
                  Filter
                </button>
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { id: "all", label: "All Items" },
                  { id: "product", label: "Software" },
                  { id: "rental", label: "GPU Nodes" }
                ].map((k) => (
                  <button
                    key={k.id}
                    onClick={() => setCatalogKind(k.id)}
                    className={catalogKind === k.id ? "primary-button" : "secondary-button"}
                    style={{ padding: "8px 14px", fontSize: "0.82rem" }}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            {catalogLoading ? (
              <div className="loading-block">Loading catalog…</div>
            ) : catalogItems.length === 0 ? (
              <div className="empty-state">
                <Search size={32} />
                <p>No listings match your search.</p>
              </div>
            ) : (
              <div style={{ background: "#ffffff", border: "1px solid var(--line, #dedfd9)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                    <thead>
                      <tr style={{ background: "#fafaf8", borderBottom: "1px solid var(--line, #dedfd9)", color: "var(--muted, #747570)", font: "700 11px 'DM Mono'", textTransform: "uppercase" }}>
                        <th style={{ padding: "14px 18px" }}>Item</th>
                        <th style={{ padding: "14px 18px" }}>Type</th>
                        <th style={{ padding: "14px 18px" }}>Price</th>
                        <th style={{ padding: "14px 18px" }}>Seller / Node Host</th>
                        <th style={{ padding: "14px 18px" }}>Status</th>
                        <th style={{ padding: "14px 18px", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catalogItems.map((item) => (
                        <tr key={item.id} style={{ borderBottom: "1px solid var(--line, #dedfd9)" }}>
                          <td style={{ padding: "14px 18px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <img src={item.image} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover" }} />
                              <div>
                                <b style={{ display: "block" }}>{item.title}</b>
                                <small style={{ color: "var(--muted)" }}>{item.category || item.gpu}</small>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            <span style={{ font: "700 11px 'DM Mono'", textTransform: "uppercase" }}>
                              {item.kind === "product" ? "Digital" : "GPU Node"}
                            </span>
                          </td>
                          <td style={{ padding: "14px 18px", font: "800 15px 'Space Grotesk'" }}>
                            {item.kind === "product" ? `$${item.price}` : `$${item.price}/hr`}
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            {item.seller || item.owner}
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            <span style={{ color: item.approved || item.status === "approved" ? "#166534" : "#92400e", fontWeight: 700, fontSize: "0.8rem" }}>
                              {item.approved || item.status === "approved" ? "Active ✓" : "Pending"}
                            </span>
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "right" }}>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                              <a
                                href={item.kind === "product" ? `/product/${item.id}` : `/rental/${item.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="secondary-button"
                                style={{ padding: "6px 10px", fontSize: "0.78rem" }}
                              >
                                <ExternalLink size={12} /> View
                              </a>
                              <button
                                type="button"
                                onClick={() => handleDeleteListing(item)}
                                className="secondary-button"
                                style={{ padding: "6px 10px", fontSize: "0.78rem", color: "#b91c1c", borderColor: "#fca5a5" }}
                              >
                                <Trash2 size={12} /> Delist
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB: ABUSE REPORTS ===================== */}
        {tab === "reports" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ margin: 0, color: "var(--muted, #747570)", fontSize: "0.9rem" }}>
                Community flagged listings for intellectual property, fraudulent claims, or malware.
              </p>
              <button onClick={fetchReports} className="secondary-button" style={{ padding: "8px 14px", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 6 }}>
                <RefreshCw size={13} /> Refresh Reports
              </button>
            </div>

            {reportsLoading ? (
              <div className="loading-block">Loading reports…</div>
            ) : reports.length === 0 ? (
              <div className="empty-state" style={{ background: "#ffffff", border: "1px solid var(--line, #dedfd9)", borderRadius: 12, padding: 40, textAlign: "center" }}>
                <Flag size={32} color="#277c50" style={{ margin: "0 auto 8px" }} />
                <h3 style={{ margin: 0, font: "600 20px 'Space Grotesk'" }}>Zero Abuse Reports</h3>
                <p style={{ color: "var(--muted, #747570)", margin: "4px 0 0" }}>No community reports currently pending review.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {reports.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      background: "#ffffff",
                      border: "1px solid var(--line, #dedfd9)",
                      borderRadius: 12,
                      padding: "20px 24px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 16
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 280 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ background: "#fee2e2", color: "#b91c1c", font: "800 10px 'DM Mono'", padding: "3px 8px", borderRadius: 4, textTransform: "uppercase" }}>
                          {r.reason}
                        </span>
                        <small style={{ color: "var(--muted)", font: "11px 'DM Mono'" }}>
                          <Clock size={11} style={{ display: "inline", verticalAlign: "middle" }} /> {new Date(r.created_at).toLocaleString()}
                        </small>
                      </div>

                      <h4 style={{ margin: "0 0 4px", font: "600 18px 'Space Grotesk'" }}>
                        {r.listing_title || r.listing_id}
                      </h4>
                      <div style={{ fontSize: "0.82rem", color: "var(--muted, #747570)", marginBottom: 8 }}>
                        Reported by: <b>{r.reporter_email || "Anonymous user"}</b> · Type: {r.listing_kind}
                      </div>

                      <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "var(--ink)", background: "#fafaf8", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--line)" }}>
                        {r.details || <i>No additional comment provided by reporter.</i>}
                      </p>

                      <a
                        href={r.listing_kind === "product" ? `/product/${r.listing_id}` : `/rental/${r.listing_id}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: "0.82rem", color: "var(--violet, #6556e8)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        Inspect Listing In New Tab <ExternalLink size={13} />
                      </a>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 160 }}>
                      <button
                        type="button"
                        onClick={() => handleResolveReport(r.id, "dismiss")}
                        className="secondary-button"
                        style={{ padding: "10px 16px", fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                      >
                        <CheckCircle2 size={14} color="#277c50" /> Dismiss Report
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolveReport(r.id, "remove_listing")}
                        className="secondary-button"
                        style={{ padding: "10px 16px", fontSize: "0.82rem", color: "#b91c1c", borderColor: "#fca5a5", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                      >
                        <XCircle size={14} /> Remove Listing
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB: GAMEZONE HUB ===================== */}
        {tab === "gamezone" && (
          <div>
            {/* Gamezone Subtab Navigation */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 8, background: "#f1f2ec", padding: 4, borderRadius: 10 }}>
                <button
                  type="button"
                  onClick={() => setGamezoneTab("catalog")}
                  style={{
                    border: "none",
                    background: gamezoneTab === "catalog" ? "#fff" : "transparent",
                    color: gamezoneTab === "catalog" ? "var(--ink)" : "var(--muted)",
                    padding: "7px 14px",
                    borderRadius: 7,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    boxShadow: gamezoneTab === "catalog" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <Layers size={14} /> Curated Catalog ({adminGames.length})
                </button>
                <button
                  type="button"
                  onClick={() => setGamezoneTab("submissions")}
                  style={{
                    border: "none",
                    background: gamezoneTab === "submissions" ? "#fff" : "transparent",
                    color: gamezoneTab === "submissions" ? "var(--ink)" : "var(--muted)",
                    padding: "7px 14px",
                    borderRadius: 7,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    boxShadow: gamezoneTab === "submissions" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <ShieldCheck size={14} /> Safety Queue ({submissions.filter(s => s.status === "pending_review").length})
                </button>
                <button
                  type="button"
                  onClick={() => setGamezoneTab("sessions")}
                  style={{
                    border: "none",
                    background: gamezoneTab === "sessions" ? "#fff" : "transparent",
                    color: gamezoneTab === "sessions" ? "var(--ink)" : "var(--muted)",
                    padding: "7px 14px",
                    borderRadius: 7,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    boxShadow: gamezoneTab === "sessions" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <Server size={14} /> Live Fleet Containers ({activeGameSessions.length})
                </button>
              </div>

              {gamezoneTab === "catalog" && (
                <button
                  type="button"
                  onClick={() => setNewGameModal(true)}
                  className="primary-button"
                  style={{ padding: "8px 16px", fontSize: "0.84rem", display: "flex", alignItems: "center", gap: 6 }}
                >
                  <Plus size={14} /> Add Game to Library
                </button>
              )}
            </div>

            {/* Subtab 1: Curated Catalog */}
            {gamezoneTab === "catalog" && (
              <div>
                {adminGamesLoading ? (
                  <div style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>Loading games catalog...</div>
                ) : adminGames.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 48, background: "#fff", borderRadius: 12, border: "1px solid var(--line)" }}>
                    <p style={{ color: "var(--muted)" }}>No games in library yet.</p>
                  </div>
                ) : (
                  <div style={{ background: "#fff", border: "1px solid var(--line, #dedfd9)", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.86rem" }}>
                        <thead>
                          <tr style={{ background: "#f8f9fa", borderBottom: "1px solid var(--line)", color: "var(--muted)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
                            <th style={{ padding: "12px 16px" }}>Game</th>
                            <th style={{ padding: "12px 16px" }}>Genre</th>
                            <th style={{ padding: "12px 16px" }}>Min Specs</th>
                            <th style={{ padding: "12px 16px" }}>Hourly Rate</th>
                            <th style={{ padding: "12px 16px" }}>Status</th>
                            <th style={{ padding: "12px 16px" }}>Featured</th>
                            <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminGames.map((g) => {
                            const isEditing = editingGameId === g.id;
                            return (
                              <tr key={g.id} style={{ borderBottom: "1px solid var(--line, #dedfd9)" }}>
                                <td style={{ padding: "12px 16px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <img
                                      src={g.cover_image || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=200"}
                                      alt={g.title}
                                      style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover" }}
                                    />
                                    <div>
                                      <div style={{ fontWeight: 700, color: "var(--ink)" }}>{g.title}</div>
                                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{g.slug} · ID: {g.id}</div>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: "12px 16px" }}>
                                  <span style={{ background: "#ede9fe", color: "#6d28d9", padding: "3px 8px", borderRadius: 4, fontSize: "0.74rem", fontWeight: 700 }}>
                                    {g.genre}
                                  </span>
                                </td>
                                <td style={{ padding: "12px 16px", fontSize: "0.8rem", color: "var(--muted)" }}>
                                  <div>{g.min_gpu_vram || "8 GB"} VRAM</div>
                                  <small style={{ color: "#64748b" }}>{g.docker_image}</small>
                                </td>
                                <td style={{ padding: "12px 16px" }}>
                                  {isEditing ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <input
                                        type="number"
                                        step="0.05"
                                        min="0.10"
                                        value={editPrice}
                                        onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0.1)}
                                        style={{ width: 80, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--line)", fontSize: "0.85rem" }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateGame(g.id, { hourly_rate_credits: editPrice })}
                                        style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: 4, padding: "4px 8px", cursor: "pointer" }}
                                        title="Save price"
                                      >
                                        <Check size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingGameId(null)}
                                        style={{ background: "#e2e8f0", color: "#475569", border: "none", borderRadius: 4, padding: "4px 8px", cursor: "pointer" }}
                                        title="Cancel"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ fontWeight: 800, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                                        {parseFloat(g.hourly_rate_credits || 1).toFixed(2)} cr/hr
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingGameId(g.id);
                                          setEditPrice(parseFloat(g.hourly_rate_credits || 1));
                                        }}
                                        style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", padding: 2 }}
                                        title="Edit hourly rate"
                                      >
                                        <Edit2 size={13} />
                                      </button>
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: "12px 16px" }}>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateGame(g.id, {
                                      hourly_rate_credits: parseFloat(g.hourly_rate_credits || 1),
                                      status: g.status === "published" ? "draft" : "published"
                                    })}
                                    style={{
                                      background: g.status === "published" ? "#dcfce7" : "#f1f5f9",
                                      color: g.status === "published" ? "#15803d" : "#64748b",
                                      border: "none",
                                      borderRadius: 4,
                                      padding: "3px 8px",
                                      fontSize: "0.74rem",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      textTransform: "uppercase"
                                    }}
                                  >
                                    {g.status || "published"}
                                  </button>
                                </td>
                                <td style={{ padding: "12px 16px" }}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(g.featured)}
                                    onChange={(e) => handleUpdateGame(g.id, {
                                      hourly_rate_credits: parseFloat(g.hourly_rate_credits || 1),
                                      featured: e.target.checked
                                    })}
                                    style={{ cursor: "pointer" }}
                                  />
                                </td>
                                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteGame(g.id, g.title)}
                                    style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}
                                    title="Delete game"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Subtab 2: Community Submissions Safety Queue */}
            {gamezoneTab === "submissions" && (
              <div>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {["all", "pending_review", "approved", "rejected"].map((sf) => (
                    <button
                      key={sf}
                      type="button"
                      onClick={() => setSubmissionFilter(sf)}
                      className={submissionFilter === sf ? "selected" : ""}
                      style={{
                        padding: "6px 12px",
                        fontSize: "0.78rem",
                        borderRadius: 6,
                        border: "1px solid var(--line)",
                        background: submissionFilter === sf ? "var(--ink, #1c1c1c)" : "#fff",
                        color: submissionFilter === sf ? "#fff" : "var(--muted)",
                        cursor: "pointer",
                        fontWeight: 600,
                        textTransform: "capitalize"
                      }}
                    >
                      {sf.replace("_", " ")}
                    </button>
                  ))}
                </div>

                {submissionsLoading ? (
                  <div style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>Loading submissions queue...</div>
                ) : submissions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 48, background: "#fff", borderRadius: 12, border: "1px solid var(--line)" }}>
                    <ShieldCheck size={36} color="var(--muted)" style={{ margin: "0 auto 12px" }} />
                    <p style={{ color: "var(--muted)", margin: 0 }}>No submissions matching this filter.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {submissions.map((sub) => (
                      <div
                        key={sub.id}
                        style={{
                          background: "#fff",
                          border: "1px solid var(--line, #dedfd9)",
                          borderRadius: 12,
                          padding: 20,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          flexWrap: "wrap",
                          gap: 16
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 280 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                            <span
                              style={{
                                background: sub.status === "approved" ? "#dcfce7" : sub.status === "rejected" ? "#fee2e2" : "#fef3c7",
                                color: sub.status === "approved" ? "#15803d" : sub.status === "rejected" ? "#b91c1c" : "#b45309",
                                fontSize: "0.74rem",
                                fontWeight: 800,
                                padding: "2px 8px",
                                borderRadius: 4,
                                textTransform: "uppercase"
                              }}
                            >
                              {sub.status.replace("_", " ")}
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                              Version {sub.version || "1.0"} • Submitted {new Date(sub.created_at).toLocaleDateString()}
                            </span>
                          </div>

                          <h3 style={{ margin: "0 0 6px", font: "700 18px 'Space Grotesk'" }}>
                            {sub.title}
                          </h3>

                          <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: 10 }}>
                            Genre: <b>{sub.genre}</b> • Submitter: <b>{sub.user_name || sub.user_id}</b> • Suggested: <b>{sub.suggested_hourly_rate} credits/hr</b>
                          </div>

                          <p style={{ fontSize: "0.85rem", color: "#334155", margin: "0 0 12px" }}>
                            {sub.description || <i>No description provided.</i>}
                          </p>

                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <a
                              href={sub.package_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: "0.82rem",
                                color: "#0284c7",
                                fontWeight: 600,
                                textDecoration: "none"
                              }}
                            >
                              Download Game Package <ExternalLink size={13} />
                            </a>
                            {sub.approved_game_id && (
                              <span style={{ fontSize: "0.8rem", color: "#16a34a" }}>
                                Live in Library: ID <code>{sub.approved_game_id}</code>
                              </span>
                            )}
                          </div>
                        </div>

                        {sub.status === "pending_review" && (
                          <button
                            type="button"
                            onClick={() => {
                              setReviewModal(sub);
                              setReviewForm({
                                decision: "approve",
                                antivirus_scanned: true,
                                no_crypto_miners: true,
                                headless_gpu_tested: true,
                                content_policy_passed: true,
                                admin_notes: "",
                                assigned_hourly_rate: sub.suggested_hourly_rate || 1.0,
                              });
                            }}
                            className="primary-button"
                            style={{ padding: "9px 16px", fontSize: "0.84rem", display: "flex", alignItems: "center", gap: 6 }}
                          >
                            <ShieldCheck size={14} /> Conduct Safety Review
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Subtab 3: Live Gaming Fleet Monitor */}
            {gamezoneTab === "sessions" && (
              <div>
                {sessionsLoading ? (
                  <div style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>Loading active sessions...</div>
                ) : activeGameSessions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 48, background: "#fff", borderRadius: 12, border: "1px solid var(--line)" }}>
                    <Server size={36} color="var(--muted)" style={{ margin: "0 auto 12px" }} />
                    <p style={{ color: "var(--muted)", margin: 0 }}>No game containers currently running.</p>
                  </div>
                ) : (
                  <div style={{ background: "#fff", border: "1px solid var(--line, #dedfd9)", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.86rem" }}>
                        <thead>
                          <tr style={{ background: "#f8f9fa", borderBottom: "1px solid var(--line)", color: "var(--muted)", fontSize: "0.78rem", textTransform: "uppercase" }}>
                            <th style={{ padding: "12px 16px" }}>Session</th>
                            <th style={{ padding: "12px 16px" }}>Game Title</th>
                            <th style={{ padding: "12px 16px" }}>User</th>
                            <th style={{ padding: "12px 16px" }}>Host GPU</th>
                            <th style={{ padding: "12px 16px" }}>Container ID</th>
                            <th style={{ padding: "12px 16px" }}>Rate</th>
                            <th style={{ padding: "12px 16px", textAlign: "right" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeGameSessions.map((sess) => (
                            <tr key={sess.id} style={{ borderBottom: "1px solid var(--line)" }}>
                              <td style={{ padding: "12px 16px" }}>
                                <span style={{ fontWeight: 700, color: "#0284c7" }}>{sess.id}</span>
                              </td>
                              <td style={{ padding: "12px 16px" }}>
                                <div style={{ fontWeight: 600 }}>{sess.game_title}</div>
                                {sess.is_private && (
                                  <span style={{ background: "#ede9fe", color: "#6d28d9", fontSize: "0.7rem", padding: "1px 5px", borderRadius: 4 }}>
                                    Private Vault
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: "12px 16px", color: "var(--muted)" }}>
                                {sess.user_name || sess.user_id}
                              </td>
                              <td style={{ padding: "12px 16px" }}>
                                {sess.gpu} ({sess.rental_id})
                              </td>
                              <td style={{ padding: "12px 16px" }}>
                                <code>{sess.container_id}</code>
                              </td>
                              <td style={{ padding: "12px 16px", fontWeight: 700 }}>
                                {sess.hourly_rate_credits} cr/hr
                              </td>
                              <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                <button
                                  type="button"
                                  onClick={() => handleForceStopSession(sess.id)}
                                  style={{
                                    background: "#fee2e2",
                                    color: "#b91c1c",
                                    border: "1px solid #fca5a5",
                                    padding: "4px 10px",
                                    borderRadius: 6,
                                    fontSize: "0.76rem",
                                    fontWeight: 700,
                                    cursor: "pointer"
                                  }}
                                >
                                  Force Terminate
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal: Add Curated Game */}
            {newGameModal && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.6)",
                  backdropFilter: "blur(4px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 99,
                  padding: 20
                }}
              >
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 16,
                    padding: 28,
                    maxWidth: 580,
                    width: "100%",
                    maxHeight: "90vh",
                    overflowY: "auto",
                    boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                    <h3 style={{ margin: 0, font: "700 20px 'Space Grotesk'" }}>Add Curated Game to Gamezone</h3>
                    <button
                      type="button"
                      onClick={() => setNewGameModal(false)}
                      style={{ border: "none", background: "transparent", fontSize: "1.2rem", cursor: "pointer", color: "var(--muted)" }}
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleCreateGame} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>Title</label>
                      <input
                        type="text"
                        required
                        value={newGameForm.title}
                        onChange={(e) => setNewGameForm({ ...newGameForm, title: e.target.value })}
                        placeholder="e.g. Doom Eternal"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)" }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>Genre</label>
                        <input
                          type="text"
                          required
                          value={newGameForm.genre}
                          onChange={(e) => setNewGameForm({ ...newGameForm, genre: e.target.value })}
                          placeholder="Action / FPS"
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>Hourly Rate (Credits)</label>
                        <input
                          type="number"
                          step="0.05"
                          min="0.10"
                          required
                          value={newGameForm.hourly_rate_credits}
                          onChange={(e) => setNewGameForm({ ...newGameForm, hourly_rate_credits: e.target.value })}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)" }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>Description</label>
                      <textarea
                        rows={3}
                        required
                        value={newGameForm.description}
                        onChange={(e) => setNewGameForm({ ...newGameForm, description: e.target.value })}
                        placeholder="Game storyline and cloud gaming performance specs..."
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)" }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>Min GPU VRAM</label>
                        <input
                          type="text"
                          value={newGameForm.min_gpu_vram}
                          onChange={(e) => setNewGameForm({ ...newGameForm, min_gpu_vram: e.target.value })}
                          placeholder="8 GB"
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>Recommended GPU</label>
                        <input
                          type="text"
                          value={newGameForm.recommended_gpu}
                          onChange={(e) => setNewGameForm({ ...newGameForm, recommended_gpu: e.target.value })}
                          placeholder="NVIDIA RTX 3070"
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)" }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>Docker Image</label>
                      <input
                        type="text"
                        value={newGameForm.docker_image}
                        onChange={(e) => setNewGameForm({ ...newGameForm, docker_image: e.target.value })}
                        placeholder="productify/game-runner:doom"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>Cover Poster Image URL</label>
                      <input
                        type="url"
                        value={newGameForm.cover_image}
                        onChange={(e) => setNewGameForm({ ...newGameForm, cover_image: e.target.value })}
                        placeholder="https://images.unsplash.com/..."
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)" }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 20 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.84rem", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={newGameForm.featured}
                          onChange={(e) => setNewGameForm({ ...newGameForm, featured: e.target.checked })}
                        />
                        Featured on Gamezone Home
                      </label>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                      <button
                        type="button"
                        onClick={() => setNewGameModal(false)}
                        className="secondary-button"
                        style={{ padding: "8px 16px" }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={creatingGame}
                        className="primary-button"
                        style={{ padding: "8px 20px" }}
                      >
                        {creatingGame ? "Adding..." : "Add to Library"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal: Safety Review Form */}
            {reviewModal && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.6)",
                  backdropFilter: "blur(4px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 99,
                  padding: 20
                }}
              >
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 16,
                    padding: 28,
                    maxWidth: 560,
                    width: "100%",
                    boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <ShieldCheck size={20} color="#2563eb" />
                      <h3 style={{ margin: 0, font: "700 20px 'Space Grotesk'" }}>
                        Safety Review: {reviewModal.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReviewModal(null)}
                      style={{ border: "none", background: "transparent", fontSize: "1.2rem", cursor: "pointer", color: "var(--muted)" }}
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSubmitReview} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0", fontSize: "0.84rem" }}>
                      <div>Package URL: <a href={reviewModal.package_url} target="_blank" rel="noreferrer" style={{ color: "#0284c7" }}>{reviewModal.package_url}</a></div>
                      <div>Submitter: <b>{reviewModal.user_name || reviewModal.user_id}</b></div>
                      <div>Suggested Rate: <b>{reviewModal.suggested_hourly_rate} credits/hr</b></div>
                    </div>

                    {/* Safety Verification Checklist */}
                    <div>
                      <div style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>
                        Mandatory Safety Checks (All must pass to approve):
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.84rem" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={reviewForm.antivirus_scanned}
                            onChange={(e) => setReviewForm({ ...reviewForm, antivirus_scanned: e.target.checked })}
                          />
                          <b>Antivirus & Malware Scan Clean</b> (No trojans, spyware, or keyloggers)
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={reviewForm.no_crypto_miners}
                            onChange={(e) => setReviewForm({ ...reviewForm, no_crypto_miners: e.target.checked })}
                          />
                          <b>No Crypto-Miners</b> or rogue background compute threads
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={reviewForm.headless_gpu_tested}
                            onChange={(e) => setReviewForm({ ...reviewForm, headless_gpu_tested: e.target.checked })}
                          />
                          <b>Headless GPU Proton / Wine Tested</b> (Boots without fatal driver crash)
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={reviewForm.content_policy_passed}
                            onChange={(e) => setReviewForm({ ...reviewForm, content_policy_passed: e.target.checked })}
                          />
                          <b>Productify Content Policy & DMCA Passed</b>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>
                        Assigned Hourly Rate (Credits)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        min="0.10"
                        value={reviewForm.assigned_hourly_rate}
                        onChange={(e) => setReviewForm({ ...reviewForm, assigned_hourly_rate: e.target.value })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>
                        Admin Audit Notes / Feedback
                      </label>
                      <textarea
                        rows={2}
                        value={reviewForm.admin_notes}
                        onChange={(e) => setReviewForm({ ...reviewForm, admin_notes: e.target.value })}
                        placeholder="Internal safety verification notes..."
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)" }}
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setReviewForm({ ...reviewForm, decision: "reject" });
                          handleSubmitReview({ preventDefault: () => {} });
                        }}
                        disabled={submittingReview}
                        style={{
                          background: "#fee2e2",
                          color: "#b91c1c",
                          border: "1px solid #fca5a5",
                          padding: "9px 18px",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: "0.86rem"
                        }}
                      >
                        Reject Submission
                      </button>
                      <button
                        type="submit"
                        disabled={submittingReview}
                        onClick={() => setReviewForm({ ...reviewForm, decision: "approve" })}
                        className="primary-button"
                        style={{ padding: "9px 20px", fontSize: "0.86rem", display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <Check size={14} /> Approve & Publish to Library
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

      </section>
    </>
  );
}
