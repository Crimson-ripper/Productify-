import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { UploadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ImageUpload({ value, onChange, label = "Upload image", testid = "image-upload" }) {
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const pick = () => ref.current?.click();
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const publicUrl = `${process.env.REACT_APP_BACKEND_URL}${data.url}`;
      onChange(publicUrl, data);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <div className="uploader" data-testid={testid}>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onFile} hidden data-testid={`${testid}-input`} />
      {value ? (
        <div className="uploader-preview">
          <img src={value} alt="" />
          <button type="button" onClick={pick} disabled={busy} data-testid={`${testid}-replace-button`}>{busy ? <Loader2 className="spin" size={14} /> : "Replace"}</button>
        </div>
      ) : (
        <button type="button" onClick={pick} disabled={busy} className="uploader-empty" data-testid={`${testid}-select-button`}>
          {busy ? <Loader2 className="spin" size={18} /> : <UploadCloud size={18} />}
          <span>{busy ? "Uploading…" : label}</span>
          <small>JPG, PNG, WEBP · up to 10 MB</small>
        </button>
      )}
    </div>
  );
}
