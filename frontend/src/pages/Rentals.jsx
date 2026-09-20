import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import SEO from "@/components/SEO";
import RentalCard from "@/components/RentalCard";

export default function Rentals() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get("q") || "";
  const sort = sp.get("sort") || "recent";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localQ, setLocalQ] = useState(q);

  useEffect(() => {
    setLoading(true);
    api.get(`/rentals?q=${encodeURIComponent(q)}&sort=${sort}`)
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, [q, sort]);

  const set = (k, v) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    setSp(n, { replace: true });
  };

  return (
    <>
      <SEO
        title="GPU rentals — RTX 4090, A100 & more · Productify"
        description="Rent verified GPU nodes by the hour. RTX 4090, A100, RTX 3090 and more from vetted providers worldwide. Instant provisioning."
        path="/rentals"
      />
      <section className="page-hero rental-hero">
        <div className="eyebrow green"><span className="eyebrow-line" /> RENT COMPUTE</div>
        <h1>Every GPU,<br /><em>every hour.</em></h1>
        <p>Verified nodes. Transparent pricing. Instant access.</p>
      </section>

      <section className="shop-toolbar">
        <form className="shop-search" onSubmit={(e) => { e.preventDefault(); set("q", localQ); }}>
          <Search size={16} />
          <input value={localQ} onChange={(e) => setLocalQ(e.target.value)} placeholder="Search GPU, region…" data-testid="rentals-search-input" />
        </form>
        <div className="sort-wrap">
          <SlidersHorizontal size={15} />
          <select value={sort} onChange={(e) => set("sort", e.target.value)} data-testid="rentals-sort-select">
            <option value="recent">Most recent</option>
            <option value="price_asc">Price · low to high</option>
            <option value="price_desc">Price · high to low</option>
          </select>
        </div>
      </section>

      <section className="rental-section">
        {loading ? (
          <div className="loading-block">Loading nodes…</div>
        ) : rows.length === 0 ? (
          <div className="empty-block">No nodes match your search.</div>
        ) : (
          <div className="rental-grid">
            {rows.map((r) => <RentalCard key={r.id} r={r} />)}
          </div>
        )}
      </section>
    </>
  );
}
