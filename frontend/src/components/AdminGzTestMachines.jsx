import { useCallback, useEffect, useState } from "react";
import { api, getErrorMessage } from "@/lib/api";
import { Panel } from "@/components/DashboardShell";
import { toast } from "sonner";

// Gamezone test machines (2026-11-27): give a VM we already run (e.g. an E2E Networks test VM made
// from the Gamezone image) a PG Connect session code, so a tester joins with the code alone.
// Not billed; ending a code disconnects the tester but leaves the VM running.
export default function AdminGzTestMachines() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ host: "", gpu: "", location: "", launcher: "steam" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows((await api.get("/admin/gamezone/test-sessions")).data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't load test codes"));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post("/admin/gamezone/test-sessions", { ...form, host: form.host.trim() });
      toast.success(`Session code ${res.data.join_code} is ready`);
      setForm((f) => ({ ...f, host: "" }));
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't create the code"));
    } finally {
      setBusy(false);
    }
  };

  const end = async (row) => {
    if (!window.confirm(`End code ${row.join_code}? Whoever is playing is disconnected. The machine keeps running.`)) return;
    try {
      await api.post(`/admin/gamezone/test-sessions/${row.id}/end`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't end it"));
    }
  };

  const copy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied");
    } catch {
      toast.error("Couldn't copy; select the code instead");
    }
  };

  return (
    <Panel title="Gamezone test machines">
      <p className="dash-note">Give a test VM a PG Connect session code. The tester installs PG Connect, enters the code and plays: no WireGuard or other setup. The VM must use the Gamezone image and accept the backend's Gamezone SSH key. Not billed; ending a code doesn't stop the VM.</p>
      <form className="dash-form" onSubmit={create}>
        <div className="three-col">
          <label>Public IP address<input required value={form.host} onChange={set("host")} placeholder="216.48.177.6" maxLength={15} inputMode="decimal" /></label>
          <label>GPU<input value={form.gpu} onChange={set("gpu")} placeholder="Tesla T4" maxLength={40} /></label>
          <label>Location<input value={form.location} onChange={set("location")} placeholder="Delhi, IN" maxLength={60} /></label>
          <label>Launcher
            <select value={form.launcher} onChange={set("launcher")}>
              <option value="steam">Steam</option>
              <option value="epic">Epic Games</option>
            </select>
          </label>
          <div className="dash-form-actions" style={{ alignSelf: "end" }}><button className="primary-button" disabled={busy}>{busy ? "Checking the machine…" : "Create session code"}</button></div>
        </div>
      </form>
      {rows.length === 0 ? <p className="dash-note">No active test codes.</p> : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead><tr><th>Code</th><th>Machine</th><th>Created</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><strong style={{ fontFamily: "monospace", letterSpacing: 1 }}>{r.join_code}</strong>{" "}<button className="link-button" onClick={() => copy(r.join_code)}>Copy</button></td>
                  <td>{[r.gpu, r.location, r.vm_host].filter(Boolean).join(" · ")}</td>
                  <td>{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</td>
                  <td><button className="link-button" onClick={() => end(r)}>End code</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
