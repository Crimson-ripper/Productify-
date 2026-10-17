import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard, Package, Cpu, Wallet, Flag, Award, Plus, RefreshCw, Download } from "lucide-react";
import { api, money, getErrorMessage } from "@/lib/api";
import { PLACEHOLDER_IMG, imgFallback } from "@/lib/image";
import { useAuth } from "@/contexts/AuthContext";
import ImageUpload from "@/components/ImageUpload";
import DashboardShell, { Stat, Panel, Attention } from "@/components/DashboardShell";
import { toast } from "sonner";

const CATS = ["Software", "Design", "Development", "Creative"];
const REASON_LABEL = { illegal: "Illegal", infringing: "IP infringement", malware: "Malware", scam: "Scam", csam: "CSAM", other: "Other" };
const NODE_EXE_URL = "https://github.com/Crimson-ripper/Productify-Node/releases/download/v1.0.0/ProductifyNode.exe";
const LOCAL_NODE = "http://127.0.0.1:48123";
const PLANS = [
  { tier: "free", name: "Free", fee: "10%" },
  { tier: "plus", name: "Plus", fee: "5%" },
  { tier: "pro", name: "Pro", fee: "0%" },
];

const EMPTY_PRODUCT = { title: "", description: "", price: "", category: "Software", tags: "", image: "" };
const EMPTY_RENTAL = { title: "", gpu: "", vram: "", price: "", location: "", description: "", image: "", gaming_ready: false, thermal_ceiling: 82 };

const statusPill = (s) => {
  if (s === "approved" || s === true) return <span className="dash-pill ok">Live</span>;
  if (s === "rejected") return <span className="dash-pill bad">Rejected</span>;
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
  const [newListing, setNewListing] = useState(null); // null | "product" | "rental"
  const [product, setProduct] = useState(EMPTY_PRODUCT);
  const [rental, setRental] = useState(EMPTY_RENTAL);
  const [hwSignature, setHwSignature] = useState(null);
  const [payoutMethod, setPayoutMethod] = useState("bank");
  const [bank, setBank] = useState({ bank_name: "", holder_name: "", account_number: "", routing_number: "" });
  const [paypalEmail, setPaypalEmail] = useState("");
  const [upiId, setUpiId] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  // Productify Node running on this computer, if any
  const [localNode, setLocalNode] = useState(null);
  const [probing, setProbing] = useState(false);

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

  const probeLocalNode = useCallback(async () => {
    setProbing(true);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(`${LOCAL_NODE}/probe`, { signal: ctrl.signal, headers: { Accept: "application/json" } });
      clearTimeout(t);
      const data = res.ok ? await res.json() : null;
      setLocalNode(data);
      return data;
    } catch {
      setLocalNode(null);
      return null;
    } finally {
      setProbing(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
    loadListings();
    loadWallet();
    api.get("/seller/reports").then((r) => setReports(r.data)).catch(() => setReports(null));
    probeLocalNode();
  }, [loadAnalytics, loadListings, loadWallet, probeLocalNode]);

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

  const autoDetect = async () => {
    const specs = localNode || (await probeLocalNode());
    try {
      const res = await api.post("/host/auto-detect", specs ? { real_specs: specs } : {});
      if (!res.data?.specs) {
        toast.info("Productify Node isn't running on this computer. Start it, or fill in the specs yourself.");
        return;
      }
      const s = res.data.specs;
      setRental((r) => ({
        ...r,
        gpu: s.gpu || r.gpu,
        vram: s.vram || r.vram,
        title: r.title || `${s.gpu} ${s.vram ? `(${s.vram})` : ""}`.trim(),
        description: r.description || s.description || "",
        price: r.price || s.suggested_price || "",
        gaming_ready: Boolean(s.gaming_ready),
      }));
      setHwSignature(res.data);
      toast.success(`Found ${s.gpu}${s.vram ? ` (${s.vram})` : ""}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't read the hardware"));
    }
  };

  const connectThisComputer = async (r) => {
    try {
      const res = await fetch(`${LOCAL_NODE}/tunnel/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rental_id: r.id, node_id: r.node_id, token: r.pairing_token }),
      });
      const data = res.ok ? await res.json() : null;
      if (data?.ok) {
        toast.success("Productify Node on this computer is now paired with this listing");
        setTimeout(loadListings, 4000);
      } else {
        toast.error("Productify Node didn't accept the pairing. Paste the token into the app instead.");
      }
    } catch {
      toast.error("Couldn't reach Productify Node on this computer.");
    }
  };

  const submitRental = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const s = hwSignature?.specs || {};
      const res = await api.post("/rentals", {
        title: rental.title,
        gpu: rental.gpu,
        vram: rental.vram,
        price: Number(rental.price),
        location: rental.location,
        description: rental.description,
        image: rental.image,
        gaming_ready: Boolean(rental.gaming_ready),
        thermal_ceiling: Number(rental.thermal_ceiling) || 82,
        node_id: localNode?.node_id || null,
        host_wan_ip: localNode?.wan_ip || null,
        hardware_signature: hwSignature?.hardware_signature || null,
        specs: { cpu: s.cpu, ram: s.ram, storage: s.storage, bandwidth: s.bandwidth },
      });
      toast.success("GPU listing submitted — an admin reviews it before it goes live");
      if (localNode && res.data?.id) connectThisComputer(res.data);
      setRental(EMPTY_RENTAL);
      setHwSignature(null);
      setNewListing(null);
      loadListings();
      setSection("machines");
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't submit the GPU listing"));
    } finally {
      setBusy(false);
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

  const rentalForm = (
    <Panel title="New GPU listing" actions={<button className="link-button" onClick={() => setNewListing(null)}>Cancel</button>}>
      <p className={localNode ? "dash-note info" : "dash-note"}>
        {localNode
          ? <>Productify Node is running on this computer ({localNode.gpu || "GPU"}). <button type="button" className="link-button" onClick={autoDetect}>Fill in specs from it</button></>
          : <>To rent out this computer, install and start <a className="link-button" href={NODE_EXE_URL}>Productify Node</a>, then <button type="button" className="link-button" onClick={probeLocalNode}>{probing ? "checking…" : "check again"}</button>. You can also list a machine from another computer and pair it later.</>}
      </p>
      <form className="dash-form" onSubmit={submitRental}>
        <label>Title<input required value={rental.title} onChange={(e) => setRental({ ...rental, title: e.target.value })} /></label>
        <div className="three-col">
          <label>GPU<input required placeholder="RTX 4090" value={rental.gpu} onChange={(e) => setRental({ ...rental, gpu: e.target.value })} /></label>
          <label>VRAM<input required placeholder="24 GB" value={rental.vram} onChange={(e) => setRental({ ...rental, vram: e.target.value })} /></label>
          <label>Price per hour (USD)<input required type="number" min="0" step="0.01" value={rental.price} onChange={(e) => setRental({ ...rental, price: e.target.value })} /></label>
        </div>
        <div className="two-col">
          <label>Location<input required placeholder="City, country" value={rental.location} onChange={(e) => setRental({ ...rental, location: e.target.value })} /></label>
          <label>Max GPU temperature (°C)<input type="number" min="60" max="95" value={rental.thermal_ceiling} onChange={(e) => setRental({ ...rental, thermal_ceiling: e.target.value })} /></label>
        </div>
        <label>Description<textarea value={rental.description} onChange={(e) => setRental({ ...rental, description: e.target.value })} /></label>
        <label className="check"><input type="checkbox" checked={rental.gaming_ready} onChange={(e) => setRental({ ...rental, gaming_ready: e.target.checked })} /> Offer this machine for Gamezone (needs Sunshine and ViGEm, installed from Productify Node)</label>
        <div>
          <label>Photo</label>
          <ImageUpload value={rental.image} onChange={(url) => setRental({ ...rental, image: url })} label="Upload a photo of the machine" testid="rental-image" />
        </div>
        <div className="dash-form-actions">
          <button className="primary-button" disabled={busy}>{busy ? "Submitting…" : "Submit for review"}</button>
        </div>
      </form>
    </Panel>
  );

  const listingsSection = (
    <>
      {newListing === "product" && productForm}
      {newListing === "rental" && rentalForm}
      <Panel
        title="Your listings"
        flush
        actions={!newListing && (
          <>
            <button className="secondary-button" onClick={() => setNewListing("product")}><Plus size={14} /> Product</button>
            <button className="secondary-button" onClick={() => setNewListing("rental")}><Plus size={14} /> GPU</button>
          </>
        )}
      >
        {!listingsLoaded ? <p className="dash-empty">Loading…</p> : !listings.products.length && !listings.rentals.length ? (
          <p className="dash-empty">Nothing listed yet. Add a product or a GPU to get started.</p>
        ) : (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead><tr><th>Listing</th><th>Type</th><th>Status</th><th className="num">Price</th><th /></tr></thead>
              <tbody>
                {listings.products.map((p) => (
                  <tr key={p.id}>
                    <td><div className="cell-title"><img src={p.image || PLACEHOLDER_IMG} alt="" onError={imgFallback} /><div><b>{p.title}</b><small>{p.category} · added {shortDate(p.created_at)}</small></div></div></td>
                    <td>Product</td>
                    <td>{statusPill(p.approved)}</td>
                    <td className="num">{money(p.price)}</td>
                    <td className="num">{p.approved && <Link className="link-button" to={`/product/${p.id}`}>View</Link>}</td>
                  </tr>
                ))}
                {listings.rentals.map((r) => (
                  <tr key={r.id}>
                    <td><div className="cell-title"><img src={r.image || PLACEHOLDER_IMG} alt="" onError={imgFallback} /><div><b>{r.title}</b><small>{r.gpu} · {r.vram} · {r.location}</small></div></div></td>
                    <td>GPU</td>
                    <td>{statusPill(r.status)}</td>
                    <td className="num">{money(r.price)}/hr</td>
                    <td className="num">{r.status === "approved" && <Link className="link-button" to={`/rental/${r.id}`}>View</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );

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
        title="Productify Node on this computer"
        actions={<button className="secondary-button" onClick={probeLocalNode} disabled={probing}><RefreshCw size={14} className={probing ? "spin" : ""} /> Check</button>}
      >
        {localNode ? (
          <p className="dash-clear">Running · {localNode.gpu || "GPU"}{localNode.vram ? ` (${localNode.vram})` : ""}{localNode.gaming_ready ? " · ready for Gamezone" : ""}. Use "Pair this computer" on a listing below.</p>
        ) : (
          <div className="dash-form-actions">
            <p className="dash-clear" style={{ flex: 1 }}>Not running here. Install it on the machine you want to rent out, sign in with the pairing token from its listing below, and switch it to Live.</p>
            <a className="primary-button" href={NODE_EXE_URL}><Download size={15} /> Download for Windows</a>
          </div>
        )}
      </Panel>

      <Panel title="Your machines">
        {!listings.rentals.length ? (
          <p className="dash-clear">No GPU listings yet. <button className="link-button" onClick={() => { setSection("listings"); setNewListing("rental"); }}>List a machine</button></p>
        ) : (
          <div className="dash-machines">
            {listings.rentals.map((r) => (
              <div className="dash-machine" key={r.id}>
                <div className="dash-machine-head">
                  <div><b>{r.title}</b><small>{r.gpu} · {r.vram} · {money(r.price)}/hr · listing {r.id}</small></div>
                  <div className="dash-row-actions">
                    {statusPill(r.status)}
                    <span className={r.is_online ? "node-status online" : "node-status"}><span className={r.is_online ? "live-dot" : "live-dot off"} />{r.is_online ? "Online" : "Offline"}</span>
                  </div>
                </div>
                {r.pairing_token ? (
                  <>
                    <label className="dash-side-label" style={{ padding: 0 }}>Pairing token</label>
                    <CopyCode text={r.pairing_token} />
                    <label className="dash-side-label" style={{ padding: "12px 0 0" }}>Headless (Linux / servers)</label>
                    <CopyCode text={`python main.py --headless --token=${r.pairing_token} --rental-id=${r.id} --live`} />
                    {localNode && !r.is_online && (
                      <div className="dash-form-actions" style={{ marginTop: 12 }}>
                        <button className="secondary-button" onClick={() => connectThisComputer(r)}>Pair this computer</button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="dash-note">This listing was created before pairing tokens existed, so no machine can connect to it. Create a new GPU listing for this machine.</p>
                )}
              </div>
            ))}
          </div>
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
