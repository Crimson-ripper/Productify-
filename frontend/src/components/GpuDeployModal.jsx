import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HardDrive, Zap, X, CheckCircle2, Loader2 } from "lucide-react";
import { api, money, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import TemplateIcon from "@/components/TemplateIcon";

import { DEFAULT_TEMPLATES } from "@/lib/templates";

export default function GpuDeployModal({ rental, isOpen, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState("jupyter-pytorch");
  const [diskSize, setDiskSize] = useState(50);
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
      });

      toast.success("Container started.");
      onClose();
      navigate(`/instances/${res.data.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to deploy GPU instance"));
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(720px, 96%)", padding: "28px", borderRadius: 0 }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", fontFamily: "var(--font-mono, monospace)", color: "var(--ok)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "4px" }}>
              <Zap size={14} /> Launch a container
            </div>
            <h2 style={{ margin: "2px 0 6px", fontSize: "1.45rem", fontFamily: "var(--font-heading, sans-serif)", letterSpacing: "-0.03em" }}>
              Start an instance
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.85rem", color: "var(--muted, #666)" }}>
              <span><b>{rental.gpu}</b> ({rental.vram})</span>
              <span>•</span>
              <span>{rental.location}</span>
              <span>•</span>
              <span>Provider: {rental.owner}</span>
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
                    borderRadius: 0,
                    border: active ? "2px solid var(--ink, #101112)" : "1px solid var(--line, #e2e2dc)",
                    background: active ? "#fafaf7" : "#ffffff",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    position: "relative",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    <TemplateIcon id={tpl.id} />
                    <span style={{ fontSize: "0.72rem", background: "#f1f3ed", color: "#4f5348", padding: "2px 7px", borderRadius: "100px", fontFamily: "var(--font-mono, monospace)" }}>
                      {tpl.service_name}
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
        <div style={{ marginBottom: "22px", background: "#f8f9f5", padding: "16px", borderRadius: 0, border: "1px solid #ebece4" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", fontWeight: 700 }}>
              <HardDrive size={16} /> Disk size
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
            <span>20 GB</span>
            <span>500 GB</span>
          </div>
        </div>

        <p style={{ margin: "0 0 22px", fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.5 }}>
          Closed beta: payments are in test mode. Billing starts when the container starts and stops when you stop it. The container and its files are deleted when you stop.
        </p>

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
              <span style={{ fontSize: "0.78rem", color: "var(--ok)", fontFamily: "var(--font-mono, monospace)", marginLeft: "4px" }}>
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
