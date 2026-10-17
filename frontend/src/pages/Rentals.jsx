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
  const onlineOnly = sp.get("online") === "1";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localQ, setLocalQ] = useState(q);

  useEffect(() => {
    setLoading(true);
    api.get(`/rentals?q=${encodeURIComponent(q)}&sort=${sort}`)
      .then((r) => setRows(r.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [q, sort]);

  const set = (k, v) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    setSp(n, { replace: true });
  };

  const shown = onlineOnly ? rows.filter((r) => r.is_online) : rows;
  const online = rows.filter((r) => r.is_online).length;

  return (
    <>
      <SEO
        title="GPU rentals — Productify"
        description="Rent a GPU by the hour from people who list their own machines on Productify. See what is online, the specs, and the hourly price."
        path="/rentals"
      />
      <section className="page-hero rental-hero">
        <div className="eyebrow">GPU rentals</div>
        <h1>Rent a GPU by the hour</h1>
        <p>
          {loading ? "Machines listed by their owners, priced per hour."
            : `${rows.length} machine${rows.length === 1 ? "" : "s"} listed, ${online} online right now.`}
        </p>
      </section>

      <section className="shop-toolbar">
        <form className="shop-search" onSubmit={(e) => { e.preventDefault(); set("q", localQ); }}>
          <Search size={16} />
          <input value={localQ} onChange={(e) => setLocalQ(e.target.value)} placeholder="GPU model or location" aria-label="Search GPU rentals" data-testid="rentals-search-input" />
        </form>
        <label className="check-toggle">
          <input type="checkbox" checked={onlineOnly} onChange={(e) => set("online", e.target.checked ? "1" : "")} data-testid="rentals-online-toggle" />
          Online now
        </label>
        <div className="sort-wrap">
          <SlidersHorizontal size={15} />
          <select value={sort} onChange={(e) => set("sort", e.target.value)} aria-label="Sort" data-testid="rentals-sort-select">
            <option value="recent">Newest</option>
            <option value="price_asc">Price, low to high</option>
            <option value="price_desc">Price, high to low</option>
          </select>
        </div>
      </section>

      <section className="rental-section">
        {loading ? (
          <div className="loading-block">Loading machines…</div>
        ) : shown.length === 0 ? (
          <div className="empty-block">
            {onlineOnly && rows.length > 0 ? "None of the listed machines are online right now." : "No machines match that search."}
          </div>
        ) : (
          <div className="rental-grid">
            {shown.map((r) => <RentalCard key={r.id} r={r} />)}
          </div>
        )}
      </section>
    </>
  );
}
