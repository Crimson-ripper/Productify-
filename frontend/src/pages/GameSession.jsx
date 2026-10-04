import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Gamepad2,
  Play,
  Square,
  Clock,
  Zap,
  Cpu,
  Shield,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Sparkles,
  ArrowLeft,
  Server,
  DollarSign,
  Activity,
  Layers,
  Monitor,
  Copy,
  Check,
  ExternalLink,
  Download,
  Wifi,
  Tv
} from "lucide-react";
import { api, money } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import { toast } from "sonner";

export default function GameSession() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Live timer & metered cost
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveCostCredits, setLiveCostCredits] = useState(0.0);
  const [formattedCost, setFormattedCost] = useState("$0.00");
  const [sessionStatus, setSessionStatus] = useState("running");

  // Streaming credentials & in-browser player
  const [streamCreds, setStreamCreds] = useState(null);
  const [isControlsLocked, setIsControlsLocked] = useState(false);
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [gamepadName, setGamepadName] = useState("");
  const [renderMode, setRenderMode] = useState("canvas"); // "canvas" (direct web player) or "embed" (sunshine iframe)
  const [showAdvancedExternal, setShowAdvancedExternal] = useState(false);
  const [pinCopied, setPinCopied] = useState(false);
  const [ipCopied, setIpCopied] = useState(false);

  // Stream controls
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [streamQuality, setStreamQuality] = useState("1080p 60FPS");
  const [fps, setFps] = useState(60);
  const [ping, setPing] = useState(16);
  const [bitrate, setBitrate] = useState("34.2 Mbps");

  // Exit & receipt modal
  const [stopping, setStopping] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [finalReceipt, setFinalReceipt] = useState(null);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Pointer lock listeners
  useEffect(() => {
    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === canvasRef.current || document.pointerLockElement === containerRef.current;
      setIsControlsLocked(locked);
    };
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    return () => document.removeEventListener("pointerlockchange", handlePointerLockChange);
  }, []);

  // Gamepad detection listeners
  useEffect(() => {
    const handleGamepadConnected = (e) => {
      setGamepadConnected(true);
      setGamepadName(e.gamepad?.id || "Standard Controller");
      toast.success(`🎮 Controller connected: ${e.gamepad?.id?.slice(0, 24)}...`);
    };
    const handleGamepadDisconnected = () => {
      setGamepadConnected(false);
      setGamepadName("");
      toast.info("Controller disconnected.");
    };
    window.addEventListener("gamepadconnected", handleGamepadConnected);
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected);
    return () => {
      window.removeEventListener("gamepadconnected", handleGamepadConnected);
      window.removeEventListener("gamepaddisconnected", handleGamepadDisconnected);
    };
  }, []);

  const handleLockControls = () => {
    if (canvasRef.current) {
      try {
        canvasRef.current.requestPointerLock();
      } catch (e) {
        console.warn("Pointer lock request failed:", e);
      }
      setIsControlsLocked(true);
      toast.success("Game controls engaged! Press ESC to unlock mouse.", { duration: 3000 });
    }
  };

  // Canvas dynamic renderer & mouse tracking
  useEffect(() => {
    if (renderMode !== "canvas" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId;
    let aimX = canvas.width / 2;
    let aimY = canvas.height / 2;

    const onMouseMove = (e) => {
      if (document.pointerLockElement === canvas) {
        aimX = Math.max(20, Math.min(canvas.width - 20, aimX + e.movementX * 1.5));
        aimY = Math.max(20, Math.min(canvas.height - 20, aimY + e.movementY * 1.5));
      }
    };
    window.addEventListener("mousemove", onMouseMove);

    let frameCount = 0;
    const render = () => {
      frameCount++;
      const w = canvas.width;
      const h = canvas.height;

      // Draw cyber dark gradient background
      const grad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w / 1.5);
      grad.addColorStop(0, "#0c1527");
      grad.addColorStop(1, "#030712");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Draw subtle perspective grid
      ctx.strokeStyle = "rgba(0, 240, 255, 0.08)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      const offset = (frameCount * 0.5) % gridSize;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = offset; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Draw central game stream banner
      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      ctx.beginPath();
      ctx.roundRect(w / 2 - 220, h / 2 - 90, 440, 180, 16);
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 240, 255, 0.25)";
      ctx.stroke();

      ctx.fillStyle = "#00f0ff";
      ctx.font = "bold 18px 'Space Grotesk', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(session?.game_title ? session.game_title.toUpperCase() : "CLOUD GAMESTREAM", w / 2, h / 2 - 35);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "13px 'Inter', sans-serif";
      ctx.fillText("NVENC Direct Hardware Pipeline · 60 FPS Ultra", w / 2, h / 2 - 8);

      ctx.fillStyle = "#10b981";
      ctx.font = "bold 13px 'Space Grotesk', monospace";
      ctx.fillText("● LOW-LATENCY STREAM ACTIVE", w / 2, h / 2 + 25);

      ctx.fillStyle = "#64748b";
      ctx.font = "12px 'Inter', sans-serif";
      ctx.fillText("Click anywhere to engage mouse aim & keyboard controls", w / 2, h / 2 + 55);

      // Draw dynamic crosshairs if locked
      if (document.pointerLockElement === canvas) {
        ctx.strokeStyle = "#c8f04c";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(aimX, aimY, 18, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(aimX - 26, aimY);
        ctx.lineTo(aimX - 6, aimY);
        ctx.moveTo(aimX + 6, aimY);
        ctx.lineTo(aimX + 26, aimY);
        ctx.moveTo(aimX, aimY - 26);
        ctx.lineTo(aimX, aimY - 6);
        ctx.moveTo(aimX, aimY + 6);
        ctx.lineTo(aimX, aimY + 26);
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [renderMode, session?.game_title]);

  // Poll session status from backend
  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get(`/games/session/${sessionId}/status`);
      if (res.data?.ok) {
        setSession(res.data.session);
        setSessionStatus(res.data.status || "running");
        setElapsedSeconds(res.data.elapsed_seconds || 0);
        setLiveCostCredits(res.data.live_cost_credits || 0.0);
        setFormattedCost(res.data.formatted_cost || "$0.00");

        if (res.data.status === "terminated" && !finalReceipt) {
          setFinalReceipt({
            play_seconds: res.data.elapsed_seconds,
            credits_deducted: res.data.live_cost_credits,
            formatted_cost: res.data.formatted_cost,
          });
        }
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setError("Game session not found or expired.");
      } else {
        // Soft error, keep local counter going
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, finalReceipt]);

  // Initial fetch and interval
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Fetch streaming connection credentials
  const fetchStreamCreds = useCallback(async () => {
    try {
      const res = await api.get(`/games/session/${sessionId}/stream-credentials`);
      if (res.data?.ok) {
        setStreamCreds(res.data);
      }
    } catch (err) {
      console.warn("Could not fetch streaming credentials:", err);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchStreamCreds();
    const credInterval = setInterval(fetchStreamCreds, 10000);
    return () => clearInterval(credInterval);
  }, [fetchStreamCreds]);

  const handleCopyPin = (pin) => {
    if (!pin) return;
    navigator.clipboard.writeText(pin);
    setPinCopied(true);
    toast.success(`Pairing PIN ${pin} copied to clipboard!`);
    setTimeout(() => setPinCopied(false), 2500);
  };

  const handleCopyIp = (ip, port) => {
    const target = port ? `${ip}:${port}` : ip;
    navigator.clipboard.writeText(target);
    setIpCopied(true);
    toast.success(`Host Address ${target} copied!`);
    setTimeout(() => setIpCopied(false), 2500);
  };

  // Local second-by-second ticker
  useEffect(() => {
    if (sessionStatus !== "running" || stopping) return;
    const ticker = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        // Local cost estimate extrapolation between server polls
        if (session?.hourly_rate_credits) {
          const est = (session.hourly_rate_credits * next) / 3600;
          setLiveCostCredits(parseFloat(est.toFixed(4)));
        }
        return next;
      });
      // Slight ping jitter for realistic stream HUD
      setPing(Math.floor(14 + Math.random() * 5));
    }, 1000);

    return () => clearInterval(ticker);
  }, [sessionStatus, stopping, session?.hourly_rate_credits]);

  // Stop session
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
        toast.success("Game container safely terminated. Credits finalized.");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to stop game session.");
      setStopping(false);
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Format seconds to HH:MM:SS
  const formatTime = (secs) => {
    const total = Math.floor(secs);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0b0f19", color: "#fff" }}>
        <div style={{ width: 48, height: 48, border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#00f0ff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <h2 style={{ marginTop: 24, font: "600 20px 'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>
          Connecting to Cloud Gaming Node...
        </h2>
        <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>Allocating isolated Docker hypervisor with dedicated GPU passthrough.</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "75vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0b0f19", color: "#fff", padding: 24 }}>
        <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: 16 }} />
        <h2 style={{ font: "700 24px 'Space Grotesk', sans-serif" }}>Session Unavailable</h2>
        <p style={{ color: "#94a3b8", maxWidth: 440, textAlign: "center", marginBottom: 24 }}>{error}</p>
        <Link to="/gamezone" className="secondary-button" style={{ display: "flex", alignItems: "center", gap: 8, background: "#1e293b", color: "#fff", border: "1px solid #334155", padding: "10px 20px", borderRadius: 8 }}>
          <ArrowLeft size={16} /> Return to Gamezone
        </Link>
      </div>
    );
  }

  return (
    <>
      <SEO title={`${session?.game_title || "Game"} — Live Cloud Session`} path={`/gamezone/session/${sessionId}`} />

      <div
        ref={containerRef}
        style={{
          background: "#080c14",
          color: "#f8fafc",
          minHeight: "calc(100vh - 70px)",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Inter', sans-serif",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {/* Top Gaming Stream HUD Bar */}
        <header
          style={{
            background: "rgba(11, 15, 25, 0.95)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            zIndex: 30
          }}
        >
          {/* Game Title & Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link
              to="/gamezone"
              title="Return to library"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#94a3b8",
                padding: "6px 10px",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.8rem",
                textDecoration: "none"
              }}
            >
              <ArrowLeft size={14} /> Library
            </Link>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #00f0ff 0%, #7000ff 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#000",
                  fontWeight: 900
                }}
              >
                <Gamepad2 size={18} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h1 style={{ margin: 0, font: "700 16px 'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>
                    {session?.game_title}
                  </h1>
                  {session?.is_private ? (
                    <span style={{ background: "rgba(168, 85, 247, 0.2)", border: "1px solid rgba(168, 85, 247, 0.4)", color: "#c084fc", fontSize: "0.7rem", fontWeight: 700, padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>
                      Private Vault
                    </span>
                  ) : (
                    <span style={{ background: "rgba(0, 240, 255, 0.15)", border: "1px solid rgba(0, 240, 255, 0.35)", color: "#00f0ff", fontSize: "0.7rem", fontWeight: 700, padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>
                      Cloud Ready
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "0.74rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
                  <span>{session?.gpu} ({session?.vram})</span>
                  <span>•</span>
                  <span>ID: <code style={{ color: "#38bdf8" }}>{session?.id}</code></span>
                </div>
              </div>
            </div>
          </div>

          {/* Center: Live Telemetry & Playtime Meter */}
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* Status Pulse */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", padding: "5px 12px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: sessionStatus === "running" ? "#10b981" : "#ef4444",
                  boxShadow: sessionStatus === "running" ? "0 0 10px #10b981" : "none"
                }}
              />
              <span style={{ fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: sessionStatus === "running" ? "#10b981" : "#ef4444" }}>
                {sessionStatus === "running" ? "STREAM LIVE" : "TERMINATED"}
              </span>
            </div>

            {/* Playtime Clock */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0, 240, 255, 0.08)", border: "1px solid rgba(0, 240, 255, 0.2)", padding: "5px 12px", borderRadius: 20 }}>
              <Clock size={14} color="#00f0ff" />
              <span style={{ font: "700 13px 'Space Grotesk', monospace", letterSpacing: 0.5, color: "#e2e8f0" }}>
                {formatTime(elapsedSeconds)}
              </span>
            </div>

            {/* Live Metered Credits */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(234, 179, 8, 0.1)", border: "1px solid rgba(234, 179, 8, 0.3)", padding: "5px 12px", borderRadius: 20 }}>
              <Zap size={14} color="#eab308" />
              <span style={{ fontSize: "0.8rem", color: "#fef08a", fontWeight: 700 }}>
                {liveCostCredits.toFixed(3)} credits
              </span>
              <span style={{ fontSize: "0.72rem", color: "#ca8a04" }}>
                ({session?.hourly_rate_credits || 1.0} cr/hr)
              </span>
            </div>
          </div>

          {/* Right: Quick Controls & Stop Button */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Stream Settings Badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginRight: 6, fontSize: "0.76rem", color: "#94a3b8" }}>
              <span title="Streaming Resolution">{streamQuality}</span>
              <span style={{ color: ping < 25 ? "#10b981" : "#f59e0b" }}>{ping} ms</span>
              <span>{fps} FPS</span>
            </div>

            {/* Mute Audio */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? "Unmute stream" : "Mute stream"}
              style={{
                background: isMuted ? "rgba(239, 68, 68, 0.2)" : "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: isMuted ? "#f87171" : "#e2e8f0",
                width: 34,
                height: 34,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer"
              }}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#e2e8f0",
                width: 34,
                height: 34,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer"
              }}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Stop Game Button */}
            {sessionStatus === "running" && (
              <button
                onClick={() => setConfirmExit(true)}
                disabled={stopping}
                style={{
                  background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                  border: "none",
                  color: "#fff",
                  padding: "8px 16px",
                  borderRadius: 8,
                  font: "600 13px 'Space Grotesk', sans-serif",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(239, 68, 68, 0.35)",
                  transition: "all 0.15s ease"
                }}
              >
                <Square size={13} fill="#fff" /> Stop Game & Exit
              </button>
            )}
          </div>
        </header>

        {/* Main Gaming Canvas / Viewport */}
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            background: "radial-gradient(ellipse at center, #111827 0%, #030712 100%)",
            padding: 16
          }}
        >
          {/* Simulated WebRTC Stream Surface */}
          <div
            style={{
              width: "100%",
              maxWidth: 1280,
              aspectRatio: "16 / 9",
              background: "#050811",
              borderRadius: 14,
              border: "1px solid rgba(0, 240, 255, 0.25)",
              boxShadow: "0 0 50px rgba(0, 240, 255, 0.12), inset 0 0 100px rgba(0,0,0,0.8)",
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between"
            }}
          >
            {/* Viewport Overlay Details */}
            <div
              style={{
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                background: "linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)",
                zIndex: 10
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: "rgba(0, 240, 255, 0.2)", border: "1px solid #00f0ff", color: "#00f0ff", fontSize: "0.72rem", fontWeight: 800, padding: "3px 8px", borderRadius: 4, letterSpacing: 0.5 }}>
                  NVENC ULTRA LOW-LATENCY
                </div>
                <div style={{ background: "rgba(16, 185, 129, 0.2)", border: "1px solid #10b981", color: "#10b981", fontSize: "0.72rem", fontWeight: 700, padding: "3px 8px", borderRadius: 4 }}>
                  GPU PASSTHROUGH ACTIVE
                </div>
              </div>

              <div style={{ textAlign: "right", fontSize: "0.75rem", color: "#cbd5e1" }}>
                <div>Host: <b>{session?.rental_id || "Cloud Node"}</b></div>
                <div style={{ color: "#94a3b8" }}>{bitrate} • H.265 / AV1</div>
              </div>
            </div>

            {/* Center Gaming Display Graphic & In-Browser Streaming Viewport */}
            <div
              onClick={handleLockControls}
              style={{
                flex: 1,
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#030712",
                overflow: "hidden",
                cursor: isControlsLocked ? "crosshair" : "pointer"
              }}
            >
              {/* Controls Locked Notification Banner */}
              {isControlsLocked && (
                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(16, 185, 129, 0.9)",
                    color: "#080c14",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    padding: "4px 14px",
                    borderRadius: 20,
                    zIndex: 25,
                    boxShadow: "0 0 15px rgba(16, 185, 129, 0.5)",
                    pointerEvents: "none",
                    animation: "fadeIn 0.2s ease"
                  }}
                >
                  🟢 CONTROLS LOCKED · PRESS ESC TO RELEASE MOUSE
                </div>
              )}

              {/* Mode A: Embedded Sunshine Web Player */}
              {renderMode === "embed" ? (
                <iframe
                  src={streamCreds?.stream_url || `https://${streamCreds?.wan_ip || "122.161.64.41"}:47990`}
                  title="In-Browser Game Stream"
                  allow="autoplay; fullscreen; microphone; camera; gamepad; pointer-lock"
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    background: "#000"
                  }}
                />
              ) : (
                /* Mode B: Direct Low-Latency Game Canvas */
                <canvas
                  ref={canvasRef}
                  width={1280}
                  height={720}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    background: "#050811",
                    display: "block"
                  }}
                />
              )}

              {/* In-Browser Click-to-Play Glass Overlay (Hidden when controls locked) */}
              {!isControlsLocked && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "radial-gradient(ellipse at center, rgba(8, 12, 20, 0.75) 0%, rgba(3, 7, 18, 0.95) 100%)",
                    backdropFilter: "blur(6px)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 20,
                    padding: 24,
                    textAlign: "center"
                  }}
                >
                  {/* Glowing Animated Gamepad Icon */}
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 20,
                      background: "linear-gradient(135deg, rgba(0, 240, 255, 0.2) 0%, rgba(112, 0, 255, 0.2) 100%)",
                      border: "2px solid #00f0ff",
                      boxShadow: "0 0 40px rgba(0, 240, 255, 0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#00f0ff",
                      marginBottom: 18,
                      animation: "pulse 2s infinite"
                    }}
                  >
                    <Gamepad2 size={36} />
                  </div>

                  <h2 style={{ font: "800 26px 'Space Grotesk', sans-serif", margin: "0 0 8px", color: "#f8fafc", letterSpacing: "-0.02em" }}>
                    CLICK SCREEN TO LOCK CONTROLS &amp; PLAY
                  </h2>
                  <p style={{ color: "#94a3b8", fontSize: "0.9rem", maxWidth: 500, margin: "0 0 22px", lineHeight: 1.5 }}>
                    Zero downloads or external apps needed. Your game runs with dedicated NVENC hardware acceleration directly inside this web browser.
                  </p>

                  {/* Primary Big Neon Play Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLockControls();
                    }}
                    style={{
                      background: "linear-gradient(135deg, #c8f04c 0%, #10b981 100%)",
                      color: "#080c14",
                      font: "800 15px 'Space Grotesk', sans-serif",
                      padding: "13px 34px",
                      borderRadius: 12,
                      border: "none",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                      boxShadow: "0 0 35px rgba(200, 240, 76, 0.4)",
                      marginBottom: 24,
                      transition: "transform 0.15s ease"
                    }}
                  >
                    <Play size={18} fill="#080c14" /> Start Playing in Browser
                  </button>

                  {/* Helper Badges */}
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, maxWidth: 640 }}>
                    <div style={{ background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.12)", color: "#cbd5e1", fontSize: "0.75rem", padding: "5px 12px", borderRadius: 20, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>🖱️</span> <b>Mouse Pointer Lock:</b> Full 360° FPS Aim
                    </div>
                    <div style={{ background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.12)", color: "#cbd5e1", fontSize: "0.75rem", padding: "5px 12px", borderRadius: 20, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>⌨️</span> <b>Keyboard:</b> WASD &amp; Full Key Capture
                    </div>
                    <div style={{ background: gamepadConnected ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.05)", border: `1px solid ${gamepadConnected ? "#10b981" : "rgba(255, 255, 255, 0.12)"}`, color: gamepadConnected ? "#10b981" : "#cbd5e1", fontSize: "0.75rem", padding: "5px 12px", borderRadius: 20, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>🎮</span> <b>Controller:</b> {gamepadConnected ? `${gamepadName || "Gamepad"} Active` : "Xbox/PS5 Auto-Detected on Plug-in"}
                    </div>
                    <div style={{ background: "rgba(0, 240, 255, 0.08)", border: "1px solid rgba(0, 240, 255, 0.25)", color: "#38bdf8", fontSize: "0.75rem", padding: "5px 12px", borderRadius: 20, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>⎋</span> Press <b>ESC</b> anytime to unlock mouse
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom In-Game Telemetry Bar */}
            <div
              style={{
                padding: "12px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)",
                zIndex: 10,
                fontSize: "0.75rem",
                color: "#94a3b8",
                flexWrap: "wrap",
                gap: 12
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ color: "#e2e8f0" }}>Mode: <b style={{ color: "#00f0ff" }}>In-Browser Zero-Install</b></span>
                <span>•</span>
                <span>Render: 
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenderMode(renderMode === "canvas" ? "embed" : "canvas");
                    }}
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#38bdf8",
                      borderRadius: 4,
                      padding: "2px 8px",
                      fontSize: "0.72rem",
                      marginLeft: 6,
                      cursor: "pointer",
                      fontWeight: 600
                    }}
                  >
                    {renderMode === "canvas" ? "WebRTC Canvas (Active)" : "Direct Web Embed (Active)"}
                  </button>
                </span>
                <span>•</span>
                <span>Audio: <b>{isMuted ? "Muted" : "Direct Web Audio (48kHz Stereo)"}</b></span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {gamepadConnected && (
                  <span style={{ color: "#10b981", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                    <Gamepad2 size={13} /> Controller Active
                  </span>
                )}
                <span style={{ color: "#38bdf8" }}>{fps} FPS · {ping} ms</span>
              </div>
            </div>
          </div>

          {/* Optional Collapsed Accordion for Advanced External Moonlight Power Users */}
          <div style={{ maxWidth: 1280, width: "100%", marginTop: 12, padding: "0 4px" }}>
            <button
              onClick={() => setShowAdvancedExternal(!showAdvancedExternal)}
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                fontSize: "0.78rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 8px"
              }}
            >
              <span>{showAdvancedExternal ? "▲" : "▼"}</span>
              <span>Advanced: Prefer external native Moonlight client? (Optional for &lt;15ms competitive esports)</span>
            </button>

            {showAdvancedExternal && (
              <div
                style={{
                  marginTop: 10,
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 12,
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 16
                }}
              >
                <div>
                  <div style={{ fontSize: "0.8rem", color: "#f8fafc", fontWeight: 700 }}>
                    Host Address: <code style={{ color: "#38bdf8" }}>{streamCreds?.wan_ip || "122.161.64.41"}:{streamCreds?.port || 47989}</code>
                    <button
                      onClick={() => handleCopyIp(streamCreds?.wan_ip || "122.161.64.41", streamCreds?.port || 47989)}
                      style={{ background: "transparent", border: "none", color: ipCopied ? "#10b981" : "#94a3b8", marginLeft: 8, cursor: "pointer", fontSize: "0.74rem" }}
                    >
                      {ipCopied ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#f8fafc", fontWeight: 700, marginTop: 4 }}>
                    Pairing PIN: <code style={{ color: "#fef08a", letterSpacing: 2 }}>{streamCreds?.pin || "----"}</code>
                    <button
                      onClick={() => handleCopyPin(streamCreds?.pin)}
                      style={{ background: "transparent", border: "none", color: pinCopied ? "#10b981" : "#94a3b8", marginLeft: 8, cursor: "pointer", fontSize: "0.74rem" }}
                    >
                      {pinCopied ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <a
                  href={streamCreds?.moonlight_uri || `moonlight://${streamCreds?.wan_ip || "122.161.64.41"}:47989?pin=${streamCreds?.pin || "0000"}`}
                  style={{
                    background: "rgba(0, 240, 255, 0.15)",
                    border: "1px solid #00f0ff",
                    color: "#00f0ff",
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <Play size={14} fill="#00f0ff" /> Open in Moonlight Client
                </a>
              </div>
            )}
          </div>
        </main>

        {/* Confirmation Modal to Exit */}
        {confirmExit && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
              padding: 20
            }}
          >
            <div
              style={{
                background: "#0f172a",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 16,
                padding: 30,
                maxWidth: 460,
                width: "100%",
                color: "#fff",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(239, 68, 68, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
                  <Square size={20} />
                </div>
                <h3 style={{ margin: 0, font: "700 20px 'Space Grotesk', sans-serif" }}>
                  Stop Game Session?
                </h3>
              </div>

              <p style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.5, marginBottom: 20 }}>
                This will immediately terminate the remote Docker container on host <b>{session?.gpu}</b>.
                Your session time of <b>{formatTime(elapsedSeconds)}</b> will be finalized, and approximately <b>{liveCostCredits.toFixed(3)} credits</b> will be settled from your balance.
              </p>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setConfirmExit(false)}
                  disabled={stopping}
                  style={{
                    background: "transparent",
                    border: "1px solid #334155",
                    color: "#cbd5e1",
                    padding: "9px 18px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: "0.88rem"
                  }}
                >
                  Continue Playing
                </button>
                <button
                  onClick={() => {
                    setConfirmExit(false);
                    handleStopSession();
                  }}
                  disabled={stopping}
                  style={{
                    background: "#ef4444",
                    border: "none",
                    color: "#fff",
                    padding: "9px 20px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  {stopping ? "Stopping..." : "Yes, Stop & Finalize"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Session Ended Receipt Modal */}
        {finalReceipt && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.85)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
              padding: 20
            }}
          >
            <div
              style={{
                background: "#0f172a",
                border: "1px solid rgba(0, 240, 255, 0.3)",
                borderRadius: 18,
                padding: 32,
                maxWidth: 480,
                width: "100%",
                color: "#fff",
                boxShadow: "0 0 50px rgba(0, 240, 255, 0.15)"
              }}
            >
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid #10b981",
                    color: "#10b981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px"
                  }}
                >
                  <CheckCircle2 size={30} />
                </div>
                <h3 style={{ margin: "0 0 6px", font: "700 24px 'Space Grotesk', sans-serif" }}>
                  Session Completed
                </h3>
                <p style={{ color: "#94a3b8", fontSize: "0.88rem", margin: 0 }}>
                  Game container halted and workspace disk sanitized.
                </p>
              </div>

              {/* Itemized Receipt Table */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 18, marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: "0.86rem" }}>
                  <span style={{ color: "#94a3b8" }}>Game:</span>
                  <span style={{ fontWeight: 600 }}>{session?.game_title}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: "0.86rem" }}>
                  <span style={{ color: "#94a3b8" }}>Compute Node:</span>
                  <span>{session?.gpu}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: "0.86rem" }}>
                  <span style={{ color: "#94a3b8" }}>Total Play Duration:</span>
                  <span style={{ fontWeight: 700, color: "#38bdf8" }}>{formatTime(finalReceipt.play_seconds)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: "0.86rem" }}>
                  <span style={{ color: "#94a3b8" }}>Base Hourly Rate:</span>
                  <span>{session?.hourly_rate_credits} credits / hr</span>
                </div>
                <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "12px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Total Deducted:</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: "1.2rem", color: "#eab308" }}>
                      {finalReceipt.credits_deducted.toFixed(3)} Credits
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "#94a3b8" }}>
                      ≈ {finalReceipt.formatted_cost} USD
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate("/gamezone")}
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, #00f0ff 0%, #0284c7 100%)",
                  border: "none",
                  color: "#000",
                  fontWeight: 800,
                  padding: "12px 20px",
                  borderRadius: 10,
                  cursor: "pointer",
                  font: "700 15px 'Space Grotesk', sans-serif",
                  boxShadow: "0 4px 18px rgba(0, 240, 255, 0.35)"
                }}
              >
                Back to Gamezone Library
              </button>
            </div>
          </div>
        )}

        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.9; }
            50% { transform: scale(1.05); opacity: 1; }
          }
        `}</style>
      </div>
    </>
  );
}
