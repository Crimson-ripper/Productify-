import { Link } from "react-router-dom";
import { ArrowRight, Cpu, MapPin } from "lucide-react";
import { money } from "@/lib/api";
import GpuVisual from "@/components/GpuVisual";
import Availability, { availabilityOf } from "@/components/Availability";

export default function RentalCard({ r }) {
  return (
    <article className="rental-card" data-testid={`rental-card-${r.id}`}>
      <Link to={`/rental/${r.id}`} className="rental-card-visual" aria-label={r.title}><GpuVisual rental={r} /></Link>
      <div className="rental-info">
        <div className="node-status-row">
          <Availability r={r} />
          {r.is_verified && <span className="node-status node-verified">· Hardware checked</span>}
        </div>
        <h3><Link to={`/rental/${r.id}`}>{r.title}</Link></h3>
        <div className="spec-row">
          <span><Cpu size={14} />{r.gpu}</span>
          <span>{r.vram}</span>
          {r.location && <span><MapPin size={13} />{r.location}</span>}
        </div>
        <div className="rental-bottom">
          <strong>{money(r.price)} <small>/ hour</small></strong>
          {availabilityOf(r) === "available" ? (
            <Link to={`/rentals/reserve/${r.id}`} className="dark-button" data-testid={`rent-node-${r.id}-button`}>
              Reserve <ArrowRight size={14} />
            </Link>
          ) : (
            <Link to={`/rental/${r.id}`} className="dark-button" data-testid={`rent-node-${r.id}-button`}>View</Link>
          )}
        </div>
      </div>
    </article>
  );
}
