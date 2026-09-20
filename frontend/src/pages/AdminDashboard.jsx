import { useEffect, useState } from "react";
import { ShieldCheck, Flag, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import SEO from "@/components/SEO";
import { toast } from "sonner";

export default function AdminDashboard() {
  const [tab, setTab] = useState("rentals");
  const [rentals, setRentals] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/admin/pending").then((r) => setRentals(r.data)).catch(() => setRentals([])),
      api.get("/admin/reports?status=open").then((r) => setReports(r.data)).catch(() => setReports([])),
    ]).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const decideRental = async (id, decision) => {
    await api.post(`/admin/rentals/${id}/${decision}`);
    setRentals((rs) => rs.filter((x) => x.id !== id));
    toast.success(`Rental ${decision}`);
  };

  const resolveReport = async (id, decision) => {
    const notes = decision === "remove_listing" ? prompt("Optional note for the record (why remove?)") || "" : "";
    await api.post(`/admin/reports/${id}/resolve`, { decision, notes });
    setReports((rs) => rs.filter((r) => r.id !== id));
    toast.success(decision === "dismiss" ? "Report dismissed" : "Listing removed");
  };

  return (
    <>
      <SEO title="Admin console — Productify" path="/admin" />
      <section className="dashboard-page admin-wide">
        <div className="eyebrow"><span className="eyebrow-line" /> OPERATIONS CONSOLE</div>
        <h1>Trust & safety<em>.</em></h1>
        <p className="subtitle">Approve GPU listings, and review reported items manually.</p>

        <div className="dashboard-tabs">
          <button className={tab === "rentals" ? "selected" : ""} onClick={() => setTab("rentals")} data-testid="admin-tab-rentals"><ShieldCheck size={14} /> GPU review queue <b className="tab-count">{rentals.length}</b></button>
          <button className={tab === "reports" ? "selected" : ""} onClick={() => setTab("reports")} data-testid="admin-tab-reports"><Flag size={14} /> Abuse reports <b className="tab-count">{reports.length}</b></button>
        </div>

        {loading ? <div className="loading-block">Loading…</div> : tab === "rentals" ? (
          rentals.length === 0 ? (
            <div className="empty-state"><ShieldCheck size={30} /><p>All clear. No listings need review.</p></div>
          ) : (
            <div className="review-list" data-testid="admin-review-list">
              {rentals.map((x) => (
                <div key={x.id} className="review-item-lg">
                  <img src={x.image} alt="" />
                  <div>
                    <b>{x.title}</b>
                    <small>{x.gpu} · {x.vram} · {x.location} · {x.owner}</small>
                    <p>{x.description}</p>
                  </div>
                  <div className="actions">
                    <button className="approve-button" onClick={() => decideRental(x.id, "approved")} data-testid={`approve-rental-${x.id}-button`}>Approve</button>
                    <button className="reject-button" onClick={() => decideRental(x.id, "rejected")} data-testid={`reject-rental-${x.id}-button`}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          reports.length === 0 ? (
            <div className="empty-state"><Flag size={30} /><p>No open reports.</p></div>
          ) : (
            <div className="review-list" data-testid="admin-reports-list">
              {reports.map((r) => (
                <div key={r.id} className="review-item-lg report-row">
                  <div className="report-badge">
                    <Flag size={18} />
                    <small>{r.reason.toUpperCase()}</small>
                  </div>
                  <div>
                    <b>{r.listing_title || r.listing_id}</b>
                    <small>{r.listing_kind} · reported by {r.reporter_email || r.reporter_id || "anonymous"} · {new Date(r.created_at).toLocaleString()}</small>
                    <p>{r.details || <i>No additional details provided.</i>}</p>
                    <a className="report-link" href={r.listing_kind === "product" ? `/product/${r.listing_id}` : `/rental/${r.listing_id}`} target="_blank" rel="noreferrer" data-testid={`report-view-listing-${r.id}`}>Open listing →</a>
                  </div>
                  <div className="actions">
                    <button className="approve-button" onClick={() => resolveReport(r.id, "dismiss")} data-testid={`report-dismiss-${r.id}-button`}><CheckCircle2 size={13} /> Keep listing</button>
                    <button className="reject-button" onClick={() => resolveReport(r.id, "remove_listing")} data-testid={`report-remove-${r.id}-button`}><XCircle size={13} /> Remove listing</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </section>
    </>
  );
}
