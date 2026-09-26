import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HardDrive, ShieldCheck, Zap, X, CheckCircle2, Loader2, Key } from "lucide-react";
import { api, money } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const DEFAULT_TEMPLATES = [
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

export default function GpuDeployModal({ rental, isOpen, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState("jupyter-pytorch");
  const [diskSize, setDiskSize] = useState(50);
  const [sshKey, setSshKey] = useState("");
  const [showSshInput, setShowSshInput] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.get("/instances/templates")
        .then((res) => {
          if (Array.isArray(res.data) && res.data.length > 0) {
            setTemplates(res.data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen || !rental) return null;

  const basePrice = Number(rental.price) || 0.60;
  const diskCostPerHour = diskSize * 0.0002;
  const totalPerHour = basePrice + diskCostPerHour;
  const perMinute = totalPerHour / 60;

  const handleDeploy = async () => {
    if (!user) {
      toast.error("Please sign in to deploy a cloud GPU instance");
      navigate("/login");
      return;
    }

    setIsDeploying(true);
    try {
      const res = await api.post("/instances/deploy", {
        rental_id: rental.id,
        template_id: selectedTemplate,
        disk_size_gb: Number(diskSize),
        ssh_public_key: sshKey.trim() || null,
      });

      toast.success("Instance container launched! Connecting to node...");
      onClose();
      navigate(`/instances/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to deploy GPU instance");
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(720px, 96%)", padding: "28px", borderRadius: "16px" }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", fontFamily: "var(--font-mono, monospace)", color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "4px" }}>
              <Zap size={14} /> ON-DEMAND CONTAINER DEPLOYMENT
            </div>
            <h2 style={{ margin: "2px 0 6px", fontSize: "1.45rem", fontFamily: "var(--font-heading, sans-serif)", letterSpacing: "-0.03em" }}>
              Launch Cloud Instance
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.85rem", color: "var(--muted, #666)" }}>
              <span><b>{rental.gpu}</b> ({rental.vram})</span>
              <span>•</span>
              <span>{rental.location}</span>
              <span>•</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#3c9563" }}>
                <ShieldCheck size={14} /> {rental.owner}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted, #888)", padding: "4px" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Step 1: Select Workload Template */}
        <div style={{ marginBottom: "22px" }}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "10px" }}>
            1. Select Container Workload Template
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "10px" }}>
            {templates.map((tpl) => {
              const active = selectedTemplate === tpl.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl.id)}
                  style={{
                    padding: "14px",
                    borderRadius: "10px",
                    border: active ? "2px solid var(--ink, #101112)" : "1px solid var(--line, #e2e2dc)",
                    background: active ? "#fafaf7" : "#ffffff",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    position: "relative",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ fontSize: "1.1rem" }}>{tpl.icon}</span>
                    <span style={{ fontSize: "0.72rem", background: "#f1f3ed", color: "#4f5348", padding: "2px 7px", borderRadius: "100px", fontFamily: "var(--font-mono, monospace)" }}>
                      Port {tpl.port}
                    </span>
                  </div>
                  <h4 style={{ margin: "0 0 4px", fontSize: "0.92rem", fontWeight: 700 }}>{tpl.name}</h4>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted, #666)", lineHeight: 1.4 }}>
                    {tpl.description}
                  </p>
                  {active && (
                    <div style={{ position: "absolute", top: "10px", right: "10px" }}>
                      <CheckCircle2 size={16} color="var(--ink, #101112)" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 2: Storage Slider */}
        <div style={{ marginBottom: "22px", background: "#f8f9f5", padding: "16px", borderRadius: "12px", border: "1px solid #ebece4" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", fontWeight: 700 }}>
              <HardDrive size={16} /> Fast NVMe Scratch Disk
            </div>
            <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700, fontSize: "0.95rem" }}>
              {diskSize} GB <span style={{ fontSize: "0.75rem", color: "#666", fontWeight: 400 }}>(+{money(diskCostPerHour)}/hr)</span>
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
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#888", marginTop: "4px" }}>
            <span>20 GB (Light)</span>
            <span>100 GB (Model weights)</span>
            <span>500 GB (Massive datasets)</span>
          </div>
        </div>

        {/* Step 3: Optional SSH Public Key */}
        <div style={{ marginBottom: "22px" }}>
          <button
            type="button"
            onClick={() => setShowSshInput(!showSshInput)}
            style={{ background: "transparent", border: "none", color: "var(--violet, #6556e8)", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", padding: 0 }}
          >
            <Key size={14} /> {showSshInput ? "Hide SSH public key" : "+ Add SSH public key for direct shell login"}
          </button>
          {showSshInput && (
            <div style={{ marginTop: "10px" }}>
              <textarea
                value={sshKey}
                onChange={(e) => setSshKey(e.target.value)}
                placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5... or ssh-rsa AAAAB3NzaC1yc2E..."
                rows={3}
                style={{ width: "100%", fontSize: "0.78rem", fontFamily: "var(--font-mono, monospace)", padding: "10px", borderRadius: "8px", border: "1px solid var(--line, #dedfd9)", background: "#ffffff" }}
              />
              <span style={{ fontSize: "0.72rem", color: "#777" }}>
                Leave blank to use web-based in-browser Jupyter / Terminal.
              </span>
            </div>
          )}
        </div>

        {/* Pricing Summary & Launch Action */}
        <div style={{ borderTop: "1px solid var(--line, #e2e2dc)", paddingTop: "18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
          <div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted, #666)", marginBottom: "2px" }}>
              Billing Rate (Metered per second)
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
              <span style={{ fontSize: "1.45rem", fontWeight: 800, fontFamily: "var(--font-heading, sans-serif)" }}>
                {money(totalPerHour)}
              </span>
              <span style={{ fontSize: "0.85rem", color: "#666" }}>/ hour</span>
              <span style={{ fontSize: "0.78rem", color: "#16a34a", fontFamily: "var(--font-mono, monospace)", marginLeft: "4px" }}>
                (~${perMinute.toFixed(4)}/min)
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              className="text-button text-button-dark"
              disabled={isDeploying}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeploy}
              disabled={isDeploying}
              className="primary-button"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 24px", fontSize: "0.92rem", fontWeight: 700 }}
            >
              {isDeploying ? (
                <>
                  <Loader2 size={16} className="spin" /> Launching Container...
                </>
              ) : (
                <>
                  <Zap size={16} /> Deploy Instance
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
