import { useEffect, useState } from "react";
import { ArrowRight, Package, Cpu, Flag, ShieldAlert, ShieldCheck } from "lucide-react";
import { api, money } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ImageUpload from "@/components/ImageUpload";
import SEO from "@/components/SEO";
import { toast } from "sonner";

const CATS = ["Software", "Design", "Development", "Creative"];
const REASON_LABEL = { illegal: "Illegal", infringing: "IP infringement", malware: "Malware", scam: "Scam", csam: "CSAM", other: "Other" };

export default function SellerDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("product");
  // product fields
  const [pTitle, setPTitle] = useState(""); const [pDesc, setPDesc] = useState("");
  const [pPrice, setPPrice] = useState(""); const [pCat, setPCat] = useState("Software"); const [pTags, setPTags] = useState("");
  const [pImage, setPImage] = useState("");
  // rental fields
  const [rTitle, setRTitle] = useState(""); const [rGpu, setRGpu] = useState(""); const [rVram, setRVram] = useState("");
  const [rPrice, setRPrice] = useState(""); const [rLoc, setRLoc] = useState(""); const [rDesc, setRDesc] = useState("");
  const [rImage, setRImage] = useState("");
  const [busy, setBusy] = useState(false);
  // reports on my listings
  const [reportsData, setReportsData] = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);

  useEffect(() => {
    if (tab !== "reports") return;
    setReportsLoading(true);
    api.get("/seller/reports").then((r) => setReportsData(r.data)).catch(() => setReportsData({ listings: [], totals: {} })).finally(() => setReportsLoading(false));
  }, [tab]);

  const submitProduct = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.post("/products", {
        title: pTitle, description: pDesc, price: Number(pPrice), category: pCat,
        image: pImage, tags: pTags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      toast.success("Product submitted for review");
      setPTitle(""); setPDesc(""); setPPrice(""); setPTags(""); setPImage("");
    } catch (err) { toast.error(err.response?.data?.detail || "Publish failed"); }
    finally { setBusy(false); }
  };

  const submitRental = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.post("/rentals", {
        title: rTitle, gpu: rGpu, vram: rVram, price: Number(rPrice), location: rLoc,
        description: rDesc, image: rImage, specs: {},
      });
      toast.success("Node submitted — pending verification");
      setRTitle(""); setRGpu(""); setRVram(""); setRPrice(""); setRLoc(""); setRDesc(""); setRImage("");
    } catch (err) { toast.error(err.response?.data?.detail || "Publish failed"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <SEO title="Seller studio — Productify" path="/dashboard" />
      <section className="dashboard-page">
        <div className="eyebrow"><span className="eyebrow-line" /> SELLER STUDIO</div>
        <h1>Build your shelf<em>.</em></h1>
        <p className="subtitle">Signed in as {user?.email} · role: {user?.role}</p>

        <div className="dashboard-tabs">
          <button className={tab === "product" ? "selected" : ""} onClick={() => setTab("product")} data-testid="dashboard-product-tab"><Package size={14} /> Digital product</button>
          <button className={tab === "rental" ? "selected" : ""} onClick={() => setTab("rental")} data-testid="dashboard-rental-tab"><Cpu size={14} /> GPU / system</button>
          <button className={tab === "reports" ? "selected" : ""} onClick={() => setTab("reports")} data-testid="dashboard-reports-tab"><Flag size={14} /> Reports on my listings</button>
        </div>

        {tab === "reports" ? (
          <SellerReports data={reportsData} loading={reportsLoading} />
        ) : tab === "product" ? (
          <form className="dashboard-form" onSubmit={submitProduct}>
            <label>Listing title<input value={pTitle} onChange={(e) => setPTitle(e.target.value)} required data-testid="dashboard-product-title-input" /></label>
            <label>Description<textarea value={pDesc} onChange={(e) => setPDesc(e.target.value)} required data-testid="dashboard-product-desc-input" /></label>
            <div className="two-col">
              <label>Category<select value={pCat} onChange={(e) => setPCat(e.target.value)} data-testid="dashboard-product-cat-select">{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label>Price (USD)<input type="number" step=".01" min="1" value={pPrice} onChange={(e) => setPPrice(e.target.value)} required data-testid="dashboard-product-price-input" /></label>
            </div>
            <label>Tags<input value={pTags} onChange={(e) => setPTags(e.target.value)} placeholder="figma, ui-kit, saas" data-testid="dashboard-product-tags-input" /></label>
            <label>Cover image<ImageUpload value={pImage} onChange={setPImage} label="Upload product image" testid="dashboard-product-image" /></label>
            <button className="primary-button" disabled={busy || !pImage} data-testid="dashboard-product-submit-button">{busy ? "Submitting…" : "Submit for review"} <ArrowRight size={16} /></button>
          </form>
        ) : (
          <form className="dashboard-form" onSubmit={submitRental}>
            <label>Listing title<input value={rTitle} onChange={(e) => setRTitle(e.target.value)} required data-testid="dashboard-rental-title-input" /></label>
            <label>Description<textarea value={rDesc} onChange={(e) => setRDesc(e.target.value)} required data-testid="dashboard-rental-desc-input" /></label>
            <div className="two-col">
              <label>GPU<input value={rGpu} onChange={(e) => setRGpu(e.target.value)} placeholder="RTX 4090" required data-testid="dashboard-rental-gpu-input" /></label>
              <label>VRAM<input value={rVram} onChange={(e) => setRVram(e.target.value)} placeholder="24 GB" required data-testid="dashboard-rental-vram-input" /></label>
            </div>
            <div className="two-col">
              <label>Hourly rate (USD)<input type="number" step=".01" min="0.05" value={rPrice} onChange={(e) => setRPrice(e.target.value)} required data-testid="dashboard-rental-price-input" /></label>
              <label>Location<input value={rLoc} onChange={(e) => setRLoc(e.target.value)} placeholder="Bengaluru, IN" required data-testid="dashboard-rental-loc-input" /></label>
            </div>
            <label>Cover image<ImageUpload value={rImage} onChange={setRImage} label="Upload node photo" testid="dashboard-rental-image" /></label>
            <div className="verification-note">Verification required. Our team reviews every node within 24 hours before it goes live.</div>
            <button className="primary-button" disabled={busy || !rImage} data-testid="dashboard-rental-submit-button">{busy ? "Submitting…" : "Submit for verification"} <ArrowRight size={16} /></button>
          </form>
        )}
      </section>
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
