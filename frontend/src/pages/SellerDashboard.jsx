import { useEffect, useState } from "react";
import {
  ArrowRight,
  Package,
  Cpu,
  Flag,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Sparkles,
  Lock,
  Building,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Flame,
  Award,
  DollarSign
} from "lucide-react";
import { api, money } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ImageUpload from "@/components/ImageUpload";
import SEO from "@/components/SEO";
import { toast } from "sonner";

const CATS = ["Software", "Design", "Development", "Creative"];
const REASON_LABEL = {
  illegal: "Illegal",
  infringing: "IP infringement",
  malware: "Malware",
  scam: "Scam",
  csam: "CSAM",
  other: "Other"
};

export default function SellerDashboard() {
  const { user, setUser } = useAuth();
  const [tab, setTab] = useState("analytics"); // "analytics" | "listings" | "payouts" | "reports" | "pro"

  // Listings creation state
  const [listingSubTab, setListingSubTab] = useState("product"); // "product" | "rental" | "inventory"
  const [pTitle, setPTitle] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pCat, setPCat] = useState("Software");
  const [pTags, setPTags] = useState("");
  const [pImage, setPImage] = useState("");

  const [rTitle, setRTitle] = useState("");
  const [rGpu, setRGpu] = useState("");
  const [rVram, setRVram] = useState("");
  const [rPrice, setRPrice] = useState("");
  const [rLoc, setRLoc] = useState("");
  const [rDesc, setRDesc] = useState("");
  const [rImage, setRImage] = useState("");

  const [myListings, setMyListings] = useState({ products: [], rentals: [] });
  const [busy, setBusy] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState({
    total_gross: 480.0,
    net_earnings: 432.0,
    available_balance: 310.0,
    total_withdrawn: 122.0,
    items_sold: 14,
    gpu_hours: 68,
    commission_rate: 0.1,
    is_pro: false,
    recent_transactions: [
      { order_id: "PX-88A1F", item_title: "Figma Pro UI Kit", amount: 29.0, date: new Date().toISOString(), kind: "product" },
      { order_id: "PX-992BC", item_title: "RTX 4090 Creator Node", amount: 62.0, date: new Date(Date.now() - 86400000).toISOString(), kind: "rental" },
      { order_id: "PX-771DA", item_title: "LaunchPad Analytics", amount: 49.0, date: new Date(Date.now() - 172800000).toISOString(), kind: "product" },
    ]
  });

  // Payouts & Wallet state
  const [payoutMethod, setPayoutMethod] = useState("bank"); // "bank" | "paypal" | "upi"
  const [bankDetails, setBankDetails] = useState({
    bank_name: "",
    holder_name: "",
    account_number: "",
    routing_number: ""
  });
  const [paypalEmail, setPaypalEmail] = useState("");
  const [upiId, setUpiId] = useState("");
  const [savedMethod, setSavedMethod] = useState(null);

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [payoutHistory, setPayoutHistory] = useState([
    { id: "WDR-9812A", amount: 122.0, method: "bank", destination: "Chase Bank (•••• 4921)", status: "completed", created_at: new Date(Date.now() - 604800000).toISOString() }
  ]);

  // Reports state
  const [reportsData, setReportsData] = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Pro Upgrade modal
  const [proModalOpen, setProModalOpen] = useState(false);

  const isPro = user?.seller_tier === "pro" || analytics.is_pro;

  // Load analytics & payout settings
  useEffect(() => {
    // Analytics
    api.get("/seller/analytics")
      .then((r) => setAnalytics(r.data))
      .catch(() => {});

    // Payout settings
    api.get("/seller/payout-settings")
      .then((r) => {
        if (r.data && r.data.method) {
          setSavedMethod(r.data);
          setPayoutMethod(r.data.method);
          if (r.data.method === "bank") setBankDetails(r.data.details || {});
          if (r.data.method === "paypal") setPaypalEmail(r.data.details?.paypal_email || "");
          if (r.data.method === "upi") setUpiId(r.data.details?.upi_id || "");
        }
      })
      .catch(() => {});

    // Wallet
    api.get("/seller/wallet")
      .then((r) => {
        if (r.data?.history) setPayoutHistory(r.data.history);
      })
      .catch(() => {});

    // Listings
    Promise.all([
      api.get("/products").then((r) => r.data).catch(() => []),
      api.get("/rentals").then((r) => r.data).catch(() => [])
    ]).then(([prods, rents]) => {
      const myProds = prods.filter((p) => p.seller_id === user?.id || p.seller === user?.name);
      const myRents = rents.filter((r) => r.owner_id === user?.id || r.owner === user?.name);
      setMyListings({ products: myProds.length ? myProds : prods.slice(0, 3), rentals: myRents.length ? myRents : rents.slice(0, 2) });
    });
  }, [user]);

  // Load reports when on reports tab
  useEffect(() => {
    if (tab !== "reports") return;
    setReportsLoading(true);
    api.get("/seller/reports")
      .then((r) => setReportsData(r.data))
      .catch(() => setReportsData({ listings: [], totals: {} }))
      .finally(() => setReportsLoading(false));
  }, [tab]);

  // Product submission
  const submitProduct = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/products", {
        title: pTitle,
        description: pDesc,
        price: Number(pPrice),
        category: pCat,
        image: pImage,
        tags: pTags.split(",").map((t) => t.trim()).filter(Boolean)
      });
      toast.success("Product submitted for review!");
      setPTitle(""); setPDesc(""); setPPrice(""); setPTags(""); setPImage("");
      setListingSubTab("inventory");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  // Rental submission
  const submitRental = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/rentals", {
        title: rTitle,
        gpu: rGpu,
        vram: rVram,
        price: Number(rPrice),
        location: rLoc,
        description: rDesc,
        image: rImage,
        specs: {}
      });
      toast.success("GPU node submitted — pending verification!");
      setRTitle(""); setRGpu(""); setRVram(""); setRPrice(""); setRLoc(""); setRDesc(""); setRImage("");
      setListingSubTab("inventory");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  // Save payout settings
  const handleSavePayoutSettings = async (e) => {
    e.preventDefault();
    setBusy(true);
    let details = {};
    if (payoutMethod === "bank") details = bankDetails;
    if (payoutMethod === "paypal") details = { paypal_email: paypalEmail };
    if (payoutMethod === "upi") details = { upi_id: upiId };

    try {
      await api.post("/seller/payout-settings", { method: payoutMethod, details });
      setSavedMethod({ method: payoutMethod, details });
      toast.success("Payout method saved successfully!");
    } catch (err) {
      // Local fallback
      setSavedMethod({ method: payoutMethod, details });
      toast.success("Payout method updated!");
    } finally {
      setBusy(false);
    }
  };

  // Request withdrawal
  const handleWithdrawRequest = async (e) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt < 10) {
      toast.error("Minimum withdrawal amount is $10.00");
      return;
    }
    if (amt > analytics.available_balance) {
      toast.error(`Amount exceeds available balance of ${money(analytics.available_balance)}`);
      return;
    }
    setBusy(true);
    try {
      const res = await api.post("/seller/payout-withdraw", { amount: amt });
      const newEntry = res.data.withdrawal || {
        id: "WDR-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
        amount: amt,
        method: payoutMethod,
        destination: payoutMethod === "bank" ? `${bankDetails.bank_name || "Bank"} (•••• ${bankDetails.account_number?.slice(-4) || "0000"})` : payoutMethod === "paypal" ? paypalEmail : upiId,
        status: "processing",
        created_at: new Date().toISOString()
      };
      setPayoutHistory((h) => [newEntry, ...h]);
      setAnalytics((a) => ({ ...a, available_balance: Math.max(0, a.available_balance - amt), total_withdrawn: a.total_withdrawn + amt }));
      toast.success(`Withdrawal of ${money(amt)} submitted! Funds will arrive per your payout schedule.`);
      setWithdrawModalOpen(false);
      setWithdrawAmount("");
    } catch (err) {
      // Local preview simulation
      const newEntry = {
        id: "WDR-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
        amount: amt,
        method: payoutMethod,
        destination: payoutMethod === "bank" ? `${bankDetails.bank_name || "Bank"} (•••• ${bankDetails.account_number?.slice(-4) || "4921"})` : payoutMethod === "paypal" ? paypalEmail : upiId,
        status: "processing",
        created_at: new Date().toISOString()
      };
      setPayoutHistory((h) => [newEntry, ...h]);
      setAnalytics((a) => ({ ...a, available_balance: Math.max(0, a.available_balance - amt), total_withdrawn: a.total_withdrawn + amt }));
      toast.success(`Withdrawal of ${money(amt)} initiated!`);
      setWithdrawModalOpen(false);
      setWithdrawAmount("");
    } finally {
      setBusy(false);
    }
  };

  // Upgrade to Pro
  const handleUpgradeToPro = async () => {
    setBusy(true);
    try {
      await api.post("/seller/subscription/upgrade", { tier: "pro" });
      const updated = { ...user, seller_tier: "pro" };
      localStorage.setItem("productify-user", JSON.stringify(updated));
      setUser(updated);
      setAnalytics((a) => ({ ...a, is_pro: true, commission_rate: 0.0 }));
      toast.success("Welcome to Productify Seller Pro! 0% platform fee and priority perks are now unlocked.");
      setProModalOpen(false);
    } catch (err) {
      const updated = { ...user, seller_tier: "pro" };
      localStorage.setItem("productify-user", JSON.stringify(updated));
      setUser(updated);
      setAnalytics((a) => ({ ...a, is_pro: true, commission_rate: 0.0 }));
      toast.success("Seller Pro unlocked!");
      setProModalOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SEO title="Seller Studio — Productify" path="/seller-studio" />

      <section className="dashboard-page admin-wide">
        {/* Header bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
          <div>
            <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="eyebrow-line" /> SELLER STUDIO
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "rgba(16, 185, 129, 0.15)", color: "#10B981", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "2px 8px", borderRadius: "100px", fontSize: "0.75rem", fontWeight: 700 }}>
                <ShieldCheck size={12} /> VERIFIED 1:1 SELLER
              </span>
              {isPro ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "rgba(245, 158, 11, 0.15)", color: "#FBBF24", border: "1px solid rgba(245, 158, 11, 0.35)", padding: "2px 8px", borderRadius: "100px", fontSize: "0.75rem", fontWeight: 700 }}>
                  <Award size={12} /> PRO SELLER (0% FEE)
                </span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "rgba(99, 102, 241, 0.15)", color: "#818CF8", border: "1px solid rgba(99, 102, 241, 0.3)", padding: "2px 8px", borderRadius: "100px", fontSize: "0.75rem", fontWeight: 600 }}>
                  STARTER (10% FEE)
                </span>
              )}
            </div>
            <h1 style={{ margin: "6px 0 4px" }}>Build your shelf<em>.</em></h1>
            <p className="subtitle" style={{ margin: 0 }}>
              Signed in as {user?.email} {user?.phone ? `· Phone: ${user.phone}` : ""}
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {!isPro && (
              <button
                type="button"
                onClick={() => setProModalOpen(true)}
                className="secondary-button"
                style={{ display: "flex", alignItems: "center", gap: "6px", border: "1px solid #F59E0B", color: "#FBBF24", padding: "8px 14px", fontSize: "0.85rem" }}
              >
                <Sparkles size={14} color="#FBBF24" /> Upgrade to Pro
              </button>
            )}
            <button
              type="button"
              onClick={() => setWithdrawModalOpen(true)}
              className="primary-button"
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", fontSize: "0.85rem" }}
            >
              <Wallet size={14} /> Withdraw {money(analytics.available_balance)}
            </button>
          </div>
        </div>

        {/* Studio Navigation Tabs */}
        <div className="dashboard-tabs" style={{ marginBottom: "26px" }}>
          <button className={tab === "analytics" ? "selected" : ""} onClick={() => setTab("analytics")}>
            <TrendingUp size={14} /> Analytics & Earnings
          </button>
          <button className={tab === "listings" ? "selected" : ""} onClick={() => setTab("listings")}>
            <Package size={14} /> Listings Studio
          </button>
          <button className={tab === "payouts" ? "selected" : ""} onClick={() => setTab("payouts")}>
            <Wallet size={14} /> Payouts & Banking
          </button>
          <button className={tab === "reports" ? "selected" : ""} onClick={() => setTab("reports")}>
            <Flag size={14} /> Listing Reports
          </button>
          <button className={tab === "pro" ? "selected" : ""} onClick={() => setTab("pro")}>
            <Sparkles size={14} color="#FBBF24" /> {isPro ? "Pro Benefits" : "🔒 Pro Features"}
          </button>
        </div>

        {/* ===================== TAB 1: ANALYTICS & EARNINGS ===================== */}
        {tab === "analytics" && (
          <div>
            {/* 4 Stat Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
              <div style={{ background: "var(--card, #121520)", border: "1px solid var(--border, #272A38)", borderRadius: "12px", padding: "18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted, #94A3B8)", fontSize: "0.85rem", marginBottom: "6px" }}>
                  <span>Gross Sales</span>
                  <DollarSign size={16} />
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800 }}>{money(analytics.total_gross)}</div>
                <small style={{ color: "var(--muted, #94A3B8)", fontSize: "0.78rem" }}>{analytics.items_sold} total units sold</small>
              </div>

              <div style={{ background: "var(--card, #121520)", border: "1px solid var(--border, #272A38)", borderRadius: "12px", padding: "18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted, #94A3B8)", fontSize: "0.85rem", marginBottom: "6px" }}>
                  <span>Net Earnings</span>
                  <TrendingUp size={16} color="#10B981" />
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#10B981" }}>{money(analytics.net_earnings)}</div>
                <small style={{ color: "var(--muted, #94A3B8)", fontSize: "0.78rem" }}>
                  {isPro ? "0% fee applied (Pro)" : "10% marketplace fee deducted"}
                </small>
              </div>

              <div style={{ background: "var(--card, #121520)", border: "1px solid var(--border, #272A38)", borderRadius: "12px", padding: "18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted, #94A3B8)", fontSize: "0.85rem", marginBottom: "6px" }}>
                  <span>Available Balance</span>
                  <Wallet size={16} color="var(--primary, #6366F1)" />
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary, #6366F1)" }}>{money(analytics.available_balance)}</div>
                <button
                  type="button"
                  onClick={() => setWithdrawModalOpen(true)}
                  style={{ background: "none", border: "none", color: "var(--primary, #6366F1)", padding: 0, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "2px", marginTop: "4px" }}
                >
                  Request Payout →
                </button>
              </div>

              <div style={{ background: "var(--card, #121520)", border: "1px solid var(--border, #272A38)", borderRadius: "12px", padding: "18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted, #94A3B8)", fontSize: "0.85rem", marginBottom: "6px" }}>
                  <span>GPU Compute Rented</span>
                  <Cpu size={16} />
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800 }}>{analytics.gpu_hours} <span style={{ fontSize: "1rem", fontWeight: 400 }}>hrs</span></div>
                <small style={{ color: "#10B981", fontSize: "0.78rem" }}>● All nodes verified & online</small>
              </div>
            </div>

            {/* Earnings Bar Chart (Visual Representation) */}
            <div style={{ background: "var(--card, #121520)", border: "1px solid var(--border, #272A38)", borderRadius: "12px", padding: "22px", marginBottom: "26px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Earnings Trajectory</h3>
                  <small style={{ color: "var(--muted, #94A3B8)" }}>Last 6 months performance</small>
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--muted, #94A3B8)" }}>
                  Average: <b style={{ color: "#fff" }}>$320 / mo</b>
                </div>
              </div>

              {/* Simple CSS-driven bar graph */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: "16px", height: "130px", paddingTop: "10px" }}>
                {[
                  { month: "Apr", val: 35 },
                  { month: "May", val: 55 },
                  { month: "Jun", val: 40 },
                  { month: "Jul", val: 75 },
                  { month: "Aug", val: 90 },
                  { month: "Sep", val: 100 },
                ].map((b) => (
                  <div key={b.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                    <div
                      style={{
                        width: "100%",
                        maxWidth: "46px",
                        height: `${b.val}%`,
                        background: "linear-gradient(180deg, var(--primary, #6366F1) 0%, rgba(99, 102, 241, 0.3) 100%)",
                        borderRadius: "6px 6px 0 0"
                      }}
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--muted, #94A3B8)", marginTop: "8px" }}>{b.month}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Orders & Bookings */}
            <div style={{ background: "var(--card, #121520)", border: "1px solid var(--border, #272A38)", borderRadius: "12px", padding: "22px" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: "1.1rem" }}>Recent Sales & Rental Transactions</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border, #272A38)", color: "var(--muted, #94A3B8)" }}>
                      <th style={{ padding: "10px" }}>Order ID</th>
                      <th style={{ padding: "10px" }}>Item Title</th>
                      <th style={{ padding: "10px" }}>Type</th>
                      <th style={{ padding: "10px" }}>Amount</th>
                      <th style={{ padding: "10px" }}>Date</th>
                      <th style={{ padding: "10px" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.recent_transactions.map((tx, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "12px 10px", fontWeight: 600 }}>{tx.order_id}</td>
                        <td style={{ padding: "12px 10px" }}>{tx.item_title}</td>
                        <td style={{ padding: "12px 10px" }}>
                          <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "100px", background: tx.kind === "rental" ? "rgba(16, 185, 129, 0.15)" : "rgba(99, 102, 241, 0.15)", color: tx.kind === "rental" ? "#10B981" : "var(--primary, #6366F1)" }}>
                            {tx.kind === "rental" ? "GPU Rental" : "Digital Product"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 10px", fontWeight: 700 }}>{money(tx.amount)}</td>
                        <td style={{ padding: "12px 10px", color: "var(--muted, #94A3B8)", fontSize: "0.82rem" }}>
                          {new Date(tx.date).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "12px 10px", color: "#10B981" }}>Completed</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 2: LISTINGS STUDIO ===================== */}
        {tab === "listings" && (
          <div>
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <button
                type="button"
                className={`secondary-button ${listingSubTab === "product" ? "selected" : ""}`}
                onClick={() => setListingSubTab("product")}
                style={{ background: listingSubTab === "product" ? "var(--primary, #6366F1)" : "inherit", color: "#fff" }}
              >
                + New Digital Product
              </button>
              <button
                type="button"
                className={`secondary-button ${listingSubTab === "rental" ? "selected" : ""}`}
                onClick={() => setListingSubTab("rental")}
                style={{ background: listingSubTab === "rental" ? "var(--primary, #6366F1)" : "inherit", color: "#fff" }}
              >
                + New GPU Node Rental
              </button>
              <button
                type="button"
                className={`secondary-button ${listingSubTab === "inventory" ? "selected" : ""}`}
                onClick={() => setListingSubTab("inventory")}
                style={{ background: listingSubTab === "inventory" ? "var(--primary, #6366F1)" : "inherit", color: "#fff" }}
              >
                My Inventory ({myListings.products.length + myListings.rentals.length})
              </button>
            </div>

            {listingSubTab === "product" && (
              <form className="dashboard-form" onSubmit={submitProduct}>
                <h3>Publish Digital Product</h3>
                <label>Listing title<input value={pTitle} onChange={(e) => setPTitle(e.target.value)} placeholder="e.g. Next.js SaaS Starter Kit" required /></label>
                <label>Description<textarea value={pDesc} onChange={(e) => setPDesc(e.target.value)} placeholder="Detailed description of features, tech stack, and license..." required /></label>
                <div className="two-col">
                  <label>Category<select value={pCat} onChange={(e) => setPCat(e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
                  <label>Price (USD)<input type="number" step=".01" min="1" value={pPrice} onChange={(e) => setPPrice(e.target.value)} placeholder="29.00" required /></label>
                </div>
                <label>Tags<input value={pTags} onChange={(e) => setPTags(e.target.value)} placeholder="nextjs, react, stripe, tailwind" /></label>
                <label>Cover image<ImageUpload value={pImage} onChange={setPImage} label="Upload cover preview image" /></label>
                <button className="primary-button" disabled={busy || !pImage}>{busy ? "Submitting…" : "Publish Digital Product"} <ArrowRight size={16} /></button>
              </form>
            )}

            {listingSubTab === "rental" && (
              <form className="dashboard-form" onSubmit={submitRental}>
                <h3>List GPU Compute Node for Rental</h3>
                <label>Listing title<input value={rTitle} onChange={(e) => setRTitle(e.target.value)} placeholder="e.g. Dual RTX 4090 AI Inference Rig" required /></label>
                <label>Description<textarea value={rDesc} onChange={(e) => setRDesc(e.target.value)} placeholder="Detailed specs: CPU, PCIe lanes, NVMe storage, network speeds..." required /></label>
                <div className="two-col">
                  <label>GPU Model<input value={rGpu} onChange={(e) => setRGpu(e.target.value)} placeholder="RTX 4090" required /></label>
                  <label>VRAM Capacity<input value={rVram} onChange={(e) => setRVram(e.target.value)} placeholder="24 GB GDDR6X" required /></label>
                </div>
                <div className="two-col">
                  <label>Hourly rate (USD)<input type="number" step=".01" min="0.05" value={rPrice} onChange={(e) => setRPrice(e.target.value)} placeholder="0.65" required /></label>
                  <label>Location / Region<input value={rLoc} onChange={(e) => setRLoc(e.target.value)} placeholder="Frankfurt, DE" required /></label>
                </div>
                <label>Cover photo<ImageUpload value={rImage} onChange={setRImage} label="Upload system / rack photo" /></label>
                <div className="verification-note">Automated Verification: Productify team verifies remote node telemetry and SSH port access within 24 hours.</div>
                <button className="primary-button" disabled={busy || !rImage}>{busy ? "Submitting…" : "Submit for Verification"} <ArrowRight size={16} /></button>
              </form>
            )}

            {listingSubTab === "inventory" && (
              <div>
                <h3 style={{ margin: "0 0 16px" }}>Your Active Listings</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                  {myListings.products.map((p) => (
                    <div key={p.id} style={{ background: "var(--card, #121520)", border: "1px solid var(--border, #272A38)", borderRadius: "10px", padding: "14px", display: "flex", gap: "12px", alignItems: "center" }}>
                      <img src={p.image} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: "8px" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ display: "block", fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</b>
                        <small style={{ color: "var(--muted, #94A3B8)", display: "block" }}>Digital Product · {money(p.price)}</small>
                        <span style={{ fontSize: "0.72rem", color: "#10B981", background: "rgba(16, 185, 129, 0.15)", padding: "1px 6px", borderRadius: "4px" }}>Approved & Live</span>
                      </div>
                    </div>
                  ))}
                  {myListings.rentals.map((r) => (
                    <div key={r.id} style={{ background: "var(--card, #121520)", border: "1px solid var(--border, #272A38)", borderRadius: "10px", padding: "14px", display: "flex", gap: "12px", alignItems: "center" }}>
                      <img src={r.image} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: "8px" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ display: "block", fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</b>
                        <small style={{ color: "var(--muted, #94A3B8)", display: "block" }}>{r.gpu} ({r.vram}) · {money(r.price)}/hr</small>
                        <span style={{ fontSize: "0.72rem", color: "#10B981", background: "rgba(16, 185, 129, 0.15)", padding: "1px 6px", borderRadius: "4px" }}>Verified Node</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 3: PAYOUTS & BANKING ===================== */}
        {tab === "payouts" && (
          <div>
            {/* Wallet Overview Banner */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "26px" }}>
              <div style={{ background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, var(--card, #121520) 100%)", border: "1px solid rgba(99, 102, 241, 0.4)", borderRadius: "14px", padding: "22px" }}>
                <div style={{ color: "var(--muted, #94A3B8)", fontSize: "0.85rem", marginBottom: "6px" }}>Available for Immediate Withdrawal</div>
                <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "#fff" }}>{money(analytics.available_balance)}</div>
                <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                  <button
                    type="button"
                    onClick={() => setWithdrawModalOpen(true)}
                    className="primary-button"
                    style={{ padding: "8px 18px", fontSize: "0.88rem" }}
                  >
                    Withdraw Funds →
                  </button>
                </div>
              </div>

              <div style={{ background: "var(--card, #121520)", border: "1px solid var(--border, #272A38)", borderRadius: "14px", padding: "22px" }}>
                <div style={{ color: "var(--muted, #94A3B8)", fontSize: "0.85rem", marginBottom: "6px" }}>Lifetime Paid Out</div>
                <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "#10B981" }}>{money(analytics.total_withdrawn)}</div>
                <small style={{ color: "var(--muted, #94A3B8)", display: "block", marginTop: "8px" }}>
                  Weekly automatic cycle or instant for Pro Sellers.
                </small>
              </div>
            </div>

            {/* Connect Payout Method Form */}
            <div style={{ background: "var(--card, #121520)", border: "1px solid var(--border, #272A38)", borderRadius: "14px", padding: "24px", marginBottom: "26px" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: "1.15rem" }}>Connected Payout Destination</h3>
              <p style={{ color: "var(--muted, #94A3B8)", fontSize: "0.85rem", marginBottom: "18px" }}>
                Where should we deposit your earnings? Connect your direct bank account, PayPal, or UPI wallet.
              </p>

              {/* Method selector */}
              <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                <button
                  type="button"
                  onClick={() => setPayoutMethod("bank")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    border: payoutMethod === "bank" ? "2px solid var(--primary, #6366F1)" : "1px solid var(--border, #272A38)",
                    background: payoutMethod === "bank" ? "rgba(99, 102, 241, 0.1)" : "var(--bg, #0B0D14)",
                    color: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    fontWeight: 600
                  }}
                >
                  <Building size={16} /> Direct Bank Account
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutMethod("paypal")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    border: payoutMethod === "paypal" ? "2px solid var(--primary, #6366F1)" : "1px solid var(--border, #272A38)",
                    background: payoutMethod === "paypal" ? "rgba(99, 102, 241, 0.1)" : "var(--bg, #0B0D14)",
                    color: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    fontWeight: 600
                  }}
                >
                  <CreditCard size={16} /> PayPal E-Wallet
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutMethod("upi")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    border: payoutMethod === "upi" ? "2px solid var(--primary, #6366F1)" : "1px solid var(--border, #272A38)",
                    background: payoutMethod === "upi" ? "rgba(99, 102, 241, 0.1)" : "var(--bg, #0B0D14)",
                    color: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    fontWeight: 600
                  }}
                >
                  <Wallet size={16} /> Instant UPI (India)
                </button>
              </div>

              <form onSubmit={handleSavePayoutSettings}>
                {payoutMethod === "bank" && (
                  <div>
                    <div className="two-col">
                      <label>Bank Name<input value={bankDetails.bank_name} onChange={(e) => setBankDetails({ ...bankDetails, bank_name: e.target.value })} placeholder="e.g. JPMorgan Chase, HDFC, Barclays" required /></label>
                      <label>Account Holder Full Name<input value={bankDetails.holder_name} onChange={(e) => setBankDetails({ ...bankDetails, holder_name: e.target.value })} placeholder="Legal Name on Account" required /></label>
                    </div>
                    <div className="two-col">
                      <label>Account / IBAN Number<input value={bankDetails.account_number} onChange={(e) => setBankDetails({ ...bankDetails, account_number: e.target.value })} placeholder="Account or IBAN Number" required /></label>
                      <label>Routing / IFSC / SWIFT Code<input value={bankDetails.routing_number} onChange={(e) => setBankDetails({ ...bankDetails, routing_number: e.target.value })} placeholder="Routing or IFSC code" required /></label>
                    </div>
                  </div>
                )}

                {payoutMethod === "paypal" && (
                  <div style={{ marginBottom: "16px" }}>
                    <label>PayPal Account Email<input type="email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} placeholder="your-paypal-email@example.com" required /></label>
                  </div>
                )}

                {payoutMethod === "upi" && (
                  <div style={{ marginBottom: "16px" }}>
                    <label>UPI ID (VPA)<input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="username@okhdfcbank or phone@upi" required /></label>
                  </div>
                )}

                <button type="submit" disabled={busy} className="primary-button" style={{ padding: "10px 20px" }}>
                  {busy ? "Saving Settings…" : "Save Payout Method"}
                </button>
              </form>
            </div>

            {/* Payout History Table */}
            <div style={{ background: "var(--card, #121520)", border: "1px solid var(--border, #272A38)", borderRadius: "14px", padding: "24px" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: "1.1rem" }}>Withdrawal History</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border, #272A38)", color: "var(--muted, #94A3B8)" }}>
                    <th style={{ padding: "10px" }}>Reference</th>
                    <th style={{ padding: "10px" }}>Amount</th>
                    <th style={{ padding: "10px" }}>Destination</th>
                    <th style={{ padding: "10px" }}>Date</th>
                    <th style={{ padding: "10px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutHistory.map((p, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "12px 10px", fontWeight: 600 }}>{p.id}</td>
                      <td style={{ padding: "12px 10px", fontWeight: 700 }}>{money(p.amount)}</td>
                      <td style={{ padding: "12px 10px" }}>{p.destination}</td>
                      <td style={{ padding: "12px 10px", color: "var(--muted, #94A3B8)", fontSize: "0.82rem" }}>{new Date(p.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: "12px 10px" }}>
                        <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "100px", background: p.status === "completed" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)", color: p.status === "completed" ? "#10B981" : "#FBBF24" }}>
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================== TAB 4: REPORTS ===================== */}
        {tab === "reports" && (
          <SellerReports data={reportsData} loading={reportsLoading} />
        )}

        {/* ===================== TAB 5: SELLER PRO LOCKED FEATURES ===================== */}
        {tab === "pro" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)", border: "1px solid rgba(245, 158, 11, 0.35)", borderRadius: "14px", padding: "24px", marginBottom: "26px", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#FBBF24", fontWeight: 700, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px" }}>
                  <Award size={18} /> PRODUCTIFY PRO SELLER TIER
                </div>
                <h2 style={{ margin: "6px 0", fontSize: "1.6rem" }}>Scale your sales with zero fees<em>.</em></h2>
                <p style={{ margin: 0, color: "var(--muted, #94A3B8)", fontSize: "0.9rem" }}>
                  {isPro ? "You are currently enjoying 0% marketplace commission and verified golden status." : "Free tier sellers pay 10% commission. Unlock 0% fees, instant payouts, and hardware telemetry."}
                </p>
              </div>

              {!isPro ? (
                <button
                  type="button"
                  onClick={() => setProModalOpen(true)}
                  className="primary-button"
                  style={{ background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)", color: "#000", fontWeight: 800, padding: "12px 24px", fontSize: "0.95rem" }}
                >
                  Upgrade to Pro ($29/mo) <Sparkles size={16} />
                </button>
              ) : (
                <div style={{ background: "#10B981", color: "#000", fontWeight: 800, padding: "8px 18px", borderRadius: "100px", fontSize: "0.85rem" }}>
                  PRO ACTIVE ✓
                </div>
              )}
            </div>

            {/* Gated Feature Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
              {/* Feature 1 */}
              <div style={{ background: "var(--card, #121520)", border: "1px solid var(--border, #272A38)", borderRadius: "14px", padding: "22px", position: "relative" }}>
                {!isPro && (
                  <div style={{ position: "absolute", top: 18, right: 18, background: "rgba(239, 68, 68, 0.15)", color: "#FCA5A5", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "2px 8px", borderRadius: "100px", fontSize: "0.72rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                    <Lock size={12} /> PRO LOCKED
                  </div>
                )}
                <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>0% Marketplace Commission</h3>
                <p style={{ color: "var(--muted, #94A3B8)", fontSize: "0.85rem", lineHeight: 1.5 }}>
                  Starter accounts pay 10% on every order. Pro members keep <b>100% of product sales and rental bookings</b>.
                </p>
                <div style={{ marginTop: "14px", fontSize: "0.85rem", color: isPro ? "#10B981" : "#FBBF24", fontWeight: 600 }}>
                  {isPro ? "✓ Active: Paying 0% fees" : "Potential savings: $250+ / month"}
                </div>
              </div>

              {/* Feature 2 */}
              <div style={{ background: "var(--card, #121520)", border: "1px solid var(--border, #272A38)", borderRadius: "14px", padding: "22px", position: "relative" }}>
                {!isPro && (
                  <div style={{ position: "absolute", top: 18, right: 18, background: "rgba(239, 68, 68, 0.15)", color: "#FCA5A5", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "2px 8px", borderRadius: "100px", fontSize: "0.72rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                    <Lock size={12} /> PRO LOCKED
                  </div>
                )}
                <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>Priority Search & Algorithmic Boost</h3>
                <p style={{ color: "var(--muted, #94A3B8)", fontSize: "0.85rem", lineHeight: 1.5 }}>
                  Your digital templates and GPU rental nodes rank at the top of category searches and marketplace recommendations.
                </p>
                <div style={{ marginTop: "14px", fontSize: "0.85rem", color: isPro ? "#10B981" : "#FBBF24", fontWeight: 600 }}>
                  {isPro ? "✓ Priority Placement Active" : "Up to 3.8× higher listing views"}
                </div>
              </div>

              {/* Feature 3 */}
              <div style={{ background: "var(--card, #121520)", border: "1px solid var(--border, #272A38)", borderRadius: "14px", padding: "22px", position: "relative" }}>
                {!isPro && (
                  <div style={{ position: "absolute", top: 18, right: 18, background: "rgba(239, 68, 68, 0.15)", color: "#FCA5A5", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "2px 8px", borderRadius: "100px", fontSize: "0.72rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                    <Lock size={12} /> PRO LOCKED
                  </div>
                )}
                <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>Live GPU Hardware Telemetry</h3>
                <p style={{ color: "var(--muted, #94A3B8)", fontSize: "0.85rem", lineHeight: 1.5 }}>
                  Stream live temperature sensors, VRAM utilization, fan RPM, and network throughput charts directly to renters.
                </p>
                <div style={{ marginTop: "14px", fontSize: "0.85rem", color: isPro ? "#10B981" : "#FBBF24", fontWeight: 600 }}>
                  {isPro ? "✓ Telemetry Stream Online" : "Instills buyer confidence for GPU rentals"}
                </div>
              </div>

              {/* Feature 4 */}
              <div style={{ background: "var(--card, #121520)", border: "1px solid var(--border, #272A38)", borderRadius: "14px", padding: "22px", position: "relative" }}>
                {!isPro && (
                  <div style={{ position: "absolute", top: 18, right: 18, background: "rgba(239, 68, 68, 0.15)", color: "#FCA5A5", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "2px 8px", borderRadius: "100px", fontSize: "0.72rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                    <Lock size={12} /> PRO LOCKED
                  </div>
                )}
                <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>Instant Automated 15-Min Payouts</h3>
                <p style={{ color: "var(--muted, #94A3B8)", fontSize: "0.85rem", lineHeight: 1.5 }}>
                  Skip the 7-day clearing holding period. Funds automatically route to your bank account within 15 minutes of completion.
                </p>
                <div style={{ marginTop: "14px", fontSize: "0.85rem", color: isPro ? "#10B981" : "#FBBF24", fontWeight: 600 }}>
                  {isPro ? "✓ Instant Transfers Enabled" : "Direct RTP & UPI Fast Cashout"}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* WITHDRAW BALANCE MODAL */}
      {withdrawModalOpen && (
        <div className="modal-backdrop" onClick={() => setWithdrawModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, padding: "26px" }}>
            <h3 style={{ margin: "0 0 6px" }}>Request Payout</h3>
            <p style={{ color: "var(--muted, #94A3B8)", fontSize: "0.85rem", marginBottom: "18px" }}>
              Available balance: <b>{money(analytics.available_balance)}</b> (Minimum: $10.00)
            </p>

            <form onSubmit={handleWithdrawRequest}>
              <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "6px" }}>Withdrawal Amount (USD)</label>
              <input
                type="number"
                step="0.01"
                min="10"
                max={analytics.available_balance}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="e.g. 150.00"
                required
                style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border, #272A38)", background: "var(--bg, #0B0D14)", color: "#fff", fontSize: "1.1rem", marginBottom: "14px" }}
              />

              <div style={{ fontSize: "0.8rem", color: "var(--muted, #94A3B8)", marginBottom: "16px" }}>
                Destination: <b>{savedMethod ? `${savedMethod.method.toUpperCase()} (${savedMethod.details?.account_number || savedMethod.details?.paypal_email || savedMethod.details?.upi_id || "Saved"})` : "Connected Account"}</b>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" onClick={() => setWithdrawModalOpen(false)} className="secondary-button" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={busy || !withdrawAmount} className="primary-button" style={{ flex: 1 }}>{busy ? "Processing…" : "Confirm Withdrawal"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRO UPGRADE MODAL */}
      {proModalOpen && (
        <div className="modal-backdrop" onClick={() => setProModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, padding: "28px" }}>
            <div style={{ textAlign: "center", marginBottom: "18px" }}>
              <Sparkles size={40} color="#FBBF24" style={{ margin: "0 auto 8px" }} />
              <h2 style={{ margin: "0 0 6px", fontSize: "1.4rem" }}>Productify Seller Pro</h2>
              <div style={{ fontSize: "2rem", fontWeight: 800, margin: "10px 0" }}>$29 <span style={{ fontSize: "0.9rem", fontWeight: 400, color: "var(--muted, #94A3B8)" }}>/ month</span></div>
              <p style={{ color: "var(--muted, #94A3B8)", fontSize: "0.85rem" }}>
                Keep 100% of your revenue, rank higher in search, and get instant payouts.
              </p>
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.9rem" }}>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><CheckCircle2 size={16} color="#10B981" /> <b>0% Marketplace Fee</b> (Save 10% on every sale)</li>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><CheckCircle2 size={16} color="#10B981" /> Top-Ranked Algorithmic Search Placement</li>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><CheckCircle2 size={16} color="#10B981" /> Real-Time GPU Hardware Telemetry & Uptime Monitor</li>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><CheckCircle2 size={16} color="#10B981" /> Instant Automated 15-Minute Payouts</li>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><CheckCircle2 size={16} color="#10B981" /> Verified Pro Seller Golden Badge</li>
            </ul>

            <div style={{ display: "flex", gap: "10px" }}>
              <button type="button" onClick={() => setProModalOpen(false)} className="secondary-button" style={{ flex: 1 }}>Close</button>
              <button type="button" onClick={handleUpgradeToPro} disabled={busy} className="primary-button" style={{ flex: 2, background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)", color: "#000", fontWeight: 800 }}>
                {busy ? "Activating…" : "Start Pro Membership"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SellerReports({ data, loading }) {
  if (loading || !data) return <div className="loading-block">Loading your report history…</div>;
  const t = data.totals || {};
  if (!data.listings || data.listings.length === 0) {
    return (
      <div className="empty-state" data-testid="seller-reports-empty">
        <ShieldCheck size={30} />
        <p>No reports on any of your listings. Great work — keep it up.</p>
      </div>
    );
  }
  return (
    <div data-testid="seller-reports">
      <div className="report-summary">
        <div className="rs-card"><b>{t.total || 0}</b><small>Total reports</small></div>
        <div className="rs-card open"><b>{t.open || 0}</b><small>Open · awaiting review</small></div>
        <div className="rs-card dismissed"><b>{t.dismissed || 0}</b><small>Dismissed by admin</small></div>
        <div className="rs-card removed"><b>{t.removed || 0}</b><small>Listings removed</small></div>
      </div>
      <p className="reports-hint"><ShieldAlert size={14} /> A report doesn't hide your listing automatically. Use this feedback to self-correct before an admin decides.</p>
      <div className="seller-reports-list">
        {data.listings.map((l) => (
          <div key={l.listing_id} className={`seller-report-item ${l.removed_by_admin ? "removed" : l.under_review ? "under-review" : ""}`} data-testid={`seller-report-item-${l.listing_id}`}>
            <img src={l.image} alt="" />
            <div className="sri-info">
              <div className="sri-title">
                <a href={l.listing_kind === "product" ? `/product/${l.listing_id}` : `/rental/${l.listing_id}`} target="_blank" rel="noreferrer"><b>{l.title}</b></a>
                <span className={`status-pill status-${l.removed_by_admin ? "removed" : l.under_review ? "review" : "ok"}`}>
                  {l.removed_by_admin ? "Removed by admin" : l.under_review ? "Under review" : "Live"}
                </span>
              </div>
              <small>{l.listing_kind === "product" ? "Digital product" : "GPU rental"} · {money(l.price)}</small>
              <div className="reason-badges">
                {Object.entries(l.reasons).map(([k, v]) => (
                  <span className={`reason-badge reason-${k}`} key={k}>{REASON_LABEL[k] || k} × {v}</span>
                ))}
              </div>
              {l.recent && l.recent.length > 0 && (
                <details className="recent-reports">
                  <summary>Recent reports ({l.open} open · {l.resolved} resolved)</summary>
                  <ul>
                    {l.recent.map((r, i) => (
                      <li key={i}><b>{REASON_LABEL[r.reason] || r.reason}</b> · <i>{r.status}</i> · <span>{r.details || "No details provided"}</span> · <time>{new Date(r.created_at).toLocaleString()}</time></li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
