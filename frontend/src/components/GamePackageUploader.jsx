import React, { useState, useRef } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, HardDrive, FileArchive, X } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { toast } from "sonner";

function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export default function GamePackageUploader({
  gameId = "game-new",
  value = "",
  onChange,
  onComplete,
  label = "Upload Game Archive to Cloudflare R2",
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileInfo, setFileInfo] = useState(null);
  const [uploadedUrl, setUploadedUrl] = useState(value);
  const [uploadSpeed, setUploadSpeed] = useState("");
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);
  const xhrRef = useRef(null);

  const handleSelectFile = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileInfo({
      name: file.name,
      size: file.size,
      formattedSize: formatBytes(file.size),
    });
    setError(null);
    setProgress(0);
    setUploading(true);

    let startTime = Date.now();
    let lastLoaded = 0;

    try {
      // Step 1: Request presigned S3 PUT URL for Cloudflare R2
      const presignRes = await api.post("/admin/games/presign-upload", {
        game_id: gameId || `game-${Date.now()}`,
        filename: file.name,
        content_type: file.type || "application/zip",
        file_size: file.size,
      });

      if (!presignRes.data?.upload_url) {
        throw new Error("Did not receive a presigned upload URL from server.");
      }

      const { upload_url, r2_key, public_url } = presignRes.data;

      // Step 2: Direct-to-R2 binary upload via XMLHttpRequest with progress tracking
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setProgress(percent);

            const elapsedSec = (Date.now() - startTime) / 1000;
            if (elapsedSec > 0.5) {
              const speedBytesPerSec = event.loaded / elapsedSec;
              setUploadSpeed(`${formatBytes(speedBytesPerSec)}/s`);
            }
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response);
          } else {
            reject(new Error(`Cloudflare R2 responded with HTTP status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during direct Cloudflare R2 upload."));
        xhr.onabort = () => reject(new Error("Upload cancelled by user."));

        xhr.open("PUT", upload_url, true);
        xhr.setRequestHeader("Content-Type", file.type || "application/zip");
        xhr.send(file);
      });

      // Step 3: Complete upload and register R2 object metadata
      const completeRes = await api.post("/admin/games/complete-upload", {
        game_id: gameId,
        r2_key,
        filename: file.name,
        size_bytes: file.size,
      });

      const finalUrl = public_url || completeRes.data?.game?.package_url;
      setUploadedUrl(finalUrl);

      if (onChange) onChange(finalUrl, { r2_key, filename: file.name, size_bytes: file.size });
      if (onComplete) onComplete({ r2_key, public_url: finalUrl, filename: file.name, size_bytes: file.size });

      toast.success(`Game package '${file.name}' stored in Cloudflare R2!`);
    } catch (err) {
      console.error("Direct R2 upload failed:", err);
      const errMsg = getErrorMessage(err, "Direct R2 upload failed.");
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setUploading(false);
      xhrRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
    setUploading(false);
    setProgress(0);
    setError("Upload cancelled.");
  };

  return (
    <div style={{ width: "100%", borderRadius: 12, background: "rgba(255, 255, 255, 0.03)", border: "1px dashed rgba(99, 102, 241, 0.35)", padding: 20 }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,.7z,.tar,.gz,.tgz,.iso,.rar"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {!uploading && !uploadedUrl && (
        <div
          onClick={handleSelectFile}
          style={{
            cursor: "pointer",
            textAlign: "center",
            padding: "24px 16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "rgba(99, 102, 241, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#818cf8",
            }}
          >
            <UploadCloud size={26} />
          </div>
          <div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#f3f4f6", marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
              Direct S3-Compatible Upload to Cloudflare R2 (Supports Multi-GB ZIP, 7Z, TAR archives)
            </div>
          </div>
          <button
            type="button"
            onClick={handleSelectFile}
            style={{
              marginTop: 6,
              background: "rgba(99, 102, 241, 0.25)",
              border: "1px solid rgba(99, 102, 241, 0.4)",
              color: "#c7d2fe",
              padding: "7px 16px",
              borderRadius: 8,
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Select Game File from Computer
          </button>
        </div>
      )}

      {uploading && (
        <div style={{ padding: "12px 6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <FileArchive size={20} color="#818cf8" />
              <div>
                <strong style={{ fontSize: "0.88rem", color: "#f3f4f6" }}>{fileInfo?.name}</strong>
                <span style={{ fontSize: "0.76rem", color: "#9ca3af", marginLeft: 8 }}>({fileInfo?.formattedSize})</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancelUpload}
              style={{
                background: "transparent",
                border: "none",
                color: "#ef4444",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: "0.78rem",
              }}
            >
              <X size={14} /> Cancel
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ width: "100%", height: 8, background: "rgba(255, 255, 255, 0.1)", borderRadius: 999, overflow: "hidden", marginBottom: 8 }}>
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "linear-gradient(90deg, #6366f1, #22c55e)",
                borderRadius: 999,
                transition: "width 0.2s ease",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", color: "#9ca3af" }}>
            <span>Streaming directly to Cloudflare R2... ({progress}%)</span>
            <span>{uploadSpeed}</span>
          </div>
        </div>
      )}

      {uploadedUrl && !uploading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle2 size={18} color="#22c55e" />
            <div>
              <div style={{ fontSize: "0.84rem", fontWeight: 600, color: "#86efac" }}>
                Cloudflare R2 Package Ready ({fileInfo?.name || "Game Archive"})
              </div>
              <div style={{ fontSize: "0.74rem", color: "#a7f3d0" }}>
                Stored with zero egress fees for instant streaming deployment
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSelectFile}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#f3f4f6",
              padding: "5px 12px",
              borderRadius: 6,
              fontSize: "0.76rem",
              cursor: "pointer",
            }}
          >
            Replace File
          </button>
        </div>
      )}

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fca5a5", fontSize: "0.78rem", marginTop: 10 }}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
