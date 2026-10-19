import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Zap, HardDrive, CheckCircle2, Loader2, Wallet, ArrowRight } from "lucide-react";
import { api, money, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_TEMPLATES } from "@/lib/templates";
import SEO from "@/components/SEO";
import TemplateIcon from "@/components/TemplateIcon";
import CreditPlans from "@/components/CreditPlans";
import Availability, { availabilityOf, UNAVAILABLE_REASON } from "@/components/Availability";
import { toast } from "sonner";

export default function GpuRentalSpace() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rental, setRental] = useState(null);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(0);
  const [freeClaimed, setFreeClaimed] = useState(false);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState("jupyter-pytorch");
  const [diskSize, setDiskSize] = useState(50);
  const [launching, setLaunching] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rRes, cRes] = await Promise.all([
        api.get(`/rentals/${id}`),
        api.get("/credits/balance").catch(() => ({ data: { compute_credits: user?.compute_credits || 0 } })),
      ]);
      setRental(rRes.data);
      setCredits(Number(cRes.data?.compute_credits || 0));
      setFreeClaimed(Boolean(cRes.data?.free_credits_claimed));
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't load this machine"));
    } finally {
      setLoading(false);
    }
    api.get("/instances/templates").then((r) => Array.isArray(r.data) && r.data.length && setTemplates(r.data)).catch(() => {});
  }, [id, user?.compute_credits]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="loading-screen"><span /><p>Loading machine…</p></div>;
  if (!rental) {
    return (
      <div className="empty-block rs-empty">
        <h2>Machine not found</h2>
        <p>This machine is no longer listed.</p>
        <Link to="/rentals" className="primary-button">Browse machines</Link>
      </div>
    );
  }

  const basePrice = Number(rental.price) || 0;
  const diskCostPerHour = diskSize * 0.0002;
  const totalPerHour = basePrice + diskCostPerHour;
  const hoursCovered = totalPerHour > 0 ? (credits / totalPerHour).toFixed(1) : "0.0";
  const avail = availabilityOf(rental);
  const canLaunch = avail === "available" && credits >= 0.5;

  const launch = async () => {
    if (avail !== "available") return toast.error(UNAVAILABLE_REASON[avail]);
    if (credits < 0.5) return toast.error("You need compute credits to start an instance.");
    setLaunching(true);
    try {
      const res = await api.post("/instances/deploy", { rental_id: rental.id, template_id: selectedTemplate, disk_size_gb: Number(diskSize) });
      toast.success("Container started.");
      navigate(`/instances/${res.data.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't start the instance"));
    } finally {
      setLaunching(false);
    }
  };

  return (
    <>
      <SEO
        title={`Rent ${rental.gpu} — Productify`}
        description={`Start a PyTorch or Python container on ${rental.gpu} (${rental.vram}), billed by the second. Closed beta.`}
        path={`/rentals/reserve/${rental.id}`}
      />
      <div className="rs-page">
        <nav className="rs-crumbs" aria-label="Breadcrumb">
          <Link to="/rentals">GPU rentals</Link><span>/</span>
          <Link to={`/rental/${rental.id}`}>{rental.gpu}</Link><span>/</span>
          <span>Start an instance</span>
        </nav>

        <section className="rs-head">
          <div>
            <div className="eyebrow">Rent this GPU · closed beta</div>
            <h1>{rental.title}</h1>
            {rental.description && <p className="rs-desc">{rental.description}</p>}
            <ul className="rs-facts">
              <li><b>GPU</b> {rental.gpu} ({rental.vram})</li>
              <li><b>Region</b> {rental.location || "—"}</li>
              <li><b>Provider</b> {rental.owner}</li>
              <li>
                <Availability r={rental} />
              </li>
            </ul>
          </div>
          <div className="rs-price">
            <div className="rs-label">Price</div>
            <div className="rs-big">{money(totalPerHour)} <small>/ hour</small></div>
            <p>{money(basePrice)} compute + {money(diskCostPerHour)} for {diskSize} GB disk. Billed by the second while running.</p>
          </div>
        </section>

        <section className="rs-card">
          <h2><Wallet size={18} aria-hidden="true" /> Compute credits</h2>
          <p>Your balance: <b>{money(credits)}</b>{totalPerHour > 0 && <> — about {hoursCovered} hours on this machine</>}.</p>
          <CreditPlans claimed={freeClaimed} onBalance={(b) => { setCredits(b); setFreeClaimed(true); }} />
        </section>

        <section className="rs-card">
          <h2>1. Environment</h2>
          <div className="rs-templates">
            {templates.map((tpl) => {
              const active = selectedTemplate === tpl.id;
              return (
                <button type="button" key={tpl.id} className={active ? "rs-tpl active" : "rs-tpl"} onClick={() => setSelectedTemplate(tpl.id)} aria-pressed={active}>
                  <span className="rs-tpl-top"><TemplateIcon id={tpl.id} size={20} />{active && <CheckCircle2 size={18} aria-hidden="true" />}</span>
                  <b>{tpl.name}</b>
                  <span>{tpl.description}</span>
                </button>
              );
            })}
          </div>

          <h2>2. Disk size</h2>
          <div className="rs-disk">
            <label htmlFor="rs-disk"><HardDrive size={16} aria-hidden="true" /> {diskSize} GB <small>(+{money(diskCostPerHour)}/hr)</small></label>
            <input id="rs-disk" type="range" min="20" max="500" step="10" value={diskSize} onChange={(e) => setDiskSize(Number(e.target.value))} />
            <div className="rs-range"><span>20 GB</span><span>500 GB</span></div>
          </div>
          <p className="rs-note">You'll work in a browser terminal. SSH and JupyterLab aren't available yet. When you stop, the container and its files are deleted.</p>
        </section>

        <section className="rs-launch">
          <div>
            <div className="rs-big">{money(totalPerHour)} <small>/ hour</small></div>
            <p>Billing starts when the container starts and stops when you stop it.</p>
          </div>
          <button type="button" className="primary-button" onClick={launch} disabled={launching || !canLaunch}>
            {launching ? <><Loader2 size={18} className="spin" /> Starting…</> : <><Zap size={18} /> Start instance <ArrowRight size={16} /></>}
          </button>
          {!canLaunch && <p className="rs-why">{avail !== "available" ? UNAVAILABLE_REASON[avail] : "You need compute credits to start. Claim your free credits above."}</p>}
        </section>
      </div>
    </>
  );
}
