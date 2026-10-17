import { Link } from "react-router-dom";
import { ArrowRight, Cpu, MapPin } from "lucide-react";
import { money } from "@/lib/api";
import { PLACEHOLDER_IMG, imgFallback } from "@/lib/image";

export default function RentalCard({ r }) {
  return (
    <article className="rental-card" data-testid={`rental-card-${r.id}`}>
      <Link to={`/rental/${r.id}`}><img src={r.image || PLACEHOLDER_IMG} alt={r.title} loading="lazy" onError={imgFallback} /></Link>
      <div className="rental-info">
        <div className={r.is_online ? "node-status online" : "node-status"}>
          <span className={r.is_online ? "live-dot" : "live-dot off"} />
          {r.is_online ? "Online now" : "Offline"}
          {r.is_verified && <span className="node-verified">· Hardware checked</span>}
        </div>
        <h3><Link to={`/rental/${r.id}`}>{r.title}</Link></h3>
        <div className="spec-row">
          <span><Cpu size={14} />{r.gpu}</span>
          <span>{r.vram}</span>
          {r.location && <span><MapPin size={13} />{r.location}</span>}
        </div>
        <div className="rental-bottom">
          <strong>{money(r.price)} <small>/ hour</small></strong>
          <Link to={`/rentals/reserve/${r.id}`} className="dark-button" data-testid={`rent-node-${r.id}-button`}>
            Reserve <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
}
