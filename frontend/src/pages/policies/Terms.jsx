import PolicyLayout from "./PolicyLayout";

export default function Terms() {
  return (
    <PolicyLayout
      title="Terms of Service"
      description="The rules for using Productify — the marketplace connecting buyers and sellers of digital products and GPU rentals."
      path="/legal/terms"
    >
      <h2>1. Acceptance</h2>
      <p>By creating an account or making a purchase, you agree to these Terms, our Privacy Policy, our Refund Policy, our Cookie Policy and our Acceptable Use Policy. If you do not agree, do not use Productify.</p>

      <h2>2. Eligibility</h2>
      <p>You must be at least 18 years old and legally able to enter into a contract in your jurisdiction. Businesses may register through an authorised representative.</p>

      <h2>3. The marketplace role</h2>
      <p>Productify is a marketplace. Sellers list products or GPU nodes; buyers purchase or rent them. Except where Productify is expressly identified as the merchant, Productify is <b>not a party to the sale contract</b> between buyer and seller and does not assume the obligations of either party. Productify does provide (a) verification of sellers and GPU nodes, (b) an escrowed checkout, and (c) dispute resolution assistance.</p>

      <h2>4. Accounts</h2>
      <ul>
        <li>You are responsible for all activity under your account.</li>
        <li>Provide accurate, current and complete information.</li>
        <li>Keep your password confidential. Notify us immediately of any unauthorized use.</li>
      </ul>

      <h2>5. Digital products</h2>
      <p>Digital products are delivered instantly upon a confirmed payment. Because digital goods are consumed immediately, the refund conditions in the Refund Policy apply.</p>

      <h2>6. GPU / system rentals</h2>
      <ul>
        <li>All rental listings are verified by Productify before going live. Verification is a good-faith check, not a warranty of continuous performance.</li>
        <li>Rentals are billed by the hour or as specified in the listing.</li>
        <li>The rental is delivered as a service — access to a remote system for the paid duration. No physical hardware ships.</li>
        <li>Illegal, abusive or unsafe use is prohibited under our Acceptable Use Policy and will result in immediate suspension.</li>
      </ul>

      <h2>7. Fees, taxes & payouts</h2>
      <p>Productify may charge marketplace fees to sellers, disclosed at the time of listing. Buyers pay the listed price plus applicable taxes. Payment is captured by Stripe, PayPal or Razorpay depending on region. Payouts to sellers are made on a weekly cycle to the payout account they configure. In India, GST invoices are issued where the seller has provided a GSTIN.</p>

      <h2>8. Prohibited items</h2>
      <p>Do not list or purchase malware, pirated software, cracked license keys, illegal content, weapons, drugs, or anything that infringes intellectual property or violates any applicable law.</p>

      <h2>9. Intellectual property</h2>
      <p>The Productify platform, logos and trademarks belong to Productify. Sellers retain ownership of their listings. By posting content, sellers grant Productify a worldwide, royalty-free, non-exclusive licence to host, display, transmit and promote the content on the platform.</p>

      <h2>10. Disclaimers & limitation of liability</h2>
      <p>Productify is provided on an "as is" and "as available" basis to the fullest extent permitted by law. Where local law grants non-excludable consumer guarantees (e.g., Australian Consumer Law, Indian Consumer Protection Act 2019, EU consumer directives, UK Consumer Rights Act 2015), nothing in these Terms limits those rights.</p>
      <p>To the extent permitted by law, Productify's total liability for any claim arising out of your use of the service is limited to the amount you paid Productify in the 12 months preceding the claim.</p>

      <h2>11. Suspension & termination</h2>
      <p>We may suspend or terminate accounts for breach of these Terms, fraud, safety concerns, or where legally required. You may close your account at any time from your profile page.</p>

      <h2>12. Dispute resolution & governing law</h2>
      <p>For buyers and sellers <b>in India</b>: these Terms are governed by the laws of India; courts at Bengaluru have exclusive jurisdiction, subject to any consumer-forum rights under the Consumer Protection Act 2019.</p>
      <p>For buyers and sellers <b>in the EU/UK</b>: nothing in these Terms deprives you of the protection of mandatory local consumer law, and you may bring proceedings in your country of habitual residence.</p>
      <p>For buyers and sellers <b>in the US</b>: disputes are governed by the laws of the State of Delaware, without regard to conflict-of-laws rules. Small-claims court remains an option.</p>
      <p>For buyers and sellers <b>in Australia</b>: the Australian Consumer Law applies where relevant, and disputes may be brought in the courts of the buyer's state of residence.</p>

      <h2>13. Changes</h2>
      <p>We may update these Terms. Material changes will be announced by email and on this page. Continued use after changes take effect constitutes acceptance.</p>

      <h2>14. Contact</h2>
      <p><a href="mailto:legal@productifynow.com">legal@productifynow.com</a></p>
    </PolicyLayout>
  );
}
