import { useState } from "react";
import { Trash2 } from "lucide-react";
import { api, money, getErrorMessage } from "@/lib/api";
import { Panel } from "@/components/DashboardShell";
import { toast } from "sonner";

// Lets the main admin review and delete demo/test listings. Nothing is deleted
// until the admin ticks items and confirms.
export default function AdminCleanup({ onDone }) {
  const [preview, setPreview] = useState(null);
  const [picked, setPicked] = useState({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const { data } = await api.get("/admin/cleanup/demo");
      setPreview(data);
      const all = {};
      [...data.products, ...data.rentals].forEach((x) => { all[x.id] = true; });
      setPicked(all);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't load the preview"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const product_ids = preview.products.filter((p) => picked[p.id]).map((p) => p.id);
    const rental_ids = preview.rentals.filter((r) => picked[r.id]).map((r) => r.id);
    const n = product_ids.length + rental_ids.length;
    if (!n) return toast.info("Nothing selected");
    if (!window.confirm(`Permanently delete ${n} listing${n === 1 ? "" : "s"}? This can't be undone.`)) return;
    setBusy(true);
    try {
      const { data } = await api.post("/admin/cleanup/demo", { product_ids, rental_ids });
      toast.success(`Deleted ${data.deleted.products} product${data.deleted.products === 1 ? "" : "s"} and ${data.deleted.rentals} GPU listing${data.deleted.rentals === 1 ? "" : "s"}`);
      setPreview(null);
      onDone?.();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't delete"));
    } finally {
      setBusy(false);
    }
  };

  const row = (x, kind) => (
    <tr key={x.id}>
      <td><input type="checkbox" checked={!!picked[x.id]} onChange={(e) => setPicked({ ...picked, [x.id]: e.target.checked })} aria-label={`Select ${x.title}`} /></td>
      <td><div className="cell-title"><div><b>{x.title}</b><small>{kind === "rental" ? `GPU · ${x.gpu || "not paired"}` : `Product · ${money(x.price)}`} · {x.seller || "—"}</small></div></div></td>
      <td>{x.reason}</td>
    </tr>
  );

  const total = preview ? preview.products.length + preview.rentals.length : 0;
  const selected = Object.values(picked).filter(Boolean).length;

  return (
    <Panel
      title="Remove demo and test listings"
      flush
      actions={!preview
        ? <button className="secondary-button" onClick={load} disabled={busy}>{busy ? "Checking…" : "Find them"}</button>
        : <button className="secondary-button" onClick={() => setPreview(null)}>Cancel</button>}
    >
      {!preview ? (
        <p className="dash-empty">Finds the built-in demo items, listings created from admin accounts, and anything titled like a test. You review the list before anything is deleted.</p>
      ) : total === 0 ? (
        <p className="dash-empty">No demo or test listings found.</p>
      ) : (
        <>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead><tr><th /><th>Listing</th><th>Why it's listed here</th></tr></thead>
              <tbody>
                {preview.products.map((p) => row(p, "product"))}
                {preview.rentals.map((r) => row(r, "rental"))}
              </tbody>
            </table>
          </div>
          <div className="dash-form-actions" style={{ padding: "16px 22px" }}>
            <button className="primary-button" onClick={remove} disabled={busy || !selected} style={{ background: "#fdeaea", color: "#963f3f" }}>
              <Trash2 size={15} /> Delete {selected} selected
            </button>
            <span className="dash-hint" style={{ margin: 0 }}>Untick anything you want to keep.</span>
          </div>
        </>
      )}
    </Panel>
  );
}
