import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import SEO from "@/components/SEO";
import { toast } from "sonner";

export default function AdminDashboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); api.get("/admin/pending").then((r) => setRows(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const decide = async (id, decision) => {
    await api.post(`/admin/rentals/${id}/${decision}`);
    setRows((rs) => rs.filter((x) => x.id !== id));
    toast.success(`Rental ${decision}`);
  };
  return (
    <>
      <SEO title="Admin console — Productify" path="/admin" />
      <section className="dashboard-page">
        <div className="eyebrow"><span className="eyebrow-line" /> OPERATIONS CONSOLE</div>
        <h1>Review queue<em>.</em></h1>
        <p className="subtitle">Approve or reject pending GPU/system listings.</p>

        {loading ? <div className="loading-block">Loading…</div> :
          rows.length === 0 ? (
            <div className="empty-state"><ShieldCheck size={30} /><p>All clear. No listings need review.</p></div>
          ) : (
            <div className="review-list" data-testid="admin-review-list">
              {rows.map((x) => (
                <div key={x.id} className="review-item-lg">
                  <img src={x.image} alt="" />
                  <div>
                    <b>{x.title}</b>
                    <small>{x.gpu} · {x.vram} · {x.location} · {x.owner}</small>
                    <p>{x.description}</p>
                  </div>
                  <div className="actions">
                    <button className="approve-button" onClick={() => decide(x.id, "approved")} data-testid={`approve-rental-${x.id}-button`}>Approve</button>
                    <button className="reject-button" onClick={() => decide(x.id, "rejected")} data-testid={`reject-rental-${x.id}-button`}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </section>
    </>
  );
}
