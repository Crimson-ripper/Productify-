import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Cpu, Layers3, LayoutDashboard, Code2, Clapperboard } from "lucide-react";
import { api, money } from "@/lib/api";
import SEO from "@/components/SEO";
import ProductCard from "@/components/ProductCard";
import RentalCard from "@/components/RentalCard";

const categories = [
  { name: "Software", icon: Layers3 },
  { name: "Design", icon: LayoutDashboard },
  { name: "Development", icon: Code2 },
  { name: "Creative", icon: Clapperboard },
];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [rentals, setRentals] = useState([]);
  useEffect(() => {
    api.get("/products").then((r) => setProducts(r.data)).catch(() => {});
    api.get("/rentals").then((r) => setRentals(r.data)).catch(() => {});
  }, []);

  // Feature the cheapest node that is online right now, else the cheapest listed one.
  const byPrice = [...rentals].sort((a, b) => a.price - b.price);
  const featured = byPrice.find((r) => r.is_online) || byPrice[0];
  const onlineCount = rentals.filter((r) => r.is_online).length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Productify",
    "url": "https://www.productifynow.com",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://www.productifynow.com/shop?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <SEO
        title="Productify — Digital marketplace & GPU rentals"
        description="Buy software, design assets and templates from independent sellers, or rent a GPU by the hour from someone who has one spare."
        path="/"
        jsonLd={jsonLd}
      />
      <section className="hero" data-testid="marketplace-hero">
        <div className="hero-copy">
          <div className="eyebrow">Productify · digital goods &amp; compute</div>
          <h1>Buy the tools.<br />Rent the <em>GPU.</em></h1>
          <p>
            Software, templates and design files from independent sellers — and hourly
            GPU time on machines people list from home or the studio.
          </p>
          <div className="hero-actions">
            <Link to="/shop" className="primary-button" data-testid="hero-shop-button">Browse the shop <ArrowRight size={17} /></Link>
            <Link to="/rentals" className="text-button" data-testid="hero-rentals-button">See GPU rentals <ArrowRight size={15} /></Link>
          </div>
          {(products.length > 0 || rentals.length > 0) && (
            <dl className="hero-counts">
              <div><dt>Products</dt><dd>{products.length}</dd></div>
              <div><dt>GPU listings</dt><dd>{rentals.length}</dd></div>
              {onlineCount > 0 && <div><dt>Online now</dt><dd>{onlineCount}</dd></div>}
            </dl>
          )}
        </div>
        {featured && (
          <div className="hero-art">
            <div className="hero-grid" />
            <Link to={`/rental/${featured.id}`} className="hero-card hero-card-main" data-testid="hero-featured-rental">
              <div className="hero-card-top">
                <span className={featured.is_online ? "live-dot" : "live-dot off"} />
                {featured.is_online ? "ONLINE NOW" : "LISTED"} · {featured.location || "Location not set"}
              </div>
              <div className="hero-gpu">{featured.gpu}</div>
              <div className="hero-spec"><span>{featured.vram}</span><span>{featured.owner}</span></div>
              <div className="hero-price">{money(featured.price)} <small>/ hr</small></div>
              <div className="hero-card-link">View this machine <ArrowRight size={13} /></div>
            </Link>
          </div>
        )}
      </section>

      <section className="category-strip" data-testid="category-strip">
        <div className="section-label">Shop by category</div>
        <div className="category-list">
          <Link to="/shop" className="category" data-testid="category-all-button">All products</Link>
          {categories.map(({ name, icon: Icon }) => (
            <Link key={name} to={`/shop?category=${encodeURIComponent(name)}`} className="category" data-testid={`category-${name.toLowerCase()}-button`}>
              <Icon size={16} />{name}
            </Link>
          ))}
          <Link to="/rentals" className="category" data-testid="category-gpu-link"><Cpu size={16} />GPU rental</Link>
        </div>
      </section>

      {products.length > 0 && (
        <section className="content-section" id="shop">
          <div className="section-heading">
            <div>
              <div className="eyebrow">New in the shop</div>
              <h2>Latest products</h2>
            </div>
            <Link to="/shop" className="text-button text-button-dark">All {products.length} products <ArrowRight size={15} /></Link>
          </div>
          <div className="product-grid" data-testid="product-grid">
            {products.slice(0, 4).map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}

      {rentals.length > 0 && (
        <section className="rental-section" id="rentals">
          <div className="section-heading rental-heading">
            <div>
              <div className="eyebrow green">Compute</div>
              <h2>GPUs you can rent</h2>
            </div>
            <p>Priced per hour by the owner. Pick a machine, launch a container, stop when you're done.</p>
            <Link className="text-button green-text" to="/rentals">All GPU listings <ArrowRight size={15} /></Link>
          </div>
          <div className="rental-grid">
            {byPrice.slice(0, 2).map((r) => <RentalCard key={r.id} r={r} />)}
          </div>
        </section>
      )}

      <section className="how-band" aria-label="How Productify works">
        <div>
          <span className="how-num">1</span>
          <b>Buy a product</b>
          <p>Check out once; the purchase is listed under Orders in your account.</p>
        </div>
        <div>
          <span className="how-num">2</span>
          <b>Rent a GPU</b>
          <p>Reserve a machine, run your container on it, and pay for the hours you use.</p>
        </div>
        <div>
          <span className="how-num">3</span>
          <b>Something wrong?</b>
          <p>Report a listing from its page, or see the <Link to="/legal/refunds">refund policy</Link>.</p>
        </div>
      </section>

      <section className="sell-section" id="sell">
        <div className="sell-copy">
          <div className="eyebrow">Selling</div>
          <h2>Have something to sell, or a GPU sitting idle?</h2>
          <p>List digital products, or connect your own machine with the Productify Node app and rent it out by the hour. Opening a seller account is free.</p>
          <Link className="primary-button" to="/sell" data-testid="start-selling-button">How selling works <ArrowRight size={17} /></Link>
        </div>
      </section>
    </>
  );
}
