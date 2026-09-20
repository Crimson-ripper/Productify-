import { Link } from "react-router-dom";
import { ArrowRight, Cpu, ShieldCheck } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { money } from "@/lib/api";
import { toast } from "sonner";

export default function RentalCard({ r }) {
  const { add } = useCart();
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
          <button
            onClick={() => { add(r, "rental"); toast.success(`${r.title} added to bag`); }}
            className="dark-button"
            data-testid={`rent-node-${r.id}-button`}
          >Rent node <ArrowRight size={15} /></button>
        </div>
      </div>
    </article>
  );
}
