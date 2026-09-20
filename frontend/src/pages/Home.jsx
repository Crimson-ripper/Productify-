import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Zap, Cpu, Layers3, LayoutDashboard, Download } from "lucide-react";
import { api } from "@/lib/api";
import SEO from "@/components/SEO";
import ProductCard from "@/components/ProductCard";
import RentalCard from "@/components/RentalCard";

const categories = [
  { name: "Software", icon: Layers3 },
  { name: "Design", icon: LayoutDashboard },
  { name: "Development", icon: Zap },
  { name: "Creative", icon: Download },
];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [rentals, setRentals] = useState([]);
  useEffect(() => {
    api.get("/products").then((r) => setProducts(r.data.slice(0, 4))).catch(() => {});
    api.get("/rentals").then((r) => setRentals(r.data.slice(0, 2))).catch(() => {});
  }, []);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Productify",
    "url": "https://productifynow.com",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://productifynow.com/shop?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };
  return (
    <>
      <SEO
        title="Productify — Digital marketplace & GPU rentals"
        description="Buy software, design assets and templates. Rent verified GPU nodes by the hour. Productify is the marketplace for people building tomorrow."
        path="/"
        jsonLd={jsonLd}
      />
      <section className="hero" data-testid="marketplace-hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> THE DIGITAL GOODS MARKETPLACE</div>
          <h1>Good tools make<br /><em>great work.</em></h1>
          <p>Discover software, creative assets, and compute power from people building the future.</p>
          <div className="hero-actions">
            <Link to="/shop" className="primary-button" data-testid="hero-shop-button">Explore the marketplace <ArrowRight size={17} /></Link>
            <Link to="/rentals" className="text-button" data-testid="hero-rentals-button">Find compute <ArrowRight size={15} /></Link>
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-grid" />
          <div className="hero-card hero-card-main">
            <div className="hero-card-top"><span className="live-dot" /> LIVE NODE</div>
            <div className="hero-gpu">RTX <strong>4090</strong></div>
            <div className="hero-spec"><span>24 GB VRAM</span><span>98% uptime</span></div>
            <div className="hero-price">$0.62 <small>/ hr</small></div>
          </div>
          <div className="floating-chip chip-one"><ShieldCheck size={16} /><span><b>Verified</b><small>every seller</small></span></div>
          <div className="floating-chip chip-two"><span className="mini-avatar">NS</span><span><b>Northstar Studio</b><small>just launched</small></span></div>
        </div>
      </section>

      <section className="category-strip" data-testid="category-strip">
        <div className="section-label">Browse by need</div>
        <div className="category-list">
          <Link to="/shop" className="category" data-testid="category-all-button"><span className="category-icon">✦</span> All products</Link>
          {categories.map(({ name, icon: Icon }) => (
            <Link key={name} to={`/shop?category=${encodeURIComponent(name)}`} className="category" data-testid={`category-${name.toLowerCase()}-button`}>
              <Icon size={18} />{name}
            </Link>
          ))}
          <Link to="/rentals" className="category" data-testid="category-gpu-link"><Cpu size={18} />GPU rental</Link>
        </div>
      </section>

      <section className="content-section" id="shop">
        <div className="section-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> CURATED FOR YOU</div>
            <h2>Tools worth<br /><em>keeping.</em></h2>
          </div>
          <Link to="/shop" className="text-button text-button-dark">Browse all products <ArrowRight size={15} /></Link>
        </div>
        <div className="product-grid" data-testid="product-grid">
          {products.map((p, i) => <ProductCard key={p.id} p={p} badge={i === 0 ? "Bestseller" : "Digital download"} />)}
        </div>
      </section>

      <section className="rental-section" id="rentals">
        <div className="section-heading rental-heading">
          <div>
            <div className="eyebrow green"><span className="eyebrow-line" /> RENT COMPUTE</div>
            <h2>Power when<br /><em>you need it.</em></h2>
          </div>
          <p>Skip the wait. Rent verified GPU nodes by the hour and ship your next experiment today.</p>
          <Link className="text-button green-text" to="/sell" data-testid="list-node-link">List your node <ArrowRight size={15} /></Link>
        </div>
        <div className="rental-grid">
          {rentals.map((r) => <RentalCard key={r.id} r={r} />)}
        </div>
      </section>

      <section className="trust-band">
        <div><ShieldCheck size={23} /><span><b>Every seller is verified</b><small>Shop with confidence, always.</small></span></div>
        <div><Zap size={23} /><span><b>Instant digital delivery</b><small>Get to work in seconds.</small></span></div>
        <div><Cpu size={23} /><span><b>Global compute network</b><small>Rent GPUs in 20+ regions.</small></span></div>
      </section>

      <section className="sell-section" id="sell">
        <div className="sell-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> FOR BUILDERS</div>
          <h2>Your work<br /><em>belongs here.</em></h2>
          <p>Turn your best tools, templates, and spare compute into income. Join a marketplace made for people who make things.</p>
          <Link className="primary-button" to="/sell" data-testid="start-selling-button">Start selling <ArrowRight size={17} /></Link>
        </div>
        <div className="sell-stat">
          <span>02</span>
          <div><b>ways to earn</b><small>Digital goods + compute</small></div>
        </div>
      </section>
    </>
  );
}
