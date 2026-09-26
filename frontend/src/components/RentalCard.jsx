import { Link } from "react-router-dom";
import { ArrowRight, Cpu, ShieldCheck, Zap } from "lucide-react";
import { money } from "@/lib/api";

export default function RentalCard({ r }) {
  return (
    <article className="rental-card" data-testid={`rental-card-${r.id}`}>
      <Link to={`/rental/${r.id}`}><img src={r.image} alt={r.title} loading="lazy" /></Link>
      <div className="rental-info">
        <div className="verified"><ShieldCheck size={15} /> Verified node</div>
        <h3><Link to={`/rental/${r.id}`}>{r.title}</Link></h3>
        <div className="spec-row">
          <span><Cpu size={15} />{r.gpu}</span>
          <span>{r.vram}</span>
          <span>{r.location}</span>
        </div>
        <div className="rental-bottom">
          <strong>{money(r.price)} <small>/ hour</small></strong>
          <Link
            to={`/rentals/reserve/${r.id}`}
            className="dark-button"
            data-testid={`rent-node-${r.id}-button`}
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Zap size={14} /> Reserve & Launch <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
}
