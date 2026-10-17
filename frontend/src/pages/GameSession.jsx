import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Maximize2, Minimize2, ExternalLink, Gamepad2, Square, ChevronDown, ChevronUp } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import SEO from "@/components/SEO";
import { toast } from "sonner";

const formatTime = (secs) => {
  const total = Math.floor(secs || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
};

export default function GameSession() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveCostCredits, setLiveCostCredits] = useState(0);
  const [sessionStatus, setSessionStatus] = useState("running");

  const [streamCreds, setStreamCreds] = useState(null);
  const [isControlsLocked, setIsControlsLocked] = useState(false);
  const [gamepadName, setGamepadName] = useState("");
  const [networkTarget, setNetworkTarget] = useState("auto"); // "auto" (internet) or "lan" (same Wi-Fi)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [stopping, setStopping] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [finalReceipt, setFinalReceipt] = useState(null);

  const containerRef = useRef(null);
  const iframeRef = useRef(null);

  const streamUrlFrom = (creds, target) => {
    if (!creds) return "";
    if (target === "lan" && creds.lan_stream_url) return creds.lan_stream_url;
    return creds.stream_url || creds.lan_stream_url || (creds.wan_ip ? `http://${creds.wan_ip}:48080/` : "");
  };
  const streamUrl = streamUrlFrom(streamCreds, networkTarget);

  // An https page can't embed an http stream; the browser blocks it and shows black.
  const isMixedContent = window.location.protocol === "https:" && streamUrl.startsWith("http:");

  // Poll session status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get(`/games/session/${sessionId}/status`);
      if (res.data?.ok) {
        setSession(res.data.session);
        setSessionStatus(res.data.status || "running");
        setElapsedSeconds(res.data.elapsed_seconds || 0);
        setLiveCostCredits(res.data.live_cost_credits || 0);
        if (res.data.status === "terminated") {
          setFinalReceipt((r) => r || {
            play_seconds: res.data.elapsed_seconds,
            credits_deducted: res.data.live_cost_credits,
            formatted_cost: res.data.formatted_cost,
          });
        }
      }
    } catch (err) {
      if (err.response?.status === 404) setError("This game session doesn't exist or has expired.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchStatus();
    const t = setInterval(fetchStatus, 4000);
    return () => clearInterval(t);
  }, [fetchStatus]);

  // Poll stream connection details (they appear once the machine has started the stream)
  const fetchStreamCreds = useCallback(async () => {
    try {
      const res = await api.get(`/games/session/${sessionId}/stream-credentials`);
      if (res.data?.ok) {
        setStreamCreds(res.data);
        return res.data;
      }
    } catch {
      // Not ready yet; try again on the next poll.
    }
    return null;
  }, [sessionId]);

  useEffect(() => {
    fetchStreamCreds();
    const t = setInterval(fetchStreamCreds, 10000);
    return () => clearInterval(t);
  }, [fetchStreamCreds]);

  // Count up locally between status polls so the timer and cost move every second
  useEffect(() => {
    if (sessionStatus !== "running" || stopping) return;
    const t = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (session?.hourly_rate_credits) setLiveCostCredits((session.hourly_rate_credits * next) / 3600);
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [sessionStatus, stopping, session?.hourly_rate_credits]);

  useEffect(() => {
    const onLock = () => setIsControlsLocked(Boolean(document.pointerLockElement));
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("pointerlockchange", onLock);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("pointerlockchange", onLock);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  useEffect(() => {
    const on = (e) => { setGamepadName(e.gamepad?.id || "Controller"); toast.success("Controller connected"); };
    const off = () => { setGamepadName(""); toast.info("Controller disconnected"); };
    window.addEventListener("gamepadconnected", on);
    window.addEventListener("gamepaddisconnected", off);
    return () => {
      window.removeEventListener("gamepadconnected", on);
      window.removeEventListener("gamepaddisconnected", off);
    };
  }, []);

  const openStandaloneWindow = async () => {
    let url = streamUrl;
    if (!url) url = streamUrlFrom(await fetchStreamCreds(), networkTarget);
    if (url) window.open(url, "ProductifyGameStream", "width=1280,height=720,menubar=no,toolbar=no,location=no,status=no");
    else toast.info("The stream isn't ready yet — give the machine a moment.");
  };

  const startPlaying = () => {
    if (isMixedContent) {
      openStandaloneWindow();
      return;
    }
    if (containerRef.current && !document.fullscreenElement) containerRef.current.requestFullscreen?.().catch(() => {});
    setIsControlsLocked(true);
    iframeRef.current?.focus();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  const copy = (text, what) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  };

  const handleStopSession = async () => {
    setStopping(true);
    try {
      const res = await api.post(`/games/session/${sessionId}/stop`);
      if (res.data?.ok) {
        setSessionStatus("terminated");
        setFinalReceipt({
          play_seconds: res.data.play_seconds,
          credits_deducted: res.data.credits_deducted,
          formatted_cost: res.data.formatted_cost,
        });
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't stop the session"));
      setStopping(false);
    }
  };

  if (loading) {
    return (
      <section className="gs-state">
        <div className="spinner" />
        <h2>Connecting to your game…</h2>
        <p>Waiting for the machine to report in.</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="gs-state">
        <h2>Session unavailable</h2>
        <p>{error}</p>
        <Link to="/gamezone" className="primary-button"><ArrowLeft size={15} /> Back to Gamezone</Link>
      </section>
    );
  }

  const ended = sessionStatus !== "running";

  return (
    <>
      <SEO title={`${session?.game_title || "Game"} — Playing · Productify`} path={`/gamezone/session/${sessionId}`} />

      <div className="gs-shell" ref={containerRef}>
        <header className="gs-bar">
          <div className="gs-title">
            <Link to="/gamezone" className="gs-back" aria-label="Back to Gamezone"><ArrowLeft size={16} /></Link>
            <div>
              <b>{session?.game_title || "Game"}</b>
              <small>{session?.gpu || "GPU"}{gamepadName ? " · controller connected" : ""}</small>
            </div>
          </div>
          <dl className="gs-meters">
            <div><dt>Status</dt><dd className={ended ? "" : "on"}>{ended ? "Stopped" : "Running"}</dd></div>
            <div><dt>Time</dt><dd>{formatTime(elapsedSeconds)}</dd></div>
            <div><dt>Cost so far</dt><dd>{liveCostCredits.toFixed(3)} cr</dd></div>
          </dl>
          <div className="gs-actions">
            <button className="gs-icon" onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit full screen" : "Full screen"}>
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            {!ended && (
              <button className="gs-stop" onClick={() => setConfirmExit(true)} disabled={stopping}>
                <Square size={12} /> {stopping ? "Stopping…" : "Stop"}
              </button>
            )}
          </div>
        </header>

        <main className="gs-main">
          <div className="gs-screen">
            {streamUrl ? (
              <iframe
                ref={iframeRef}
                src={streamUrl}
                title="Game stream"
                allow="autoplay; fullscreen; microphone; camera; gamepad; pointer-lock"
              />
            ) : (
              <div className="gs-waiting"><div className="spinner" />Waiting for the machine to start the stream…</div>
            )}

            {streamUrl && !isControlsLocked && (
              <div className="gs-overlay">
                <Gamepad2 size={30} />
                <h2>Ready when you are</h2>
                <p>
                  {isMixedContent
                    ? "Your browser won't show this stream inside the page, so it opens in its own window."
                    : "Click play to go full screen. Press Esc to get your mouse back."}
                </p>
                <div className="gs-overlay-actions">
                  <button className="primary-button" onClick={startPlaying}>Play</button>
                  <button className="text-button" onClick={openStandaloneWindow}><ExternalLink size={14} /> Open in a new window</button>
                </div>
              </div>
            )}
          </div>

          <div className="gs-below">
            <div className="gs-route">
              Connection:
              <button className={networkTarget === "auto" ? "active" : ""} onClick={() => setNetworkTarget("auto")}>Internet</button>
              <button className={networkTarget === "lan" ? "active" : ""} onClick={() => setNetworkTarget("lan")}>Same Wi-Fi</button>
            </div>
            <button className="gs-adv-toggle" onClick={() => setShowAdvanced((s) => !s)} aria-expanded={showAdvanced}>
              Use the Moonlight app instead {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {showAdvanced && (
            <div className="gs-adv">
              {streamCreds?.wan_ip ? (
                <>
                  <dl>
                    <div>
                      <dt>Host address</dt>
                      <dd><code>{streamCreds.wan_ip}:{streamCreds.port || 47989}</code> <button onClick={() => copy(`${streamCreds.wan_ip}:${streamCreds.port || 47989}`, "Address")}>Copy</button></dd>
                    </div>
                    {streamCreds.pin && (
                      <div><dt>Pairing PIN</dt><dd><code>{streamCreds.pin}</code> <button onClick={() => copy(streamCreds.pin, "PIN")}>Copy</button></dd></div>
                    )}
                    {streamCreds.web_username && (
                      <div><dt>Web player login</dt><dd><code>{streamCreds.web_username}</code> / <code>{streamCreds.web_password}</code></dd></div>
                    )}
                  </dl>
                  {streamCreds.moonlight_uri && <a className="secondary-button" href={streamCreds.moonlight_uri}>Open in Moonlight</a>}
                </>
              ) : (
                <p>Connection details appear here once the machine has started the stream.</p>
              )}
            </div>
          )}
        </main>
      </div>

      {confirmExit && (
        <div className="overlay">
          <div className="modal-card" role="dialog" aria-modal="true">
            <h2>Stop playing?</h2>
            <p className="modal-desc">
              The game shuts down on the machine. You've played {formatTime(elapsedSeconds)}, about {liveCostCredits.toFixed(3)} credits.
            </p>
            <div className="gz-modal-actions">
              <button className="text-button text-button-dark" onClick={() => setConfirmExit(false)} disabled={stopping}>Keep playing</button>
              <button className="dark-button" onClick={() => { setConfirmExit(false); handleStopSession(); }} disabled={stopping}>Stop game</button>
            </div>
          </div>
        </div>
      )}

      {finalReceipt && (
        <div className="overlay">
          <div className="modal-card" role="dialog" aria-modal="true">
            <div className="eyebrow">Session ended</div>
            <h2>{session?.game_title || "Game"}</h2>
            <div className="gz-quote">
              <div className="row"><span>Machine</span><span>{session?.gpu}</span></div>
              <div className="row"><span>Played</span><span>{formatTime(finalReceipt.play_seconds)}</span></div>
              <div className="row muted"><span>Rate</span><span>{session?.hourly_rate_credits} credits / hr</span></div>
              <div className="row total">
                <span>Charged</span>
                <strong>{Number(finalReceipt.credits_deducted || 0).toFixed(3)} credits</strong>
              </div>
              {finalReceipt.formatted_cost && <div className="row muted"><span /><span>≈ {finalReceipt.formatted_cost}</span></div>}
            </div>
            <button className="primary-button full" onClick={() => navigate("/gamezone")}>Back to Gamezone</button>
          </div>
        </div>
      )}
    </>
  );
}
