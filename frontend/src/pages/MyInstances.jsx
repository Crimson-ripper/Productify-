import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Zap,
  Cpu,
  Play,
  Square,
  RotateCcw,
  ArrowRight,
  Plus
} from "lucide-react";
import { api, money } from "@/lib/api";
import SEO from "@/components/SEO";
import { toast } from "sonner";

export default function MyInstances() {
  const navigate = useNavigate();
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // "all" | "running" | "paused" | "terminated"

  const fetchInstances = async () => {
    try {
      const res = await api.get("/instances");
      setInstances(res.data);
    } catch (err) {
      toast.error("Failed to load instances");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
    const timer = setInterval(() => {
      fetchInstances();
    }, 12000);
    return () => clearInterval(timer);
  }, []);

  const handleAction = async (e, instId, action) => {
    e.preventDefault();
    e.stopPropagation();
    if (action === "terminate") {
      const ok = window.confirm("Are you sure you want to terminate this instance? Billing will stop.");
      if (!ok) return;
    }

    try {
      await api.post(`/instances/${instId}/action`, { action });
      toast.success(`Instance ${action}d`);
      fetchInstances();
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to ${action} instance`);
    }
  };

  const formatRuntime = (totalSec) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const filteredInstances = instances.filter((inst) => {
    if (filter === "all") return true;
    return inst.status === filter;
  });

  return (
    <>
      <SEO
        title="My Cloud GPU Instances · Productify"
        description="Manage on-demand cloud GPU instances, containers, JupyterLab, and ComfyUI sessions."
        path="/instances"
      />

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 6% 90px" }}>
        {/* Header Hero */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "20px", marginBottom: "32px" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", fontFamily: "var(--font-mono, monospace)", color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "6px" }}>
              <Zap size={14} /> CLOUD COMPUTE FLEET
            </div>
            <h1 style={{ margin: "2px 0 6px", fontSize: "clamp(2rem, 3.5vw, 2.8rem)", fontWeight: 800, fontFamily: "var(--font-heading, sans-serif)", letterSpacing: "-0.04em" }}>
              Cloud GPU Instances
            </h1>
            <p style={{ margin: 0, color: "var(--muted, #666)", fontSize: "0.92rem", maxWidth: "600px" }}>
              Vast.ai-grade peer-to-peer compute instances. Launch containerized JupyterLab, ComfyUI, or Ollama with per-second metering.
            </p>
          </div>

          <Link
            to="/rentals"
            className="primary-button"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 22px", fontSize: "0.9rem", fontWeight: 700 }}
          >
            <Plus size={16} /> Deploy New GPU Node
          </Link>
        </div>

        {/* Filter Toolbar */}
        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--line, #e2e2dc)", paddingBottom: "14px", marginBottom: "24px" }}>
          {[
            { id: "all", label: `All (${instances.length})` },
            { id: "running", label: `Running (${instances.filter((i) => i.status === "running").length})` },
            { id: "paused", label: `Paused (${instances.filter((i) => i.status === "paused").length})` },
            { id: "terminated", label: `Terminated (${instances.filter((i) => i.status === "terminated").length})` },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              style={{
                background: filter === item.id ? "var(--ink, #101112)" : "transparent",
                color: filter === item.id ? "#ffffff" : "var(--muted, #666)",
                border: "none",
                borderRadius: "100px",
                padding: "6px 14px",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Instance List */}
        {loading ? (
          <div className="loading-screen">
            <span />
            <p>Loading your cloud instances...</p>
          </div>
        ) : filteredInstances.length === 0 ? (
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              border: "1px dashed var(--line, #dedfd9)",
              padding: "64px 20px",
              textAlign: "center",
            }}
          >
            <Cpu size={40} color="var(--muted, #999)" style={{ marginBottom: "12px" }} />
            <h3 style={{ margin: "0 0 6px", fontSize: "1.2rem" }}>No instances found</h3>
            <p style={{ color: "var(--muted, #666)", fontSize: "0.88rem", maxWidth: "420px", margin: "0 auto 20px" }}>
              {filter === "all"
                ? "You haven't deployed any GPU instances yet. Choose from RTX 4090, A100, and more with instant setup."
                : `No instances currently in "${filter}" status.`}
            </p>
            <Link to="/rentals" className="primary-button" style={{ display: "inline-flex" }}>
              Browse Available GPUs <ArrowRight size={15} style={{ marginLeft: "6px" }} />
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "16px" }}>
            {filteredInstances.map((inst) => {
              const statusColor = inst.status === "running" ? "#16a34a" : inst.status === "paused" ? "#d97706" : "#6b7280";
              return (
                <div
                  key={inst.id}
                  onClick={() => navigate(`/instances/${inst.id}`)}
                  style={{
                    background: "#ffffff",
                    borderRadius: "14px",
                    border: "1px solid var(--line, #e2e2dc)",
                    padding: "20px 24px",
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr 1fr auto",
                    alignItems: "center",
                    gap: "20px",
                    cursor: "pointer",
                    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--ink, #101112)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--line, #e2e2dc)")}
                >
                  {/* Left: Template & Node details */}
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "10px",
                        background: "#f3f4f0",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "1.3rem",
                      }}
                    >
                      {inst.template_id === "jupyter-pytorch" ? "⚡" : inst.template_id === "comfyui-sdxl" ? "🎨" : inst.template_id === "ollama-llm" ? "🦙" : "💻"}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                          {inst.template_name}
                        </h4>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "2px 8px",
                            borderRadius: "100px",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            fontFamily: "var(--font-mono, monospace)",
                            background: inst.status === "running" ? "#eefbf2" : inst.status === "paused" ? "#fef8e7" : "#f3f4f6",
                            color: statusColor,
                          }}
                        >
                          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: statusColor }} />
                          {inst.status.toUpperCase()}
                        </span>
                      </div>
                      <p style={{ margin: "3px 0 0", fontSize: "0.8rem", color: "var(--muted, #666)" }}>
                        {inst.rental_title} · <b>{inst.gpu}</b> ({inst.vram}) · {inst.location}
                      </p>
                    </div>
                  </div>

                  {/* Middle: Runtime & Metered Cost */}
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted, #777)", textTransform: "uppercase", fontFamily: "var(--font-mono, monospace)" }}>
                      Runtime & Cost
                    </div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink, #101112)", marginTop: "2px" }}>
                      {formatRuntime(inst.live_runtime_seconds || 0)} · <span style={{ color: "#16a34a" }}>${(inst.live_cost || 0).toFixed(4)}</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#888" }}>
                      {money(inst.hourly_price)}/hr · {inst.disk_size_gb}GB NVMe
                    </div>
                  </div>

                  {/* Port & IP */}
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted, #777)", textTransform: "uppercase", fontFamily: "var(--font-mono, monospace)" }}>
                      Connection
                    </div>
                    <div style={{ fontSize: "0.82rem", fontFamily: "var(--font-mono, monospace)", marginTop: "2px" }}>
                      {inst.host_ip}:{inst.ssh_port}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#666" }}>
                      Port {inst.web_port} ({inst.service_name})
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {inst.status === "running" && (
                      <button
                        type="button"
                        onClick={(e) => handleAction(e, inst.id, "pause")}
                        title="Pause compute"
                        style={{ background: "#f4f4f0", border: "1px solid var(--line, #e2e2dc)", borderRadius: "8px", padding: "8px", cursor: "pointer", display: "grid", placeItems: "center" }}
                      >
                        <Square size={14} fill="currentColor" />
                      </button>
                    )}
                    {inst.status === "paused" && (
                      <button
                        type="button"
                        onClick={(e) => handleAction(e, inst.id, "resume")}
                        title="Resume compute"
                        style={{ background: "#f4f4f0", border: "1px solid var(--line, #e2e2dc)", borderRadius: "8px", padding: "8px", cursor: "pointer", display: "grid", placeItems: "center" }}
                      >
                        <Play size={14} fill="currentColor" />
                      </button>
                    )}
                    {inst.status !== "terminated" && (
                      <button
                        type="button"
                        onClick={(e) => handleAction(e, inst.id, "terminate")}
                        title="Terminate container"
                        style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: "8px", padding: "8px", cursor: "pointer", display: "grid", placeItems: "center" }}
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="primary-button"
                      style={{ padding: "8px 16px", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      Console <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
