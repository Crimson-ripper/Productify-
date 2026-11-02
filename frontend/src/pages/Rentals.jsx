import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import SEO from "@/components/SEO";
import RentalCard from "@/components/RentalCard";
import { availabilityOf } from "@/components/Availability";

const REFRESH_MS = 30_000;
const STATUS_ORDER = { available: 0, in_use: 1, paused: 2, offline: 3 };

const vramGb = (r) => {
  const m = String(r.vram || "").match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
};
const shortGpu = (g) => String(g || "").replace(/^NVIDIA\s+/i, "").replace(/^GeForce\s+/i, "").trim();

export default function Rentals() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get("q") || "";
  const sort = sp.get("sort") || "available";
  const availableOnly = sp.get("available") === "1";
  const gpu = sp.get("gpu") || "";
  const minVram = Number(sp.get("vram") || 0);
  const place = sp.get("loc") || "";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState(null);
  const [localQ, setLocalQ] = useState(q);
  const timer = useRef(null);

  const load = useCallback((quiet) => {
    if (!quiet) setLoading(true);
    const apiSort = sort === "available" ? "recent" : sort;
    return api.get(`/rentals?q=${encodeURIComponent(q)}&sort=${apiSort}`)
      .then((r) => { setRows(r.data); setUpdated(new Date()); })
      .catch(() => { if (!quiet) setRows([]); })
      .finally(() => { if (!quiet) setLoading(false); });
  }, [q, sort]);

  // Live: refresh every 30 s while the tab is visible, and straight away when it becomes visible again.
  useEffect(() => {
    load(false);
    const tick = () => { if (document.visibilityState === "visible") load(true); };
    timer.current = setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer.current); document.removeEventListener("visibilitychange", tick); };
  }, [load]);

  const set = (k, v) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    setSp(n, { replace: true });
  };

  const gpus = useMemo(() => [...new Set(rows.map((r) => shortGpu(r.gpu)).filter(Boolean))].sort(), [rows]);
  const places = useMemo(() => [...new Set(rows.map((r) => (r.location || "").trim()).filter(Boolean))].sort(), [rows]);
  const availableCount = rows.filter((r) => availabilityOf(r) === "available").length;

  const shown = useMemo(() => {
    let list = rows.filter((r) =>
      (!availableOnly || availabilityOf(r) === "available") &&
      (!gpu || shortGpu(r.gpu) === gpu) &&
      (!minVram || vramGb(r) >= minVram) &&
      (!place || (r.location || "").trim() === place));
    if (sort === "available") {
      list = [...list].sort((a, b) => (STATUS_ORDER[availabilityOf(a)] ?? 9) - (STATUS_ORDER[availabilityOf(b)] ?? 9));
    }
    return list;
  }, [rows, availableOnly, gpu, minVram, place, sort]);

  const filtered = availableOnly || gpu || minVram || place;

  return (
    <>
      <SEO
        title="GPU rentals — Productify"
        description="Rent a GPU by the hour from people who list their own machines on Productify. Live availability, specs and hourly prices."
        path="/rentals"
      />
      <section className="page-hero rental-hero">
        <div className="eyebrow">GPU rentals · live</div>
        <h1>Rent a GPU by the hour</h1>
        <p aria-live="polite">
          {loading ? "Checking which machines are available…"
            : availableCount > 0
              ? <><b className="rx-live-count">{availableCount} GPU{availableCount === 1 ? "" : "s"} available now</b> · {rows.length} listed</>
              : `No GPUs are available right now · ${rows.length} listed. This page updates by itself.`}
        </p>
      </section>

      <section className="shop-toolbar rx-toolbar">
        <form className="shop-search" onSubmit={(e) => { e.preventDefault(); set("q", localQ); }}>
          <Search size={16} />
          <input value={localQ} onChange={(e) => setLocalQ(e.target.value)} placeholder="GPU model or location" aria-label="Search GPU rentals" data-testid="rentals-search-input" />
        </form>
        <label className="check-toggle">
          <input type="checkbox" checked={availableOnly} onChange={(e) => set("available", e.target.checked ? "1" : "")} data-testid="rentals-available-toggle" />
          Available now
        </label>
        <select value={gpu} onChange={(e) => set("gpu", e.target.value)} aria-label="GPU model" data-testid="rentals-gpu-select">
          <option value="">Any GPU</option>
          {gpus.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={minVram || ""} onChange={(e) => set("vram", e.target.value)} aria-label="Minimum VRAM" data-testid="rentals-vram-select">
          <option value="">Any VRAM</option>
          {[6, 8, 12, 16, 24, 48].map((v) => <option key={v} value={v}>{v} GB or more</option>)}
        </select>
        {places.length > 1 && (
          <select value={place} onChange={(e) => set("loc", e.target.value)} aria-label="Location" data-testid="rentals-location-select">
            <option value="">Any location</option>
            {places.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <div className="sort-wrap">
          <SlidersHorizontal size={15} />
          <select value={sort} onChange={(e) => set("sort", e.target.value)} aria-label="Sort" data-testid="rentals-sort-select">
            <option value="available">Available first</option>
            <option value="recent">Newest</option>
            <option value="price_asc">Price, low to high</option>
            <option value="price_desc">Price, high to low</option>
          </select>
        </div>
        {updated && (
          <button type="button" className="rx-refresh" onClick={() => load(true)} title="Refresh now">
            <RefreshCw size={14} aria-hidden="true" /> Updated {updated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </button>
        )}
      </section>

      <section className="rental-section">
        {loading ? (
          <div className="loading-block">Loading machines…</div>
        ) : shown.length === 0 ? (
          <div className="empty-block">
            {filtered && rows.length > 0
              ? <>No machines match those filters right now. <button type="button" className="rx-link" onClick={() => setSp(new URLSearchParams(), { replace: true })}>Clear filters</button></>
              : "No machines match that search."}
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
