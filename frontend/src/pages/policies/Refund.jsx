import PolicyLayout from "./PolicyLayout";

export default function Refund() {
  return (
    <PolicyLayout
      title="Refund & Return Policy"
      description="Refund windows and return rules for digital products, GPU rentals, and consumer-protection carve-outs by region."
      path="/legal/refunds"
    >
      <h2>1. Digital products</h2>
      <p>Because digital goods are delivered immediately, all sales are final <b>unless</b>:</p>
      <ul>
        <li>The product is materially different from the listing description;</li>
        <li>The product does not function as described;</li>
        <li>You receive a duplicate purchase due to a technical error;</li>
        <li>Or your local consumer-protection law grants a stronger right (see §4).</li>
      </ul>
      <p>Eligible refund window: <b>30 days</b> from purchase. Contact <a href="mailto:support@productifynow.com">support@productifynow.com</a> with your order ID.</p>

      <h2>2. GPU / system rentals</h2>
      <ul>
        <li><b>Not started</b> — full refund if you cancel before the reserved slot begins.</li>
        <li><b>Started but failed</b> — pro-rated refund plus 25% service credit if the node was verifiably unavailable or performed below listed specs.</li>
        <li><b>Consumed</b> — no refund for compute time already delivered as described.</li>
      </ul>
      <p>Disputes are reviewed within 3 business days.</p>

      <h2>3. How to request a refund</h2>
      <ol>
        <li>Go to <a href="/orders">Orders</a> and open the order.</li>
        <li>Email <a href="mailto:support@productifynow.com">support@productifynow.com</a> with the order ID and reason.</li>
        <li>We will acknowledge within 24 hours and resolve within 7 business days.</li>
        <li>Approved refunds are returned to your original payment method within the payment provider's settlement window (Stripe/PayPal 5–10 business days; Razorpay 5–7 business days).</li>
      </ol>

      <h2>4. Consumer rights by region</h2>
      <h3>4.1 European Union & United Kingdom</h3>
      <p>Under the EU Consumer Rights Directive (2011/83/EU) and the UK Consumer Contracts Regulations 2013, you have 14 days to withdraw from most distance contracts. For <b>digital content</b>, this right is <b>lost</b> once download begins <i>with your prior express consent</i> and acknowledgement of that loss — which you provide by clicking "Complete purchase" at checkout.</p>

      <h3>4.2 India (Consumer Protection Act 2019 & E-Commerce Rules 2020)</h3>
      <p>Sellers must honour the return, refund, exchange, warranty and guarantee terms displayed on the listing. Deficient digital services must be remedied or refunded. Grievances can be escalated to the Grievance Officer (see Privacy Policy §10) within 30 days.</p>

      <h3>4.3 United States</h3>
      <p>Refund availability is as stated above. California residents are entitled to the disclosures on this page under Cal. Civ. Code §1723. Some states may provide additional statutory rights.</p>

      <h3>4.4 Australia (Australian Consumer Law)</h3>
      <p>Nothing in this policy excludes the consumer guarantees under the Australian Consumer Law. If a product fails to meet a consumer guarantee, you are entitled to a repair, replacement or refund and — if the failure is major — compensation for reasonably foreseeable loss.</p>

      <h2>5. Chargebacks</h2>
      <p>Please contact us before initiating a chargeback with your bank — most disputes are resolved faster directly. Unjustified chargebacks may result in account suspension.</p>
    </PolicyLayout>
  );
}
