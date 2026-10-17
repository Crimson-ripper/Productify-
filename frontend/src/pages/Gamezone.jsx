import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Gamepad2, Play, Upload, Lock, ShieldCheck, Search, Cpu, X, ArrowRight } from "lucide-react";
import { api, money, getErrorMessage } from "@/lib/api";
import { PLACEHOLDER_IMG, imgFallback } from "@/lib/image";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import GamePackageUploader from "@/components/GamePackageUploader";
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

  // Launch Library Game: Navigates to the interactive Machine Selection page
  const handleLaunchGame = useCallback((targetGame) => {
    const gameToPlay = (targetGame && targetGame.id) ? targetGame : selectedGame;
    if (!gameToPlay) return;

    if (!user) {
      sessionStorage.setItem("productify_pending_game", JSON.stringify(gameToPlay));
      toast.info(`Please sign in to launch ${gameToPlay.title}.`);
      navigate("/login");
      return;
    }

    setSelectedGame(null);
    navigate(`/gamezone/select-host/${gameToPlay.id}`);
  }, [user, selectedGame, navigate]);

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

  const balance = user?.compute_credits ?? user?.balance;

  return (
    <>
      <SEO
        title="Gamezone — Play games on a rented GPU · Productify"
        description="Play games streamed from a GPU someone else owns, paid by the hour in Productify credits. Or run your own game build privately."
        path="/gamezone"
      />

      <section className="page-hero gz-hero">
        <div className="eyebrow">Gamezone</div>
        <h1>Play on someone else's GPU</h1>
        <p>
          Pick a game, pick a machine, and play it streamed to your browser. You pay
          by the hour in credits, only while the session runs.
        </p>
      </section>

      <nav className="gz-tabs" aria-label="Gamezone sections">
        {[
          ["library", Gamepad2, "Game library"],
          ["submit", Upload, "Submit a game"],
          ["private", Lock, "Your own games"],
        ].map(([key, Icon, label]) => (
          <button key={key} className={activeTab === key ? "gz-tab active" : "gz-tab"} onClick={() => setActiveTab(key)} aria-pressed={activeTab === key}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>

      {activeTab === "library" && (
        <section className="gz-section">
          <div className="gz-filters">
            <div className="cat-tabs">
              {genres.map((g) => (
                <button key={g} className={selectedGenre === g ? "cat-tab active" : "cat-tab"} onClick={() => setSelectedGenre(g)}>{g}</button>
              ))}
            </div>
            <div className="shop-search gz-search">
              <Search size={16} />
              <input type="text" placeholder="Search games" aria-label="Search games" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <div className="loading-block"><div className="spinner" />Loading games…</div>
          ) : games.length === 0 ? (
            <div className="empty-block">No games match that search.</div>
          ) : (
            <div className="gz-grid">
              {games.map((game) => (
                <article key={game.id} className="gz-card" onClick={() => setSelectedGame(game)}>
                  <div className="gz-cover">
                    <img src={game.cover_image || PLACEHOLDER_IMG} alt={game.title} loading="lazy" onError={imgFallback} />
                    <span className="product-badge">{game.genre}</span>
                    {game.featured && <span className="gz-featured">Featured</span>}
                  </div>
                  <div className="gz-body">
                    <h3>{game.title}</h3>
                    <p>{game.description?.length > 115 ? `${game.description.slice(0, 115)}…` : game.description}</p>
                    <div className="gz-spec"><Cpu size={13} /> Needs {game.min_gpu_vram}{game.recommended_gpu ? ` · ${game.recommended_gpu}` : ""}</div>
                    <div className="gz-foot">
                      <div>
                        <strong>{game.hourly_rate_credits.toFixed(2)}</strong> <small>credits / hr</small>
                        {game.rate_inr && <small className="gz-inr">≈ ₹{Math.round(game.rate_inr)} / hr</small>}
                      </div>
                      <button
                        className="dark-button"
                        onClick={(e) => { e.stopPropagation(); handleLaunchGame(game); }}
                        disabled={Boolean(launchingSession)}
                      >
                        <Play size={13} /> Play
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "submit" && (
        <section className="gz-section narrow">
          <div className="gz-note">
            <ShieldCheck size={18} />
            <p>An admin reviews every submitted build before it appears in the library. You'll see its status below.</p>
          </div>

          <div className="gz-panel">
            <h2>Submit a game</h2>
            <p className="gz-panel-desc">Upload the build, or paste a download link (Google Drive, Mega, S3, Dropbox).</p>
            <form onSubmit={handleSubmitGame} className="dashboard-form gz-form">
              <div className="two-col">
                <label>Title
                  <input required type="text" value={submitForm.title} onChange={(e) => setSubmitForm({ ...submitForm, title: e.target.value })} />
                </label>
                <label>Genre
                  <input required type="text" placeholder="Action, Indie, Racing…" value={submitForm.genre} onChange={(e) => setSubmitForm({ ...submitForm, genre: e.target.value })} />
                </label>
              </div>
              <div>
                <label>Game package</label>
                <div className="gz-uploader">
                  <GamePackageUploader
                    gameId={submitForm.title ? submitForm.title.toLowerCase().replace(/[^a-z0-9]/g, "-") : "community-game"}
                    value={submitForm.package_url}
                    onComplete={(data) => setSubmitForm({ ...submitForm, package_url: data.public_url })}
                    label="Upload the game archive (.zip, .7z, .tar.gz)"
                  />
                </div>
                <label>…or download link
                  <input required type="url" placeholder="https://" value={submitForm.package_url} onChange={(e) => setSubmitForm({ ...submitForm, package_url: e.target.value })} />
                </label>
              </div>
              <div className="three-col">
                <label>Version
                  <input type="text" value={submitForm.version} onChange={(e) => setSubmitForm({ ...submitForm, version: e.target.value })} />
                </label>
                <label>Minimum GPU
                  <input type="text" value={submitForm.min_gpu} onChange={(e) => setSubmitForm({ ...submitForm, min_gpu: e.target.value })} />
                </label>
                <label>Suggested rate (credits/hr)
                  <input type="number" step="0.05" min="0.10" value={submitForm.suggested_hourly_rate} onChange={(e) => setSubmitForm({ ...submitForm, suggested_hourly_rate: parseFloat(e.target.value) || 0.5 })} />
                </label>
              </div>
              <label>Description and controls
                <textarea rows={3} value={submitForm.description} onChange={(e) => setSubmitForm({ ...submitForm, description: e.target.value })} />
              </label>
              <div><button type="submit" className="primary-button" disabled={submitting}>{submitting ? "Submitting…" : "Submit for review"}</button></div>
            </form>
          </div>

          {user && (
            <div className="gz-list-block">
              <h3>Your submissions</h3>
              {mySubmissions.length === 0 ? (
                <p className="gz-muted">You haven't submitted a game yet.</p>
              ) : (
                <div className="gz-rows">
                  {mySubmissions.map((s) => (
                    <div key={s.id} className="gz-row">
                      <div>
                        <b>{s.title} <span className="gz-muted">{s.version}</span></b>
                        <small>{s.genre} · submitted {s.created_at?.slice(0, 10)}</small>
                      </div>
                      <span className={`status-pill ${s.status === "approved" ? "status-ok" : s.status === "rejected" ? "status-removed" : "status-review"}`}>
                        {s.status === "approved" ? "In library" : s.status === "rejected" ? "Rejected" : "In review"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {activeTab === "private" && (
        <section className="gz-section">
          <div className="gz-note">
            <Lock size={18} />
            <p>Games you add here are only visible to you. They never appear in the library. You pay for the GPU time plus the platform fee and tax.</p>
          </div>

          <div className="gz-two">
            <div className="gz-panel">
              <h2>Add a game</h2>
              <p className="gz-panel-desc">Link to your game build. It runs in a private container on the GPU you pick.</p>
              <form onSubmit={handleUploadPrivateGame} className="dashboard-form gz-form">
                <label>Name
                  <input required type="text" value={privateUploadForm.title} onChange={(e) => setPrivateUploadForm({ ...privateUploadForm, title: e.target.value })} />
                </label>
                <label>Package URL
                  <input required type="url" placeholder="https://" value={privateUploadForm.package_url} onChange={(e) => setPrivateUploadForm({ ...privateUploadForm, package_url: e.target.value })} />
                </label>
                <div className="two-col">
                  <label>Size (GB)
                    <input type="number" step="0.5" value={privateUploadForm.package_size_gb} onChange={(e) => setPrivateUploadForm({ ...privateUploadForm, package_size_gb: parseFloat(e.target.value) || 5.0 })} />
                  </label>
                  <label>Executable
                    <input type="text" placeholder="Game.exe or start.sh" value={privateUploadForm.launch_executable} onChange={(e) => setPrivateUploadForm({ ...privateUploadForm, launch_executable: e.target.value })} />
                  </label>
                </div>
                <div><button type="submit" className="primary-button" disabled={uploadingPrivate}>{uploadingPrivate ? "Saving…" : "Add game"}</button></div>
              </form>
            </div>

            <div className="gz-panel">
              <h2>Machine and price</h2>
              <p className="gz-panel-desc">Choose which GPU your private games run on.</p>
              <div className="dashboard-form gz-form">
                <label>GPU
                  <select value={selectedRentalId} onChange={(e) => setSelectedRentalId(e.target.value)}>
                    {availableRentals.map((r) => (
                      <option key={r.id} value={r.id}>{r.title} — {r.gpu} ({r.vram}) · {money(r.price)}/hr</option>
                    ))}
                  </select>
                </label>
              </div>
              {privateQuote && (
                <div className="gz-quote">
                  <div className="row"><span>GPU rental</span><span>{money(privateQuote.gpu_base_rate_usd)} / hr</span></div>
                  <div className="row muted"><span>Platform fee (10%)</span><span>+{money(privateQuote.platform_fee_usd)}</span></div>
                  <div className="row muted"><span>Tax (5%)</span><span>+{money(privateQuote.tax_usd)}</span></div>
                  <div className="row total"><span>Total</span><strong>{money(privateQuote.total_hourly_usd)} / hr</strong></div>
                </div>
              )}
            </div>
          </div>

          <div className="gz-list-block">
            <h3>Your games ({privateGames.length})</h3>
            {privateLoading ? (
              <p className="gz-muted">Loading…</p>
            ) : privateGames.length === 0 ? (
              <p className="gz-muted">Nothing here yet. Add a game above.</p>
            ) : (
              <div className="gz-rows">
                {privateGames.map((pg) => (
                  <div key={pg.id} className="gz-row">
                    <div>
                      <b>{pg.title}</b>
                      <small><code>{pg.launch_executable}</code> · {pg.package_size_gb} GB · added {pg.uploaded_at?.slice(0, 10)}</small>
                    </div>
                    <div className="gz-row-actions">
                      <button className="text-button text-button-dark danger" onClick={() => handleDeletePrivateGame(pg.id)}>Remove</button>
                      <button className="dark-button" onClick={() => handleLaunchPrivateGame(pg)} disabled={launchingSession}><Play size={13} /> Launch</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {selectedGame && (
        <div className="overlay" onClick={() => setSelectedGame(null)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="gz-modal-title" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={() => setSelectedGame(null)} aria-label="Close"><X size={18} /></button>
            <div className="eyebrow">{selectedGame.genre}</div>
            <h2 id="gz-modal-title">{selectedGame.title}</h2>
            <p className="modal-desc">Plays in your browser — no download. You choose the machine on the next step.</p>
            <div className="gz-quote">
              <div className="row"><span>Rate</span><strong>{selectedGame.hourly_rate_credits.toFixed(2)} credits / hr</strong></div>
              <div className="row muted"><span>Needs</span><span>{selectedGame.min_gpu_vram}</span></div>
              {user && balance != null && (
                <div className="row total"><span>Your balance</span><strong>{Number(balance).toFixed(2)} credits</strong></div>
              )}
            </div>
            {!user ? (
              <button
                className="primary-button full"
                onClick={() => { sessionStorage.setItem("productify_pending_game", JSON.stringify(selectedGame)); navigate("/login"); }}
              >
                Sign in to play <ArrowRight size={16} />
              </button>
            ) : (
              <div className="gz-modal-actions">
                <button className="text-button text-button-dark" onClick={() => setSelectedGame(null)}>Cancel</button>
                <button className="primary-button" onClick={() => handleLaunchGame(selectedGame)} disabled={Boolean(launchingSession)}>
                  Choose a machine <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
