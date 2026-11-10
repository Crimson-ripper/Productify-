import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, Cpu, Play, Square, Copy, AlertTriangle, RefreshCw } from "lucide-react";
import { api, money, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { track } from "@/lib/analytics";

// Gamezone play (flow A): pick a region and a machine near you, pick Steam or Epic, press Play.
// We rent that machine, set it up (5-10 minutes), then PG Connect joins it with the session code.
// Ending the session deletes the machine and everything on it.

const REGION_NAMES = typeof Intl !== "undefined" && Intl.DisplayNames ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
const regionName = (c) => { try { return (REGION_NAMES && REGION_NAMES.of(c)) || c; } catch { return c; } };
const fmtTime = (s) => `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;

export default function GamezonePlay({ downloadUrl }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState(null);
  const [country, setCountry] = useState("");
  const [countries, setCountries] = useState([]);
  const [machines, setMachines] = useState([]);
  const [launchers, setLaunchers] = useState([{ id: "steam", name: "Steam" }, { id: "epic", name: "Epic Games" }]);
  const [searched, setSearched] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [offerId, setOfferId] = useState(null);
  const [launcher, setLauncher] = useState("steam");
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lowDismissed, setLowDismissed] = useState(false);
  const poll = useRef(null);

  const loadMachines = useCallback(async (c) => {
    setLoadingList(true);
    try {
      const res = await api.get("/gamezone/play/machines", { params: c ? { country: c } : {} });
      setEnabled(res.data.enabled);
      if (!res.data.enabled) return;
      setCountry(res.data.country);
      setCountries(res.data.countries || []);
      setMachines(res.data.machines || []);
      setSearched(res.data.searched || []);
      if (res.data.launchers) setLaunchers(res.data.launchers);
      setOfferId((cur) => (res.data.machines || []).some((m) => m.offer_id === cur) ? cur : (res.data.machines?.[0]?.offer_id ?? null));
    } catch (err) {
      setEnabled((e) => e ?? true);
      toast.error(getErrorMessage(err, "Couldn't load machines"));
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadSession = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get("/gamezone/play/current");
      setSession(res.data.session);
    } catch { /* keep the last state; the next poll retries */ }
  }, [user]);

  useEffect(() => { loadMachines(""); }, [loadMachines]);
  useEffect(() => { loadSession(); }, [loadSession]);

  const live = session && ["finding", "starting", "running"].includes(session.status);
  useEffect(() => {
    clearInterval(poll.current);
    if (live) poll.current = setInterval(loadSession, session.status === "running" ? 30000 : 8000);
    return () => clearInterval(poll.current);
  }, [live, session?.status, loadSession]);

  if (enabled === false || enabled === null) return null;

  const start = async () => {
    if (!user) { navigate("/login", { state: { from: { pathname: "/gamezone" } } }); return; }
    if (!offerId) return;
    setBusy(true);
    try {
      const res = await api.post("/gamezone/play", { offer_id: offerId, launcher, country });
      setSession(res.data);
      setLowDismissed(false);
      track("cta_click", { cta_name: "gamezone_play", launcher });
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't start the session"));
      if (err?.response?.status === 409) loadMachines(country);
    } finally {
      setBusy(false);
    }
  };

  const end = async () => {
    if (!window.confirm("End the session? The machine and everything on it (including your Steam/Epic sign-in) is deleted.")) return;
    setBusy(true);
    try {
      const res = await api.post(`/gamezone/play/${session.id}/end`);
      setSession(res.data.session);
      toast.success("Session ended");
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't end the session"));
    } finally {
      setBusy(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(session.join_code).then(() => toast.success("Code copied"), () => {});
  };

  const picked = machines.find((m) => m.offer_id === offerId);
  const launcherName = (id) => (launchers.find((l) => l.id === id) || {}).name || id;

  return (
    <section className="gz-play-wrap" aria-labelledby="gz-play-title">
      <div className="gz-play">
        <div className="gz-play-head">
          <h2 id="gz-play-title">Play on a cloud gaming PC</h2>
          <p>Rent a gaming machine near you by the hour and play your own Steam or Epic games on it through PG Connect.</p>
        </div>

        {live || (session && session.status === "terminated") ? (
          <div className="gz-session" aria-live="polite">
            {session.status !== "running" && session.status !== "terminated" && (
              <>
                <div className="gz-session-state"><span className="gz-dot pulse" /> Setting up your machine…</div>
                <p className="gz-muted">
                  {session.gpu} in {session.location}. This usually takes 5–10 minutes; you aren't charged until it's ready.
                  {session.setup_detail ? <> Now: <i>{session.setup_detail}</i></> : null}
                </p>
                <button className="secondary-button" onClick={end} disabled={busy}><Square size={14} /> Cancel</button>
              </>
            )}
            {session.status === "running" && (
              <>
                <div className="gz-session-state"><span className="gz-dot on" /> Ready · {session.gpu} in {session.location}</div>
                <div className="gz-code">
                  <span>Session code</span>
                  <b>{session.join_code}</b>
                  <button className="gz-icon-btn" onClick={copyCode} aria-label="Copy session code"><Copy size={15} /></button>
                </div>
                <div className="gz-session-actions">
                  <a className="primary-button" href={session.connect_url}
                     onClick={() => track("cta_click", { cta_name: "gamezone_launch" })}>
                    <Play size={15} /> Open in PG Connect
                  </a>
                  <button className="secondary-button" onClick={end} disabled={busy}><Square size={14} /> End session</button>
                </div>
                <p className="gz-muted">
                  {launcherName(session.launcher)} opens when you connect. No PG Connect yet? <a href={downloadUrl} download>Download it</a>, then enter the code.
                </p>
                <dl className="gz-meter">
                  <div><dt>Time</dt><dd>{fmtTime(session.runtime_seconds || 0)}</dd></div>
                  <div><dt>Cost so far</dt><dd>{money(session.cost || 0)}</dd></div>
                  <div><dt>Price</dt><dd>{money(session.hourly_price || 0)}/h</dd></div>
                  {session.minutes_left != null && <div><dt>Credit left</dt><dd>about {fmtTime(session.minutes_left * 60)}</dd></div>}
                </dl>
              </>
            )}
            {session.status === "terminated" && (
              <>
                <div className="gz-session-state"><span className="gz-dot" /> Session ended{session.end_reason ? ` (${session.end_reason})` : ""}</div>
                <p className="gz-muted">
                  {session.cost > 0 ? `Charged ${money(session.cost)} for ${fmtTime(session.runtime_seconds || 0)}.` : "You weren't charged."} The machine and everything on it has been deleted.
                </p>
                <button className="primary-button" onClick={() => setSession(null)}>Start a new session</button>
              </>
            )}
          </div>
        ) : (
          <div className="gz-picker">
            <div className="gz-picker-row">
              <label className="gz-field">
                <span><MapPin size={14} /> Region</span>
                <select value={country} onChange={(e) => { setCountry(e.target.value); loadMachines(e.target.value); }}>
                  {countries.map((c) => <option key={c} value={c}>{regionName(c)}</option>)}
                </select>
              </label>
              <button className="gz-icon-btn" onClick={() => loadMachines(country)} disabled={loadingList} aria-label="Refresh machines">
                <RefreshCw size={15} className={loadingList ? "spin" : ""} />
              </button>
            </div>
            {searched.length > 0 && searched[0] !== country && (
              <p className="gz-muted">No machines in {regionName(country)} right now; showing the nearest countries.</p>
            )}

            <div className="gz-machines" role="radiogroup" aria-label="Machines near you">
              {loadingList && machines.length === 0 && <p className="gz-muted">Looking for machines near you…</p>}
              {!loadingList && machines.length === 0 && <p className="gz-muted">No gaming machines are free near this region right now. Try another region or check back soon.</p>}
              {machines.map((m) => (
                <label key={m.offer_id} className={`gz-machine${m.offer_id === offerId ? " on" : ""}`}>
                  <input type="radio" name="gz-machine" checked={m.offer_id === offerId} onChange={() => setOfferId(m.offer_id)} />
                  <span className="gz-machine-gpu"><Cpu size={14} /> {m.gpu} <small>{m.vram_gb} GB</small></span>
                  <span className="gz-machine-meta">{m.location}{m.distance_km != null ? ` · ~${m.distance_km.toLocaleString()} km` : ""} · {m.cpu_cores} cores · {m.ram_gb} GB RAM</span>
                  <span className="gz-machine-price">{money(m.price)}<small>/h</small></span>
                </label>
              ))}
            </div>

            <fieldset className="gz-launchers">
              <legend>Launcher</legend>
              {launchers.map((l) => (
                <label key={l.id} className={`gz-chip${launcher === l.id ? " on" : ""}`}>
                  <input type="radio" name="gz-launcher" checked={launcher === l.id} onChange={() => setLauncher(l.id)} />
                  {l.name}
                </label>
              ))}
            </fieldset>

            <ul className="gz-terms">
              <li>You sign in to your own {launcherName(launcher)} account and play games you own.</li>
              <li>When the session ends, the machine is deleted with everything on it, including your sign-in. Progress is kept only through {launcherName(launcher)}'s cloud saves.</li>
              <li>Billed per minute from your credits while the machine is ready. We warn you by popup and email when your credit is running low; the session ends when it runs out.</li>
            </ul>

            <button className="primary-button gz-play-btn" onClick={start} disabled={busy || !offerId}>
              <Play size={15} /> {user ? `Play${picked ? ` · ${money(picked.price)}/h` : ""}` : "Sign in to play"}
            </button>
          </div>
        )}
      </div>

      {session?.status === "running" && session.low_credit && !lowDismissed && (
        <div className="gz-modal" role="alertdialog" aria-modal="true" aria-labelledby="gz-low-title">
          <div className="gz-modal-box">
            <h3 id="gz-low-title"><AlertTriangle size={18} /> Your credit is running low</h3>
            <p>{session.minutes_left < 1 ? "Less than a minute" : `About ${session.minutes_left} minute${session.minutes_left === 1 ? "" : "s"}`} of play left. Your session ends when your credit runs out. We've also emailed you.</p>
            <div className="gz-session-actions">
              <Link className="primary-button" to="/pricing" target="_blank" rel="noopener">Add credits</Link>
              <button className="secondary-button" onClick={() => setLowDismissed(true)}>Keep playing</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
