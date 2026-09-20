import { useEffect, useState } from "react";
import { ArrowRight, Package, Cpu } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ImageUpload from "@/components/ImageUpload";
import SEO from "@/components/SEO";
import { toast } from "sonner";

const CATS = ["Software", "Design", "Development", "Creative"];

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
        </div>

        {tab === "product" ? (
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
