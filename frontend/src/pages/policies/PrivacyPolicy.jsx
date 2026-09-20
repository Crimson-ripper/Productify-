import PolicyLayout from "./PolicyLayout";

export default function PrivacyPolicy() {
  return (
    <PolicyLayout
      title="Privacy Policy"
      description="How Productify collects, uses, stores, shares and protects your personal information — with region-specific rights for the EU/UK, USA, India and Australia."
      path="/legal/privacy"
    >
      <h2>1. Who we are</h2>
      <p>Productify ("Productify", "we", "us", "our") operates the marketplace at <a href="https://productifynow.com">productifynow.com</a> for digital goods and GPU/system rentals. If you have questions about this policy, contact us at <a href="mailto:privacy@productifynow.com">privacy@productifynow.com</a>.</p>

      <h2>2. Information we collect</h2>
      <ul>
        <li><b>Account data</b> — name, email, password hash, role (buyer/seller/admin), phone number (optional), avatar.</li>
        <li><b>Google sign-in data</b> — if you use Google, we receive your email, name and profile picture from Google via Emergent-managed OAuth.</li>
        <li><b>Listings & content</b> — product descriptions, GPU node specifications, uploaded images, and any files you transfer during a GPU rental session.</li>
        <li><b>Transactions</b> — cart contents, order totals, payment provider, timestamps, region. Card and bank details are handled by our payment providers (Stripe, PayPal, Razorpay) — we never store your card number.</li>
        <li><b>Technical data</b> — IP address, device, browser, cookies, log data, approximate location for region-based checkout.</li>
      </ul>

      <h2>3. Why we use it (legal bases)</h2>
      <ul>
        <li><b>Contract</b> — to create your account, fulfil orders, host and deliver digital goods, provision GPU access, process payments and issue receipts.</li>
        <li><b>Legitimate interests</b> — fraud prevention, seller verification, marketplace safety, service improvement.</li>
        <li><b>Consent</b> — marketing communications, optional cookies, uploading identity documents for seller verification.</li>
        <li><b>Legal obligation</b> — tax records, responding to lawful requests, DPDP/GDPR/CCPA compliance.</li>
      </ul>

      <h2>4. Sharing</h2>
      <p>We share the minimum data needed with:</p>
      <ul>
        <li><b>Payment providers</b> — Stripe, PayPal, Razorpay for processing purchases (region-based selection).</li>
        <li><b>Infrastructure</b> — Emergent Object Storage for hosting uploaded files; Google (only if you sign in with Google).</li>
        <li><b>Sellers/buyers</b> — buyers see the seller's display name; sellers see the buyer's name for fulfillment.</li>
        <li><b>Legal & safety</b> — courts, regulators or law-enforcement where required by law.</li>
      </ul>
      <p>We do <b>not</b> sell your personal information. We do <b>not</b> "share" it for cross-context behavioural advertising as defined by the CCPA/CPRA.</p>

      <h2>5. International transfers</h2>
      <p>Productify serves a global audience. Data may be transferred to, and processed in, jurisdictions other than your own — including India, the US and the EU. Where we transfer personal data outside your region, we rely on the Standard Contractual Clauses (EU/UK), the DPDP Act transfer rules (India), and equivalent safeguards.</p>

      <h2>6. Retention</h2>
      <p>Account and transactional data are retained while your account is active and for up to 7 years after closure to comply with tax and financial-record obligations. Uploaded images and workspace files are retained until you delete the listing or your account. Session cookies expire in 7 days.</p>

      <h2>7. Your rights</h2>
      <h3>7.1 European Economic Area & United Kingdom (GDPR / UK GDPR)</h3>
      <p>You have the right to <b>access, rectify, erase, restrict, port, and object</b> to processing of your personal data, and to withdraw consent at any time. You may lodge a complaint with your national supervisory authority (e.g., Ireland's DPC, the UK's ICO).</p>

      <h3>7.2 California residents (CCPA / CPRA)</h3>
      <p>You have the right to <b>know</b> what personal information we collect, <b>delete</b> it, <b>correct</b> it, <b>opt out of sale/share</b>, and <b>limit use of sensitive personal information</b>. To exercise, email <a href="mailto:privacy@productifynow.com">privacy@productifynow.com</a> with subject "California Rights Request". We do not sell personal information; a "Do Not Sell or Share My Personal Information" link is not applicable but requests are honored regardless.</p>

      <h3>7.3 India (Digital Personal Data Protection Act, 2023 & IT Rules 2011)</h3>
      <p>You have the right to (a) obtain a summary of your personal data being processed, (b) request correction, completion, updating and erasure, (c) nominate another person to exercise your rights on your behalf in case of death or incapacity, and (d) grievance redressal. See §10 for our Grievance Officer.</p>

      <h3>7.4 Australia (Privacy Act 1988 — APPs)</h3>
      <p>You may request access to and correction of your personal information under APP 12 and APP 13. Complaints can be made to the Office of the Australian Information Commissioner (OAIC).</p>

      <h2>8. Security</h2>
      <p>We hash passwords with bcrypt, store session tokens in httpOnly Secure cookies with SameSite=None, encrypt data in transit (HTTPS), and restrict administrative access. No system is perfect — please choose a strong password and enable two-factor authentication where offered.</p>

      <h2>9. Children</h2>
      <p>Productify is not directed at children. We do not knowingly collect personal information from anyone under 16 (EU), under 13 (US COPPA), or from a child as defined under the Indian DPDP Act without verifiable parental consent. If you believe a child has provided data, contact us for prompt deletion.</p>

      <h2>10. Grievance & Data Protection Officer</h2>
      <p>Under India's DPDP Act 2023 and IT Rules 2011, you may contact our Grievance Officer:</p>
      <p><b>Grievance Officer</b>: To be appointed on launch.<br/>Email: <a href="mailto:grievance@productifynow.com">grievance@productifynow.com</a>. Response within 24 hours; resolution within 15 days.</p>
      <p><b>Data Protection Officer (EU/UK GDPR)</b>: <a href="mailto:dpo@productifynow.com">dpo@productifynow.com</a>.</p>

      <h2>11. Changes</h2>
      <p>We will post any material changes here and, where required, notify you by email. Continued use of Productify after a change constitutes acceptance.</p>
    </PolicyLayout>
  );
}
