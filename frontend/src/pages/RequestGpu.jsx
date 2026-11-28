import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { api, getErrorMessage } from "@/lib/api";
import { ctaProps } from "@/lib/analytics";
import "./RequestGpu.css";

// Advance GPU requests (2026-11-28): supply is limited, so renters ask at least 12 hours ahead,
// we arrange the machine, they're reminded the way they chose, then they pay and get access.
const CHANNELS = [
  { k: "email", t: "Email" },
  { k: "site", t: "On this site" },
  { k: "whatsapp", t: "WhatsApp" },
  { k: "sms", t: "SMS" },
];
const rupees = (n) => "₹" + Number(n).toLocaleString("en-IN");
const fmtWhen = (iso) => new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const toLocalInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function RequestGpu() {
  const [params] = useSearchParams();
  const [opt, setOpt] = useState(null);
  const [rows, setRows] = useState([]);
  const [gpu, setGpu] = useState(params.get("gpu") || "");
  const [start, setStart] = useState(() => toLocalInput(new Date(Date.now() + 24 * 3600e3)));
  const [hours, setHours] = useState(4);
  const [mode, setMode] = useState("ahead"); // "ahead" (12h+, Rs 70/h) | "soon" (1h+, Rs 100/h)
  const [notify, setNotify] = useState(["email", "site"]);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows((await api.get("/gpu-requests/mine")).data);
    } catch (e) {
      toast.error(getErrorMessage(e, "Couldn't load your requests"));
    }
  }, []);

  useEffect(() => {
    api.get("/gpu-requests/options").then((r) => {
      setOpt(r.data);
      setGpu((g) => (r.data.gpus.includes(g) ? g : r.data.gpus[0]));
    }).catch(() => setErr("Couldn't load GPU options. Please refresh the page."));
    load();
  }, [load]);

  // Opening the page counts as seeing the on-site reminders.
  useEffect(() => {
    if (rows.some((r) => r.unread)) api.post("/gpu-requests/mine/seen").catch(() => {});
  }, [rows]);

  const lead = mode === "ahead" ? (opt?.lead_hours || 12) : (opt?.urgent_lead_hours || 1);
  const minStart = useMemo(() => toLocalInput(new Date(Date.now() + lead * 3600e3 + 5 * 60e3)), [lead]);
  const rate = mode === "ahead" ? (opt?.hourly_rate || 70) : (opt?.urgent_rate || 100);
  const minH = mode === "ahead" ? (opt?.min_hours || 4) : (opt?.urgent_min_hours || 1);
  const price = hours * rate;
  const pickMode = (m) => {
    setMode(m);
    const l = m === "ahead" ? (opt?.lead_hours || 12) : (opt?.urgent_lead_hours || 1);
    setStart(toLocalInput(new Date(Date.now() + (m === "ahead" ? 24 : l + 0.25) * 3600e3)));
    const mh = m === "ahead" ? (opt?.min_hours || 4) : (opt?.urgent_min_hours || 1);
    setHours((h) => Math.max(h, mh));
  };
  // A short-notice start picked 12+ hours ahead is really an advance booking, and the reverse.
  const startLead = (new Date(start) - Date.now()) / 3600e3;
  const needsPhone = notify.includes("whatsapp") || notify.includes("sms");
  const hourChoices = Array.from({ length: 25 - minH }, (_, i) => minH + i);

  const toggle = (k) => setNotify((n) => (n.includes(k) ? n.filter((x) => x !== k) : [...n, k]));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!notify.length) return setErr("Choose at least one way for us to remind you.");
    if (startLead < lead) return setErr(`Please pick a start time at least ${lead} hour${lead === 1 ? "" : "s"} from now.`);
    if (mode === "soon" && startLead >= (opt?.lead_hours || 12)) return setErr(`That's ${opt?.lead_hours || 12}+ hours away, so choose "Book ahead" for the lower price.`);
    setBusy(true);
    try {
      await api.post("/gpu-requests", { gpu, start_at: new Date(start).toISOString(), hours, notify, phone, notes });
      toast.success("Request sent. We'll remind you when your GPU is arranged.");
      setNotes("");
      load();
    } catch (e2) {
      setErr(getErrorMessage(e2, "Couldn't send your request"));
    } finally {
      setBusy(false);
    }
  };

  const act = async (id, action, done) => {
    try {
      await api.post(`/gpu-requests/${id}/${action}`);
      toast.success(done);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "That didn't work"));
    }
  };

  return (
    <>
      <SEO title="Request a GPU — Productify" description="Request a GPU at least 12 hours ahead. We arrange it, remind you when it's ready, and you pay only once it's arranged." path="/request-gpu" />

      <section className="lp-section rq">
        <h1 className="rq-h1">Request a GPU</h1>
        <p className="rq-lede">Pick your GPU and time, and we'll have it set up for you. Book at least {opt?.lead_hours || 12} hours ahead for ₹{opt?.hourly_rate || 70}/hour, or ask at short notice for ₹{opt?.urgent_rate || 100}/hour. We'll remind you when it's ready, and you pay only then.</p>

        <div className="rq-grid">
          <form className="rq-form" onSubmit={submit} noValidate>
            <fieldset className="rq-field">
              <legend>When do you need it?</legend>
              <div className="rq-modes">
                <button type="button" className="rq-mode" aria-pressed={mode === "ahead"} onClick={() => pickMode("ahead")}>
                  <b>Book ahead</b><span>{opt?.lead_hours || 12}+ hours from now</span><em>₹{opt?.hourly_rate || 70}/hour · {opt?.min_hours || 4} h minimum</em>
                </button>
                <button type="button" className="rq-mode" aria-pressed={mode === "soon"} onClick={() => pickMode("soon")}>
                  <b>Short notice</b><span>From {opt?.urgent_lead_hours || 1} hour from now</span><em>₹{opt?.urgent_rate || 100}/hour · {opt?.urgent_min_hours || 1} h minimum</em>
                </button>
              </div>
              {mode === "soon" && <span className="rq-hint">Short-notice GPUs depend on what our partner has free. If we can't get one in time, we'll offer you another time.</span>}
            </fieldset>
            <div className="rq-field">
              <label htmlFor="rq-gpu">GPU</label>
              <select id="rq-gpu" value={gpu} onChange={(e) => setGpu(e.target.value)}>
                {(opt?.gpus || []).map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="rq-row">
              <div className="rq-field">
                <label htmlFor="rq-start">Start date and time</label>
                <input id="rq-start" type="datetime-local" min={minStart} value={start} onChange={(e) => setStart(e.target.value)} />
                <span className="rq-hint">At least {lead} hour{lead === 1 ? "" : "s"} from now. Your local time.</span>
              </div>
              <div className="rq-field">
                <label htmlFor="rq-hours">How long</label>
                <select id="rq-hours" value={hours} onChange={(e) => setHours(+e.target.value)}>
                  {hourChoices.map((h) => <option key={h} value={h}>{h === 1 ? "1 hour" : `${h} hours`}</option>)}
                </select>
                <span className="rq-hint">{minH} hour{minH === 1 ? "" : "s"} minimum. Need more than 24? Add it in the note.</span>
              </div>
            </div>

            <fieldset className="rq-field rq-channels">
              <legend>How should we remind you?</legend>
              <div className="rq-checks">
                {CHANNELS.map((c) => (
                  <label key={c.k} className="rq-check">
                    <input type="checkbox" checked={notify.includes(c.k)} onChange={() => toggle(c.k)} /> {c.t}
                  </label>
                ))}
              </div>
              <span className="rq-hint">Pick one or more. We'll use them when your GPU is ready, if we need to change the time, or if anything else changes.</span>
            </fieldset>
            {needsPhone && (
              <div className="rq-field">
                <label htmlFor="rq-phone">Phone number for WhatsApp/SMS</label>
                <input id="rq-phone" type="tel" inputMode="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
              </div>
            )}
            <div className="rq-field">
              <label htmlFor="rq-notes">Anything we should know? <span className="rq-opt">(optional)</span></label>
              <textarea id="rq-notes" rows={3} maxLength={1000} placeholder="e.g. what you're running, VRAM you need, preferred region" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="rq-price" aria-live="polite">
              <div>
                <div className="rq-hint">Price</div>
                <div className="rq-price-val">{rupees(price)}</div>
              </div>
              <div className="rq-hint rq-right">{hours} h × {rupees(rate)}/hour{mode === "soon" ? " (short notice)" : ""}<br />You pay once it's arranged.</div>
            </div>
            {err && <p className="rq-err" role="alert">{err}</p>}
            <button type="submit" className="primary-button" disabled={busy || !opt} {...ctaProps("request_gpu_submit")}>{busy ? "Sending…" : <>Send request <ArrowRight size={17} /></>}</button>
            <p className="rq-hint">Payments are in test mode during the closed beta.</p>
          </form>

          <div className="rq-list">
            <h2 className="rq-h2">Your requests</h2>
            {rows.length === 0 && <p className="rq-empty">No requests yet. When you send one, it shows up here with its status.</p>}
            {rows.map((r) => (
              <article key={r.id} className={`rq-card st-${r.status}`}>
                <div className="rq-card-top">
                  <b>{r.gpu}</b>
                  <span className="rq-pill">{r.unread && <i className="rq-dot" aria-label="New update" />}{r.status_label}</span>
                </div>
                <div className="rq-meta">{fmtWhen(r.start_at)} · {r.hours} h · {rupees(r.price)}{r.urgent ? " · short notice" : ""}</div>
                {r.status === "new_time" && r.offered_start && (
                  <div className="rq-box">
                    We couldn't arrange your original time. We can offer <b>{fmtWhen(r.offered_start)}</b> instead.
                    <div className="rq-actions">
                      <button type="button" className="primary-button rq-sm" onClick={() => act(r.id, "accept-time", "New time accepted")}>Accept new time</button>
                      <button type="button" className="rq-link" onClick={() => act(r.id, "cancel", "Request cancelled")}>Cancel request</button>
                    </div>
                  </div>
                )}
                {r.status === "ready" && (
                  <div className="rq-box">
                    Your GPU is arranged. Pay {rupees(r.price)} to confirm it.
                    <div className="rq-actions">
                      <button type="button" className="primary-button rq-sm" onClick={() => act(r.id, "pay", "Paid (test mode)")}>Pay {rupees(r.price)}</button>
                    </div>
                  </div>
                )}
                {r.status === "paid" && <div className="rq-box">Payment received. We'll send your access details before {fmtWhen(r.start_at)}.</div>}
                {r.access && <div className="rq-box"><div className="rq-hint">How to connect</div><pre className="rq-access">{r.access}</pre></div>}
                {r.staff_note && r.status === "cancelled" && <div className="rq-hint">Note from our team: {r.staff_note}</div>}
                {["requested", "arranging"].includes(r.status) && (
                  <button type="button" className="rq-link" onClick={() => act(r.id, "cancel", "Request cancelled")}>Cancel request</button>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
