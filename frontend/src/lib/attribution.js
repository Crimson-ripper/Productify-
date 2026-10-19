// Lead source/channel (ROADMAP Task 9). Remembers how this browser session arrived —
// utm_source / utm_campaign from the first URL, else the referring site, else "direct" —
// so waitlist and provider submissions can record their channel. Session storage only;
// nothing is sent anywhere until the visitor submits a form.

const KEY = "productify-attribution";

export function captureAttribution() {
  try {
    if (sessionStorage.getItem(KEY)) return;
    const p = new URLSearchParams(window.location.search);
    let source = (p.get("utm_source") || "").trim();
    if (!source && document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (host && !host.endsWith("productifynow.com")) source = host;
    }
    sessionStorage.setItem(KEY, JSON.stringify({ source: (source || "direct").slice(0, 200), campaign: (p.get("utm_campaign") || "").slice(0, 200) }));
  } catch {
    // storage blocked: forms fall back to "direct"
  }
}

export function getAttribution() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "null") || { source: "direct", campaign: "" };
  } catch {
    return { source: "direct", campaign: "" };
  }
}
