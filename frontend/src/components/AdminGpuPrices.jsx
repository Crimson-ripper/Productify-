import { useCallback, useEffect, useState } from "react";
import { api, money, getErrorMessage } from "@/lib/api";
import { Panel } from "@/components/DashboardShell";
import { toast } from "sonner";

// Productify sets host machine prices (2026-11-15): one hourly price per GPU model. Approved and
// pending machines with that GPU follow it unless an admin set a price for that one machine.
export default function AdminGpuPrices() {
  const [rows, setRows] = useState([]);
  const [gpu, setGpu] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows((await api.get("/admin/gpu-prices")).data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't load GPU prices"));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.put("/admin/gpu-prices", { gpu, price: Number(price) });
      toast.success(`${res.data.key}: ${money(res.data.price)}/h · ${res.data.machines_updated} machine${res.data.machines_updated === 1 ? "" : "s"} updated`);
      setGpu(""); setPrice("");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save the price"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (key) => {
    if (!window.confirm(`Remove the table price for ${key}? Machines keep their current price.`)) return;
    try {
      await api.delete(`/admin/gpu-prices/${encodeURIComponent(key)}`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't remove it"));
    }
  };

  return (
    <Panel title="GPU prices">
      <p className="dash-note">Hosts don't set prices. Each GPU model has one hourly price here; machines with that GPU use it unless you set a price for a single machine at review. Hosts receive the price minus the platform fee.</p>
      <form className="dash-form" onSubmit={save}>
        <div className="three-col">
          <label>GPU model<input required value={gpu} onChange={(e) => setGpu(e.target.value)} placeholder="RTX 3060" maxLength={60} /></label>
          <label>Price per hour (USD)<input required type="number" min="0.01" max="100" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.30" /></label>
          <div className="dash-form-actions" style={{ alignSelf: "end" }}><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save price"}</button></div>
        </div>
      </form>
      {rows.length === 0 ? <p className="dash-note">No GPU prices yet. Add one before approving machines with that GPU.</p> : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead><tr><th>GPU</th><th>Price</th><th>Updated</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.gpu || r.key}</td>
                  <td>{money(r.price)}/h</td>
                  <td>{r.updated_at ? new Date(r.updated_at).toLocaleDateString() : "—"}</td>
                  <td><button className="link-button" onClick={() => remove(r.key)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
