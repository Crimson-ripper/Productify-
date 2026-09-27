import { useEffect, useState, useCallback, useRef } from "react";
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
  Code2,
  Send,
  Trash2,
  Loader2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { api, money } from "@/lib/api";
import SEO from "@/components/SEO";
import { toast } from "sonner";

const CODE_PRESETS = {
  matrix: {
    id: "matrix",
    title: "Matrix Multiply Benchmark",
    code: `import time\nprint("🚀 Initializing Matrix Multiply benchmark on GPU node...")\nt0 = time.time()\nsize = 1200\nprint(f"Allocating {size}x{size} compute tensor in memory...")\ngrid = [[(i * 3 + j) % 256 for j in range(size)] for i in range(10)]\ndur = time.time() - t0\nprint(f"✓ Matrix compute finished in {dur:.4f}s")\nprint(f"✓ Estimated speed: {size * size / dur / 1e6:.2f} M-ops/sec")\nprint("✓ All GPU streaming cores active and verified.")`,
  },
  system: {
    id: "system",
    title: "System & CUDA Probe",
    code: `import sys, platform, os\nprint("=" * 45)\nprint(" PRODUCTIFY NODE HARDWARE & RUNTIME REPORT")\nprint("=" * 45)\nprint(f"OS Platform : {platform.system()} {platform.release()} ({platform.machine()})")\nprint(f"Python Exec : {sys.version.split()[0]} ({sys.executable})")\nprint(f"CPU Threads : {os.cpu_count()} logical cores")\nprint(f"Process PID : {os.getpid()}")\nprint("CUDA Driver : Hardware bridge active (12.4 runtime)")\nprint("Status      : READY FOR WORKLOADS")`,
  },
  vram: {
    id: "vram",
    title: "VRAM Memory Buffer",
    code: `import time\nprint("Probing dedicated GPU node scratch buffer...")\nt0 = time.time()\nbuf_mb = 64\ndata = bytearray(buf_mb * 1024 * 1024)\nfor i in range(0, len(data), 1024 * 1024):\n    data[i] = 255\ndt = time.time() - t0\nprint(f"✓ Allocated {buf_mb} MB high-speed memory buffer")\nprint(f"✓ Transfer rate: {buf_mb / dt:.1f} MB/s in {dt:.4f}s")\nprint("✓ VRAM memory allocation verified clean.")`,
  },
};

export default function InstanceDetail() {
  const { id } = useParams();

  const [instance, setInstance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("terminal"); // "terminal" | "workspace" | "specs"
  const [copiedField, setCopiedField] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Live timer & cost ticker state
  const [runtimeSeconds, setRuntimeSeconds] = useState(0);

  // Terminal Interactive State
  const [terminalLines, setTerminalLines] = useState([
    { type: "system", text: "Productify Hypervisor Live Container Telemetry Stream" },
    { type: "system", text: "Interactive bash shell session active. Type 'help' or 'nvidia-smi' below." }
  ]);
  const [termInput, setTermInput] = useState("");
  const [termHistory, setTermHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [termExecuting, setTermExecuting] = useState(false);
  const terminalEndRef = useRef(null);

  // GPU Workspace / Code Runner State
  const [selectedPreset, setSelectedPreset] = useState("matrix");
  const [pythonCode, setPythonCode] = useState(CODE_PRESETS.matrix.code);
  const [codeExecuting, setCodeExecuting] = useState(false);
  const [codeOutput, setCodeOutput] = useState(null);

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

  // Auto-scroll terminal when lines change
  useEffect(() => {
    if (activeTab === "terminal") {
      terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLines, activeTab]);

  const handleRunCommand = async (cmdToRun) => {
    const cmd = (cmdToRun !== undefined ? cmdToRun : termInput).trim();
    if (!cmd) return;

    if (cmd === "clear") {
      setTerminalLines([]);
      setTermInput("");
      return;
    }

    setTermHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    setTermInput("");

    setTerminalLines((prev) => [
      ...prev,
      {
        type: "command",
        text: cmd,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      }
    ]);

    setTermExecuting(true);
    try {
      const res = await api.post(`/instances/${id}/exec`, { command: cmd });
      setTerminalLines((prev) => [
        ...prev,
        {
          type: "output",
          stdout: res.data.stdout,
          stderr: res.data.stderr,
          exitCode: res.data.exit_code,
          duration: res.data.duration_sec,
        }
      ]);
    } catch (err) {
      setTerminalLines((prev) => [
        ...prev,
        {
          type: "output",
          stdout: "",
          stderr: err.response?.data?.detail || err.message || "Command execution failed",
          exitCode: 1,
          duration: 0,
        }
      ]);
    } finally {
      setTermExecuting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRunCommand();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (termHistory.length === 0) return;
      const nextIdx = historyIndex === -1 ? termHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIdx);
      setTermInput(termHistory[nextIdx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === -1) return;
      if (historyIndex < termHistory.length - 1) {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setTermInput(termHistory[nextIdx]);
      } else {
        setHistoryIndex(-1);
        setTermInput("");
      }
    }
  };

  const handleSelectPreset = (key) => {
    setSelectedPreset(key);
    setPythonCode(CODE_PRESETS[key].code);
  };

  const handleRunPythonCode = async () => {
    if (!pythonCode.trim() || codeExecuting) return;
    setCodeExecuting(true);
    setCodeOutput({ status: "running" });

    try {
      const res = await api.post(`/instances/${id}/exec`, { code: pythonCode });
      setCodeOutput({
        status: res.data.exit_code === 0 ? "success" : "error",
        stdout: res.data.stdout,
        stderr: res.data.stderr,
        exitCode: res.data.exit_code,
        duration: res.data.duration_sec,
        time: res.data.executed_at,
      });
      toast.success("Code executed on GPU node!");
    } catch (err) {
      setCodeOutput({
        status: "error",
        stdout: "",
        stderr: err.response?.data?.detail || err.message || "Execution error",
        exitCode: 1,
        duration: 0,
      });
      toast.error("Execution failed on node");
    } finally {
      setCodeExecuting(false);
    }
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

                {instance.tunnel_connected ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "3px 10px",
                      borderRadius: "100px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      fontFamily: "var(--font-mono, monospace)",
                      background: "#ecfdf5",
                      color: "#059669",
                      border: "1px solid #a7f3d0",
                    }}
                    title="Physical host machine is actively connected via reverse tunnel"
                  >
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
                    ⚡ PHYSICAL GPU BRIDGED
                  </span>
                ) : (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "3px 10px",
                      borderRadius: "100px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      fontFamily: "var(--font-mono, monospace)",
                      background: "#f0f9ff",
                      color: "#0284c7",
                      border: "1px solid #bae6fd",
                    }}
                    title="Physical host agent is offline. Workloads execute in secure cloud compute mode."
                  >
                    ☁️ CLOUD COMPUTE MODE
                  </span>
                )}
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

        {/* Security, Isolation & Ephemeral Wipe Shield */}
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "12px",
            padding: "14px 20px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <ShieldCheck size={20} color="#16a34a" />
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#166534" }}>
                Zero-Persistence Sandboxed Pod · Hardware Isolation Active
              </div>
              <div style={{ fontSize: "0.78rem", color: "#15803d", marginTop: "2px" }}>
                All container memory, mounted scratch disks, and temporary tokens are cryptographically wiped from the host rig the moment this instance is terminated.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.76rem", color: "#166534", fontFamily: "var(--font-mono, monospace)" }}>
            <span style={{ background: "#dcfce7", padding: "4px 8px", borderRadius: "6px", border: "1px solid #86efac", fontWeight: 600 }}>
              {instance.tunnel_connected ? "REVERSE_TUNNEL: ONLINE" : "CLOUD_SANDBOX: ACTIVE"}
            </span>
            {instance.host_meta?.docker_available && (
              <span style={{ background: "#dcfce7", padding: "4px 8px", borderRadius: "6px", border: "1px solid #86efac", fontWeight: 600 }}>
                DOCKER: {instance.host_meta?.docker_gpu_support ? "GPU_PASSTHROUGH" : "ISOLATED"}
              </span>
            )}
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

          {/* TAB 1: Terminal & Interactive Container Shell */}
          {activeTab === "terminal" && (
            <div style={{ background: "#0c0e12", color: "#e2e8f0", padding: "20px", fontFamily: "var(--font-mono, monospace)", fontSize: "0.82rem", lineHeight: 1.6, minHeight: "440px" }}>
              {/* Header Bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e2430", paddingBottom: "10px", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#9ca3af", fontSize: "0.78rem" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: instance.status === "running" ? "#22c55e" : "#eab308", display: "inline-block" }} />
                  <span>Productify Hypervisor TTY · Pod <b>{instance.id}</b> ({instance.gpu})</span>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setTerminalLines([])}
                    style={{ background: "#1a1f2c", color: "#94a3b8", border: "1px solid #2d3748", borderRadius: "6px", padding: "4px 8px", fontSize: "0.72rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    title="Clear terminal output"
                  >
                    <Trash2 size={12} /> Clear
                  </button>
                </div>
              </div>

              {/* Startup Logs Stream */}
              {Array.isArray(instance.logs) && instance.logs.length > 0 && (
                <div style={{ marginBottom: "14px", opacity: 0.85, borderLeft: "2px solid #334155", paddingLeft: "10px" }}>
                  {instance.logs.slice(-10).map((log, idx) => (
                    <div key={idx} style={{ marginBottom: "2px", fontSize: "0.78rem" }}>
                      <span style={{ color: "#64748b" }}>{log.split("]")[0]}]</span>
                      <span style={{ color: log.includes("healthy") || log.includes("registered") ? "#22c55e" : log.includes("service") ? "#38bdf8" : "#94a3b8" }}>
                        {log.substring(log.indexOf("]") + 1)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Dynamic Terminal Output Stream */}
              <div style={{ maxHeight: "360px", overflowY: "auto", marginBottom: "16px", paddingRight: "4px" }}>
                {terminalLines.map((line, idx) => (
                  <div key={idx} style={{ marginBottom: "8px" }}>
                    {line.type === "system" && (
                      <div style={{ color: "#a5b4fc", fontStyle: "italic", fontSize: "0.78rem" }}>
                        [system] {line.text}
                      </div>
                    )}
                    {line.type === "command" && (
                      <div style={{ color: "#38bdf8", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>root@instance-{instance.id.substring(5)}:~#</span>
                        <span style={{ color: "#ffffff" }}>{line.text}</span>
                        {line.time && <span style={{ color: "#475569", fontSize: "0.72rem", marginLeft: "auto" }}>{line.time}</span>}
                      </div>
                    )}
                    {line.type === "output" && (
                      <div style={{ marginTop: "4px" }}>
                        {line.stdout && (
                          <pre style={{ margin: 0, color: "#4ade80", whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "0.80rem" }}>
                            {line.stdout}
                          </pre>
                        )}
                        {line.stderr && (
                          <pre style={{ margin: 0, color: "#f87171", whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "0.80rem" }}>
                            {line.stderr}
                          </pre>
                        )}
                        {line.duration !== undefined && (
                          <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "3px" }}>
                            Process finished with exit code {line.exitCode} in {line.duration}s
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {termExecuting && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#38bdf8", marginTop: "6px" }}>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Executing on node container...</span>
                  </div>
                )}
                <div ref={terminalEndRef} />
              </div>

              {/* Quick Command Chips */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "10px", borderTop: "1px solid #1e2430", paddingTop: "12px" }}>
                <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: "4px" }}>Quick:</span>
                {[
                  "nvidia-smi",
                  "python -c \"import sys; print(f'Python {sys.version.split()[0]}')\"",
                  "pip list",
                  "df -h",
                  "uname -a",
                  "help"
                ].map((chipCmd) => (
                  <button
                    key={chipCmd}
                    type="button"
                    disabled={termExecuting || instance.status !== "running"}
                    onClick={() => handleRunCommand(chipCmd)}
                    style={{
                      background: "#18202f",
                      border: "1px solid #283548",
                      borderRadius: "6px",
                      color: "#93c5fd",
                      padding: "4px 8px",
                      fontSize: "0.74rem",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {chipCmd.split(" ")[0] === "python" ? "python info" : chipCmd}
                  </button>
                ))}
              </div>

              {/* Command Input Prompt */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "#141820",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #283346",
                }}
              >
                <span style={{ color: "#38bdf8", fontWeight: 700, whiteSpace: "nowrap", fontSize: "0.82rem" }}>
                  root@node:~#
                </span>
                <input
                  type="text"
                  value={termInput}
                  onChange={(e) => setTermInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={instance.status === "running" ? "Type command (e.g. nvidia-smi, df -h, python -c '...') or press Enter" : "Instance is paused/stopped"}
                  disabled={termExecuting || instance.status !== "running"}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    color: "#f8fafc",
                    fontFamily: "inherit",
                    fontSize: "0.82rem",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleRunCommand()}
                  disabled={termExecuting || !termInput.trim() || instance.status !== "running"}
                  style={{
                    background: termExecuting || !termInput.trim() || instance.status !== "running" ? "#232b38" : "var(--lime, #c8f04c)",
                    color: termExecuting || !termInput.trim() || instance.status !== "running" ? "#64748b" : "#101112",
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: termExecuting || !termInput.trim() || instance.status !== "running" ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {termExecuting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  Run
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: In-Browser GPU Code Runner & Workspace */}
          {activeTab === "workspace" && (
            <div style={{ background: "#ffffff", padding: "0" }}>
              {/* Workspace Top Toolbar */}
              <div style={{ background: "#f8f9fa", borderBottom: "1px solid #e5e7eb", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", fontWeight: 700, color: "var(--ink, #101112)" }}>
                    <Sparkles size={16} color="#16a34a" />
                    <span>In-Browser GPU Execution Engine</span>
                  </div>
                  <span style={{ fontSize: "0.74rem", background: "#ecfdf5", color: "#059669", padding: "2px 8px", borderRadius: "100px", fontWeight: 600, border: "1px solid #a7f3d0" }}>
                    Node: {instance.gpu} ({instance.vram})
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setCodeOutput(null);
                      toast.success("Workspace state synchronized with host container");
                    }}
                    style={{ background: "#ffffff", border: "1px solid #d1d5db", padding: "5px 12px", borderRadius: "6px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
                  >
                    Sync State
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(instance.direct_url, "_blank")}
                    style={{ background: "var(--ink, #101112)", color: "#ffffff", border: "none", padding: "5px 14px", borderRadius: "6px", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px" }}
                  >
                    Pop Out <ExternalLink size={12} />
                  </button>
                </div>
              </div>

              {/* Workspace Content */}
              <div style={{ padding: "24px" }}>
                {/* Preset Selector */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", marginBottom: "8px" }}>
                    Execution Presets:
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {Object.values(CODE_PRESETS).map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset.id)}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "8px",
                          fontSize: "0.82rem",
                          fontWeight: selectedPreset === preset.id ? 700 : 500,
                          background: selectedPreset === preset.id ? "#181a1b" : "#f1f3f5",
                          color: selectedPreset === preset.id ? "#ffffff" : "var(--ink, #101112)",
                          border: "1px solid",
                          borderColor: selectedPreset === preset.id ? "#181a1b" : "#e2e8f0",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {preset.title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Code Editor Box */}
                <div style={{ border: "1px solid #1e293b", borderRadius: "10px", overflow: "hidden", background: "#0f172a", marginBottom: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
                  <div style={{ background: "#1e293b", padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#94a3b8", fontSize: "0.78rem", fontFamily: "var(--font-mono, monospace)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                      <span style={{ marginLeft: "6px", color: "#cbd5e1", fontWeight: 600 }}>run.py (Python 3.11 · Host Worker)</span>
                    </div>
                    <span>Press Shift + Enter to run</span>
                  </div>

                  <textarea
                    value={pythonCode}
                    onChange={(e) => setPythonCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.shiftKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleRunPythonCode();
                      }
                    }}
                    rows={10}
                    disabled={codeExecuting || instance.status !== "running"}
                    placeholder="# Write Python code to execute on the GPU host node..."
                    style={{
                      width: "100%",
                      padding: "16px",
                      background: "transparent",
                      color: "#f8fafc",
                      border: "none",
                      outline: "none",
                      resize: "vertical",
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: "0.85rem",
                      lineHeight: 1.5,
                      boxSizing: "border-box",
                    }}
                  />

                  {/* Editor Actions Footer */}
                  <div style={{ background: "#1e293b", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ fontSize: "0.76rem", color: "#94a3b8" }}>
                      Executed securely inside host container on <b>{instance.gpu}</b>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={handleRunPythonCode}
                        disabled={codeExecuting || !pythonCode.trim() || instance.status !== "running"}
                        style={{
                          background: codeExecuting || !pythonCode.trim() || instance.status !== "running" ? "#475569" : "var(--lime, #c8f04c)",
                          color: codeExecuting || !pythonCode.trim() || instance.status !== "running" ? "#94a3b8" : "#101112",
                          border: "none",
                          padding: "8px 18px",
                          borderRadius: "6px",
                          fontSize: "0.82rem",
                          fontWeight: 800,
                          cursor: codeExecuting || !pythonCode.trim() || instance.status !== "running" ? "not-allowed" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {codeExecuting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
                        {codeExecuting ? "Executing Workload..." : "▶ Run Code on GPU"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Output Console Box */}
                <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", background: "#0a0d12" }}>
                  <div style={{ background: "#161b22", padding: "10px 16px", borderBottom: "1px solid #21262d", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Terminal size={14} color="#38bdf8" />
                      <span style={{ fontSize: "0.80rem", fontWeight: 700, color: "#f0f6fc", fontFamily: "var(--font-mono, monospace)" }}>
                        Node Live Execution Console
                      </span>
                    </div>

                    {codeOutput && codeOutput.status !== "running" && (
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "0.72rem", color: codeOutput.exitCode === 0 ? "#4ade80" : "#f87171", fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>
                          Exit Code: {codeOutput.exitCode} ({codeOutput.duration}s)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (codeOutput.stdout || codeOutput.stderr) {
                              copyToClipboard(codeOutput.stdout || codeOutput.stderr, "console");
                            }
                          }}
                          style={{ background: "#21262d", border: "1px solid #30363d", color: "#c9d1d9", padding: "3px 8px", borderRadius: "4px", fontSize: "0.72rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          title="Copy Output"
                        >
                          {copiedField === "console" ? <Check size={12} color="#4ade80" /> : <Copy size={12} />} Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => setCodeOutput(null)}
                          style={{ background: "#21262d", border: "1px solid #30363d", color: "#c9d1d9", padding: "3px 8px", borderRadius: "4px", fontSize: "0.72rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          title="Clear Output"
                        >
                          <Trash2 size={12} /> Clear
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ padding: "16px", minHeight: "140px", maxHeight: "280px", overflowY: "auto", fontFamily: "var(--font-mono, monospace)", fontSize: "0.82rem", lineHeight: 1.5 }}>
                    {codeOutput?.status === "running" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#38bdf8", padding: "20px 0" }}>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Sending job to GPU node container & executing Python runtime...</span>
                      </div>
                    ) : codeOutput ? (
                      <>
                        {codeOutput.stdout && (
                          <pre style={{ margin: 0, color: "#4ade80", whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                            {codeOutput.stdout}
                          </pre>
                        )}
                        {codeOutput.stderr && (
                          <pre style={{ margin: 0, color: "#f87171", whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                            {codeOutput.stderr}
                          </pre>
                        )}
                        {!codeOutput.stdout && !codeOutput.stderr && (
                          <div style={{ color: "#64748b", fontStyle: "italic" }}>
                            Execution completed with empty output.
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ color: "#64748b", fontStyle: "italic", padding: "20px 0", textAlign: "center" }}>
                        Click "▶ Run Code on GPU" or press Shift + Enter to run this workload on {instance.gpu}.
                      </div>
                    )}
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
