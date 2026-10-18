import PolicyLayout from "./PolicyLayout";

export default function Cookies() {
  return (
    <PolicyLayout
      title="Cookie Policy"
      description="What cookies Productify uses, why, and how you can control them."
      path="/legal/cookies"
    >
      <h2>1. What are cookies?</h2>
      <p>Cookies are small text files stored on your device by your browser. Similar technologies include local storage, session storage and pixel tags. We treat all of these as "cookies" in this policy.</p>

      <h2>2. Cookies we use</h2>
      <h3>Strictly necessary (always on)</h3>
      <ul>
        <li><b>session_token</b> — keeps you signed in via Google (httpOnly, Secure, SameSite=None, 7 days).</li>
        <li><b>productify-token</b> — JWT for email/password sign-in (localStorage, 7 days).</li>
        <li><b>productify-user</b> / <b>productify-cart</b> — remembers your profile info and cart between visits.</li>
      </ul>

      <h3>Analytics</h3>
      <p>We do not currently use analytics cookies or session recording. If we add analytics later, we will list it here and ask for your consent first where the law requires it.</p>

      <h3>Advertising</h3>
      <p>We do not currently use advertising cookies.</p>

      <h2>3. Managing cookies</h2>
      <p>You can accept or reject non-essential cookies via the banner shown on first visit. You can also block cookies through your browser settings — note that blocking essential cookies will break sign-in and checkout.</p>

      <h2>4. Regional notes</h2>
      <ul>
        <li><b>EU/UK</b> — under ePrivacy and the GDPR, we ask for opt-in consent before setting non-essential cookies.</li>
        <li><b>California</b> — the "Do Not Sell or Share My Personal Information" mechanism honours a Global Privacy Control (GPC) signal from your browser.</li>
        <li><b>India</b> — under the DPDP Act, cookies that process personal data require consent, which is obtained at the banner.</li>
      </ul>

      <h2>5. Changes</h2>
      <p>We will update this list as our cookie usage evolves. Check back periodically or contact <a href="mailto:privacy@productifynow.com">privacy@productifynow.com</a> for questions.</p>
    </PolicyLayout>
  );
}
