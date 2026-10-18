import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard, Package, Cpu, Wallet, Flag, Award, Plus, Download, Trash2 } from "lucide-react";
import { api, money, getErrorMessage } from "@/lib/api";
import { PLACEHOLDER_IMG, imgFallback } from "@/lib/image";
import { useAuth } from "@/contexts/AuthContext";
import ImageUpload from "@/components/ImageUpload";
import DashboardShell, { Stat, Panel, Attention } from "@/components/DashboardShell";
import { toast } from "sonner";

const CATS = ["Software", "Design", "Development", "Creative"];
const REASON_LABEL = { illegal: "Illegal", infringing: "IP infringement", malware: "Malware", scam: "Scam", csam: "CSAM", other: "Other" };
// Direct link to the installer file, so the browser downloads it instead of opening GitHub.
const NODE_DOWNLOAD_URL = "https://github.com/Crimson-ripper/Productify-Node/releases/download/v2.0.0/ProductifyNode-Setup.exe";
const PLANS = [
  { tier: "free", name: "Free", fee: "10%" },
  { tier: "plus", name: "Plus", fee: "5%" },
  { tier: "pro", name: "Pro", fee: "0%" },
];

const EMPTY_PRODUCT = { title: "", description: "", price: "", category: "Software", tags: "", image: "" };
const statusPill = (s) => {
  if (s === "approved" || s === true) return <span className="dash-pill ok">Live</span>;
  if (s === "rejected") return <span className="dash-pill bad">Rejected</span>;
  if (s === "awaiting_pairing") return <span className="dash-pill muted">Waiting to pair</span>;
  if (s === "paired") return <span className="dash-pill wait">Needs a price</span>;
  return <span className="dash-pill wait">In review</span>;
};

const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

function CopyCode({ text }) {
  return (
    <div className="dash-code">
      <code>{text}</code>
      <button onClick={() => { navigator.clipboard.writeText(text); toast.success("Copied"); }}>Copy</button>
    </div>
  );
}

export default function SellerDashboard() {
  const { user } = useAuth();
  const [section, setSection] = useState("overview");

  const [analytics, setAnalytics] = useState(null);
  const [listings, setListings] = useState({ products: [], rentals: [] });
  const [listingsLoaded, setListingsLoaded] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [reports, setReports] = useState(null);
  const [busy, setBusy] = useState(false);

  // Forms
  const [newListing, setNewListing] = useState(null); // null | "product"
  const [product, setProduct] = useState(EMPTY_PRODUCT);
  const [prices, setPrices] = useState({}); // machine id -> { price, title, location }
  const [payoutMethod, setPayoutMethod] = useState("bank");
  const [bank, setBank] = useState({ bank_name: "", holder_name: "", account_number: "", routing_number: "" });
  const [paypalEmail, setPaypalEmail] = useState("");
  const [upiId, setUpiId] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const loadListings = useCallback(() => {
    api.get("/seller/listings")
      .then((r) => setListings(r.data))
      .catch(() => setListings({ products: [], rentals: [] }))
      .finally(() => setListingsLoaded(true));
  }, []);

  const loadWallet = useCallback(() => {
    api.get("/seller/wallet").then((r) => {
      setWallet(r.data);
      if (r.data?.payout_method) {
        setPayoutMethod(r.data.payout_method);
        const d = r.data.payout_details || {};
        if (r.data.payout_method === "bank") setBank((b) => ({ ...b, ...d }));
        if (r.data.payout_method === "paypal") setPaypalEmail(d.paypal_email || "");
        if (r.data.payout_method === "upi") setUpiId(d.upi_id || "");
      }
    }).catch(() => setWallet(null));
  }, []);

  const loadAnalytics = useCallback(() => {
    api.get("/seller/analytics").then((r) => setAnalytics(r.data)).catch(() => setAnalytics(null));
  }, []);

  useEffect(() => {
    loadAnalytics();
    loadListings();
    loadWallet();
    api.get("/seller/reports").then((r) => setReports(r.data)).catch(() => setReports(null));
  }, [loadAnalytics, loadListings, loadWallet]);

  // While a machine is waiting to pair, check every few seconds so its hardware appears by itself.
  const waitingToPair = listings.rentals.some((r) => r.status === "awaiting_pairing");
  useEffect(() => {
    if (!waitingToPair) return;
    const t = setInterval(loadListings, 5000);
    return () => clearInterval(t);
  }, [waitingToPair, loadListings]);

  useEffect(() => {
    if (section !== "machines") return;
    api.get("/seller/nodes/telemetry").then((r) => setTelemetry(r.data)).catch(() => setTelemetry(null));
  }, [section]);

  const tier = analytics?.tier || user?.seller_tier || "free";
  const pendingCount = listings.products.filter((p) => !p.approved).length + listings.rentals.filter((r) => r.status === "pending").length;
  const offlineMachines = listings.rentals.filter((r) => r.status === "approved" && !r.is_online);
  const openReports = reports?.totals?.open || 0;
  const hasPayoutMethod = Boolean(wallet?.payout_method);

  // ---------- actions ----------
  const submitProduct = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/products", {
        title: product.title,
        description: product.description,
        price: Number(product.price),
        category: product.category,
        image: product.image,
        tags: product.tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      toast.success("Product submitted — it goes live once an admin approves it");
      setProduct(EMPTY_PRODUCT);
      setNewListing(null);
      loadListings();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't submit the product"));
    } finally {
      setBusy(false);
    }
  };

  // Start a GPU listing: the backend returns a pairing code; hardware arrives once the machine connects.
  const createMachine = async () => {
    setBusy(true);
    try {
      await api.post("/seller/machines");
      loadListings();
      setSection("machines");
      window.scrollTo(0, 0);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't create a pairing code"));
    } finally {
      setBusy(false);
    }
  };

  const publishMachine = async (e, r) => {
    e.preventDefault();
    const p = prices[r.id] || {};
    setBusy(true);
    try {
      const res = await api.post(`/seller/machines/${r.id}/publish`, {
        price: Number(p.price ?? r.price),
        title: p.title ?? r.title,
        location: p.location ?? r.location,
      });
      toast.success(res.data.status === "approved" ? "Saved" : "Sent for review — it goes live once an admin approves it");
      loadListings();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save"));
    } finally {
      setBusy(false);
    }
  };

  const deleteMachine = async (r) => {
    if (!window.confirm("Delete this machine? Its pairing code will stop working.")) return;
    try {
      await api.delete(`/seller/machines/${r.id}`);
      loadListings();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't delete it"));
    }
  };

  const savePayoutMethod = async (e) => {
    e.preventDefault();
    setBusy(true);
    const details = payoutMethod === "bank" ? bank : payoutMethod === "paypal" ? { paypal_email: paypalEmail } : { upi_id: upiId };
    try {
      await api.post("/seller/payout-settings", { method: payoutMethod, details });
      toast.success("Payout details saved");
      loadWallet();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save payout details"));
    } finally {
      setBusy(false);
    }
  };

  const requestWithdrawal = async (e) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt < 10) return toast.error("The minimum withdrawal is $10.00");
    setBusy(true);
    try {
      await api.post("/seller/payout-withdraw", { amount: amt });
      toast.success(`Withdrawal of ${money(amt)} requested`);
      setWithdrawAmount("");
      loadWallet();
      loadAnalytics();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't request the withdrawal"));
    } finally {
      setBusy(false);
    }
  };

  // ---------- sections ----------
  const nav = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "listings", label: "Listings", icon: Package, count: pendingCount },
    { key: "machines", label: "Machines", icon: Cpu, count: offlineMachines.length },
    { key: "earnings", label: "Earnings", icon: Wallet },
    { key: "reports", label: "Reports", icon: Flag, count: openReports },
    { key: "plan", label: "Plan", icon: Award },
  ];

  const attention = [
    pendingCount > 0 && { text: `${pendingCount} listing${pendingCount === 1 ? " is" : "s are"} waiting for admin review.`, action: { label: "View", onClick: () => setSection("listings") } },
    offlineMachines.length > 0 && { text: `${offlineMachines.length} live machine${offlineMachines.length === 1 ? " is" : "s are"} offline, so renters can't use ${offlineMachines.length === 1 ? "it" : "them"}.`, action: { label: "Fix", onClick: () => setSection("machines") } },
    openReports > 0 && { text: `${openReports} open report${openReports === 1 ? "" : "s"} on your listings.`, action: { label: "Review", onClick: () => setSection("reports") } },
    !hasPayoutMethod && wallet && { text: "Add a bank, PayPal or UPI account so you can withdraw earnings.", action: { label: "Add", onClick: () => setSection("earnings") } },
    listingsLoaded && !listings.products.length && !listings.rentals.length && { text: "You haven't listed anything yet.", action: { label: "Create a listing", onClick: () => { setSection("listings"); setNewListing("product"); } } },
  ].filter(Boolean);

  const overview = (
    <>
      <dl className="dash-stats">
        <Stat label="Available to withdraw" value={analytics ? money(analytics.available_balance) : "—"} tone="good" />
        <Stat label="Earned after fees" value={analytics ? money(analytics.net_earnings) : "—"} note={analytics ? `${Math.round(analytics.commission_rate * 100)}% platform fee` : null} />
        <Stat label="Items sold" value={analytics ? analytics.items_sold : "—"} />
        <Stat label="GPU hours rented" value={analytics ? analytics.gpu_hours : "—"} />
        <Stat label="Listings" value={listingsLoaded ? listings.products.length + listings.rentals.length : "—"} note={pendingCount ? `${pendingCount} in review` : null} />
      </dl>
      <div className="dash-grid">
        <Panel title="Recent sales" flush>
          {!analytics?.recent_transactions?.length ? (
            <p className="dash-empty">No sales yet. They'll show up here as soon as someone buys from you.</p>
          ) : (
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead><tr><th>Item</th><th>Date</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {analytics.recent_transactions.map((t, i) => (
                    <tr key={`${t.order_id}-${i}`}>
                      <td><div className="cell-title"><div><b>{t.item_title}</b><small>{t.kind === "rental" ? "GPU rental" : "Product"} · #{String(t.order_id).slice(0, 8)}</small></div></div></td>
                      <td>{shortDate(t.date)}</td>
                      <td className="num">{money(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="Needs attention">
          <Attention items={attention} />
        </Panel>
      </div>
    </>
  );

  const productForm = (
    <Panel title="New product" actions={<button className="link-button" onClick={() => setNewListing(null)}>Cancel</button>}>
      <form className="dash-form" onSubmit={submitProduct}>
        <label>Title<input required value={product.title} onChange={(e) => setProduct({ ...product, title: e.target.value })} /></label>
        <div className="two-col">
          <label>Price (USD)<input required type="number" min="0" step="0.01" value={product.price} onChange={(e) => setProduct({ ...product, price: e.target.value })} /></label>
          <label>Category
            <select value={product.category} onChange={(e) => setProduct({ ...product, category: e.target.value })}>
              {CATS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <label>Description<textarea required value={product.description} onChange={(e) => setProduct({ ...product, description: e.target.value })} /></label>
        <label>Tags<input placeholder="figma, ui-kit, dark mode" value={product.tags} onChange={(e) => setProduct({ ...product, tags: e.target.value })} /></label>
        <div>
          <label>Cover image</label>
          <ImageUpload value={product.image} onChange={(url) => setProduct({ ...product, image: url })} label="Upload cover image" testid="product-image" />
        </div>
        <div className="dash-form-actions">
          <button className="primary-button" disabled={busy}>{busy ? "Submitting…" : "Submit for review"}</button>
        </div>
      </form>
    </Panel>
  );

  const hardware = (r) => [
    ["GPU", r.gpu || "—"],
    ["VRAM", r.vram || "—"],
    ["CPU", [r.specs?.cpu_model, r.specs?.cpu].filter(Boolean).join(" · ") || "—"],
    ["RAM", r.specs?.ram || "—"],
  ];

  const pairingSteps = (r) => (
    <ol className="pair-steps">
      <li><span>1</span><div><b>Install Productify Node</b> on the computer you want to rent out. <a className="link-button" href={NODE_DOWNLOAD_URL} download>Download for Windows</a></div></li>
      <li><span>2</span><div><b>Paste this pairing code</b> into the app:<CopyCode text={r.pairing_code} /></div></li>
      <li><span>3</span><div><b>That's it.</b> The GPU, memory and CPU appear here by themselves once the app connects. <span className="pair-wait"><span className="spinner small" /> Waiting for your machine…</span></div></li>
    </ol>
  );

  const gpuPanel = (
    <Panel
      title="GPUs"
      actions={listings.rentals.length > 0 && (
        <button className="secondary-button" onClick={createMachine} disabled={busy}><Plus size={14} /> Add another GPU</button>
      )}
    >
      {!listingsLoaded ? <p className="dash-clear">Loading…</p> : listings.rentals.length === 0 ? (
        <div className="gpu-empty">
          <Cpu size={26} />
          <h3>Rent out your GPU</h3>
          <p>Create a pairing code, paste it into Productify Node on your computer, and your hardware fills in automatically. No photos or specs to type.</p>
          <div className="dash-form-actions">
            <button className="primary-button" onClick={createMachine} disabled={busy}>Create pairing code</button>
            <a className="text-button text-button-dark" href={NODE_DOWNLOAD_URL} download><Download size={14} /> Download Productify Node</a>
          </div>
        </div>
      ) : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead><tr><th>Machine</th><th>Status</th><th className="num">Price</th><th /></tr></thead>
            <tbody>
              {listings.rentals.map((r) => (
                <tr key={r.id}>
                  <td><div className="cell-title"><div><b>{r.title || "New machine"}</b><small>{r.gpu ? `${r.gpu}${r.vram ? ` · ${r.vram}` : ""}` : "Not paired yet"}</small></div></div></td>
                  <td>{statusPill(r.status)}</td>
                  <td className="num">{r.price ? `${money(r.price)}/hr` : "—"}</td>
                  <td className="num"><button className="link-button" onClick={() => setSection("machines")}>{["awaiting_pairing", "paired"].includes(r.status) ? "Finish setup" : "Manage"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );

  const listingsSection = (
    <>
      {newListing === "product" && productForm}
      {gpuPanel}
      <Panel
        title="Products"
        flush
        actions={!newListing && <button className="secondary-button" onClick={() => setNewListing("product")}><Plus size={14} /> Add a product</button>}
      >
        {!listingsLoaded ? <p className="dash-empty">Loading…</p> : !listings.products.length ? (
          <p className="dash-empty">No products yet.</p>
        ) : (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead><tr><th>Product</th><th>Status</th><th className="num">Price</th><th /></tr></thead>
              <tbody>
                {listings.products.map((p) => (
                  <tr key={p.id}>
                    <td><div className="cell-title"><img src={p.image || PLACEHOLDER_IMG} alt="" onError={imgFallback} /><div><b>{p.title}</b><small>{p.category} · added {shortDate(p.created_at)}</small></div></div></td>
                    <td>{statusPill(p.approved)}</td>
                    <td className="num">{money(p.price)}</td>
                    <td className="num">{p.approved && <Link className="link-button" to={`/product/${p.id}`}>View</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );

  const machineCard = (r) => {
    const draft = prices[r.id] || {};
    const set = (k, v) => setPrices((all) => ({ ...all, [r.id]: { ...draft, [k]: v } }));
    return (
      <div className="dash-machine" key={r.id}>
        <div className="dash-machine-head">
          <div><b>{r.title || "New machine"}</b><small>Listing {r.id}{r.agent_version ? ` · Productify Node ${r.agent_version}` : ""}</small></div>
          <div className="dash-row-actions">
            {statusPill(r.status)}
            {r.status !== "awaiting_pairing" && (
              <span className={r.is_online ? "node-status online" : "node-status"}><span className={r.is_online ? "live-dot" : "live-dot off"} />{r.is_online ? (r.live === false ? "Online · paused" : "Online") : "Offline"}</span>
            )}
          </div>
        </div>

        {r.status === "awaiting_pairing" ? pairingSteps(r) : (
          <>
            <dl className="hw-grid">
              {hardware(r).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
            {r.gpu?.startsWith("CPU only") && (
              <p className="dash-note">Productify Node couldn't find an NVIDIA GPU. Install or update the NVIDIA driver on that computer (it includes <code>nvidia-smi</code>), then restart Productify Node. Without it, renters only get the CPU.</p>
            )}
            {r.specs && r.specs.docker === false && (
              <p className="dash-note">Docker Desktop wasn't running when this machine last connected. Renters can't start jobs until it is.</p>
            )}
            <form className="dash-form price-form" onSubmit={(e) => publishMachine(e, r)}>
              <div className="three-col">
                <label>Price per hour (USD)<input required type="number" min="0.01" max="100" step="0.01" value={draft.price ?? (r.price || "")} onChange={(e) => set("price", e.target.value)} placeholder="0.40" /></label>
                <label>Name shown to renters<input value={draft.title ?? r.title ?? ""} onChange={(e) => set("title", e.target.value)} maxLength={120} /></label>
                <label>City (optional)<input value={draft.location ?? r.location ?? ""} onChange={(e) => set("location", e.target.value)} maxLength={80} placeholder="Delhi, IN" /></label>
              </div>
              <div className="dash-form-actions">
                <button className="primary-button" disabled={busy}>{r.status === "paired" || r.status === "rejected" ? "Submit for review" : "Save"}</button>
                {r.status === "approved" && <Link className="link-button" to={`/rental/${r.id}`}>View listing</Link>}
              </div>
            </form>
            {r.pairing_code && (
              <details className="pair-again">
                <summary>Pairing code (to set up this machine again)</summary>
                <CopyCode text={r.pairing_code} />
              </details>
            )}
          </>
        )}
        {["awaiting_pairing", "paired", "rejected"].includes(r.status) && (
          <button className="link-button danger-link" onClick={() => deleteMachine(r)}><Trash2 size={13} /> Delete</button>
        )}
      </div>
    );
  };

  const machinesSection = (
    <>
      <dl className="dash-stats">
        <Stat label="Machines" value={listings.rentals.length} />
        <Stat label="Online now" value={listings.rentals.filter((r) => r.is_online).length} tone="good" />
        <Stat label="Instances running" value={telemetry ? telemetry.running_instances_count : "—"} />
        <Stat label="Compute hours" value={telemetry ? telemetry.total_compute_hours : "—"} />
        <Stat label="Earned from compute" value={telemetry ? money(telemetry.total_net_earned) : "—"} note="after fees" />
      </dl>

      <Panel
        title="Your machines"
        actions={<button className="secondary-button" onClick={createMachine} disabled={busy}><Plus size={14} /> {listings.rentals.length ? "Add another GPU" : "Create pairing code"}</button>}
      >
        {!listings.rentals.length ? (
          <p className="dash-clear">No machines yet. Create a pairing code to add one.</p>
        ) : (
          <div className="dash-machines">{listings.rentals.map(machineCard)}</div>
        )}
      </Panel>

      {telemetry?.active_instances?.length > 0 && (
        <Panel title="Recent instances on your machines" flush>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead><tr><th>Instance</th><th>Renter</th><th>Status</th><th className="num">Runtime</th><th className="num">Billed</th></tr></thead>
              <tbody>
                {telemetry.active_instances.slice(0, 15).map((i) => (
                  <tr key={i.id}>
                    <td><div className="cell-title"><div><b>{i.template_name || "Container"}</b><small>{i.rental_title || i.gpu}</small></div></div></td>
                    <td>{i.renter_name || i.renter_email || "—"}</td>
                    <td>{i.status === "running" ? <span className="dash-pill ok">Running</span> : <span className="dash-pill muted">{i.status}</span>}</td>
                    <td className="num">{(i.live_runtime_seconds / 3600).toFixed(1)} h</td>
                    <td className="num">{money(i.live_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );

  const earningsSection = (
    <>
      <dl className="dash-stats">
        <Stat label="Available" value={analytics ? money(analytics.available_balance) : "—"} tone="good" />
        <Stat label="Being paid out" value={wallet ? money(wallet.pending_balance) : "—"} />
        <Stat label="Withdrawn so far" value={analytics ? money(analytics.total_withdrawn) : "—"} />
        <Stat label="Platform fee" value={analytics ? `${Math.round(analytics.commission_rate * 100)}%` : "—"} />
      </dl>
      {wallet?.is_locked && (
        <p className="dash-note">Withdrawals are paused until {new Date(wallet.payout_lock_until).toLocaleString()} after a recent account security change.</p>
      )}
      <div className="dash-split">
        <Panel title="Withdraw">
          {!hasPayoutMethod ? (
            <p className="dash-clear">Add payout details first, then you can withdraw.</p>
          ) : (
            <form className="dash-form" onSubmit={requestWithdrawal}>
              <label>Amount (USD)
                <input type="number" min="10" step="0.01" max={analytics?.available_balance || undefined} value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="10.00 minimum" />
              </label>
              <p className="dash-hint">Goes to your {wallet.payout_method === "bank" ? "bank account" : wallet.payout_method === "paypal" ? "PayPal" : "UPI ID"}. An admin approves each payout.</p>
              <div className="dash-form-actions">
                <button className="primary-button" disabled={busy || wallet?.is_locked || !analytics?.available_balance}>Request withdrawal</button>
              </div>
            </form>
          )}
        </Panel>
        <Panel title="Payout details">
          <form className="dash-form" onSubmit={savePayoutMethod}>
            <div className="dash-subtabs">
              {[["bank", "Bank"], ["paypal", "PayPal"], ["upi", "UPI"]].map(([k, l]) => (
                <button type="button" key={k} className={payoutMethod === k ? "active" : ""} onClick={() => setPayoutMethod(k)}>{l}</button>
              ))}
            </div>
            {payoutMethod === "bank" && (
              <>
                <div className="two-col">
                  <label>Bank<input required value={bank.bank_name || ""} onChange={(e) => setBank({ ...bank, bank_name: e.target.value })} /></label>
                  <label>Account holder<input required value={bank.holder_name || ""} onChange={(e) => setBank({ ...bank, holder_name: e.target.value })} /></label>
                </div>
                <div className="two-col">
                  <label>Account number<input required value={bank.account_number || ""} onChange={(e) => setBank({ ...bank, account_number: e.target.value })} /></label>
                  <label>Routing / IFSC<input required value={bank.routing_number || ""} onChange={(e) => setBank({ ...bank, routing_number: e.target.value })} /></label>
                </div>
              </>
            )}
            {payoutMethod === "paypal" && <label>PayPal email<input required type="email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} /></label>}
            {payoutMethod === "upi" && <label>UPI ID<input required placeholder="name@bank" value={upiId} onChange={(e) => setUpiId(e.target.value)} /></label>}
            <div className="dash-form-actions"><button className="secondary-button" disabled={busy}>Save</button></div>
          </form>
        </Panel>
      </div>
      <Panel title="Withdrawal history" flush>
        {!wallet?.history?.length ? <p className="dash-empty">No withdrawals yet.</p> : (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead><tr><th>Requested</th><th>To</th><th>Status</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {wallet.history.map((h) => (
                  <tr key={h.id}>
                    <td>{shortDate(h.created_at)}<div><small style={{ font: "10px 'DM Mono'", color: "#888" }}>{h.id}</small></div></td>
                    <td>{h.destination}</td>
                    <td>{h.status === "completed" ? <span className="dash-pill ok">Paid</span> : h.status === "rejected" ? <span className="dash-pill bad">Rejected</span> : <span className="dash-pill wait">Processing</span>}</td>
                    <td className="num">{money(h.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );

  const reportsSection = (
    <>
      <dl className="dash-stats">
        <Stat label="Open" value={reports?.totals?.open ?? "—"} tone={openReports ? "warn" : undefined} />
        <Stat label="Dismissed" value={reports?.totals?.dismissed ?? "—"} />
        <Stat label="Removed" value={reports?.totals?.removed ?? "—"} />
        <Stat label="Total" value={reports?.totals?.total ?? "—"} />
      </dl>
      <Panel title="Reports on your listings">
        <p className="dash-hint" style={{ margin: "0 0 14px" }}>Buyers can report a listing. A report never hides it on its own; an admin decides.</p>
        {!reports?.listings?.length ? <p className="dash-clear">No one has reported any of your listings.</p> : (
          <div className="seller-reports-list">
            {reports.listings.map((l) => (
              <div key={l.listing_id} className={`seller-report-item ${l.removed_by_admin ? "removed" : l.under_review ? "under-review" : ""}`}>
                <img src={l.image || PLACEHOLDER_IMG} alt="" onError={imgFallback} />
                <div className="sri-info">
                  <div className="sri-title">
                    <b>{l.title}</b>
                    <span className={`status-pill ${l.removed_by_admin ? "status-removed" : l.under_review ? "status-review" : "status-ok"}`}>
                      {l.removed_by_admin ? "Removed" : l.under_review ? "Under review" : "OK"}
                    </span>
                  </div>
                  <small>{l.listing_kind === "rental" ? "GPU" : "Product"} · {l.open} open · {l.resolved} resolved</small>
                  <div className="reason-badges">
                    {Object.entries(l.reasons || {}).map(([k, n]) => <span key={k} className={`reason-badge reason-${k}`}>{REASON_LABEL[k] || k} × {n}</span>)}
                  </div>
                  {l.recent?.length > 0 && (
                    <details className="recent-reports">
                      <summary>Latest reports</summary>
                      <ul>{l.recent.map((rr, i) => <li key={i}><b>{REASON_LABEL[rr.reason] || rr.reason}</b> · <i>{rr.status}</i> · <time>{shortDate(rr.created_at)}</time>{rr.details ? <div>{rr.details}</div> : null}</li>)}</ul>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );

  const planSection = (
    <Panel title="Your plan">
      <p className="dash-note">Paid plans aren't available yet because payments aren't live. Everyone is on Free (10% fee) for now.</p>
      <div className="dash-plans">
        {PLANS.map((p) => (
          <div key={p.tier} className={tier === p.tier ? "dash-plan current" : "dash-plan"}>
            <h3>{p.name}</h3>
            <p className="fee"><b>{p.fee}</b> fee on each sale and rental</p>
            {tier === p.tier ? <span className="dash-pill ok">Current plan</span> : <button className="secondary-button" disabled>Coming soon</button>}
          </div>
        ))}
      </div>
    </Panel>
  );

  const content = { overview, listings: listingsSection, machines: machinesSection, earnings: earningsSection, reports: reportsSection, plan: planSection }[section];
  const titles = { overview: "Overview", listings: "Listings", machines: "Machines", earnings: "Earnings", reports: "Reports", plan: "Plan" };

  return (
    <DashboardShell
      seoTitle="Seller studio — Productify"
      path="/seller-studio"
      eyebrow="Seller studio"
      title={section === "overview" ? `Hi, ${user?.name?.split(" ")[0] || "there"}` : titles[section]}
      subtitle={section === "overview" ? `${user?.storename || user?.name || ""}${user?.username ? ` · @${user.username}` : ""} · ${PLANS.find((p) => p.tier === tier)?.name || "Free"} plan` : null}
      actions={section === "overview" && (
        <>
          <button className="secondary-button" onClick={() => { setSection("listings"); setNewListing("product"); }}><Plus size={14} /> New listing</button>
          <button className="primary-button" onClick={() => setSection("earnings")}>Withdraw</button>
        </>
      )}
      nav={nav}
      active={section}
      onNav={(k) => { setSection(k); setNewListing(null); window.scrollTo(0, 0); }}
    >
      {content}
    </DashboardShell>
  );
}