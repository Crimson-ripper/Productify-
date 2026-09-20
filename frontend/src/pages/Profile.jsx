import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ImageUpload from "@/components/ImageUpload";
import SEO from "@/components/SEO";
import { toast } from "sonner";

export default function Profile() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(user?.name || ""); setPhone(user?.phone || ""); setAvatarUrl(user?.avatar_url || "");
  }, [user]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch("/auth/me", { name, phone, avatar_url: avatarUrl });
      await refresh();
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Update failed");
    } finally { setBusy(false); }
  };

  return (
    <>
      <SEO title="Your profile — Productify" path="/profile" />
      <section className="dashboard-page">
        <div className="eyebrow"><span className="eyebrow-line" /> ACCOUNT</div>
        <h1>Your profile<em>.</em></h1>
        <p className="subtitle">Signed in as {user?.email} · role: {user?.role}</p>

        <form className="profile-form" onSubmit={save}>
          <div className="avatar-row">
            <ImageUpload value={avatarUrl} onChange={setAvatarUrl} label="Upload avatar" testid="profile-avatar" />
          </div>
          <label>Display name<input value={name} onChange={(e) => setName(e.target.value)} required data-testid="profile-name-input" /></label>
          <label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" data-testid="profile-phone-input" /></label>
          <button className="primary-button" disabled={busy} data-testid="profile-save-button">{busy ? "Saving…" : "Save changes"}</button>
        </form>
      </section>
    </>
  );
}
