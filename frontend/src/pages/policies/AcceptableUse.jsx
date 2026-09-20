import PolicyLayout from "./PolicyLayout";

export default function AcceptableUse() {
  return (
    <PolicyLayout
      title="Acceptable Use Policy"
      description="What you can and cannot do on Productify — including rules for uploaded content and rented GPU compute."
      path="/legal/acceptable-use"
    >
      <h2>1. General conduct</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Break any law, regulation or third-party right.</li>
        <li>Harass, threaten, defraud or impersonate any person.</li>
        <li>Circumvent security, rate limits, verification checks, or gain unauthorised access to any account or system.</li>
        <li>Scrape, crawl or bulk-download Productify content beyond ordinary browsing.</li>
      </ul>

      <h2>2. Prohibited content</h2>
      <ul>
        <li>Malware, spyware, keyloggers, ransomware, cracked license keys, cheat tools, phishing kits.</li>
        <li>Pirated software, unauthorized copies of copyrighted works, leaked databases.</li>
        <li>Child sexual abuse material (CSAM), non-consensual intimate imagery, or any content that sexualises minors.</li>
        <li>Content that incites violence, terrorism, or hatred against protected classes.</li>
        <li>Personally identifiable information about others without their consent.</li>
      </ul>

      <h2>3. GPU rental — specific rules</h2>
      <p>GPU rentals give you access to significant compute. In addition to §1 and §2, you may not use rented compute to:</p>
      <ul>
        <li>Mine cryptocurrency without the node owner's explicit written permission on the listing.</li>
        <li>Generate CSAM, non-consensual sexual deepfakes, or targeted disinformation.</li>
        <li>Train models on data you do not have rights to.</li>
        <li>Run DDoS, credential stuffing, brute-force or scanning workloads.</li>
        <li>Store client data in violation of the client's data-protection agreement.</li>
        <li>Exceed the resource limits stated in the listing.</li>
      </ul>

      <h2>4. Reporting abuse</h2>
      <p>Report violations to <a href="mailto:abuse@productifynow.com">abuse@productifynow.com</a>. For CSAM, we report to NCMEC (US) and equivalent authorities immediately and preserve evidence as required by law.</p>

      <h2>5. Enforcement</h2>
      <p>We may investigate, remove content, suspend or terminate accounts, and cooperate with law-enforcement without prior notice. <b>Accounts terminated under this policy — or under §8A/§8B of the Terms of Service — are not entitled to any refund, credit, payout, compensation or restoration of content, ratings, reviews or workspace files.</b> Each seller and each buyer remains personally and solely responsible for the legality of the items they list, purchase, upload or transfer; Productify acts only as an intermediary and disclaims responsibility to the fullest extent permitted by law.</p>

      <h2>6. DMCA & copyright complaints (US) / notice-and-takedown</h2>
      <p>Send DMCA notices to <a href="mailto:dmca@productifynow.com">dmca@productifynow.com</a> including: your electronic signature, identification of the copyrighted work, the URL of the infringing material, your contact information, a good-faith statement, and a statement under penalty of perjury that you are authorized to act.</p>
    </PolicyLayout>
  );
}
