import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Cpu, RefreshCw, AlertCircle } from "lucide-react";
import { api, money, getErrorMessage } from "@/lib/api";
import { PLACEHOLDER_IMG, imgFallback } from "@/lib/image";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import { toast } from "sonner";
export default function GameHostSelect() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [game, setGame] = useState(null);
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Launch state
  const [launchingHostId, setLaunchingHostId] = useState(null);

  const pollIntervalRef = useRef(null);

  // Fetch host fleet and game info
  const fetchHosts = useCallback(async (isBackground = false) => {
    if (!gameId) return;
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await api.get(`/games/${gameId}/hosts`);
      if (res.data?.ok) {
        setGame(res.data.game);
        setHosts(res.data.hosts || []);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to fetch game hosts:", err);
      if (!isBackground) {
        setError(getErrorMessage(err, "Could not load machine fleet for this game."));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gameId]);

  useEffect(() => {
    fetchHosts(false);

    // Poll every 6 seconds to update real-time online/offline presence
    pollIntervalRef.current = setInterval(() => {
      fetchHosts(true);
    }, 6000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchHosts]);

  // Handle machine selection & container launch
  const handleSelectHost = async (host) => {
    if (!host.is_online) {
      toast.error("This machine is currently offline and cannot host sessions.");
      return;
    }

    if (!user) {
      sessionStorage.setItem("productify_pending_game", JSON.stringify(game));
      sessionStorage.setItem("productify_pending_rental", host.id);
      toast.info("Please sign in to launch your cloud gaming session.");
      navigate("/login");
      return;
    }

    setLaunchingHostId(host.id);
    try {
      const res = await api.post("/games/play", {
        game_id: game?.id || gameId,
        rental_id: host.id,
      });
      if (res.data?.session?.id) {
        navigate(`/gamezone/session/${res.data.session.id}`);
      } else {
        throw new Error(res.data?.error || "The machine didn't start the game.");
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't start the game on that machine"));
      setLaunchingHostId(null);
    }
  };

  const onlineCount = hosts.filter((h) => h.is_online).length;
  const launchingHost = hosts.find((h) => h.id === launchingHostId);

  return (
    <>
      <SEO
        title={game ? `Choose a machine for ${game.title} — Productify` : "Choose a machine — Productify"}
        description="Pick an online GPU to run your game on."
      />
      <section className="host-page">
        <Link to="/gamezone" className="crumb host-back"><ArrowLeft size={13} /> Gamezone</Link>

        {game && (
          <div className="host-game">
            <img src={game.cover_image || PLACEHOLDER_IMG} alt={game.title} onError={imgFallback} />
            <div>
              <div className="eyebrow">{game.genre || "Game"}</div>
              <h1>{game.title}</h1>
              {game.description && <p>{game.description}</p>}
              <dl className="host-game-facts">
                {game.min_vram && <div><dt>Needs</dt><dd>{game.min_vram} VRAM</dd></div>}
                {game.recommended_gpu && <div><dt>Recommended</dt><dd>{game.recommended_gpu}</dd></div>}
                {(game.rate_usd || game.rate_credits) && <div><dt>Game rate</dt><dd>{game.rate_usd ? `${money(game.rate_usd)}/hr` : ""}{game.rate_credits ? ` (${game.rate_credits} credits)` : ""}</dd></div>}
              </dl>
            </div>
          </div>
        )}

        <div className="host-head">
          <div>
            <h2>Choose a machine</h2>
            <p>{loading ? "Checking which machines are online…" : `${onlineCount} of ${hosts.length} online. The list refreshes every few seconds.`}</p>
          </div>
          <button className="secondary-button" onClick={() => fetchHosts(true)} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? "spin" : ""} /> Refresh
          </button>
        </div>

        {error && <div className="form-error host-error"><AlertCircle size={15} /> {error}</div>}

        {loading && hosts.length === 0 ? (
          <div className="loading-block"><div className="spinner" />Loading machines…</div>
        ) : !loading && hosts.length === 0 ? (
          <div className="empty-block">No machines are registered yet. Owners add one by running Productify Node.</div>
        ) : (
          <div className="host-grid">
            {hosts.map((host) => {
              const isOnline = Boolean(host.is_online);
              return (
                <article key={host.id} className={isOnline ? "host-card" : "host-card offline"}>
                  <div className="host-card-top">
                    <span className={isOnline ? "node-status online" : "node-status"}>
                      <span className={isOnline ? "live-dot" : "live-dot off"} />{isOnline ? "Online" : "Offline"}
                    </span>
                    <strong>{money(host.price || 0)}<small> / hr</small></strong>
                  </div>
                  <h3>{host.title}</h3>
                  <div className="host-gpu"><Cpu size={14} /> {host.gpu}</div>
                  <dl className="host-specs">
                    <div><dt>VRAM</dt><dd>{host.vram || "—"}</dd></div>
                    <div><dt>RAM</dt><dd>{host.ram || "—"}</dd></div>
                    <div><dt>Region</dt><dd>{host.region || "—"}</dd></div>
                    <div><dt>Ping</dt><dd>{isOnline && host.ping_ms ? `${host.ping_ms} ms` : "—"}</dd></div>
                  </dl>
                  <button
                    className={isOnline ? "primary-button full" : "secondary-button full"}
                    onClick={() => handleSelectHost(host)}
                    disabled={!isOnline || Boolean(launchingHostId)}
                  >
                    {!isOnline ? "Offline" : launchingHostId === host.id ? "Starting…" : "Play on this machine"}
                  </button>
                </article>
              );
            })}
          </div>
        )}

        {launchingHostId && (
          <div className="overlay">
            <div className="modal-card host-launch" role="status" aria-live="polite">
              <div className="spinner" />
              <h2>Starting {game?.title || "your game"}</h2>
              <p className="modal-desc">
                Setting up the game on {launchingHost?.title || "the machine"}. This can take a minute
                the first time, while the game files download to it.
              </p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}