import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Cpu, ShieldCheck, Zap } from "lucide-react";
import { api, money } from "@/lib/api";
import SEO from "@/components/SEO";
import ReportButton from "@/components/ReportButton";
import GpuDeployModal from "@/components/GpuDeployModal";

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
  if (!r) return <div className="empty-block">Rental not found. <Link to="/rentals">Back</Link></div>;

  return (
    <>
      <SEO title={`${r.title} — GPU rental · Productify`} description={r.description || `Rent ${r.gpu} with ${r.vram} VRAM at ${money(r.price)}/hour.`} path={`/rental/${r.id}`} image={r.image} />
      <section className="detail-page" data-testid={`rental-detail-${r.id}`}>
        <div className="detail-image"><img src={r.image} alt={r.title} /></div>
        <div className="detail-info">
          <div className="crumb"><Link to="/rentals">GPU rentals</Link></div>
          <h1>{r.title}</h1>
          <div className="detail-seller">by <b>{r.owner}</b> · <span className="verified-pill"><ShieldCheck size={13} /> Verified node</span></div>
          <div className="detail-price">{money(r.price)} <small>/ hour</small></div>
          <p className="detail-desc">{r.description}</p>
          <div className="specs-grid">
            <div><Cpu size={14} /><b>GPU</b><span>{r.gpu}</span></div>
            <div><Cpu size={14} /><b>VRAM</b><span>{r.vram}</span></div>
            {r.specs?.cpu && <div><Cpu size={14} /><b>CPU</b><span>{r.specs.cpu}</span></div>}
            {r.specs?.ram && <div><Cpu size={14} /><b>RAM</b><span>{r.specs.ram}</span></div>}
            {r.specs?.storage && <div><Cpu size={14} /><b>Storage</b><span>{r.specs.storage}</span></div>}
            {r.specs?.bandwidth && <div><Cpu size={14} /><b>Bandwidth</b><span>{r.specs.bandwidth}</span></div>}
            <div><Cpu size={14} /><b>Location</b><span>{r.location}</span></div>
          </div>
          <div className="detail-actions" style={{ flexWrap: "wrap", gap: "10px" }}>
            <Link
              to={`/rentals/reserve/${r.id}`}
              className="primary-button"
              data-testid="rental-detail-reserve-button"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--lime, #c8f04c)", color: "var(--ink, #101112)", border: "none", fontWeight: 800, textDecoration: "none", padding: "12px 24px" }}
            >
              <Zap size={16} /> Reserve Now (Go to Dedicated Rental Space) <ArrowRight size={16} />
            </Link>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setDeployModalOpen(true)}
              data-testid="rental-detail-deploy-button"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              Quick Launch Modal
            </button>
            <ReportButton listingId={r.id} listingKind="rental" />
          </div>
        </div>
      </section>

      <GpuDeployModal
        rental={r}
        isOpen={deployModalOpen}
        onClose={() => setDeployModalOpen(false)}
      />
    </>
  );
}
