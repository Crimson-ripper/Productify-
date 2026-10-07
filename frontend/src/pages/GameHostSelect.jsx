import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Gamepad2,
  Server,
  Zap,
  Cpu,
  Layers,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  ShieldCheck,
  RefreshCw,
  HardDrive,
  Radio,
  Wifi,
  ExternalLink,
  Sparkles,
  Monitor
} from "lucide-react";
import { api, money, getErrorMessage } from "@/lib/api";
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
  const [launchStep, setLaunchStep] = useState(1);
  const [launchStatusText, setLaunchStatusText] = useState("");

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
    setLaunchStep(1);
    setLaunchStatusText(`Connecting to host node (${host.title})...`);

    try {
      setTimeout(() => {
        setLaunchStep(2);
        setLaunchStatusText("Verifying game files & cache from Cloudflare R2...");
      }, 1200);

      setTimeout(() => {
        setLaunchStep(3);
        setLaunchStatusText("Allocating isolated GPU container & initializing Sunshine daemon...");
      }, 2600);

      const res = await api.post("/games/play", {
        game_id: game?.id || gameId,
        rental_id: host.id,
      });

      if (res.data?.session?.id) {
        setLaunchStep(4);
        setLaunchStatusText("Pairing WebRTC stream... Entering gaming session!");
        toast.success(`Allocated GPU node ${host.gpu}! Connecting browser stream...`);

        setTimeout(() => {
          navigate(`/gamezone/session/${res.data.session.id}`);
        }, 1000);
      } else {
        throw new Error(res.data?.error || "Failed to initialize gaming container");
      }
    } catch (err) {
      console.error("Launch error:", err);
      toast.error(getErrorMessage(err, "Failed to spin up game container on host."));
      setLaunchingHostId(null);
    }
  };

  const onlineCount = hosts.filter((h) => h.is_online).length;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#f3f4f6", padding: "40px 20px 80px" }}>
      <SEO
        title={game ? `Select Machine to Play ${game.title}` : "Select Gaming Machine"}
        description="Choose an active GPU host node with real-time online status and low-latency streaming."
      />

      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        {/* Navigation Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, fontSize: "0.85rem", color: "#9ca3af" }}>
          <Link to="/gamezone" style={{ color: "#818cf8", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={16} /> Back to Gamezone Library
          </Link>
          <span>/</span>
          <span>Machine Fleet Selection</span>
        </div>

        {/* Selected Game Banner / Header Card */}
        {game && (
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 18,
              background: "linear-gradient(135deg, rgba(30, 27, 75, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)",
              border: "1px solid rgba(99, 102, 241, 0.25)",
              padding: "28px 32px",
              marginBottom: 36,
              boxShadow: "0 12px 36px rgba(0, 0, 0, 0.5)",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center" }}>
              {game.cover_image && (
                <img
                  src={game.cover_image}
                  alt={game.title}
                  style={{
                    width: 110,
                    height: 140,
                    objectFit: "cover",
                    borderRadius: 12,
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
                  }}
                />
              )}
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                  <span
                    style={{
                      background: "rgba(99, 102, 241, 0.2)",
                      border: "1px solid rgba(99, 102, 241, 0.4)",
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: "0.75rem",
                      color: "#a5b4fc",
                      fontWeight: 600,
                    }}
                  >
                    {game.genre || "Cloud Title"}
                  </span>
                  <span
                    style={{
                      background: "rgba(34, 197, 94, 0.15)",
                      border: "1px solid rgba(34, 197, 94, 0.3)",
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: "0.75rem",
                      color: "#86efac",
                      fontWeight: 600,
                    }}
                  >
                    Cloudflare R2 Optimized
                  </span>
                </div>
                <h1 style={{ fontSize: "1.85rem", fontWeight: 800, margin: "0 0 10px", color: "#ffffff", letterSpacing: "-0.02em" }}>
                  {game.title}
                </h1>
                <p style={{ fontSize: "0.9rem", color: "#94a3b8", margin: "0 0 14px", maxWidth: 700, lineHeight: 1.5 }}>
                  {game.description || "Stream this game in ultra low-latency 60 FPS directly in your browser from an isolated GPU host node."}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 20, fontSize: "0.82rem", color: "#cbd5e1" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Cpu size={15} color="#818cf8" />
                    <span>Min VRAM: <strong>{game.min_vram || "4 GB"}</strong></span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Gamepad2 size={15} color="#818cf8" />
                    <span>Recommended: <strong>{game.recommended_gpu || "GTX 1650+"}</strong></span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <DollarSign size={15} color="#22c55e" />
                    <span>Rate: <strong style={{ color: "#4ade80" }}>{money(game.rate_usd || 1.0)}/hr</strong> ({game.rate_credits || 1.0} credits)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section Header: Fleet Presence */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Server size={22} color="#6366f1" />
              <h2 style={{ fontSize: "1.45rem", fontWeight: 700, margin: 0, color: "#ffffff" }}>
                Select Host Machine to Run Game
              </h2>
            </div>
            <p style={{ fontSize: "0.85rem", color: "#9ca3af", margin: "6px 0 0" }}>
              All machines running ProductifyNode are monitored live. Green glowing machines are currently online and ready to accept your game container session.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(34, 197, 94, 0.12)",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                padding: "6px 14px",
                borderRadius: 999,
                fontSize: "0.8rem",
                color: "#4ade80",
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 0 10px #22c55e",
                  display: "inline-block",
                }}
              />
              <span>{onlineCount} Machine{onlineCount === 1 ? "" : "s"} Online</span>
            </div>

            <button
              onClick={() => fetchHosts(true)}
              disabled={refreshing}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#e2e8f0",
                padding: "7px 14px",
                borderRadius: 8,
                fontSize: "0.8rem",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <RefreshCw size={14} className={refreshing ? "spin-animate" : ""} />
              {refreshing ? "Refreshing..." : "Refresh Status"}
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div
            style={{
              padding: "16px 20px",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 12,
              color: "#fca5a5",
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && hosts.length === 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: 20 }}>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                style={{
                  height: 220,
                  borderRadius: 16,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  animation: "pulse 1.5s infinite ease-in-out",
                }}
              />
            ))}
          </div>
        )}

        {/* Machine Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 22 }}>
          {hosts.map((host) => {
            const isOnline = Boolean(host.is_online);
            const isLaunching = launchingHostId === host.id;

            return (
              <div
                key={host.id}
                style={{
                  position: "relative",
                  borderRadius: 16,
                  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  background: isOnline
                    ? "linear-gradient(180deg, rgba(16, 24, 39, 0.95) 0%, rgba(15, 23, 42, 0.85) 100%)"
                    : "rgba(17, 24, 39, 0.4)",
                  border: isOnline
                    ? "2px solid #22c55e"
                    : "1px solid rgba(255, 255, 255, 0.08)",
                  boxShadow: isOnline
                    ? "0 0 24px rgba(34, 197, 94, 0.25), 0 8px 30px rgba(0, 0, 0, 0.4)"
                    : "none",
                  opacity: isOnline ? 1 : 0.45,
                  filter: isOnline ? "none" : "grayscale(85%)",
                  overflow: "hidden",
                  padding: 24,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                {/* Glowing Top Corner Badge */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "5px 12px",
                      borderRadius: 999,
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      letterSpacing: "0.03em",
                      background: isOnline ? "rgba(34, 197, 94, 0.18)" : "rgba(148, 163, 184, 0.12)",
                      border: isOnline ? "1px solid #22c55e" : "1px solid rgba(148, 163, 184, 0.2)",
                      color: isOnline ? "#4ade80" : "#94a3b8",
                      boxShadow: isOnline ? "0 0 12px rgba(34, 197, 94, 0.35)" : "none",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: isOnline ? "#22c55e" : "#64748b",
                        boxShadow: isOnline ? "0 0 8px #22c55e" : "none",
                      }}
                    />
                    <span>{isOnline ? "ONLINE & READY TO HOST" : "OFFLINE (NOT CONNECTED)"}</span>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.15rem", fontWeight: 800, color: isOnline ? "#4ade80" : "#94a3b8" }}>
                      {money(host.price || 0.60)}<span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#9ca3af" }}>/hr</span>
                    </div>
                  </div>
                </div>

                {/* Host Details */}
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 6px", color: isOnline ? "#ffffff" : "#94a3b8" }}>
                    {host.title}
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#a5b4fc", fontSize: "0.85rem", fontWeight: 600, marginBottom: 16 }}>
                    <Cpu size={16} />
                    <span>{host.gpu}</span>
                  </div>

                  {/* Specs Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: "0.8rem" }}>
                    <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <span style={{ color: "#9ca3af", display: "block", fontSize: "0.72rem" }}>Dedicated VRAM</span>
                      <strong style={{ color: "#f3f4f6" }}>{host.vram}</strong>
                    </div>
                    <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <span style={{ color: "#9ca3af", display: "block", fontSize: "0.72rem" }}>System RAM</span>
                      <strong style={{ color: "#f3f4f6" }}>{host.ram}</strong>
                    </div>
                    <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <span style={{ color: "#9ca3af", display: "block", fontSize: "0.72rem" }}>Region / Edge</span>
                      <strong style={{ color: "#f3f4f6" }}>{host.region}</strong>
                    </div>
                    <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <span style={{ color: "#9ca3af", display: "block", fontSize: "0.72rem" }}>Network Latency</span>
                      <strong style={{ color: isOnline ? "#4ade80" : "#9ca3af" }}>
                        {isOnline ? `⚡ ${host.ping_ms || 22}ms ping` : "N/A"}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Action CTA */}
                <div>
                  {isOnline ? (
                    <button
                      onClick={() => handleSelectHost(host)}
                      disabled={Boolean(launchingHostId)}
                      style={{
                        width: "100%",
                        padding: "13px 20px",
                        borderRadius: 10,
                        border: "none",
                        background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
                        color: "#ffffff",
                        fontWeight: 700,
                        fontSize: "0.92rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        boxShadow: "0 4px 18px rgba(34, 197, 94, 0.4)",
                        transition: "all 0.2s ease",
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
                      onMouseOut={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                    >
                      <Sparkles size={18} />
                      <span>{isLaunching ? "Spinning Up Sandbox..." : "Launch on this Machine"}</span>
                    </button>
                  ) : (
                    <button
                      disabled
                      style={{
                        width: "100%",
                        padding: "13px 20px",
                        borderRadius: 10,
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        background: "rgba(255, 255, 255, 0.04)",
                        color: "#6b7280",
                        fontWeight: 600,
                        fontSize: "0.88rem",
                        cursor: "not-allowed",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      <span>Host Machine Offline</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty Fleet State */}
        {!loading && hosts.length === 0 && (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              background: "rgba(255, 255, 255, 0.02)",
              borderRadius: 16,
              border: "1px dashed rgba(255, 255, 255, 0.1)",
            }}
          >
            <Server size={44} color="#6366f1" style={{ margin: "0 auto 16px" }} />
            <h3 style={{ fontSize: "1.2rem", color: "#f3f4f6", margin: "0 0 8px" }}>No Host Machines Registered</h3>
            <p style={{ color: "#9ca3af", maxWidth: 480, margin: "0 auto 20px", fontSize: "0.88rem" }}>
              Start ProductifyNode on a host laptop or desktop machine to register it as an active GPU node.
            </p>
          </div>
        )}

        {/* Launching Overlay Modal */}
        {launchingHostId && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(5, 5, 10, 0.85)",
              backdropFilter: "blur(10px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 20,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 480,
                background: "#0f172a",
                border: "1px solid rgba(99, 102, 241, 0.4)",
                borderRadius: 20,
                padding: "36px 32px",
                boxShadow: "0 24px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(99, 102, 241, 0.2)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: "rgba(99, 102, 241, 0.15)",
                  border: "2px solid #6366f1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                }}
              >
                <Gamepad2 size={34} color="#818cf8" className="spin-animate" />
              </div>

              <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#ffffff", margin: "0 0 8px" }}>
                Initializing Cloud Gaming Rig
              </h3>
              <p style={{ fontSize: "0.88rem", color: "#94a3b8", margin: "0 0 24px", minHeight: 40 }}>
                {launchStatusText}
              </p>

              {/* Step indicator */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left", fontSize: "0.82rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: launchStep >= 1 ? "#4ade80" : "#64748b" }}>
                  <CheckCircle2 size={16} />
                  <span>1. Reverse Tunnel Node Verification</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: launchStep >= 2 ? "#4ade80" : "#64748b" }}>
                  <CheckCircle2 size={16} />
                  <span>2. Cloudflare R2 Game Package Cache Check</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: launchStep >= 3 ? "#4ade80" : "#64748b" }}>
                  <CheckCircle2 size={16} />
                  <span>3. Isolated GPU Container Allocation</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: launchStep >= 4 ? "#4ade80" : "#64748b" }}>
                  <CheckCircle2 size={16} />
                  <span>4. Sunshine Display Hook & Moonlight WebRTC</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
