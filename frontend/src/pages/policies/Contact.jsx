import PolicyLayout from "./PolicyLayout";

export default function Contact() {
  return (
    <PolicyLayout
      title="Legal & Grievance Contact"
      description="Reach the right team quickly — general support, privacy, grievance officer, DPO, DMCA and law enforcement."
      path="/legal/contact"
    >
      <h2>General contacts</h2>
      <div className="contact-grid">
        <div className="contact-card">
          <b>Support</b>
          <a href="mailto:support@productifynow.com">support@productifynow.com</a>
          <small>Order help, refunds, seller onboarding</small>
        </div>
        <div className="contact-card">
          <b>Privacy</b>
          <a href="mailto:privacy@productifynow.com">privacy@productifynow.com</a>
          <small>Data access, deletion, portability requests</small>
        </div>
        <div className="contact-card">
          <b>Legal</b>
          <a href="mailto:legal@productifynow.com">legal@productifynow.com</a>
          <small>Terms, licensing, partnerships</small>
        </div>
        <div className="contact-card">
          <b>Abuse</b>
          <a href="mailto:abuse@productifynow.com">abuse@productifynow.com</a>
          <small>Report a listing, user or workload</small>
        </div>
      </div>

      <h2>India — Grievance Officer (IT Rules 2011 & DPDP Act 2023)</h2>
      <p><b>Grievance Officer</b>: To be appointed on launch.<br/>Email: <a href="mailto:grievance@productifynow.com">grievance@productifynow.com</a><br/>Working hours: Monday–Friday, 10:00–18:00 IST.<br/>Acknowledgement: within 24 hours. Resolution: within 15 days.</p>

      <h2>EU & UK — Data Protection Officer</h2>
      <p><b>DPO</b>: <a href="mailto:dpo@productifynow.com">dpo@productifynow.com</a>. You may also contact your national supervisory authority (e.g., Ireland's <a href="https://dataprotection.ie" target="_blank" rel="noreferrer">DPC</a>, UK <a href="https://ico.org.uk" target="_blank" rel="noreferrer">ICO</a>).</p>

      <h2>US — DMCA agent</h2>
      <p><b>DMCA</b>: <a href="mailto:dmca@productifynow.com">dmca@productifynow.com</a>. Follow the notice format described in the Acceptable Use Policy §6.</p>

      <h2>Law enforcement</h2>
      <p>Valid legal process (subpoenas, court orders, MLAT requests) should be sent to <a href="mailto:legal@productifynow.com">legal@productifynow.com</a>. Emergency requests: mark the subject line "EMERGENCY DISCLOSURE REQUEST" and expect a response within 12 hours.</p>

      <h2>Registered address</h2>
      <p>To be added at company registration — <a href="https://productifynow.com">productifynow.com</a>.</p>
    </PolicyLayout>
  );
}
