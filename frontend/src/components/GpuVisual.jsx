// A typographic spec card for a GPU machine, used instead of photos so listings
// never rely on stock or generated imagery. Shows only what the machine reported.
export default function GpuVisual({ rental, large = false }) {
  const gpu = rental.gpu || "GPU";
  const vendor = /nvidia|geforce|rtx|gtx|tesla|quadro|a100|h100/i.test(gpu) ? "NVIDIA" : "";
  const model = gpu.replace(/^NVIDIA\s+/i, "").replace(/^GeForce\s+/i, "");
  return (
    <div className={large ? "gpu-visual large" : "gpu-visual"} role="img" aria-label={`${gpu}${rental.vram ? `, ${rental.vram}` : ""}`}>
      {vendor && <span className="gpu-visual-vendor">{vendor}</span>}
      <span className="gpu-visual-model">{model}</span>
      <span className="gpu-visual-specs">
        {[rental.vram && `${rental.vram} VRAM`, rental.specs?.ram && `${rental.specs.ram} RAM`].filter(Boolean).join(" · ")}
      </span>
    </div>
  );
}
