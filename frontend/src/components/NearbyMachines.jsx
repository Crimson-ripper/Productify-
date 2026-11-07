import { useCallback, useEffect, useState } from "react";
import { MapPin, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { OrderForm } from "@/components/GpuOnDemand";

// Partner machines in the visitor's country. The list is searched only when someone arrives or clicks
// Refresh, and a region's list is shared for 2 minutes. Prices are a range; the exact price is set at rent.
const CLICK_GAP_S = 20;
const money = (n) => `$${Number(n).toFixed(2)}`;
const names = typeof Intl !== "undefined" && Intl.DisplayNames ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
const countryName = (c) => { try { return names?.of(c) || c; } catch { return c; } };
const guessCountry = () => {
  const m = (navigator.language || "").match(/-([A-Za-z]{2})$/);
  return m ? m[1].toUpperCase() : "";
};

export default function NearbyMachines() {
  const [data, setData] = useState(null);
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(true);
  const [wait, setWait] = useState(0);
  const [open, setOpen] = useState(null);

  const load = useCallback((code, refresh) => {
    setLoading(true);
    const q = new URLSearchParams();
    const want = code || guessCountry();
    if (code) q.set("country", code);
    else if (want) q.set("country_hint", want);
    if (refresh) q.set("refresh", "1");
    return api.get(`/partners/nearby?${q}`)
      .then((r) => { setData(r.data); if (r.data.country) setCountry(r.data.country); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load("", false); }, [load]);  // once per visit

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const refresh = () => { setWait(CLICK_GAP_S); load(country, true); };

  if (!data?.enabled) return null;
  const machines = data.machines || [];
  return (
    <section className="rental-section od-section" aria-labelledby="nb-title">
      <div className="nb-head">
        <h2 id="nb-title"><MapPin size={18} aria-hidden="true" /> Machines near you <span className="od-beta">Beta</span></h2>
        <label className="sr-only" htmlFor="nb-country">Country</label>
        <select id="nb-country" value={country} onChange={(e) => { setOpen(null); load(e.target.value, false); }}>
          {(data.countries || []).map((c) => <option key={c} value={c}>{countryName(c)}</option>)}
        </select>
        <button type="button" className="rx-refresh" onClick={refresh} disabled={wait > 0 || loading} title="Refresh the list">
          <RefreshCw size={14} aria-hidden="true" /> {wait > 0 ? `Refresh in ${wait}s` : "Refresh"}
        </button>
      </div>
      <p className="nb-note" aria-live="polite">
        {loading ? "Checking machines…"
          : data.fallback?.length ? `No machines in ${countryName(data.country)} right now, so these are in nearby countries. Expect higher latency.`
            : data.paused ? "Showing the last list we have; new searches are paused for now."
              : `Prices are a range; you see the exact price when your machine is ready.${data.age_s != null ? ` List checked ${Math.round(data.age_s / 60)} min ago.` : ""}`}
      </p>
      {!loading && machines.length === 0 && <p className="od-none">No machines available here right now. Try another country, or order by class below.</p>}
      <div className="od-grid">
        {machines.map((m) => (
          <div key={m.offer_id} className="od-card">
            {m.tag && <span className="nb-tag">{m.tag}</span>}
            <h3>{m.gpu} <span>{m.vram}</span></h3>
            <p className="od-ex">{m.location}</p>
            <p className="od-price">about {money(m.price_low)}–{money(m.price_high)}/h</p>
            {open === m.offer_id
              ? <OrderForm machine={m} onClose={() => setOpen(null)} />
              : <button type="button" className="primary-button" onClick={() => setOpen(m.offer_id)}>Rent</button>}
          </div>
        ))}
      </div>
    </section>
  );
}
