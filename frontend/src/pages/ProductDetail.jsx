import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, ShieldCheck, Tag } from "lucide-react";
import { api, money } from "@/lib/api";
import { useCart } from "@/contexts/CartContext";
import SEO from "@/components/SEO";
import ReportButton from "@/components/ReportButton";
import { toast } from "sonner";

export default function ProductDetail() {
  const { id } = useParams();
  const { add } = useCart();
  const [p, setP] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    api.get(`/products/${id}`).then((r) => setP(r.data)).catch(() => setP(null)).finally(() => setLoading(false));
  }, [id]);
  if (loading) return <div className="loading-block">Loading…</div>;
  if (!p) return <div className="empty-block">Product not found. <Link to="/shop">Back to shop</Link></div>;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": p.title,
    "description": p.description,
    "image": p.image,
    "brand": { "@type": "Brand", "name": p.seller },
    "offers": { "@type": "Offer", "price": p.price, "priceCurrency": "USD", "availability": "https://schema.org/InStock" },
  };
  return (
    <>
      <SEO title={`${p.title} — Productify`} description={p.description} path={`/product/${p.id}`} image={p.image} type="product" jsonLd={jsonLd} />
      <section className="detail-page" data-testid={`product-detail-${p.id}`}>
        <div className="detail-image"><img src={p.image} alt={p.title} /></div>
        <div className="detail-info">
          <div className="crumb"><Link to="/shop">Shop</Link> · <Link to={`/shop?category=${p.category}`}>{p.category}</Link></div>
          <h1>{p.title}</h1>
          <div className="detail-seller">by <b>{p.seller}</b> · <span className="verified-pill"><ShieldCheck size={13} /> Verified</span></div>
          <div className="detail-price">{money(p.price)}</div>
          <p className="detail-desc">{p.description}</p>
          {p.tags?.length > 0 && (
            <div className="tag-row">{p.tags.map((t) => <span className="tag" key={t}><Tag size={11} /> {t}</span>)}</div>
          )}
          <div className="detail-actions">
            <button className="primary-button" onClick={() => { add(p, "product"); toast.success("Added to bag"); }} data-testid="detail-add-button">Add to bag <ArrowRight size={16} /></button>
            <Link to="/cart" className="text-button text-button-dark">Go to bag <ArrowRight size={14} /></Link>
            <ReportButton listingId={p.id} listingKind="product" />
          </div>
          <div className="detail-features">
            <div><ShieldCheck size={16} /><span><b>Instant download</b><small>Delivered to your account</small></span></div>
            <div><ShieldCheck size={16} /><span><b>Verified seller</b><small>Reviewed by our team</small></span></div>
            <div><ShieldCheck size={16} /><span><b>30-day refund</b><small>No questions asked</small></span></div>
          </div>
        </div>
      </section>
    </>
  );
}
