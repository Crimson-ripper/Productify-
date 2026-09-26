import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Cpu,
  Copy,
  ExternalLink,
  Square,
  Play,
  RotateCcw,
  Check,
  Activity,
  Terminal,
  Server,
  Gauge,
  Clock,
  Code2
} from "lucide-react";
import { api, money } from "@/lib/api";
import SEO from "@/components/SEO";
import { toast } from "sonner";

export default function InstanceDetail() {
  const { id } = useParams();

  const [instance, setInstance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("terminal"); // "terminal" | "workspace" | "specs"
  const [copiedField, setCopiedField] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Live timer & cost ticker state
  const [runtimeSeconds, setRuntimeSeconds] = useState(0);

  const fetchInstance = useCallback(async (isPoll = false) => {
    try {
      const res = await api.get(`/instances/${id}`);
      setInstance(res.data);
      setRuntimeSeconds(res.data.live_runtime_seconds || 0);
    } catch (err) {
      if (!isPoll) {
        toast.error("Failed to load instance details");
      }
    } finally {
      if (!isPoll) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInstance(false);
    const interval = setInterval(() => {
      fetchInstance(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchInstance]);

  // Second-by-second ticker increment
  useEffect(() => {
    if (instance?.status !== "running") return;
    const ticker = setInterval(() => {
      setRuntimeSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(ticker);
  }, [instance?.status]);

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleAction = async (action) => {
    if (action === "terminate") {
      const confirmed = window.confirm("Are you sure you want to terminate this instance? Compute will stop and all scratch data will be removed.");
      if (!confirmed) return;
    }

    setActionBusy(true);
    try {
      await api.post(`/instances/${id}/action`, { action });
      toast.success(`Instance ${action === "terminate" ? "terminated" : action === "pause" ? "paused" : "resumed"} successfully`);
      await fetchInstance(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to ${action} instance`);
    } finally {
      setActionBusy(false);
    }
  };

  const formatRuntime = (totalSec) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <span />
        <p>Connecting to GPU instance container...</p>
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="empty-block" style={{ padding: "80px 20px", textAlign: "center" }}>
        <h2>Instance not found</h2>
        <p>This instance may have expired or you do not have permission to view it.</p>
        <Link to="/rentals" className="primary-button" style={{ marginTop: "14px", display: "inline-flex" }}>
          Browse GPU Nodes
        </Link>
      </div>
    );
  }

  const currentCost = (runtimeSeconds / 3600.0) * Number(instance.hourly_price || 0.60);
  const statusColor = instance.status === "running" ? "#16a34a" : instance.status === "paused" ? "#d97706" : "#6b7280";

  return (
    <>
      <SEO
        title={`${instance.rental_title} (${instance.id}) · Productify Cloud Compute`}
        description={`On-demand GPU container instance running ${instance.template_name}.`}
        path={`/instances/${instance.id}`}
      />

      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "36px 5% 80px" }}>
        {/* Navigation Breadcrumb */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ fontSize: "0.82rem", color: "var(--muted, #777)", display: "flex", gap: "6px", alignItems: "center" }}>
            <Link to="/rentals" style={{ color: "var(--ink, #101112)", textDecoration: "none" }}>GPU Rentals</Link>
            <span>/</span>
            <Link to="/instances" style={{ color: "var(--ink, #101112)", textDecoration: "none" }}>My Instances</Link>
            <span>/</span>
            <span style={{ fontFamily: "var(--font-mono, monospace)" }}>{instance.id}</span>
          </div>

          <Link
            to="/instances"
            className="text-button text-button-dark"
            style={{ fontSize: "0.82rem", padding: "4px 8px" }}
          >
            ← Back to All Instances
          </Link>
        </div>

        {/* Top Control Header */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid var(--line, #e2e2dc)",
            borderRadius: "16px",
            padding: "24px 28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "20px",
            marginBottom: "24px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "#f0f2eb",
                display: "grid",
                placeItems: "center",
                color: "var(--ink, #101112)",
                fontSize: "1.4rem",
              }}
            >
              {instance.template_id === "jupyter-pytorch" ? "⚡" : instance.template_id === "comfyui-sdxl" ? "🎨" : instance.template_id === "ollama-llm" ? "🦙" : "💻"}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, fontFamily: "var(--font-heading, sans-serif)", letterSpacing: "-0.03em" }}>
                  {instance.template_name}
                </h1>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "3px 10px",
                    borderRadius: "100px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    fontFamily: "var(--font-mono, monospace)",
                    background: instance.status === "running" ? "#eefbf2" : instance.status === "paused" ? "#fef8e7" : "#f3f4f6",
                    color: statusColor,
                    border: `1px solid ${statusColor}33`,
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: statusColor,
                      boxShadow: instance.status === "running" ? `0 0 8px ${statusColor}` : "none",
                    }}
                  />
                  {instance.status.toUpperCase()}
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--muted, #666)" }}>
                Node: <b>{instance.rental_title}</b> ({instance.gpu}, {instance.vram}) · Host: {instance.seller_name} · {instance.location}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {instance.status === "running" ? (
              <button
                type="button"
                onClick={() => handleAction("pause")}
                disabled={actionBusy}
                className="secondary-button"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 18px", fontSize: "0.85rem", fontWeight: 700, border: "1px solid var(--line, #dedfd9)" }}
              >
                <Square size={14} fill="currentColor" /> Pause Compute
              </button>
            ) : instance.status === "paused" ? (
              <button
                type="button"
                onClick={() => handleAction("resume")}
                disabled={actionBusy}
                className="primary-button"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 18px", fontSize: "0.85rem", fontWeight: 700 }}
              >
                <Play size={14} fill="currentColor" /> Resume Workload
              </button>
            ) : null}

            {instance.status !== "terminated" && (
              <button
                type="button"
                onClick={() => handleAction("terminate")}
                disabled={actionBusy}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 18px",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  background: "#fef2f2",
                  color: "#b91c1c",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                <RotateCcw size={14} /> Terminate
              </button>
            )}
          </div>
        </div>

        {/* Real-time Metering Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          {/* Runtime Clock */}
          <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid var(--line, #e2e2dc)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted, #777)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono, monospace)" }}>
              <Clock size={15} /> Active Runtime
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: "var(--ink, #101112)", margin: "8px 0 2px" }}>
              {formatRuntime(runtimeSeconds)}
            </div>
            <span style={{ fontSize: "0.75rem", color: "#666" }}>
              Started at {new Date(instance.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          {/* Accrued Cost Ticker */}
          <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid var(--line, #e2e2dc)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#16a34a", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono, monospace)" }}>
              <Activity size={15} /> Current Accrued Cost
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: "#16a34a", margin: "8px 0 2px" }}>
              ${currentCost.toFixed(4)}
            </div>
            <span style={{ fontSize: "0.75rem", color: "#666" }}>
              Rate: {money(instance.hourly_price)}/hr ({money(instance.base_price)} compute + {money(instance.storage_price)} disk)
            </span>
          </div>

          {/* GPU Telemetry */}
          <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid var(--line, #e2e2dc)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted, #777)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono, monospace)" }}>
              <Gauge size={15} /> GPU Utilization & VRAM
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: "var(--ink, #101112)", margin: "8px 0 2px" }}>
              {instance.telemetry?.gpu_utilization_pct || 78}%
            </div>
            <span style={{ fontSize: "0.75rem", color: "#666" }}>
              VRAM: {instance.telemetry?.vram_used_gb || 16.4} / {instance.telemetry?.vram_total_gb || 24} GB · {instance.telemetry?.temperature_c || 64}°C
            </span>
          </div>

          {/* Host Node Specs */}
          <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid var(--line, #e2e2dc)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted, #777)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono, monospace)" }}>
              <Server size={15} /> Node Connectivity
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--ink, #101112)", margin: "10px 0 4px", fontFamily: "var(--font-mono, monospace)" }}>
              {instance.host_ip}:{instance.ssh_port}
            </div>
            <span style={{ fontSize: "0.75rem", color: "#666" }}>
              Scratch: {instance.disk_size_gb} GB NVMe ext4 attached
            </span>
          </div>
        </div>

        {/* Quick Connection Bar */}
        <div
          style={{
            background: "#181a1b",
            color: "#f3f4f6",
            borderRadius: "14px",
            padding: "20px 24px",
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div style={{ fontSize: "0.72rem", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "var(--font-mono, monospace)", marginBottom: "4px" }}>
              DIRECT ACCESS PROTOCOLS
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#a3e635", fontSize: "0.85rem", fontWeight: 700 }}>SSH command:</span>
                <code style={{ background: "#26292b", padding: "5px 10px", borderRadius: "6px", fontSize: "0.82rem", color: "#e5e7eb" }}>
                  {instance.ssh_command}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(instance.ssh_command, "ssh")}
                  style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer", padding: "2px" }}
                  title="Copy SSH command"
                >
                  {copiedField === "ssh" ? <Check size={16} color="#a3e635" /> : <Copy size={16} />}
                </button>
              </div>

              {instance.jupyter_token && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "#a3e635", fontSize: "0.85rem", fontWeight: 700 }}>Token:</span>
                  <code style={{ background: "#26292b", padding: "5px 10px", borderRadius: "6px", fontSize: "0.82rem", color: "#e5e7eb" }}>
                    {instance.jupyter_token}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(instance.jupyter_token, "token")}
                    style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer", padding: "2px" }}
                    title="Copy auth token"
                  >
                    {copiedField === "token" ? <Check size={16} color="#a3e635" /> : <Copy size={16} />}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => {
                setActiveTab("workspace");
                toast.success(`Switched to in-browser ${instance.service_name} view below!`);
              }}
              className="primary-button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "var(--lime, #c8f04c)",
                color: "var(--ink, #101112)",
                padding: "10px 20px",
                fontSize: "0.85rem",
                fontWeight: 800,
                border: "none",
              }}
            >
              <ExternalLink size={15} /> Launch In-Browser {instance.service_name}
            </button>
          </div>
        </div>

        {/* Tabbed Interactive Console Area */}
        <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid var(--line, #e2e2dc)", overflow: "hidden" }}>
          {/* Tab Selector */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--line, #e2e2dc)", background: "#fafaf7" }}>
            <button
              type="button"
              onClick={() => setActiveTab("terminal")}
              style={{
                padding: "14px 22px",
                border: "none",
                background: activeTab === "terminal" ? "#ffffff" : "transparent",
                borderBottom: activeTab === "terminal" ? "2px solid var(--ink, #101112)" : "none",
                fontWeight: activeTab === "terminal" ? 700 : 500,
                fontSize: "0.88rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Terminal size={16} /> Container Logs & Startup
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("workspace")}
              style={{
                padding: "14px 22px",
                border: "none",
                background: activeTab === "workspace" ? "#ffffff" : "transparent",
                borderBottom: activeTab === "workspace" ? "2px solid var(--ink, #101112)" : "none",
                fontWeight: activeTab === "workspace" ? 700 : 500,
                fontSize: "0.88rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Code2 size={16} /> In-Browser {instance.service_name} Workspace
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("specs")}
              style={{
                padding: "14px 22px",
                border: "none",
                background: activeTab === "specs" ? "#ffffff" : "transparent",
                borderBottom: activeTab === "specs" ? "2px solid var(--ink, #101112)" : "none",
                fontWeight: activeTab === "specs" ? 700 : 500,
                fontSize: "0.88rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Cpu size={16} /> Node Hardware & Configuration
            </button>
          </div>

          {/* TAB 1: Terminal & Container Logs */}
          {activeTab === "terminal" && (
            <div style={{ background: "#0f1115", color: "#4ade80", padding: "22px", fontFamily: "var(--font-mono, monospace)", fontSize: "0.82rem", lineHeight: 1.6, minHeight: "360px", overflowX: "auto" }}>
              <div style={{ color: "#9ca3af", marginBottom: "12px", borderBottom: "1px solid #23272e", paddingBottom: "8px" }}>
                Productify Hypervisor Container Telemetry Stream · Pod {instance.id}
              </div>
              {Array.isArray(instance.logs) && instance.logs.map((log, idx) => (
                <div key={idx} style={{ marginBottom: "4px" }}>
                  <span style={{ color: "#6b7280" }}>{log.split("]")[0]}]</span>
                  <span style={{ color: log.includes("healthy") ? "#22c55e" : log.includes("service") ? "#38bdf8" : "#e2e8f0" }}>
                    {log.substring(log.indexOf("]") + 1)}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: "14px", color: "#38bdf8" }}>
                root@instance-{instance.id.substring(5)}:~# nvidia-smi --query-gpu=name,driver_version,temperature.gpu,utilization.gpu --format=csv
              </div>
              <div style={{ color: "#e2e8f0", marginTop: "4px" }}>
                name, driver_version, temperature.gpu, utilization.gpu [%]<br />
                {instance.gpu}, 550.54.14, {instance.telemetry?.temperature_c || 63} C, {instance.telemetry?.gpu_utilization_pct || 79} %
              </div>
              <div style={{ marginTop: "12px", color: "#9ca3af", animation: "blink 1s infinite" }}>
                root@instance-{instance.id.substring(5)}:~# <span style={{ display: "inline-block", width: "8px", height: "14px", background: "#4ade80", verticalAlign: "middle" }} />
              </div>
            </div>
          )}

          {/* TAB 2: In-Browser Web Workspace */}
          {activeTab === "workspace" && (
            <div style={{ padding: "0", background: "#f8f9fa", minHeight: "420px" }}>
              <div style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb", padding: "10px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", fontWeight: 600 }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e" }} />
                  {instance.service_name} Virtual Terminal Session
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => toast.success("Environment synced with node scratch disk")}
                    style={{ background: "#f3f4f6", border: "1px solid #d1d5db", padding: "4px 10px", borderRadius: "6px", fontSize: "0.75rem", cursor: "pointer" }}
                  >
                    Sync State
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(instance.direct_url, "_blank")}
                    style={{ background: "var(--ink, #101112)", color: "#ffffff", border: "none", padding: "4px 12px", borderRadius: "6px", fontSize: "0.75rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    Pop Out <ExternalLink size={12} />
                  </button>
                </div>
              </div>

              {/* Workspace Mock Content */}
              <div style={{ padding: "24px" }}>
                <div style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e5e7eb", padding: "20px" }}>
                  <h3 style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>
                    🚀 {instance.service_name} Ready for Execution
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "#666", lineHeight: 1.5, margin: "0 0 16px" }}>
                    Your instance is running container image <code>{instance.docker_image}</code> mounted on <b>{instance.disk_size_gb}GB NVMe</b> storage.
                    You can execute Jupyter notebooks, run ComfyUI workflows, or train models directly.
                  </p>

                  <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", fontFamily: "var(--font-mono, monospace)", fontSize: "0.82rem" }}>
                    <div style={{ color: "#64748b", marginBottom: "8px" }}># Quick Python PyTorch Test</div>
                    <div style={{ color: "#0f172a" }}>
                      import torch<br />
                      print(f"CUDA Available: &#123;torch.cuda.is_available()&#125;")<br />
                      print(f"Device Name: &#123;torch.cuda.get_device_name(0)&#125;")<br />
                      x = torch.randn(4096, 4096, device='cuda')<br />
                      print(f"Matrix multiply speed: &#123;torch.matmul(x, x).shape&#125; completed on GPU")
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Node Hardware Details */}
          {activeTab === "specs" && (
            <div style={{ padding: "28px" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "1.1rem" }}>Node Hardware Specs</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
                <div style={{ padding: "16px", borderRadius: "8px", background: "#fafaf7", border: "1px solid var(--line, #e2e2dc)" }}>
                  <span style={{ fontSize: "0.75rem", color: "#666", textTransform: "uppercase" }}>GPU Acceleration</span>
                  <div style={{ fontSize: "1rem", fontWeight: 700, margin: "4px 0" }}>{instance.gpu} ({instance.vram})</div>
                  <span style={{ fontSize: "0.78rem", color: "#444" }}>PCIe 4.0 x16 · 16,384 CUDA Cores</span>
                </div>

                <div style={{ padding: "16px", borderRadius: "8px", background: "#fafaf7", border: "1px solid var(--line, #e2e2dc)" }}>
                  <span style={{ fontSize: "0.75rem", color: "#666", textTransform: "uppercase" }}>Host CPU</span>
                  <div style={{ fontSize: "1rem", fontWeight: 700, margin: "4px 0" }}>{instance.specs?.cpu || "AMD Ryzen 9 7950X / EPYC"}</div>
                  <span style={{ fontSize: "0.78rem", color: "#444" }}>Dedicated compute threads</span>
                </div>

                <div style={{ padding: "16px", borderRadius: "8px", background: "#fafaf7", border: "1px solid var(--line, #e2e2dc)" }}>
                  <span style={{ fontSize: "0.75rem", color: "#666", textTransform: "uppercase" }}>System RAM</span>
                  <div style={{ fontSize: "1rem", fontWeight: 700, margin: "4px 0" }}>{instance.specs?.ram || "128 GB DDR5 ECC"}</div>
                  <span style={{ fontSize: "0.78rem", color: "#444" }}>High-speed memory bandwidth</span>
                </div>

                <div style={{ padding: "16px", borderRadius: "8px", background: "#fafaf7", border: "1px solid var(--line, #e2e2dc)" }}>
                  <span style={{ fontSize: "0.75rem", color: "#666", textTransform: "uppercase" }}>Internet Uplink</span>
                  <div style={{ fontSize: "1rem", fontWeight: 700, margin: "4px 0" }}>{instance.specs?.bandwidth || "1 Gbps Symmetrical"}</div>
                  <span style={{ fontSize: "0.78rem", color: "#444" }}>Data center fiber low-latency pipe</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
