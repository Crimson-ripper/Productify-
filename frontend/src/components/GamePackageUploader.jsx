import { useState, useRef } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, FileArchive, X } from "lucide-react";
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

      toast.success(`${file.name} uploaded`);
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
    <div className="pkg-uploader">
      <input ref={fileInputRef} type="file" accept=".zip,.7z,.tar,.gz,.tgz,.iso,.rar" onChange={handleFileChange} hidden />

      {!uploading && !uploadedUrl && (
        <button type="button" className="pkg-drop" onClick={handleSelectFile}>
          <UploadCloud size={22} />
          <b>{label}</b>
          <small>Large files are fine — it uploads straight to storage.</small>
        </button>
      )}

      {uploading && (
        <div className="pkg-progress">
          <div className="pkg-file">
            <FileArchive size={16} />
            <b>{fileInfo?.name}</b>
            <small>{fileInfo?.formattedSize}</small>
            <button type="button" className="text-button text-button-dark danger" onClick={handleCancelUpload}><X size={13} /> Cancel</button>
          </div>
          <div className="pkg-bar"><span style={{ width: `${progress}%` }} /></div>
          <div className="pkg-meta"><span>Uploading… {progress}%</span><span>{uploadSpeed}</span></div>
        </div>
      )}

      {uploadedUrl && !uploading && (
        <div className="pkg-done">
          <CheckCircle2 size={16} />
          <span>Uploaded{fileInfo?.name ? `: ${fileInfo.name}` : ""}</span>
          <button type="button" className="text-button text-button-dark" onClick={handleSelectFile}>Replace</button>
        </div>
      )}

      {error && <div className="pkg-error"><AlertCircle size={14} /> {error}</div>}
    </div>
  );
}