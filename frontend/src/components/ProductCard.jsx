import { Link } from "react-router-dom";
import { money } from "@/lib/api";
import { PLACEHOLDER_IMG, imgFallback } from "@/lib/image";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";

export default function ProductCard({ p }) {
  const { add } = useCart();
  return (
    <article className="product-card" data-testid={`product-card-${p.id}`}>
      <Link to={`/product/${p.id}`} className="product-image">
        <img src={p.image || PLACEHOLDER_IMG} alt={p.title} loading="lazy" onError={imgFallback} />
        {p.category && <span className="product-badge">{p.category}</span>}
      </Link>
      <button
        className="quick-add"
        onClick={() => { add(p, "product"); toast.success(`${p.title} added to bag`); }}
        data-testid={`add-product-${p.id}-button`}
      >Add to bag</button>
      <div className="product-meta">
        <div>
          <h3><Link to={`/product/${p.id}`}>{p.title}</Link></h3>
          <p>{p.seller}</p>
        </div>
        <strong>{money(p.price)}</strong>
      </div>
    </article>
  );
}
