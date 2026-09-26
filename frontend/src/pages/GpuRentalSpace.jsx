import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Zap,
  HardDrive,
  ShieldCheck,
  CreditCard,
  Plus,
  ArrowRight,
  Key,
  CheckCircle2,
  Loader2,
  Wallet,
  Clock
} from "lucide-react";
import { api, money } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import { toast } from "sonner";

const WORKLOAD_TEMPLATES = [
  {
    id: "jupyter-pytorch",
    name: "PyTorch 2.4 + JupyterLab",
    category: "Deep Learning & AI",
    description: "CUDA 12.4, PyTorch 2.4, TorchVision, Torchaudio, FlashAttention-2, JupyterLab in-browser.",
    icon: "⚡",
    port: 8888,
    service_name: "JupyterLab",
  },
  {
    id: "comfyui-sdxl",
    name: "ComfyUI + SDXL & Flux",
    category: "Generative Art",
    description: "Pre-loaded with SDXL Turbo, Flux weights, and ControlNet for visual generation.",
    icon: "🎨",
    port: 8188,
    service_name: "ComfyUI Web",
  },
  {
    id: "ollama-llm",
    name: "Ollama + Open WebUI",
    category: "LLMs & Chat",
    description: "Host DeepSeek-R1, Llama 3.3, and Mistral with lightning-fast inference and UI.",
    icon: "🦙",
    port: 11434,
    service_name: "Ollama API & WebUI",
  },
  {
    id: "ubuntu-base",
    name: "Ubuntu 22.04 LTS (CUDA Base)",
    category: "Custom Compute",
    description: "Pure Linux root shell with NVIDIA Drivers 550, Docker, Git, and full SSH access.",
    icon: "💻",
    port: 22,
    service_name: "SSH Shell",
  },
];

export default function GpuRentalSpace() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rental, setRental] = useState(null);
  const [loading, setLoading] = useState(true);

  // Compute Credits state
  const [credits, setCredits] = useState(0.0);
  const [topupAmount, setTopupAmount] = useState(10);
  const [topupBusy, setTopupBusy] = useState(false);

  // Workload launch configuration
  const [selectedTemplate, setSelectedTemplate] = useState("jupyter-pytorch");
  const [diskSize, setDiskSize] = useState(50);
  const [sshKey, setSshKey] = useState("");
  const [showSshInput, setShowSshInput] = useState(false);
  const [launching, setLaunching] = useState(false);

  const fetchNodeAndCredits = useCallback(async () => {
    try {
      const [rRes, cRes] = await Promise.all([
        api.get(`/rentals/${id}`),
        api.get("/credits/balance").catch(() => ({ data: { compute_credits: user?.compute_credits || 0.0 } })),
      ]);
      setRental(rRes.data);
      setCredits(Number(cRes.data?.compute_credits || 0.0));
    } catch (err) {
      toast.error("Failed to load GPU node details");
    } finally {
      setLoading(false);
    }
  }, [id, user?.compute_credits]);

  useEffect(() => {
    fetchNodeAndCredits();
  }, [fetchNodeAndCredits]);

  const handleTopup = async (amt) => {
    setTopupBusy(true);
    try {
      const res = await api.post("/credits/topup", { amount: Number(amt), provider: "card" });
      setCredits(Number(res.data.compute_credits));
      toast.success(`Successfully added ${money(amt)} to your Compute Credits!`);
    } catch (err) {
      toast.error("Failed to add compute credits");
    } finally {
      setTopupBusy(false);
    }
  };

  const handle1ClickLaunch = async () => {
    if (!rental) return;

    const basePrice = Number(rental.price) || 0.60;
    const diskCostPerHour = diskSize * 0.0002;
    const totalPerHour = basePrice + diskCostPerHour;

    if (credits < 0.50) {
      toast.error(`Please add at least $5.00 in compute credits to launch on this node (Rate: ${money(totalPerHour)}/hr)`);
      return;
    }

    setLaunching(true);
    try {
      const res = await api.post("/instances/deploy", {
        rental_id: rental.id,
        template_id: selectedTemplate,
        disk_size_gb: Number(diskSize),
        ssh_public_key: sshKey.trim() || null,
      });

      toast.success("Instance container launched! Connecting to node...");
      navigate(`/instances/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to launch GPU instance");
    } finally {
      setLaunching(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <span />
        <p>Opening dedicated GPU rental space...</p>
      </div>
    );
  }

  if (!rental) {
    return (
      <div className="empty-block" style={{ padding: "80px 20px", textAlign: "center" }}>
        <h2>GPU Node not found</h2>
        <p>This node is no longer available or was unlisted by the host.</p>
        <Link to="/rentals" className="primary-button" style={{ marginTop: "14px", display: "inline-flex" }}>
          Browse Other Nodes
        </Link>
      </div>
    );
  }

  const basePrice = Number(rental.price) || 0.60;
  const diskCostPerHour = diskSize * 0.0002;
  const totalPerHour = basePrice + diskCostPerHour;
  const perMinute = totalPerHour / 60;
  const hoursCovered = totalPerHour > 0 ? (credits / totalPerHour).toFixed(1) : "0.0";

  return (
    <>
      <SEO
        title={`Reserve ${rental.title} · Dedicated GPU Rental Space`}
        description={`On-demand dedicated compute space for ${rental.gpu} (${rental.vram}). 1-click launch with PyTorch, ComfyUI, Ollama, and SSH.`}
        path={`/rentals/reserve/${rental.id}`}
      />

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 6% 90px" }}>
        {/* Breadcrumb Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--muted, #777)", display: "flex", gap: "6px", alignItems: "center" }}>
            <Link to="/rentals" style={{ color: "var(--ink, #101112)", textDecoration: "none" }}>GPU Marketplace</Link>
            <span>/</span>
            <Link to={`/rental/${rental.id}`} style={{ color: "var(--ink, #101112)", textDecoration: "none" }}>{rental.gpu}</Link>
            <span>/</span>
            <span style={{ fontWeight: 600 }}>Dedicated Rental Space</span>
          </div>

          <Link to="/rentals" className="text-button text-button-dark" style={{ fontSize: "0.82rem" }}>
            ← Back to Marketplace
          </Link>
        </div>

        {/* Hero Banner */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid var(--line, #e2e2dc)",
            borderRadius: "16px",
            padding: "28px 32px",
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: "24px",
            alignItems: "center",
            marginBottom: "28px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
          }}
        >
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", fontFamily: "var(--font-mono, monospace)", color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "8px" }}>
              <Zap size={14} /> DEDICATED ON-DEMAND COMPUTE SPACE
            </div>
            <h1 style={{ margin: "2px 0 8px", fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 800, fontFamily: "var(--font-heading, sans-serif)", letterSpacing: "-0.03em" }}>
              {rental.title}
            </h1>
            <p style={{ margin: "0 0 14px", color: "var(--muted, #666)", fontSize: "0.92rem", lineHeight: 1.5 }}>
              {rental.description || `High-throughput compute node equipped with ${rental.gpu} (${rental.vram}) for ML inference, Stable Diffusion, and deep learning.`}
            </p>

            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "0.82rem", color: "var(--muted, #666)" }}>
              <span><b>GPU:</b> {rental.gpu} ({rental.vram})</span>
              <span>•</span>
              <span><b>Region:</b> {rental.location}</span>
              <span>•</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#3c9563", fontWeight: 600 }}>
                <ShieldCheck size={15} /> Verified Host: {rental.owner}
              </span>
            </div>
          </div>

          {/* Pricing & Coverage Card */}
          <div
            style={{
              background: "#fafaf7",
              border: "1px solid var(--line, #e2e2dc)",
              borderRadius: "14px",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted, #777)", textTransform: "uppercase", fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.05em" }}>
                Rental Rate (Per-Second Metering)
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", margin: "6px 0 2px" }}>
                <span style={{ fontSize: "2rem", fontWeight: 800, fontFamily: "var(--font-heading, sans-serif)" }}>
                  {money(totalPerHour)}
                </span>
                <span style={{ fontSize: "0.9rem", color: "#666" }}>/ hour</span>
                <span style={{ fontSize: "0.8rem", color: "#16a34a", fontFamily: "var(--font-mono, monospace)" }}>
                  (~${perMinute.toFixed(4)}/min)
                </span>
              </div>
              <span style={{ fontSize: "0.78rem", color: "#888" }}>
                {money(basePrice)} base compute + {money(diskCostPerHour)} for {diskSize}GB NVMe scratch
              </span>
            </div>

            <div style={{ borderTop: "1px solid #e5e5dc", marginTop: "14px", paddingTop: "12px", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem", color: "#444" }}>
              <Clock size={15} color="#16a34a" />
              <span>
                Your <b>{money(credits)}</b> credit balance covers <b>~{hoursCovered} hours</b> of compute.
              </span>
            </div>
          </div>
        </div>

        {/* Section 1: Compute Credits & Rental Wallet Card */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid var(--line, #e2e2dc)",
            borderRadius: "14px",
            padding: "24px 28px",
            marginBottom: "28px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "16px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Wallet size={18} color="var(--ink, #101112)" />
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                  Rental Wallet & Compute Credits
                </h3>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--muted, #666)" }}>
                Preload funds to power second-by-second container execution. Unused credits never expire.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--muted, #666)" }}>Available Credits:</span>
              <span
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 800,
                  fontFamily: "var(--font-mono, monospace)",
                  color: credits > 0 ? "#16a34a" : "#d97706",
                  background: credits > 0 ? "#f0fdf4" : "#fef8e7",
                  border: `1px solid ${credits > 0 ? "#bbf7d0" : "#fed7aa"}`,
                  padding: "4px 14px",
                  borderRadius: "8px",
                }}
              >
                {money(credits)}
              </span>
            </div>
          </div>

          {/* Quick Top-Up Preset Chips */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", background: "#fafaf7", padding: "14px 18px", borderRadius: "10px", border: "1px solid #ebece4" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ink, #101112)", display: "flex", alignItems: "center", gap: "6px" }}>
              <CreditCard size={15} /> Quick Top-Up:
            </span>

            {[5, 10, 25, 50].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleTopup(amt)}
                disabled={topupBusy}
                style={{
                  background: "#ffffff",
                  border: "1px solid var(--line, #dedfd9)",
                  borderRadius: "8px",
                  padding: "6px 14px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                +${amt}.00
              </button>
            ))}

            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
              <span style={{ fontSize: "0.82rem", color: "#666" }}>Custom: $</span>
              <input
                type="number"
                min="1"
                step="1"
                value={topupAmount}
                onChange={(e) => setTopupAmount(Number(e.target.value))}
                style={{ width: "70px", padding: "5px 8px", borderRadius: "6px", border: "1px solid var(--line, #dedfd9)", fontSize: "0.82rem", background: "#ffffff" }}
              />
              <button
                type="button"
                onClick={() => handleTopup(topupAmount)}
                disabled={topupBusy || topupAmount <= 0}
                className="secondary-button"
                style={{ padding: "6px 12px", fontSize: "0.82rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                {topupBusy ? <Loader2 size={13} className="spin" /> : <Plus size={13} />} Add Funds
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: 1-Click Workload Template Selector */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid var(--line, #e2e2dc)",
            borderRadius: "14px",
            padding: "28px 32px",
            marginBottom: "28px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ marginBottom: "18px" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: "1.2rem", fontWeight: 700 }}>
              1. Choose Container Workload Template
            </h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted, #666)" }}>
              Select your pre-configured environment. The host machine will boot this exact image with full GPU acceleration.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px", marginBottom: "24px" }}>
            {WORKLOAD_TEMPLATES.map((tpl) => {
              const active = selectedTemplate === tpl.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl.id)}
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    border: active ? "2px solid var(--ink, #101112)" : "1px solid var(--line, #e2e2dc)",
                    background: active ? "#fafaf7" : "#ffffff",
                    cursor: "pointer",
                    position: "relative",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "1.3rem" }}>{tpl.icon}</span>
                    <span style={{ fontSize: "0.72rem", background: "#f0f2ea", color: "#4f5348", padding: "2px 8px", borderRadius: "100px", fontFamily: "var(--font-mono, monospace)" }}>
                      Port {tpl.port}
                    </span>
                  </div>
                  <h4 style={{ margin: "0 0 4px", fontSize: "0.95rem", fontWeight: 700 }}>{tpl.name}</h4>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted, #666)", lineHeight: 1.45 }}>
                    {tpl.description}
                  </p>
                  {active && (
                    <div style={{ position: "absolute", top: "12px", right: "12px" }}>
                      <CheckCircle2 size={18} color="var(--ink, #101112)" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* NVMe Storage Slider */}
          <div style={{ background: "#fafaf7", padding: "20px", borderRadius: "12px", border: "1px solid #ebece4", marginBottom: "22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem", fontWeight: 700 }}>
                <HardDrive size={16} /> Fast NVMe Scratch Disk
              </div>
              <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700, fontSize: "0.95rem" }}>
                {diskSize} GB <span style={{ fontSize: "0.78rem", color: "#666", fontWeight: 400 }}>(+{money(diskCostPerHour)}/hr)</span>
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="500"
              step="10"
              value={diskSize}
              onChange={(e) => setDiskSize(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--ink, #101112)", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#888", marginTop: "4px" }}>
              <span>20 GB (Fast test)</span>
              <span>100 GB (Deep learning models)</span>
              <span>500 GB (Massive datasets)</span>
            </div>
          </div>

          {/* Optional SSH Public Key Input */}
          <div style={{ marginBottom: "14px" }}>
            <button
              type="button"
              onClick={() => setShowSshInput(!showSshInput)}
              style={{ background: "transparent", border: "none", color: "var(--violet, #6556e8)", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", padding: 0 }}
            >
              <Key size={14} /> {showSshInput ? "Hide SSH public key" : "+ Add SSH public key for direct root terminal access"}
            </button>
            {showSshInput && (
              <div style={{ marginTop: "10px" }}>
                <textarea
                  value={sshKey}
                  onChange={(e) => setSshKey(e.target.value)}
                  placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5... or ssh-rsa AAAAB3NzaC1yc2E..."
                  rows={3}
                  style={{ width: "100%", fontSize: "0.8rem", fontFamily: "var(--font-mono, monospace)", padding: "10px", borderRadius: "8px", border: "1px solid var(--line, #dedfd9)", background: "#ffffff" }}
                />
                <span style={{ fontSize: "0.72rem", color: "#777" }}>
                  Optional. You can always use the in-browser interactive terminal directly on the instance page.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: 1-Click Launch Footer */}
        <div
          style={{
            background: "var(--ink, #101112)",
            color: "#ffffff",
            borderRadius: "16px",
            padding: "24px 32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "20px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", color: "#a3e635", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono, monospace)" }}>
              READY TO LAUNCH
            </div>
            <div style={{ fontSize: "1.45rem", fontWeight: 800, fontFamily: "var(--font-heading, sans-serif)", margin: "4px 0 2px" }}>
              {money(totalPerHour)} <small style={{ fontSize: "0.85rem", color: "#9ca3af", fontWeight: 400 }}>/ hour</small>
            </div>
            <span style={{ fontSize: "0.8rem", color: "#d1d5db" }}>
              Billed per minute · Stop, pause, or terminate anytime
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              onClick={handle1ClickLaunch}
              disabled={launching}
              className="primary-button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "14px 28px",
                fontSize: "1rem",
                fontWeight: 800,
                background: "var(--lime, #c8f04c)",
                color: "var(--ink, #101112)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {launching ? (
                <>
                  <Loader2 size={18} className="spin" /> Spawning Container...
                </>
              ) : (
                <>
                  <Zap size={18} /> ⚡ 1-Click Launch Rented GPU <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
