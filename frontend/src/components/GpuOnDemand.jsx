import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cpu } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_TEMPLATES } from "@/lib/templates";

// Partner GPUs get rented by others within minutes, so renters pick a class and a price cap and
// we rent the best matching machine. The actual price is shown once the machine is ready.
const ENVIRONMENTS = [{ id: "jupyterlab", name: "JupyterLab (PyTorch)" }, ...DEFAULT_TEMPLATES];
const money = (n) => `$${Number(n).toFixed(2)}`;
const guessCountry = () => {
  const m = (navigator.language || "").match(/-([A-Za-z]{2})$/);
  return m ? m[1].toUpperCase() : "";
};

// cls: a class card. machine: a machine picked from the nearby list (tried first; class from the machine).
export function OrderForm({ cls, machine, onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth() || {};
  const [templateId, setTemplateId] = useState(ENVIRONMENTS[0].id);
  const [near, setNear] = useState(true);
  const [country, setCountry] = useState(guessCountry());
  const [cap, setCap] = useState(String(machine ? machine.price_high : cls.high ?? cls.typical ?? ""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!user) { navigate("/login"); return; }
    const max = Number(cap);
    if (!(max > 0)) { setErr("Enter a price cap."); return; }
    setBusy(true); setErr("");
    try {
      const res = await api.post("/instances/order", {
        class_id: machine ? machine.class_id : cls.id, template_id: templateId, near: !machine && near,
        country: !machine && near ? country.slice(0, 2) : "", max_price: max, preferred_offer: machine?.offer_id,
      });
      navigate(`/instances/${res.data.id}`);
    } catch (ex) {
      setErr(ex?.response?.data?.detail || "Couldn't place the order. Try again.");
      setBusy(false);
    }
  };

  return (
    <form className="od-form" onSubmit={submit} aria-label={`Order a ${machine ? machine.gpu : cls.name} GPU`}>
      <label>Environment
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          {ENVIRONMENTS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      {!machine && <label>Region
        <select value={near ? "near" : "any"} onChange={(e) => setNear(e.target.value === "near")}>
          <option value="near">Near me (lower latency)</option>
          <option value="any">Anywhere (cheapest)</option>
        </select>
      </label>}
      {!machine && near && (
        <label>Your country code
          <input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} placeholder="e.g. IN" />
        </label>
      )}
      <label>Most you'll pay per hour (USD)
        <input type="number" min="0.01" step="0.01" value={cap} onChange={(e) => setCap(e.target.value)} required />
      </label>
      <p className="od-note">
        We rent the best machine at or under your cap and set it up for you, usually in 2–5 minutes.
        You see the exact price when it's ready, and billing starts only then. If nothing starts within
        10 minutes, the order is cancelled and you aren't charged.
      </p>
      {err && <p className="od-err" role="alert">{err}</p>}
      <div className="od-actions">
        <button type="submit" className="primary-button" disabled={busy}>{busy ? "Ordering…" : user ? "Find my GPU" : "Log in to order"}</button>
        <button type="button" className="rx-link" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

export default function GpuOnDemand() {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState("");

  useEffect(() => {
    const load = () => api.get("/partners/classes").then((r) => setData(r.data)).catch(() => {});
    load();  // once per visit: the list searches only when someone arrives
  }, []);

  if (!data?.enabled) return null;
  return (
    <section className="rental-section od-section" aria-labelledby="od-title">
      <h2 id="od-title"><Cpu size={18} aria-hidden="true" /> GPU on demand <span className="od-beta">Beta</span></h2>
      <p className="od-lead">Pick a class and the most you'll pay per hour. We find a partner machine and set it up for you.</p>
      <div className="od-grid">
        {data.classes.map((c) => (
          <div key={c.id} className="od-card">
            <h3>{c.name} <span>{c.vram}</span></h3>
            <p className="od-ex">{c.examples}</p>
            <p className="od-for">{c.for}</p>
            {c.available > 0 ? (
              <>
                <p className="od-price">about {money(c.typical)}/h <span>range {money(c.low)}–{money(c.high)}</span></p>
                {open === c.id
                  ? <OrderForm cls={c} onClose={() => setOpen("")} />
                  : <button type="button" className="primary-button" onClick={() => setOpen(c.id)}>Order</button>}
              </>
            ) : <p className="od-none">None available right now.</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
