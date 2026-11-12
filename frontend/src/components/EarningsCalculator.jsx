import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { ctaProps } from "@/lib/analytics";
import { ROUTES } from "@/lib/routes";
import "./EarningsCalculator.css";

// EXAMPLE FIGURES ONLY (CLAUDE.md §3 rule 2). None of these are measured.
// [TODO: confirm standard rates per GPU model]
// [TODO: replace demand scores with real rental history per GPU model]
// p = standard rate in USD/hour, w = typical power draw in watts, d = demand score 0–1
const GPUS = [
  { n: "RTX 3060 · 12 GB", p: 0.12, w: 170, d: 0.5 },
  { n: "RTX 3070 · 8 GB", p: 0.14, w: 220, d: 0.3 },
  { n: "RTX 3080 · 10 GB", p: 0.18, w: 320, d: 0.4 },
  { n: "RTX 3090 · 24 GB", p: 0.25, w: 350, d: 0.75 },
  { n: "RTX 4060 Ti · 16 GB", p: 0.16, w: 165, d: 0.55 },
  { n: "RTX 4070 · 12 GB", p: 0.18, w: 200, d: 0.5 },
  { n: "RTX 4080 · 16 GB", p: 0.3, w: 320, d: 0.6 },
  { n: "RTX 4090 · 24 GB", p: 0.45, w: 450, d: 0.85 },
  { n: "RTX 5090 · 32 GB", p: 0.7, w: 575, d: 0.8 },
  { n: "Other NVIDIA GPU", p: 0.15, w: 250, d: 0.35 },
];
const FEE = 0.1; // Free plan
const MIN_WITHDRAW_USD = 10;
const MIN_HOURS = 2;
const LEVELS = [
  { min: 0.75, t: "High", bars: 4, c: "high" },
  { min: 0.55, t: "Medium", bars: 3, c: "med" },
  { min: 0.35, t: "Low", bars: 2, c: "low" },
  { min: -1, t: "Very low", bars: 1, c: "vlow" },
];
const PERIODS = [
  { k: "hours", t: "Hours", days: 0 },
  { k: "day", t: "1 day", days: 1 },
  { k: "week", t: "1 week", days: 7 },
  { k: "month", t: "1 month", days: 30 },
  { k: "year", t: "1 year", days: 365 },
];

const INFO = {
  watts: "How much electricity your GPU uses while it's working, in watts. We use it to estimate your power bill during rentals. Check your GPU's specs if you're not sure.",
  adj: "Productify sets a standard hourly rate for each GPU. You can move yours up to 20% lower or higher. Lower means renters pick you more often. Higher means more money per hour but fewer rentals.",
  chance: "How likely renters are to choose your machine. It depends on how popular your GPU model is with AI developers and how your price compares to the standard rate.",
  block: "Don't want to list your PC all day? List it for a few hours instead. The minimum is 2 hours, and you can add whole hours after that.",
  hours: "How many hours a day your PC is listed and ready for renters. You can pause it anytime to use it yourself.",
  util: "Your PC earns only while someone is using it. If it's online for 10 hours and renters use it for 4, that's 40%, and you're paid for 4 hours. We estimate this from how popular your GPU is and your price. A lower price usually means more rentals.",
  fee: "Productify keeps this share of each rental to run the platform. On the Free plan it's 10%, so from $1.00 of rental you get $0.90.",
  kwh: "What you pay your power company for one unit (1 kWh) of electricity. You'll find it on your electricity bill. We use it to estimate what running your GPU costs you.",
};

function chanceFor(gpu, adj) {
  const s = Math.max(0, Math.min(1, gpu.d - (adj / 100) * 1.5));
  return { s, level: LEVELS.find((l) => s >= l.min) };
}
const autoUtil = (s) => Math.round((10 + s * 50) / 5) * 5;

function Label({ htmlFor, id, open, onToggle, children, value }) {
  return (
    <div className="ec-lblrow">
      <label htmlFor={htmlFor}>{children}</label>
      <button type="button" className="ec-info" aria-expanded={open} aria-controls={`ec-info-${id}`} aria-label="What does this mean?" onClick={onToggle}>i</button>
      {value !== undefined && <output>{value}</output>}
    </div>
  );
}

export default function EarningsCalculator() {
  const [gpuIdx, setGpuIdx] = useState(7);
  const gpu = GPUS[gpuIdx];
  const [watts, setWatts] = useState(gpu.w);
  const [adj, setAdj] = useState(0);
  const [util, setUtil] = useState(() => autoUtil(chanceFor(gpu, 0).s));
  const [hrsDay, setHrsDay] = useState(12);
  const [block, setBlock] = useState("4");
  const [period, setPeriod] = useState("month");
  const [cur, setCur] = useState("USD");
  const [fx, setFx] = useState("88"); // [TODO: example rate; consider a live rate]
  const [kwh, setKwh] = useState("0.15");
  const [open, setOpen] = useState({});
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const info = (k) => open[k] && <div className="ec-infobox" id={`ec-info-${k}`}>{INFO[k]}</div>;

  const { s, level } = chanceFor(gpu, adj);

  const pickGpu = (i) => {
    setGpuIdx(i);
    setWatts(GPUS[i].w);
    setUtil(autoUtil(chanceFor(GPUS[i], adj).s));
  };
  const changeAdj = (v) => {
    setAdj(v);
    setUtil(autoUtil(chanceFor(gpu, v).s));
  };
  const rateFx = () => Math.max(1, parseFloat(fx) || 88);
  const switchCur = (c) => {
    if (c === cur) return;
    const k = parseFloat(kwh) || 0;
    setKwh(c === "INR" ? (k * rateFx()).toFixed(1) : (k / rateFx()).toFixed(2));
    setCur(c);
  };

  const r = useMemo(() => {
    const days = PERIODS.find((p) => p.k === period).days;
    const blk = Math.max(MIN_HOURS, Math.round(parseFloat(block) || MIN_HOURS));
    const u = util / 100;
    const rate = gpu.p * (1 + adj / 100);
    const toUsd = cur === "INR" ? 1 / rateFx() : 1;
    const rented = days === 0 ? blk * u : hrsDay * u * days;
    const gross = rented * rate;
    const fee = gross * FEE;
    const payout = gross - fee;
    const power = (rented * (Number(watts) || 0) / 1000) * (parseFloat(kwh) || 0) * toUsd;
    const net = payout - power;
    const perListedHr = u * rate * (1 - FEE);
    return { days, blk, rate, rented, gross, fee, payout, power, net, perListedHr };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, block, util, gpu, adj, cur, fx, hrsDay, watts, kwh]);

  const fmt = (usd) => {
    const x = usd * (cur === "INR" ? rateFx() : 1);
    const sym = cur === "INR" ? "₹" : "$";
    return (x < 0 ? "-" : "") + sym + Math.abs(x).toLocaleString(cur === "INR" ? "en-IN" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const minLabel = fmt(MIN_WITHDRAW_USD).replace(/\.00$/, "");
  let withdraw;
  if (r.perListedHr <= 0) withdraw = "At these settings you won't build up a balance to withdraw.";
  else if (r.days === 0) withdraw = `You'd reach the ${minLabel} withdrawal minimum after about ${Math.ceil(MIN_WITHDRAW_USD / r.perListedHr)} hours online in total.`;
  else {
    const d = Math.ceil(MIN_WITHDRAW_USD / (r.perListedHr * hrsDay));
    withdraw = `You'd reach the ${minLabel} withdrawal minimum in about ${d} day${d === 1 ? "" : "s"}.`;
  }
  const periodLabel = { hours: `for ${r.blk} hours online`, day: "per day", week: "per week", month: "per month", year: "per year" }[period];
  const tot = r.gross + r.power || 1;
  const dem = gpu.d >= 0.75 ? "high" : gpu.d >= 0.5 ? "steady" : "lower";
  const pr = adj < 0 ? `your rate is ${-adj}% below standard` : adj > 0 ? `your rate is ${adj}% above standard` : "you're at the standard rate";

  return (
    <div className="ec" aria-label="Earnings calculator">
      <p className="ec-example">Example figures. Rates, demand and power numbers are estimates for illustration, not measured results.</p>
      <div className="ec-grid">
        <div className="ec-panel">
          <div className="ec-eyebrow">Your hardware</div>
          <div className="ec-field">
            <label htmlFor="ec-gpu">GPU</label>
            <select id="ec-gpu" value={gpuIdx} onChange={(e) => pickGpu(+e.target.value)}>
              {GPUS.map((g, i) => <option key={g.n} value={i}>{g.n}</option>)}
            </select>
          </div>
          <div className="ec-field">
            <Label htmlFor="ec-watts" id="watts" open={open.watts} onToggle={() => toggle("watts")}>Power draw (W)</Label>
            {info("watts")}
            <input id="ec-watts" type="number" min="0" step="10" value={watts} onChange={(e) => setWatts(e.target.value)} />
          </div>

          <div className="ec-eyebrow">Pricing</div>
          <div className="ec-rate">
            <div><div className="ec-hint">Productify standard rate</div><div className="ec-rateval">${gpu.p.toFixed(2)}/h</div></div>
            <div className="ec-right"><div className="ec-hint">Your rate</div><div className="ec-rateval ec-accent">${r.rate.toFixed(3).replace(/0$/, "")}/h</div></div>
          </div>
          <div className="ec-field">
            <Label htmlFor="ec-adj" id="adj" open={open.adj} onToggle={() => toggle("adj")} value={`${adj > 0 ? "+" : ""}${adj}%`}>Adjust your rate</Label>
            {info("adj")}
            <input id="ec-adj" type="range" min="-20" max="20" step="5" value={adj} onChange={(e) => changeAdj(+e.target.value)} />
            <span className="ec-hint">You can go up to 20% below or above the standard rate. A lower price gets picked more often.</span>
          </div>
          <div className={`ec-chance ec-${level.c}`}>
            <div>
              <div className="ec-lblrow ec-small">Chance of getting rented <button type="button" className="ec-info" aria-expanded={!!open.chance} aria-controls="ec-info-chance" aria-label="What does this mean?" onClick={() => toggle("chance")}>i</button></div>
              <div className="ec-chancelvl">{level.t}</div>
            </div>
            <div className="ec-meter" aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i} className={i < level.bars ? "on" : ""} />)}</div>
          </div>
          {info("chance")}
          <span className="ec-hint">Demand for the {gpu.n.split(" · ")[0]} is {dem}, and {pr}.</span>

          <div className="ec-eyebrow">Availability</div>
          <div className="ec-field">
            <span className="ec-lbl">Period</span>
            <div className="ec-seg">
              {PERIODS.map((p) => <button key={p.k} type="button" aria-pressed={period === p.k} onClick={() => setPeriod(p.k)}>{p.t}</button>)}
            </div>
          </div>
          {period === "hours" ? (
            <div className="ec-field">
              <Label htmlFor="ec-block" id="block" open={open.block} onToggle={() => toggle("block")}>How many hours will you make it available?</Label>
              {info("block")}
              <input id="ec-block" type="number" min={MIN_HOURS} step="1" value={block} onChange={(e) => setBlock(e.target.value)} />
              <span className="ec-hint">{(parseFloat(block) || 0) < MIN_HOURS ? "Minimum is 2 hours, so 2 hours is used." : "Minimum 2 hours, then any number of whole hours."}</span>
            </div>
          ) : (
            <div className="ec-field">
              <Label htmlFor="ec-hours" id="hours" open={open.hours} onToggle={() => toggle("hours")} value={`${hrsDay} h`}>Hours online per day</Label>
              {info("hours")}
              <input id="ec-hours" type="range" min="1" max="24" step="1" value={hrsDay} onChange={(e) => setHrsDay(+e.target.value)} />
            </div>
          )}
          <div className="ec-field">
            <Label htmlFor="ec-util" id="util" open={open.util} onToggle={() => toggle("util")} value={`${util}%`}>Share of online time actually rented</Label>
            {info("util")}
            <input id="ec-util" type="range" min="0" max="100" step="5" value={util} onChange={(e) => setUtil(+e.target.value)} />
            <span className="ec-hint">Set automatically from your rental chance. You can move it to test other cases.</span>
          </div>

          <div className="ec-eyebrow">Costs</div>
          <div className="ec-field">
            <span className="ec-lbl">Currency</span>
            <div className="ec-seg">
              <button type="button" aria-pressed={cur === "USD"} onClick={() => switchCur("USD")}>$ USD</button>
              <button type="button" aria-pressed={cur === "INR"} onClick={() => switchCur("INR")}>₹ INR</button>
            </div>
          </div>
          {cur === "INR" && (
            <div className="ec-field">
              <label htmlFor="ec-fx">₹ per $1</label>
              <input id="ec-fx" type="number" min="1" step="0.5" value={fx} onChange={(e) => setFx(e.target.value)} />
              <span className="ec-hint">Example exchange rate. Change it to today's rate.</span>
            </div>
          )}
          <div className="ec-row2">
            <div className="ec-field">
              <Label id="fee" open={open.fee} onToggle={() => toggle("fee")}>Platform fee</Label>
              <div className="ec-locked">10% <span className="ec-hint">Free plan</span></div>
            </div>
            <div className="ec-field">
              <Label htmlFor="ec-kwh" id="kwh" open={open.kwh} onToggle={() => toggle("kwh")}>{cur === "INR" ? "Electricity (₹ / unit)" : "Electricity ($ / kWh)"}</Label>
              <input id="ec-kwh" type="number" min="0" step={cur === "INR" ? "0.5" : "0.01"} value={kwh} onChange={(e) => setKwh(e.target.value)} />
            </div>
          </div>
          {info("fee")}
          {info("kwh")}
        </div>

        <div className="ec-panel ec-result" aria-live="polite">
          <div className="ec-eyebrow">You keep, {periodLabel}</div>
          <div className={`ec-big${r.net < 0 ? " ec-neg" : ""}`}>{fmt(r.net)}</div>
          <div className="ec-hint">{fmt(r.payout)} paid out, minus {fmt(r.power)} of electricity</div>
          <div className="ec-bar" aria-hidden="true">
            <span className="b-net" style={{ width: `${(Math.max(r.net, 0) / tot) * 100}%` }} />
            <span className="b-fee" style={{ width: `${(r.fee / tot) * 100}%` }} />
            <span className="b-pow" style={{ width: `${(r.power / tot) * 100}%` }} />
          </div>
          <div className="ec-legend"><span><i className="b-net" />You keep</span><span><i className="b-fee" />Platform fee</span><span><i className="b-pow" />Electricity</span></div>
          <table className="ec-table">
            <tbody>
              <tr><td>Hours rented</td><td>{r.rented.toLocaleString(undefined, { maximumFractionDigits: 1 })} h</td></tr>
              <tr><td>Rental income</td><td>{fmt(r.gross)}</td></tr>
              <tr><td>Platform fee</td><td className="ec-minus">−{fmt(r.fee)}</td></tr>
              <tr><td>Paid out to you</td><td>{fmt(r.payout)}</td></tr>
              <tr><td>Electricity while rented</td><td className="ec-minus">−{fmt(r.power)}</td></tr>
              <tr className="ec-total"><td>Profit after power</td><td>{fmt(r.net)}</td></tr>
            </tbody>
          </table>
          <div className="ec-note">{withdraw}</div>
          <Link to={ROUTES.apply} className="primary-button ec-cta" {...ctaProps("earn_calculator_apply")}>Start hosting <ArrowRight size={17} /></Link>
          <span className="ec-hint ec-center">Apply for the closed beta. We review every machine.</span>
        </div>
      </div>
      <p className="ec-fine">Estimate only. Real earnings depend on demand, your price, power costs and downtime. There's no guaranteed income, and your machine may not be rented at all. Payments are in test mode during the closed beta.</p>
    </div>
  );
}
