import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Cpu,
  Copy,
  ExternalLink,
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
  Maximize2,
  Minimize2,
} from "lucide-react";
import { api, money, getErrorMessage } from "@/lib/api";
import SEO from "@/components/SEO";
import TemplateIcon from "@/components/TemplateIcon";
import { toast } from "sonner";

const NEEDS_TORCH = `try:
    import torch
except ImportError:
    raise SystemExit("PyTorch isn't installed here. Order the PyTorch environment, or run: pip install torch")
if not torch.cuda.is_available():
    raise SystemExit("PyTorch can't see a GPU on this machine.")
`;

// Every number these print is measured on the renter's machine when they run (CLAUDE.md §3 rule 2).
const CODE_PRESETS = {
  matrix: {
    id: "matrix",
    title: "GPU matrix multiply",
    code: `import time
${NEEDS_TORCH}
size = 4000
a = torch.rand(size, size, device="cuda")
b = torch.rand(size, size, device="cuda")
torch.cuda.synchronize()
t0 = time.time()
c = a @ b
torch.cuda.synchronize()
print(f"GPU: {torch.cuda.get_device_name(0)}")
print(f"Multiplied two {size}x{size} matrices in {time.time() - t0:.4f}s")`,
  },
  system: {
    id: "system",
    title: "System & GPU info",
    code: `import os, platform, subprocess, sys
print(f"OS:      {platform.system()} {platform.release()} ({platform.machine()})")
print(f"Python:  {sys.version.split()[0]}")
print(f"CPU:     {os.cpu_count()} logical cores")
r = subprocess.run(["nvidia-smi", "--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"], capture_output=True, text=True)
print(f"GPU:     {r.stdout.strip() or 'none found'}")
try:
    import torch
    print(f"PyTorch: {torch.__version__}, can use GPU: {torch.cuda.is_available()}")
except ImportError:
    print("PyTorch: not installed")`,
  },
  vram: {
    id: "vram",
    title: "GPU memory test",
    code: `import time
${NEEDS_TORCH}
gb = 1
t0 = time.time()
x = torch.ones(gb * 1024 ** 3, dtype=torch.uint8, device="cuda")
torch.cuda.synchronize()
print(f"Filled {gb} GB of GPU memory in {time.time() - t0:.4f}s")
print(f"Allocated: {torch.cuda.memory_allocated() / 1024 ** 3:.2f} GB of {torch.cuda.get_device_properties(0).total_memory / 1024 ** 3:.1f} GB")
del x
torch.cuda.empty_cache()`,
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
    { type: "system", text: "Browser terminal. Each command runs on its own inside your container (it isn't a full shell session, so `cd` doesn't carry over)." },
    { type: "system", text: "Commands time out after 2 minutes. Try nvidia-smi or python -c \"import torch; print(torch.cuda.is_available())\"." }
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
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(false);

  const fetchInstance = useCallback(async (isPoll = false) => {
    try {
      const res = await api.get(`/instances/${id}`);
      setInstance(res.data);
      setRuntimeSeconds(res.data.live_runtime_seconds || 0);
    } catch (err) {
      if (!isPoll) {
        toast.error(getErrorMessage(err, "Failed to load instance details"));
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
      toast.error(getErrorMessage(err, `Failed to ${action} instance`));
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
      toast.error(getErrorMessage(err, "Execution failed on node"));
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
        <p>Either this instance doesn't exist, or it belongs to a different account. If you started it, make sure you're signed in with that account (each window shares one sign-in).</p>
        <Link to="/rentals" className="primary-button" style={{ marginTop: "14px", display: "inline-flex" }}>
          Browse GPU Nodes
        </Link>
      </div>
    );
  }

  const currentCost = (runtimeSeconds / 3600.0) * Number(instance.hourly_price || 0.60);
  const statusColor = instance.status === "running" ? "var(--ok)" : instance.status === "paused" ? "#a56b1a" : "var(--muted)";

  return (
    <>
      <SEO
        title={`${instance.rental_title} (${instance.id}) · Productify`}
        description={`On-demand GPU container instance running ${instance.template_name}.`}
        path={`/instances/${instance.id}`}
      />

      <div className="ix">
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "36px 5% 80px" }}>
        {/* Navigation Breadcrumb */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ fontSize: "0.82rem", color: "var(--ix-fg2)", display: "flex", gap: "6px", alignItems: "center" }}>
            <Link to="/rentals" style={{ color: "var(--ix-fg)", textDecoration: "none" }}>GPU Rentals</Link>
            <span>/</span>
            <Link to="/instances" style={{ color: "var(--ix-fg)", textDecoration: "none" }}>My Instances</Link>
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
            background: "var(--ix-card)",
            border: "0",
            borderRadius: 0,
            padding: "24px 28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "20px",
            marginBottom: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: 0,
                background: "var(--ix-card2)",
                display: "grid",
                placeItems: "center",
                color: "var(--ix-fg)",
                fontSize: "1.4rem",
              }}
            >
              <TemplateIcon id={instance.template_id} size={22} />
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

                {instance.status === "terminated" ? null : instance.tunnel_connected ? (
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
                      background: "var(--ix-ok-bg)",
                      color: "var(--ix-ok)",
                      border: "0",
                    }}
                    title="The host machine is connected"
                  >
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--ok)" }} />
                    Running on the GPU
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
                      background: "var(--ix-warn-bg)",
                      color: "#8a3a10",
                      border: "0",
                    }}
                    title="The host machine is offline. Commands can't run until it reconnects."
                  >
                    Machine offline
                  </span>
                )}
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--ix-fg2)" }}>
                Node: <b>{instance.rental_title}</b> ({instance.gpu}, {instance.vram}) · Host: {instance.seller_name} · {instance.location}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {instance.status === "terminated" && instance.kind === "partner" && !instance.started_at && (
              <p className="ix-starting" role="status">This order didn't start{instance.end_reason ? `: ${instance.end_reason}` : ""}. You haven't been charged. <Link to="/rentals">Order again</Link></p>
            )}
            {instance.status === "finding" && (
              <p className="ix-starting" role="status">Finding a machine at or under {money(instance.max_price)}/h… this page updates by itself. You see the exact price once it's ready, and billing starts only then. If nothing starts within 10 minutes the order is cancelled and you aren't charged.</p>
            )}
            {instance.status === "starting" && (
              <p className="ix-starting" role="status">Starting your machine… this usually takes 2–5 minutes and this page updates by itself. Billing starts only when it's ready; if it doesn't start within 10 minutes it's cancelled and you aren't charged.</p>
            )}
            {instance.status === "paused" ? (
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
                  background: "#c0392b",
                  color: "#ffffff",
                  border: "0",
                  borderRadius: 0,
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
          <div style={{ background: "var(--ix-card)", padding: "20px", borderRadius: 0, border: "0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ix-fg2)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono, monospace)" }}>
              <Clock size={15} /> Active Runtime
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: "var(--ix-fg)", margin: "8px 0 2px" }}>
              {formatRuntime(runtimeSeconds)}
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--ix-fg2)" }}>
              Started at {new Date(instance.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          {/* Accrued Cost Ticker */}
          <div style={{ background: "var(--ix-card)", padding: "20px", borderRadius: 0, border: "0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ix-ok)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono, monospace)" }}>
              <Activity size={15} /> Current Accrued Cost
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: "var(--ix-ok)", margin: "8px 0 2px" }}>
              ${currentCost.toFixed(4)}
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--ix-fg2)" }}>
              {instance.hourly_price == null ? "Price shown once your machine is ready" : <>Rate: {money(instance.hourly_price)}/hr ({money(instance.base_price)} compute + {money(instance.storage_price)} disk)</>}
            </span>
          </div>

          {/* GPU Telemetry */}
          <div style={{ background: "var(--ix-card)", padding: "20px", borderRadius: 0, border: "0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ix-fg2)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono, monospace)" }}>
              <Gauge size={15} /> GPU
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--ix-fg)", margin: "10px 0 4px" }}>
              {instance.gpu}{instance.vram ? ` · ${instance.vram}` : ""}
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--ix-fg2)" }}>
              {instance.telemetry
                ? `Utilisation ${instance.telemetry.gpu_utilization_pct}% · VRAM ${instance.telemetry.vram_used_gb} GB used`
                : "Live GPU usage isn't reported yet. Run nvidia-smi in the terminal to check."}
            </span>
          </div>

          {/* Host Node Specs */}
          <div style={{ background: "var(--ix-card)", padding: "20px", borderRadius: 0, border: "0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ix-fg2)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono, monospace)" }}>
              <Server size={15} /> Machine connection
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: instance.status === "terminated" ? "var(--ix-fg2)" : instance.tunnel_connected ? "var(--ok)" : "var(--danger)", margin: "10px 0 4px" }}>
              {instance.status === "terminated" ? "Ended" : instance.tunnel_connected ? "Connected" : "Machine offline"}
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--ix-fg2)" }}>
              Disk: {instance.disk_size_gb} GB
            </span>
          </div>
        </div>

        {/* Quick Connection Bar */}
        <div
          style={{
            background: "#181a1b",
            color: "#f3f4f6",
            borderRadius: 0,
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
            <div style={{ fontSize: "0.72rem", color: "var(--on-ink-subtle)", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "var(--font-mono, monospace)", marginBottom: "4px" }}>
              How to connect
            </div>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--on-ink-muted)", maxWidth: 520 }}>
              {instance.status === "terminated"
                ? "This instance has ended and its files were deleted, so there's nothing to connect to."
                : <>Use the browser terminal below to run Python and PyTorch commands in your container. SSH isn't available yet, and JupyterLab has a <a href="/waitlist" style={{ color: "inherit", textDecoration: "underline" }}>waitlist</a>.</>}
            </p>
          </div>

          {instance.status !== "terminated" && <div>
            <button
              type="button"
              onClick={() => setActiveTab("terminal")}
              className="primary-button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "var(--lime, #c8f04c)",
                color: "#0a0a0b",
                padding: "10px 20px",
                fontSize: "0.85rem",
                fontWeight: 800,
                border: "none",
              }}
            >
              <ExternalLink size={15} /> Open browser terminal
            </button>
          </div>}
        </div>

        {/* Security, Isolation & Ephemeral Wipe Shield */}
        <div
          style={{
            background: "var(--ix-ok-bg)",
            border: "0",
            borderRadius: 0,
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
            <ShieldCheck size={20} color="var(--ok)" />
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ix-ok)" }}>
                Isolated container
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--ix-ok)", marginTop: "2px" }}>
                Your job runs in a container without access to the provider's files. When you stop the instance, the container and its files are deleted. <a href="/security" style={{ color: "inherit", textDecoration: "underline" }}>How isolation works</a>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.76rem", color: "var(--ix-ok)", fontFamily: "var(--font-mono, monospace)" }}>
            <span style={{ background: "var(--ix-ok-bg)", padding: "4px 8px", borderRadius: 0, border: "0", fontWeight: 600 }}>
              {instance.status === "terminated" ? "MACHINE: RELEASED" : instance.tunnel_connected ? "MACHINE: ONLINE" : "MACHINE: OFFLINE"}
            </span>
            {instance.host_meta?.docker_available && (
              <span style={{ background: "var(--ix-ok-bg)", padding: "4px 8px", borderRadius: 0, border: "0", fontWeight: 600 }}>
                DOCKER: {instance.host_meta?.docker_gpu_support ? "GPU_PASSTHROUGH" : "ISOLATED"}
              </span>
            )}
          </div>
        </div>

        {/* Tabbed Interactive Console Area */}
        <div style={{ background: "var(--ix-card)", borderRadius: 0, border: "0", overflow: "hidden" }}>
          {/* Tab Selector */}
          <div style={{ display: "flex", borderBottom: "2px solid var(--ix-bk)", background: "var(--ix-card2)" }}>
            <button
              type="button"
              onClick={() => setActiveTab("terminal")}
              style={{
                padding: "14px 22px",
                border: "none",
                background: activeTab === "terminal" ? "var(--lime)" : "transparent",
                color: activeTab === "terminal" ? "#0a0a0b" : "var(--ix-fg)",
                borderBottom: "none",
                fontWeight: activeTab === "terminal" ? 700 : 500,
                fontSize: "0.88rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Terminal size={16} /> Browser terminal & logs
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("workspace")}
              style={{
                padding: "14px 22px",
                border: "none",
                background: activeTab === "workspace" ? "var(--lime)" : "transparent",
                color: activeTab === "workspace" ? "#0a0a0b" : "var(--ix-fg)",
                borderBottom: "none",
                fontWeight: activeTab === "workspace" ? 700 : 500,
                fontSize: "0.88rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Code2 size={16} /> Python workspace
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("specs")}
              style={{
                padding: "14px 22px",
                border: "none",
                background: activeTab === "specs" ? "var(--lime)" : "transparent",
                color: activeTab === "specs" ? "#0a0a0b" : "var(--ix-fg)",
                borderBottom: "none",
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
            <div className="ix-code" style={{ background: "#0c0e12", color: "#e2e8f0", padding: "20px", fontFamily: "ui-monospace, Consolas, 'Courier New', monospace", fontSize: "0.82rem", lineHeight: 1.6, minHeight: "440px" }}>
              {/* Header Bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e2430", paddingBottom: "10px", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ix-fg2)", fontSize: "0.78rem" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: instance.status === "running" ? "var(--ok)" : "#a56b1a", display: "inline-block" }} />
                  <span>Browser terminal · <b>{instance.id}</b> ({instance.gpu})</span>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setTerminalLines([])}
                    style={{ background: "#1a1f2c", color: "var(--ix-fg2)", border: "1px solid #2d3748", borderRadius: 0, padding: "4px 8px", fontSize: "0.72rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    title="Clear terminal output"
                  >
                    <Trash2 size={12} /> Clear
                  </button>
                </div>
              </div>

              {/* Startup Logs Stream */}
              {Array.isArray(instance.logs) && instance.logs.length > 0 && (
                <div style={{ marginBottom: "14px", borderLeft: "2px solid #334155", paddingLeft: "10px" }}>
                  {instance.logs.slice(-10).map((log, idx) => (
                    <div key={idx} style={{ marginBottom: "2px", fontSize: "0.78rem" }}>
                      <span style={{ color: "var(--ix-fg2)" }}>{log.split("]")[0]}]</span>
                      <span style={{ color: log.includes("healthy") || log.includes("registered") ? "var(--ok)" : "var(--ix-fg)" }}>
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
                      <div style={{ color: "var(--lime)", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>$</span>
                        <span style={{ color: "#ffffff" }}>{line.text}</span>
                        {line.time && <span style={{ color: "#4a4a45", fontSize: "0.72rem", marginLeft: "auto" }}>{line.time}</span>}
                      </div>
                    )}
                    {line.type === "output" && (
                      <div style={{ marginTop: "4px" }}>
                        {line.stdout && (
                          <pre style={{ margin: 0, color: "var(--ix-ok)", whiteSpace: "pre", overflowX: "auto", fontFamily: "inherit", fontSize: "0.80rem" }}>
                            {line.stdout}
                          </pre>
                        )}
                        {line.stderr && (
                          <pre style={{ margin: 0, color: "var(--danger)", whiteSpace: "pre", overflowX: "auto", fontFamily: "inherit", fontSize: "0.80rem" }}>
                            {line.stderr}
                          </pre>
                        )}
                        {line.duration !== undefined && (
                          <div style={{ fontSize: "0.7rem", color: "var(--ix-fg2)", marginTop: "3px" }}>
                            Process finished with exit code {line.exitCode} in {line.duration}s
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {termExecuting && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--lime)", marginTop: "6px" }}>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Executing on node container...</span>
                  </div>
                )}
                <div ref={terminalEndRef} />
              </div>

              {/* Quick Command Chips */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "10px", borderTop: "1px solid #1e2430", paddingTop: "12px" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--ix-fg2)", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: "4px" }}>Quick:</span>
                {[
                  "nvidia-smi",
                  "python -c \"import sys; print(f'Python {sys.version.split()[0]}')\"",
                  "pip list",
                  "df -h",
                  "uname -a"
                ].map((chipCmd) => (
                  <button
                    key={chipCmd}
                    type="button"
                    disabled={termExecuting || instance.status !== "running"}
                    onClick={() => handleRunCommand(chipCmd)}
                    style={{
                      background: "#18202f",
                      border: "1px solid #283548",
                      borderRadius: 0,
                      color: "#93c5fd",
                      padding: "4px 8px",
                      fontSize: "0.74rem",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {chipCmd.split(" ")[0] === "python" ? "python version" : chipCmd}
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
                  borderRadius: 0,
                  border: "1px solid #283346",
                }}
              >
                <span style={{ color: "var(--lime)", fontWeight: 700, whiteSpace: "nowrap", fontSize: "0.82rem" }}>
                  $
                </span>
                <input
                  type="text"
                  value={termInput}
                  onChange={(e) => setTermInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={instance.status === "running" ? "Type command (e.g. nvidia-smi, df -h, python -c '...') or press Enter" : "This instance has ended"}
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
                    color: termExecuting || !termInput.trim() || instance.status !== "running" ? "var(--muted)" : "#101112",
                    border: "none",
                    borderRadius: 0,
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
            <div
              style={
                isWorkspaceExpanded
                  ? {
                      position: "fixed",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 9999,
                      background: "var(--ix-card)",
                      overflowY: "auto",
                      padding: "0",
                    }
                  : { background: "var(--ix-card)", padding: "0" }
              }
            >
              {/* Workspace Top Toolbar */}
              <div style={{ background: "var(--ix-card2)", borderBottom: "2px solid var(--ix-bk)", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", fontWeight: 700, color: "var(--ix-fg)" }}>
                    <Sparkles size={16} color="var(--ok)" />
                    <span>Python workspace</span>
                  </div>
                  <span style={{ fontSize: "0.74rem", background: "var(--ix-ok-bg)", color: "var(--ix-ok)", padding: "2px 8px", borderRadius: "100px", fontWeight: 600, border: "1px solid #a7f3d0" }}>
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
                    style={{ background: "var(--ix-card)", border: "0", padding: "5px 12px", borderRadius: 0, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
                  >
                    Sync State
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsWorkspaceExpanded((prev) => !prev);
                      toast.info(!isWorkspaceExpanded ? "Full-screen GPU workspace enabled" : "Restored to standard view");
                    }}
                    style={{
                      background: isWorkspaceExpanded ? "var(--ok)" : "#ffffff",
                      color: isWorkspaceExpanded ? "#ffffff" : "var(--ink, #101112)",
                      border: "1px solid " + (isWorkspaceExpanded ? "var(--ok)" : "#d1d5db"),
                      padding: "5px 12px",
                      borderRadius: 0,
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                    title={isWorkspaceExpanded ? "Collapse to standard page view" : "Maximize workspace to full screen"}
                  >
                    {isWorkspaceExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                    {isWorkspaceExpanded ? "Exit Fullscreen" : "Fullscreen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(window.location.pathname, "_blank", "width=1280,height=850")}
                    style={{ background: "var(--ink, #101112)", color: "#ffffff", border: "none", padding: "5px 14px", borderRadius: 0, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px" }}
                    title="Open live workspace in a dedicated detached browser window"
                  >
                    Pop Out <ExternalLink size={12} />
                  </button>
                </div>
              </div>

              {/* Workspace Content */}
              <div style={{ padding: "24px" }}>
                {/* Preset Selector */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ix-fg2)", marginBottom: "8px" }}>
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
                          borderRadius: 0,
                          fontSize: "0.82rem",
                          fontWeight: selectedPreset === preset.id ? 700 : 500,
                          background: selectedPreset === preset.id ? "var(--lime)" : "#26282b",
                          color: selectedPreset === preset.id ? "#0a0a0b" : "var(--ix-fg)",
                          border: "0",
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
                <div style={{ border: "1px solid #1a1b1d", borderRadius: 0, overflow: "hidden", background: "var(--ink)", marginBottom: "20px" }}>
                  <div style={{ background: "#1a1b1d", padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--ix-fg2)", fontSize: "0.78rem", fontFamily: "var(--font-mono, monospace)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--danger)", display: "inline-block" }} />
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#a56b1a", display: "inline-block" }} />
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--ok)", display: "inline-block" }} />
                      <span style={{ marginLeft: "6px", color: "#cbd5e1", fontWeight: 600 }}>run.py</span>
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
                      fontFamily: "ui-monospace, Consolas, 'Courier New', monospace",
                      fontSize: "0.85rem",
                      lineHeight: 1.5,
                      boxSizing: "border-box",
                    }}
                  />

                  {/* Editor Actions Footer */}
                  <div style={{ background: "#1a1b1d", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ fontSize: "0.76rem", color: "var(--ix-fg2)" }}>
                      Runs in your container on <b>{instance.gpu}</b>. Code uses the GPU only if it asks for it.
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={handleRunPythonCode}
                        disabled={codeExecuting || !pythonCode.trim() || instance.status !== "running"}
                        style={{
                          background: codeExecuting || !pythonCode.trim() || instance.status !== "running" ? "#4a4a45" : "var(--lime, #c8f04c)",
                          color: codeExecuting || !pythonCode.trim() || instance.status !== "running" ? "var(--muted)" : "#101112",
                          border: "none",
                          padding: "8px 18px",
                          borderRadius: 0,
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
                        {codeExecuting ? "Running..." : "Run code"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Output Console Box */}
                <div style={{ border: "0", borderRadius: 0, overflow: "hidden", background: "#0a0d12" }}>
                  <div style={{ background: "#161b22", padding: "10px 16px", borderBottom: "1px solid #21262d", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Terminal size={14} color="var(--ix-ok)" />
                      <span style={{ fontSize: "0.80rem", fontWeight: 700, color: "#f0f6fc", fontFamily: "var(--font-mono, monospace)" }}>
                        Output
                      </span>
                    </div>

                    {codeOutput && codeOutput.status !== "running" && (
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "0.72rem", color: codeOutput.exitCode === 0 ? "var(--ok)" : "var(--danger)", fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>
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
                          {copiedField === "console" ? <Check size={12} color="var(--ok)" /> : <Copy size={12} />} Copy
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

                  <div className="ix-code" style={{ padding: "16px", minHeight: "140px", maxHeight: "280px", overflowY: "auto", fontFamily: "ui-monospace, Consolas, 'Courier New', monospace", fontSize: "0.82rem", lineHeight: 1.5 }}>
                    {codeOutput?.status === "running" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--lime)", padding: "20px 0" }}>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Running your code...</span>
                      </div>
                    ) : codeOutput ? (
                      <>
                        {codeOutput.stdout && (
                          <pre style={{ margin: 0, color: "var(--ix-ok)", whiteSpace: "pre", overflowX: "auto", fontFamily: "inherit" }}>
                            {codeOutput.stdout}
                          </pre>
                        )}
                        {codeOutput.stderr && (
                          <pre style={{ margin: 0, color: "var(--danger)", whiteSpace: "pre", overflowX: "auto", fontFamily: "inherit" }}>
                            {codeOutput.stderr}
                          </pre>
                        )}
                        {!codeOutput.stdout && !codeOutput.stderr && (
                          <div style={{ color: "var(--ix-fg2)", fontStyle: "italic" }}>
                            Execution completed with empty output.
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ color: "var(--ix-fg2)", fontStyle: "italic", padding: "20px 0", textAlign: "center" }}>
                        Click "Run code" or press Shift + Enter to run this workload on {instance.gpu}.
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
                <div style={{ padding: "16px", borderRadius: 0, background: "var(--ix-card2)", border: "0" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--ix-fg2)", textTransform: "uppercase" }}>GPU Acceleration</span>
                  <div style={{ fontSize: "1rem", fontWeight: 700, margin: "4px 0" }}>{instance.gpu} ({instance.vram})</div>
                  <span style={{ fontSize: "0.78rem", color: "var(--ix-fg2)" }}>PCIe 4.0 x16 · 16,384 CUDA Cores</span>
                </div>

                <div style={{ padding: "16px", borderRadius: 0, background: "var(--ix-card2)", border: "0" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--ix-fg2)", textTransform: "uppercase" }}>Host CPU</span>
                  <div style={{ fontSize: "1rem", fontWeight: 700, margin: "4px 0" }}>{instance.specs?.cpu || "AMD Ryzen 9 7950X / EPYC"}</div>
                  <span style={{ fontSize: "0.78rem", color: "var(--ix-fg2)" }}>Dedicated compute threads</span>
                </div>

                <div style={{ padding: "16px", borderRadius: 0, background: "var(--ix-card2)", border: "0" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--ix-fg2)", textTransform: "uppercase" }}>System RAM</span>
                  <div style={{ fontSize: "1rem", fontWeight: 700, margin: "4px 0" }}>{instance.specs?.ram || "128 GB DDR5 ECC"}</div>
                  <span style={{ fontSize: "0.78rem", color: "var(--ix-fg2)" }}>High-speed memory bandwidth</span>
                </div>

                <div style={{ padding: "16px", borderRadius: 0, background: "var(--ix-card2)", border: "0" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--ix-fg2)", textTransform: "uppercase" }}>Internet Uplink</span>
                  <div style={{ fontSize: "1rem", fontWeight: 700, margin: "4px 0" }}>{instance.specs?.bandwidth || "1 Gbps Symmetrical"}</div>
                  <span style={{ fontSize: "0.78rem", color: "var(--ix-fg2)" }}>Data center fiber low-latency pipe</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
