import PolicyLayout from "./PolicyLayout";

export default function Contact() {
  return (
    <PolicyLayout
      title="Legal & Grievance Contact"
      description="Reach the right team quickly: support, hosts, billing, privacy, legal, security, grievance officer, DPO and DMCA."
      path="/legal/contact"
    >
      <p>Productify is in closed beta. Questions about renting go to support, and questions about providing a machine go to hosts; many are answered in the <a href="/faq">FAQ</a>. Response times: [TODO: confirm support hours and response time].</p>
      <h2>General contacts</h2>
      <div className="contact-grid">
        <div className="contact-card">
          <b>Support</b>
          <a href="mailto:support@productifynow.com">support@productifynow.com</a>
          <small>Help with renting, your account and instances</small>
        </div>
        <div className="contact-card">
          <b>General</b>
          <a href="mailto:hello@productifynow.com">hello@productifynow.com</a>
          <small>Questions, feedback, press and partnerships</small>
        </div>
        <div className="contact-card">
          <b>Hosts</b>
          <a href="mailto:hosts@productifynow.com">hosts@productifynow.com</a>
          <small>Provider applications, Productify Node, payouts</small>
        </div>
        <div className="contact-card">
          <b>Billing</b>
          <a href="mailto:billing@productifynow.com">billing@productifynow.com</a>
          <small>Credits, charges and refunds</small>
        </div>
        <div className="contact-card">
          <b>Privacy</b>
          <a href="mailto:privacy@productifynow.com">privacy@productifynow.com</a>
          <small>Data access, deletion, portability requests</small>
        </div>
        <div className="contact-card">
          <b>Legal</b>
          <a href="mailto:legal@productifynow.com">legal@productifynow.com</a>
          <small>Terms, licensing, copyright notices</small>
        </div>
        <div className="contact-card">
          <b>Security and abuse</b>
          <a href="mailto:security@productifynow.com">security@productifynow.com</a>
          <small>Vulnerabilities; report a listing, user or workload</small>
        </div>
      </div>

      <h2>India — Grievance Officer (IT Rules 2011 & DPDP Act 2023)</h2>
      <p><b>Grievance Officer</b>: To be appointed on launch.<br/>Email: <a href="mailto:legal@productifynow.com">legal@productifynow.com</a> (subject: "Grievance")<br/>Working hours: Monday–Friday, 10:00–18:00 IST.<br/>Acknowledgement: within 24 hours. Resolution: within 15 days.</p>

      <h2>EU & UK — Data Protection Officer</h2>
      <p><b>DPO</b>: <a href="mailto:privacy@productifynow.com">privacy@productifynow.com</a>. You may also contact your national supervisory authority (e.g., Ireland's <a href="https://dataprotection.ie" target="_blank" rel="noreferrer">DPC</a>, UK <a href="https://ico.org.uk" target="_blank" rel="noreferrer">ICO</a>).</p>

      <h2>US — DMCA agent</h2>
      <p><b>DMCA</b>: <a href="mailto:legal@productifynow.com">legal@productifynow.com</a> (subject: "DMCA notice"). Follow the notice format described in the Acceptable Use Policy §6.</p>

      <h2>Law enforcement</h2>
      <p>Valid legal process (subpoenas, court orders, MLAT requests) should be sent to <a href="mailto:legal@productifynow.com">legal@productifynow.com</a>. Emergency requests: mark the subject line "EMERGENCY DISCLOSURE REQUEST" and expect a response within 12 hours.</p>

      <h2>Registered address</h2>
      <p>To be added at company registration — <a href="https://www.productifynow.com">productifynow.com</a>.</p>
    </PolicyLayout>
  );
}
