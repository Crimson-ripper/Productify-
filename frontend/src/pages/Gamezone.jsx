import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Gamepad2,
  Sparkles,
  Zap,
  Play,
  Upload,
  Lock,
  ShieldCheck,
  Search,
  Clock,
  Cpu,
  Layers,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Info,
  Server,
  DollarSign
} from "lucide-react";
import { api, money, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import { toast } from "sonner";

export default function Gamezone() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("library"); // "library" | "submit" | "private"
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [genres, setGenres] = useState(["All"]);
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Play Modal State
  const [selectedGame, setSelectedGame] = useState(null);
  const [launchingSession, setLaunchingSession] = useState(false);
  const [availableRentals, setAvailableRentals] = useState([]);
  const [selectedRentalId, setSelectedRentalId] = useState("");

  // Community Submit State
  const [submitForm, setSubmitForm] = useState({
    title: "",
    genre: "Indie",
    description: "",
    package_url: "",
    version: "v1.0.0",
    min_gpu: "NVIDIA GTX 1060 (6 GB)",
    suggested_hourly_rate: 0.80,
    cover_image: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [mySubmissions, setMySubmissions] = useState([]);

  // Private Games State
  const [privateGames, setPrivateGames] = useState([]);
  const [privateLoading, setPrivateLoading] = useState(false);
  const [privateUploadForm, setPrivateUploadForm] = useState({
    title: "",
    package_url: "",
    package_size_gb: 15.0,
    launch_executable: "Game.exe",
    description: "",
  });
  const [uploadingPrivate, setUploadingPrivate] = useState(false);
  const [privateQuote, setPrivateQuote] = useState(null);
  const [selectedPrivateGame, setSelectedPrivateGame] = useState(null);

  // Load public games catalog
  const fetchGames = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedGenre !== "All") params.append("genre", selectedGenre);
      if (searchQuery.trim()) params.append("q", searchQuery.trim());
      const res = await api.get(`/games?${params.toString()}`);
      if (res.data?.games) {
        setGames(res.data.games);
        if (res.data.genres) setGenres(res.data.genres);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load games catalog"));
    } finally {
      setLoading(false);
    }
  }, [selectedGenre, searchQuery]);

  // Load available GPU nodes for hosting
  const fetchRentals = useCallback(async () => {
    try {
      const res = await api.get("/rentals");
      const list = res.data?.rentals || res.data || [];
      setAvailableRentals(list);
      if (list.length > 0 && !selectedRentalId) {
        setSelectedRentalId(list[0].id);
      }
    } catch {
      // Fallback
    }
  }, [selectedRentalId]);

  // Load user's private games
  const fetchPrivateGames = useCallback(async () => {
    if (!user) return;
    setPrivateLoading(true);
    try {
      const res = await api.get("/games/private");
      setPrivateGames(res.data?.private_games || []);
    } catch {
      setPrivateGames([]);
    } finally {
      setPrivateLoading(false);
    }
  }, [user]);

  // Load user's submissions
  const fetchMySubmissions = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get("/games/my-submissions");
      setMySubmissions(res.data?.submissions || []);
    } catch {}
  }, [user]);

  useEffect(() => {
    fetchGames();
    fetchRentals();
  }, [fetchGames, fetchRentals]);

  useEffect(() => {
    if (activeTab === "private") fetchPrivateGames();
    if (activeTab === "submit") fetchMySubmissions();
  }, [activeTab, fetchPrivateGames, fetchMySubmissions]);

  // Fetch private pricing quote when rental changes
  useEffect(() => {
    async function loadQuote() {
      if (!selectedRentalId || !user) return;
      try {
        const res = await api.post("/games/private/quote", {
          rental_id: selectedRentalId
        });
        setPrivateQuote(res.data?.pricing);
      } catch {}
    }
    if (activeTab === "private") {
      loadQuote();
    }
  }, [selectedRentalId, user, activeTab]);

  // Launch Library Game (Supports 1-Click direct launch or modal launch)
  const handleLaunchGame = useCallback(async (targetGame) => {
    const gameToPlay = (targetGame && targetGame.id) ? targetGame : selectedGame;
    if (!gameToPlay) return;

    if (!user) {
      sessionStorage.setItem("productify_pending_game", JSON.stringify(gameToPlay));
      toast.info(`Please sign in to launch ${gameToPlay.title}.`);
      navigate("/login");
      return;
    }

    setLaunchingSession(gameToPlay.id || true);
    try {
      const res = await api.post("/games/play", {
        game_id: gameToPlay.id,
        rental_id: selectedRentalId || undefined
      });
      if (res.data?.session?.id) {
        toast.success(`Spinning up isolated GPU container for ${gameToPlay.title}!`);
        setSelectedGame(null);
        navigate(`/gamezone/session/${res.data.session.id}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to start game session"));
    } finally {
      setLaunchingSession(false);
    }
  }, [user, selectedGame, selectedRentalId, navigate]);

  // Auto-launch pending game when user logs in
  useEffect(() => {
    if (user) {
      const rawPending = sessionStorage.getItem("productify_pending_game");
      if (rawPending) {
        try {
          const pendingGame = JSON.parse(rawPending);
          sessionStorage.removeItem("productify_pending_game");
          if (pendingGame && pendingGame.id) {
            handleLaunchGame(pendingGame);
          }
        } catch {
          sessionStorage.removeItem("productify_pending_game");
        }
      }
    }
  }, [user, handleLaunchGame]);

  // Launch Private Game
  const handleLaunchPrivateGame = async (pgame) => {
    if (!user) {
      navigate("/login");
      return;
    }
    setLaunchingSession(true);
    try {
      const res = await api.post("/games/play", {
        private_game_id: pgame.id,
        rental_id: selectedRentalId || undefined
      });
      if (res.data?.session?.id) {
        toast.success(`Private container launched for ${pgame.title}!`);
        navigate(`/gamezone/session/${res.data.session.id}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to launch private game container"));
    } finally {
      setLaunchingSession(false);
    }
  };

  // Submit community game
  const handleSubmitGame = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate("/login");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post("/games/submit", submitForm);
      toast.success(res.data?.message || "Game submitted for safety review!");
      setSubmitForm({
        title: "",
        genre: "Indie",
        description: "",
        package_url: "",
        version: "v1.0.0",
        min_gpu: "NVIDIA GTX 1060 (6 GB)",
        suggested_hourly_rate: 0.80,
        cover_image: "",
      });
      fetchMySubmissions();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to submit game"));
    } finally {
      setSubmitting(false);
    }
  };

  // Upload private game
  const handleUploadPrivateGame = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate("/login");
      return;
    }
    setUploadingPrivate(true);
    try {
      await api.post("/games/private/upload", privateUploadForm);
      toast.success("Private game registered in your vault!");
      setPrivateUploadForm({
        title: "",
        package_url: "",
        package_size_gb: 15.0,
        launch_executable: "Game.exe",
        description: "",
      });
      fetchPrivateGames();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save private game"));
    } finally {
      setUploadingPrivate(false);
    }
  };

  // Delete private game
  const handleDeletePrivateGame = async (pgameId) => {
    if (!window.confirm("Remove this game from your private vault?")) return;
    try {
      await api.delete(`/games/private/${pgameId}`);
      toast.success("Game removed.");
      fetchPrivateGames();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not delete game"));
    }
  };

  return (
    <>
      <SEO
        title="Gamezone — High-Performance Cloud Gaming & Remote GPU Hypervisor"
        description="Stream AAA and indie games instantly in 4K 120 FPS on distributed cloud GPUs. Metered hourly rates in platform credits."
        path="/gamezone"
      />

      <div className="gamezone-container" style={{ minHeight: "100vh", background: "#0a0b0e", color: "#f3f4f6" }}>
        
        {/* ===================== HERO SECTION ===================== */}
        <section
          style={{
            position: "relative",
            padding: "60px 5% 48px",
            background: "radial-gradient(ellipse at 50% 0%, rgba(99, 102, 241, 0.22) 0%, rgba(10, 11, 14, 0.98) 75%)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            overflow: "hidden"
          }}
        >
          <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 2 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(99, 102, 241, 0.15)", border: "1px solid rgba(99, 102, 241, 0.35)", padding: "6px 14px", borderRadius: 999, fontSize: "0.8rem", color: "#a5b4fc", fontWeight: 600, marginBottom: 18 }}>
              <Sparkles size={14} /> ZERO DOWNLOADS · INSTANT CLOUD CONTAINERS · DISTRIBUTED GPUS
            </div>

            <h1 style={{ font: "800 clamp(32px, 5vw, 54px) 'Space Grotesk', sans-serif", letterSpacing: "-0.04em", margin: "0 0 16px", color: "#ffffff", lineHeight: 1.1 }}>
              Productify <span style={{ background: "linear-gradient(135deg, #a855f7 0%, #6366f1 50%, #38bdf8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Gamezone</span><em>.</em>
            </h1>

            <p style={{ maxWidth: 640, color: "#9ca3af", fontSize: "1.05rem", lineHeight: 1.6, margin: "0 0 28px" }}>
              Launch ready-to-play AAA titles and indie games on dedicated physical GPUs inside isolated Docker containers. Pay only for the minutes you play with unified platform credits.
            </p>

            {/* Quick Metrics Bar */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", paddingTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.07)", padding: "10px 18px", borderRadius: 10 }}>
                <Cpu size={18} color="#38bdf8" />
                <div>
                  <div style={{ fontSize: "0.72rem", color: "#9ca3af", textTransform: "uppercase", fontWeight: 700 }}>Host Fleet</div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>RTX 4090 · A100 · 3090</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.07)", padding: "10px 18px", borderRadius: 10 }}>
                <Zap size={18} color="#10b981" />
                <div>
                  <div style={{ fontSize: "0.72rem", color: "#9ca3af", textTransform: "uppercase", fontWeight: 700 }}>Performance</div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>4K 120 FPS Ready</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.07)", padding: "10px 18px", borderRadius: 10 }}>
                <Clock size={18} color="#eab308" />
                <div>
                  <div style={{ fontSize: "0.72rem", color: "#9ca3af", textTransform: "uppercase", fontWeight: 700 }}>Metered Billing</div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Credits / Hour</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== TAB CONTROLS ===================== */}
        <section style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 5% 0" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: 16 }}>
            <button
              onClick={() => setActiveTab("library")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
                border: "none",
                background: activeTab === "library" ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" : "rgba(255, 255, 255, 0.06)",
                color: activeTab === "library" ? "#ffffff" : "#d1d5db",
                transition: "all 0.15s ease"
              }}
            >
              <Gamepad2 size={16} /> Ready-to-Play Library
            </button>

            <button
              onClick={() => setActiveTab("submit")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
                border: "none",
                background: activeTab === "submit" ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" : "rgba(255, 255, 255, 0.06)",
                color: activeTab === "submit" ? "#ffffff" : "#d1d5db",
                transition: "all 0.15s ease"
              }}
            >
              <Upload size={16} /> Submit Game to Library
            </button>

            <button
              onClick={() => setActiveTab("private")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
                border: "none",
                background: activeTab === "private" ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" : "rgba(255, 255, 255, 0.06)",
                color: activeTab === "private" ? "#ffffff" : "#d1d5db",
                transition: "all 0.15s ease"
              }}
            >
              <Lock size={16} /> Play Your Own Game (Private Vault)
            </button>
          </div>
        </section>

        {/* ===================== TAB CONTENT: LIBRARY ===================== */}
        {activeTab === "library" && (
          <section style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 5% 80px" }}>
            
            {/* Filters & Search */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
              {/* Genre Pills */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {genres.map((g) => (
                  <button
                    key={g}
                    onClick={() => setSelectedGenre(g)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 999,
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: selectedGenre === g ? "1px solid #8b5cf6" : "1px solid rgba(255, 255, 255, 0.12)",
                      background: selectedGenre === g ? "rgba(139, 92, 246, 0.2)" : "rgba(255, 255, 255, 0.04)",
                      color: selectedGenre === g ? "#c4b5fd" : "#9ca3af",
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div style={{ position: "relative", minWidth: 260 }}>
                <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#6b7280" }} />
                <input
                  type="text"
                  placeholder="Search games, tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 14px 8px 36px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: 8,
                    color: "#f3f4f6",
                    fontSize: "0.85rem",
                    outline: "none"
                  }}
                />
              </div>
            </div>

            {/* Game Cards Grid */}
            {loading ? (
              <div style={{ textAlign: "center", padding: "80px 20px", color: "#9ca3af" }}>
                <div className="spinner" style={{ margin: "0 auto 16px" }} />
                Loading Gamezone Library...
              </div>
            ) : games.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 20px", background: "rgba(255, 255, 255, 0.02)", borderRadius: 12, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <Gamepad2 size={42} color="#6b7280" style={{ margin: "0 auto 12px" }} />
                <h3 style={{ margin: "0 0 6px", color: "#e5e7eb" }}>No games found</h3>
                <p style={{ color: "#9ca3af", fontSize: "0.9rem", margin: 0 }}>Try clearing filters or search query.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
                {games.map((game) => (
                  <div
                    key={game.id}
                    onClick={() => setSelectedGame(game)}
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 14,
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      cursor: "pointer",
                      transition: "transform 0.15s ease, border-color 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px)";
                      e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                    }}
                  >
                    {/* Cover Banner */}
                    <div style={{ position: "relative", height: 180, width: "100%", background: "#1f2937", overflow: "hidden" }}>
                      <img
                        src={game.cover_image}
                        alt={game.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          top: 12,
                          left: 12,
                          background: "rgba(10, 11, 14, 0.8)",
                          backdropFilter: "blur(6px)",
                          padding: "4px 10px",
                          borderRadius: 6,
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "#c4b5fd",
                          border: "1px solid rgba(255, 255, 255, 0.1)"
                        }}
                      >
                        {game.genre}
                      </div>

                      {game.featured && (
                        <div
                          style={{
                            position: "absolute",
                            top: 12,
                            right: 12,
                            background: "linear-gradient(135deg, #f59e0b, #d97706)",
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontSize: "0.72rem",
                            fontWeight: 800,
                            color: "#ffffff"
                          }}
                        >
                          ★ FEATURED
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", flex: 1 }}>
                      <h3 style={{ margin: "0 0 8px", font: "700 18px 'Space Grotesk', sans-serif", color: "#ffffff" }}>
                        {game.title}
                      </h3>

                      <p style={{ margin: "0 0 16px", color: "#9ca3af", fontSize: "0.85rem", lineHeight: 1.5, flex: 1 }}>
                        {game.description.slice(0, 115)}...
                      </p>

                      {/* Specs Badge */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.75rem", color: "#a5b4fc", background: "rgba(99, 102, 241, 0.1)", padding: "6px 10px", borderRadius: 6, marginBottom: 16 }}>
                        <Cpu size={14} />
                        <span>Min GPU: <b>{game.min_gpu_vram}</b> ({game.recommended_gpu})</span>
                      </div>

                      {/* Pricing & Play Action */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
                        <div>
                          <div style={{ fontSize: "0.7rem", color: "#9ca3af", textTransform: "uppercase", fontWeight: 700 }}>Rate</div>
                          <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#10b981", fontFeatureSettings: "'tnum' on" }}>
                            {game.hourly_rate_credits.toFixed(2)} <span style={{ fontSize: "0.75rem", color: "#6ee7b7", fontWeight: 600 }}>credits/hr</span>
                          </div>
                          {game.rate_inr && (
                            <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>
                              ~₹{Math.round(game.rate_inr)}/hr
                            </div>
                          )}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLaunchGame(game);
                          }}
                          disabled={Boolean(launchingSession)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "9px 18px",
                            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 8,
                            fontWeight: 700,
                            fontSize: "0.88rem",
                            cursor: "pointer",
                            boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)"
                          }}
                        >
                          <Play size={15} fill="#ffffff" /> {launchingSession === game.id ? "Launching..." : "Play Now"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ===================== TAB CONTENT: SUBMIT GAME ===================== */}
        {activeTab === "submit" && (
          <section style={{ maxWidth: 860, margin: "0 auto", padding: "32px 5% 80px" }}>
            
            {/* Explanatory Safety Banner */}
            <div style={{ background: "rgba(99, 102, 241, 0.1)", border: "1px solid rgba(99, 102, 241, 0.3)", borderRadius: 12, padding: "20px 24px", marginBottom: 32, display: "flex", gap: 16 }}>
              <ShieldCheck size={28} color="#818cf8" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h4 style={{ margin: "0 0 6px", color: "#ffffff", fontSize: "1rem", fontWeight: 700 }}>
                  Community Game Submission & Safety Guarantee
                </h4>
                <p style={{ margin: 0, color: "#c7d2fe", fontSize: "0.88rem", lineHeight: 1.5 }}>
                  Every submitted game build undergoes strict manual sandbox verification before public catalog inclusion. Our security team verifies antivirus clean scans, confirms the absence of crypto-miners/ransomware, and validates headless Proton/Docker rendering.
                </p>
              </div>
            </div>

            {/* Submission Form */}
            <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 14, padding: "28px 32px", marginBottom: 40 }}>
              <h3 style={{ margin: "0 0 6px", font: "700 20px 'Space Grotesk', sans-serif" }}>Submit Your Game</h3>
              <p style={{ color: "#9ca3af", fontSize: "0.88rem", margin: "0 0 24px" }}>
                Provide a secure build download link (Google Drive, Mega, S3, Dropbox) to submit your game to the library.
              </p>

              <form onSubmit={handleSubmitGame} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>Game Title *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Neon Cyber Runner"
                      value={submitForm.title}
                      onChange={(e) => setSubmitForm({ ...submitForm, title: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 8, color: "#f3f4f6", outline: "none" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>Genre *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Action / Indie / Racing"
                      value={submitForm.genre}
                      onChange={(e) => setSubmitForm({ ...submitForm, genre: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 8, color: "#f3f4f6", outline: "none" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>Package / Build Download Link (ZIP / Executable) *</label>
                  <input
                    required
                    type="url"
                    placeholder="https://drive.google.com/file/... or https://s3.amazonaws.com/build.zip"
                    value={submitForm.package_url}
                    onChange={(e) => setSubmitForm({ ...submitForm, package_url: e.target.value })}
                    style={{ width: "100%", padding: "10px 14px", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 8, color: "#f3f4f6", outline: "none" }}
                  />
                  <small style={{ color: "#6b7280", marginTop: 4, display: "block" }}>Provide a direct accessible download link to your standalone game archive.</small>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>Version</label>
                    <input
                      type="text"
                      value={submitForm.version}
                      onChange={(e) => setSubmitForm({ ...submitForm, version: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 8, color: "#f3f4f6", outline: "none" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>Min GPU Spec</label>
                    <input
                      type="text"
                      value={submitForm.min_gpu}
                      onChange={(e) => setSubmitForm({ ...submitForm, min_gpu: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 8, color: "#f3f4f6", outline: "none" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>Suggested Rate (Credits/Hr)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.10"
                      value={submitForm.suggested_hourly_rate}
                      onChange={(e) => setSubmitForm({ ...submitForm, suggested_hourly_rate: parseFloat(e.target.value) || 0.5 })}
                      style={{ width: "100%", padding: "10px 14px", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 8, color: "#f3f4f6", outline: "none" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>Description & Controls</label>
                  <textarea
                    rows={3}
                    placeholder="Short summary, controls, system recommendations..."
                    value={submitForm.description}
                    onChange={(e) => setSubmitForm({ ...submitForm, description: e.target.value })}
                    style={{ width: "100%", padding: "10px 14px", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 8, color: "#f3f4f6", outline: "none" }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "12px 24px",
                    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor: "pointer",
                    alignSelf: "flex-start",
                    boxShadow: "0 4px 14px rgba(99, 102, 241, 0.35)"
                  }}
                >
                  {submitting ? "Submitting..." : "Submit Game for Safety Review"}
                </button>
              </form>
            </div>

            {/* My Submissions Status Table */}
            {user && (
              <div>
                <h3 style={{ margin: "0 0 16px", font: "700 18px 'Space Grotesk', sans-serif" }}>Your Submitted Games</h3>
                {mySubmissions.length === 0 ? (
                  <p style={{ color: "#6b7280", fontSize: "0.88rem" }}>You haven't submitted any games to the library yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {mySubmissions.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          background: "rgba(255, 255, 255, 0.02)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          borderRadius: 10,
                          padding: "14px 18px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 12
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: "#f3f4f6" }}>{s.title} ({s.version})</div>
                          <div style={{ fontSize: "0.78rem", color: "#9ca3af" }}>Genre: {s.genre} · Submitted {s.created_at?.slice(0, 10)}</div>
                        </div>

                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background: s.status === "approved" ? "rgba(16, 185, 129, 0.2)" : s.status === "rejected" ? "rgba(239, 68, 68, 0.2)" : "rgba(234, 179, 8, 0.2)",
                            color: s.status === "approved" ? "#34d399" : s.status === "rejected" ? "#f87171" : "#facc15",
                            border: `1px solid ${s.status === "approved" ? "#059669" : s.status === "rejected" ? "#dc2626" : "#ca8a04"}`
                          }}
                        >
                          {s.status === "approved" ? "✓ Approved to Library" : s.status === "rejected" ? "✗ Rejected" : "⏳ Safety Check Pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ===================== TAB CONTENT: PLAY YOUR GAME (PRIVATE VAULT) ===================== */}
        {activeTab === "private" && (
          <section style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 5% 80px" }}>
            
            {/* Privacy Guarantee Banner */}
            <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: 12, padding: "20px 24px", marginBottom: 32, display: "flex", gap: 16 }}>
              <Lock size={26} color="#34d399" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h4 style={{ margin: "0 0 6px", color: "#ffffff", fontSize: "1rem", fontWeight: 700 }}>
                  Private User Vault (Play Your Own Game)
                </h4>
                <p style={{ margin: 0, color: "#a7f3d0", fontSize: "0.88rem", lineHeight: 1.5 }}>
                  Uploaded game packages in this vault are strictly scoped to your User ID. They are never sent to public listings or shared with other users. You pay only for the physical host GPU time plus standard platform fee & taxes.
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, alignItems: "flex-start" }}>
              
              {/* Left Column: Upload New Private Game */}
              <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 14, padding: "24px 28px" }}>
                <h3 style={{ margin: "0 0 6px", font: "700 18px 'Space Grotesk', sans-serif" }}>Upload Private Game</h3>
                <p style={{ color: "#9ca3af", fontSize: "0.85rem", margin: "0 0 20px" }}>
                  Add your game build link to run inside a private cloud GPU container.
                </p>

                <form onSubmit={handleUploadPrivateGame} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>Game Name *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. My Modded Cyberpunk Build"
                      value={privateUploadForm.title}
                      onChange={(e) => setPrivateUploadForm({ ...privateUploadForm, title: e.target.value })}
                      style={{ width: "100%", padding: "9px 12px", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 8, color: "#f3f4f6", outline: "none" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>Game Package URL *</label>
                    <input
                      required
                      type="url"
                      placeholder="https://storage.com/private/game.zip"
                      value={privateUploadForm.package_url}
                      onChange={(e) => setPrivateUploadForm({ ...privateUploadForm, package_url: e.target.value })}
                      style={{ width: "100%", padding: "9px 12px", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 8, color: "#f3f4f6", outline: "none" }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>Size (GB)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={privateUploadForm.package_size_gb}
                        onChange={(e) => setPrivateUploadForm({ ...privateUploadForm, package_size_gb: parseFloat(e.target.value) || 5.0 })}
                        style={{ width: "100%", padding: "9px 12px", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 8, color: "#f3f4f6", outline: "none" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>Executable</label>
                      <input
                        type="text"
                        placeholder="Game.exe / start.sh"
                        value={privateUploadForm.launch_executable}
                        onChange={(e) => setPrivateUploadForm({ ...privateUploadForm, launch_executable: e.target.value })}
                        style={{ width: "100%", padding: "9px 12px", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 8, color: "#f3f4f6", outline: "none" }}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={uploadingPrivate}
                    style={{
                      padding: "10px 18px",
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 700,
                      cursor: "pointer",
                      marginTop: 6
                    }}
                  >
                    {uploadingPrivate ? "Saving..." : "+ Save to Private Vault"}
                  </button>
                </form>
              </div>

              {/* Right Column: Pricing Breakdown & Node Selector */}
              <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 14, padding: "24px 28px" }}>
                <h3 style={{ margin: "0 0 6px", font: "700 18px 'Space Grotesk', sans-serif" }}>GPU Node & Pricing Breakdown</h3>
                <p style={{ color: "#9ca3af", fontSize: "0.85rem", margin: "0 0 16px" }}>
                  Select the physical GPU host node you wish to rent for running your private container:
                </p>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>Available GPU Nodes</label>
                  <select
                    value={selectedRentalId}
                    onChange={(e) => setSelectedRentalId(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", background: "#111827", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: 8, color: "#ffffff", outline: "none", fontSize: "0.9rem" }}
                  >
                    {availableRentals.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title} — {r.gpu} ({r.vram}) · ${r.price?.toFixed(2)}/hr
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price Breakdown Card */}
                {privateQuote && (
                  <div style={{ background: "rgba(0, 0, 0, 0.3)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 10, padding: "16px 18px", marginBottom: 20 }}>
                    <div style={{ fontSize: "0.75rem", color: "#a5b4fc", textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>
                      Itemized Transparent Hourly Cost
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", marginBottom: 6 }}>
                      <span style={{ color: "#d1d5db" }}>Host GPU Rental Base:</span>
                      <b>${privateQuote.gpu_base_rate_usd?.toFixed(2)} / hr</b>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", marginBottom: 6 }}>
                      <span style={{ color: "#d1d5db" }}>Platform Orchestration Fee (10%):</span>
                      <span style={{ color: "#9ca3af" }}>+${privateQuote.platform_fee_usd?.toFixed(2)}</span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", marginBottom: 10 }}>
                      <span style={{ color: "#d1d5db" }}>Infrastructure & Taxes (5%):</span>
                      <span style={{ color: "#9ca3af" }}>+${privateQuote.tax_usd?.toFixed(2)}</span>
                    </div>

                    <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, color: "#ffffff" }}>Total Hourly Rate:</span>
                      <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#10b981" }}>
                        ${privateQuote.total_hourly_usd?.toFixed(2)} <span style={{ fontSize: "0.75rem", color: "#6ee7b7" }}>credits/hr</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* User's Private Games Vault List */}
            <div style={{ marginTop: 40 }}>
              <h3 style={{ margin: "0 0 16px", font: "700 20px 'Space Grotesk', sans-serif" }}>Your Private Games ({privateGames.length})</h3>
              
              {privateLoading ? (
                <p style={{ color: "#9ca3af" }}>Loading vault...</p>
              ) : privateGames.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", background: "rgba(255, 255, 255, 0.02)", borderRadius: 12, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <Lock size={32} color="#6b7280" style={{ margin: "0 auto 10px" }} />
                  <p style={{ color: "#9ca3af", margin: 0 }}>No private games in your vault yet. Upload one above to get started!</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {privateGames.map((pg) => (
                    <div
                      key={pg.id}
                      style={{
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: 12,
                        padding: "16px 20px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 16
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#ffffff" }}>{pg.title}</div>
                        <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginTop: 4 }}>
                          Executable: <code style={{ color: "#a5b4fc" }}>{pg.launch_executable}</code> · Size: {pg.package_size_gb} GB · Uploaded {pg.uploaded_at?.slice(0, 10)}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          onClick={() => handleDeletePrivateGame(pg.id)}
                          style={{
                            padding: "8px 14px",
                            background: "transparent",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            color: "#f87171",
                            borderRadius: 6,
                            fontSize: "0.8rem",
                            cursor: "pointer"
                          }}
                        >
                          Delete
                        </button>

                        <button
                          onClick={() => handleLaunchPrivateGame(pg)}
                          disabled={launchingSession}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "9px 18px",
                            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 8,
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            cursor: "pointer"
                          }}
                        >
                          <Play size={14} fill="#ffffff" /> Launch on GPU
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ===================== PLAY MODAL CONFIRMATION ===================== */}
        {selectedGame && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(3, 7, 18, 0.85)",
              backdropFilter: "blur(10px)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 9999,
              padding: 20
            }}
          >
            <div
              style={{
                background: "linear-gradient(180deg, #0e1424 0%, #080c14 100%)",
                border: "1px solid rgba(0, 240, 255, 0.3)",
                borderRadius: 20,
                padding: "28px 32px",
                maxWidth: 520,
                width: "100%",
                color: "#ffffff",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(0, 240, 255, 0.15)"
              }}
            >
              {/* Modal Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "linear-gradient(135deg, #00f0ff 0%, #7000ff 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#000"
                    }}
                  >
                    <Gamepad2 size={24} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "0.72rem", color: "#00f0ff", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Instant Cloud Play
                      </span>
                      <span style={{ background: "rgba(16, 185, 129, 0.2)", border: "1px solid rgba(16, 185, 129, 0.4)", color: "#10b981", fontSize: "0.68rem", fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>
                        IN-BROWSER
                      </span>
                    </div>
                    <h3 style={{ margin: "4px 0 0", font: "700 22px 'Space Grotesk', sans-serif" }}>
                      {selectedGame.title}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedGame(null)}
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: "1rem", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>

              {/* Zero-Install Banner */}
              <div
                style={{
                  background: "rgba(0, 240, 255, 0.08)",
                  border: "1px solid rgba(0, 240, 255, 0.2)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 18,
                  fontSize: "0.82rem",
                  color: "#cbd5e1"
                }}
              >
                <Sparkles size={16} color="#00f0ff" style={{ flexShrink: 0 }} />
                <span>
                  <b>100% In-Browser Play:</b> No downloads or 3rd-party apps needed. Play directly in your web browser with mouse lock and gamepad support!
                </span>
              </div>

              {/* Pricing & Host Specs Card */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 12,
                  padding: "16px 18px",
                  marginBottom: 20
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, fontSize: "0.88rem" }}>
                  <span style={{ color: "#94a3b8" }}>Hourly Rate:</span>
                  <div style={{ textAlign: "right" }}>
                    <b style={{ color: "#c8f04c", fontSize: "1.15rem", fontFamily: "'Space Grotesk', sans-serif" }}>
                      {selectedGame.hourly_rate_credits.toFixed(2)} credits/hr
                    </b>
                    <span style={{ fontSize: "0.76rem", color: "#94a3b8", display: "block" }}>
                      (~${selectedGame.hourly_rate_credits.toFixed(2)}/hr · Metered second-by-second)
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.85rem" }}>
                  <span style={{ color: "#94a3b8" }}>Allocated Cloud GPU:</span>
                  <span style={{ color: "#38bdf8", fontWeight: 600 }}>{availableRentals[0]?.gpu || "NVIDIA RTX 4090"} (Dedicated NVENC)</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8, marginTop: 8 }}>
                  <span style={{ color: "#94a3b8" }}>Your Current Balance:</span>
                  <b style={{ color: user ? "#10b981" : "#f59e0b" }}>
                    {user ? `${(user.compute_credits ?? user.balance ?? 10.0).toFixed(2)} credits` : "Sign In to Check"}
                  </b>
                </div>
              </div>

              {/* Action Buttons */}
              {!user ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    onClick={() => {
                      sessionStorage.setItem("productify_pending_game", JSON.stringify(selectedGame));
                      navigate("/login");
                    }}
                    style={{
                      width: "100%",
                      padding: "13px",
                      background: "linear-gradient(135deg, #00f0ff 0%, #0077ff 100%)",
                      border: "none",
                      borderRadius: 10,
                      color: "#000",
                      fontWeight: 800,
                      fontSize: "0.95rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      boxShadow: "0 0 25px rgba(0, 240, 255, 0.4)"
                    }}
                  >
                    <Play size={18} fill="#000" /> Sign In &amp; Start Playing
                  </button>
                  <p style={{ textAlign: "center", color: "#64748b", fontSize: "0.78rem", margin: 0 }}>
                    New here? Registering takes 10 seconds and includes free trial compute credits!
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={() => setSelectedGame(null)}
                    style={{
                      flex: 1,
                      padding: "12px",
                      background: "transparent",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      borderRadius: 10,
                      color: "#ffffff",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleLaunchGame(selectedGame)}
                    disabled={Boolean(launchingSession)}
                    style={{
                      flex: 2,
                      padding: "12px",
                      background: "linear-gradient(135deg, #c8f04c 0%, #10b981 100%)",
                      border: "none",
                      borderRadius: 10,
                      color: "#080c14",
                      fontWeight: 800,
                      fontSize: "0.95rem",
                      cursor: "pointer",
                      boxShadow: "0 0 30px rgba(200, 240, 76, 0.35)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      transition: "all 0.15s ease"
                    }}
                  >
                    <Play size={16} fill="#080c14" />
                    {launchingSession ? "Spinning up Cloud GPU..." : "Start Playing in Browser"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
