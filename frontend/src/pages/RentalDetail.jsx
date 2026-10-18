import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api, money } from "@/lib/api";
import GpuVisual from "@/components/GpuVisual";
import SEO from "@/components/SEO";
import ReportButton from "@/components/ReportButton";
import GpuDeployModal from "@/components/GpuDeployModal";

const SPEC_FIELDS = [
  ["cpu", "CPU"],
  ["ram", "RAM"],
  ["storage", "Storage"],
  ["bandwidth", "Bandwidth"],
];

export default function RentalDetail() {
  const { id } = useParams();
  const [r, setR] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deployModalOpen, setDeployModalOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/rentals/${id}`).then((res) => setR(res.data)).catch(() => setR(null)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading-block">Loading…</div>;
  if (!r) return <div className="empty-block">We couldn't find that machine. <Link to="/rentals">Back to GPU rentals</Link></div>;

  return (
    <>
      <SEO title={`${r.title} — GPU rental · Productify`} description={r.description || `Rent ${r.gpu} with ${r.vram} VRAM at ${money(r.price)}/hour.`} path={`/rental/${r.id}`} />
      <section className="detail-page" data-testid={`rental-detail-${r.id}`}>
        <div className="detail-image"><GpuVisual rental={r} large /></div>
        <div className="detail-info">
          <div className="crumb"><Link to="/rentals">GPU rentals</Link></div>
          <h1>{r.title}</h1>
          <div className="detail-seller">
            Listed by <b>{r.owner}</b>
            <span className={r.is_online ? "node-status online" : "node-status"}>
              <span className={r.is_online ? "live-dot" : "live-dot off"} />{r.is_online ? "Online now" : "Offline"}
            </span>
          </div>
          <div className="detail-price">{money(r.price)} <small>/ hour</small></div>
          {r.description && <p className="detail-desc">{r.description}</p>}
          <dl className="specs-grid">
            <div><dt>GPU</dt><dd>{r.gpu}</dd></div>
            <div><dt>VRAM</dt><dd>{r.vram}</dd></div>
            {SPEC_FIELDS.filter(([k]) => r.specs?.[k]).map(([k, label]) => (
              <div key={k}><dt>{label}</dt><dd>{r.specs[k]}</dd></div>
            ))}
            {r.location && <div><dt>Location</dt><dd>{r.location}</dd></div>}
          </dl>
          <div className="detail-actions">
            <Link to={`/rentals/reserve/${r.id}`} className="primary-button" data-testid="rental-detail-reserve-button">
              Reserve this GPU <ArrowRight size={16} />
            </Link>
            <button type="button" className="text-button text-button-dark" onClick={() => setDeployModalOpen(true)} data-testid="rental-detail-deploy-button">
              Launch from a template
            </button>
          </div>
          {!r.is_online && <p className="detail-note">This machine is offline right now, so nothing can run on it until its owner reconnects it.</p>}
          <div className="detail-report"><ReportButton listingId={r.id} listingKind="rental" /></div>
        </div>
      </section>

      <GpuDeployModal rental={r} isOpen={deployModalOpen} onClose={() => setDeployModalOpen(false)} />
    </>
  );
}
