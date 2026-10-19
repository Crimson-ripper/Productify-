import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import SEO from "@/components/SEO";
import ProductCard from "@/components/ProductCard";

const CATS = ["all", "Software", "Design", "Development", "Creative"];

export default function Shop() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get("q") || "";
  const category = sp.get("category") || "all";
  const sort = sp.get("sort") || "recent";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localQ, setLocalQ] = useState(q);

  useEffect(() => {
    setLoading(true);
    api.get(`/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&sort=${sort}`)
      .then((r) => setRows(r.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [q, category, sort]);

  const set = (k, v) => {
    const n = new URLSearchParams(sp);
    if (v && v !== "all" && v !== "") n.set(k, v); else n.delete(k);
    setSp(n, { replace: true });
  };
  const onSearch = (e) => { e.preventDefault(); set("q", localQ); };

  return (
    <>
      <SEO
        title={`${category === "all" ? "All products" : category} — Productify`}
        description={`Digital products in ${category === "all" ? "every category" : category} from independent sellers on Productify.`}
        path="/shop"
      />
      <section className="page-hero">
        <div className="eyebrow">Shop</div>
        <h1>{category === "all" ? "All products" : category}</h1>
        <p>
          {loading ? "Software, templates and design files from independent sellers."
            : `${rows.length} product${rows.length === 1 ? "" : "s"}${q ? ` matching “${q}”` : ""}.`}
        </p>
      </section>

      <section className="shop-toolbar">
        <div className="cat-tabs">
          {CATS.map((c) => (
            <button
              key={c}
              className={category === c ? "cat-tab active" : "cat-tab"}
              onClick={() => set("category", c)}
              data-testid={`shop-cat-${c.toLowerCase()}-button`}
            >{c === "all" ? "All" : c}</button>
          ))}
        </div>
        <form className="shop-search" onSubmit={onSearch}>
          <Search size={16} />
          <input value={localQ} onChange={(e) => setLocalQ(e.target.value)} placeholder="Search products…" aria-label="Search products" data-testid="shop-search-input" />
        </form>
        <div className="sort-wrap">
          <SlidersHorizontal size={15} />
          <select value={sort} onChange={(e) => set("sort", e.target.value)} aria-label="Sort products" data-testid="shop-sort-select">
            <option value="recent">Most recent</option>
            <option value="price_asc">Price · low to high</option>
            <option value="price_desc">Price · high to low</option>
          </select>
        </div>
      </section>

      <section className="content-section">
        {loading ? (
          <div className="loading-block">Loading products…</div>
        ) : rows.length === 0 ? (
          <div className="empty-block">
            Nothing here yet{q ? ` for “${q}”` : ""}.{" "}
            {(q || category !== "all") && <button className="link-button" onClick={() => { setLocalQ(""); setSp({}, { replace: true }); }}>Clear filters</button>}
          </div>
        ) : (
          <div className="product-grid" data-testid="product-grid">
            {rows.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </section>
    </>
  );
}
