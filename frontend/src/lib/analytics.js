// Analytics (CLAUDE.md §5, ROADMAP Task 7): Google Analytics 4.
// Events: page_view, cta_click, waitlist_submit, provider_form_submit, form_success, form_error.
//
// Privacy: GA4 is loaded ONLY after the visitor clicks "Accept all" in the cookie banner
// (basic Consent Mode v2: every storage type defaults to denied, then analytics/ads are
// granted on accept). Before consent, or without REACT_APP_GA_ID, nothing is sent to Google.
// Personal data (names, emails, form contents) is never sent — only event names and
// non-identifying parameters like cta_name and form.

const GA_ID = process.env.REACT_APP_GA_ID || "";
export const CONSENT_KEY = "productify-cookie-consent";
let loaded = false;

function gtag() {
  window.dataLayer = window.dataLayer || [];
  // gtag.js expects the arguments object itself
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

export function hasAnalyticsConsent() {
  try {
    return JSON.parse(localStorage.getItem(CONSENT_KEY) || "null")?.choice === "accepted";
  } catch {
    return false;
  }
}

function loadGa() {
  if (loaded || !GA_ID || typeof document === "undefined") return;
  loaded = true;
  window.gtag = gtag;
  gtag("consent", "default", {
    ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied",
  });
  // Global Privacy Control: keep advertising off even after "Accept all" (Cookie Policy §2).
  const ads = navigator.globalPrivacyControl ? "denied" : "granted";
  gtag("consent", "update", {
    ad_storage: ads, ad_user_data: ads, ad_personalization: ads, analytics_storage: "granted",
  });
  gtag("js", new Date());
  gtag("config", GA_ID, { send_page_view: false }); // page views are sent on route change below
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
}

/** Call once at startup: loads GA4 if the visitor accepted cookies earlier. */
export function initAnalytics() {
  if (hasAnalyticsConsent()) loadGa();
}

/** Cookie banner "Accept all". */
export function grantAnalyticsConsent() {
  loadGa();
  track("page_view");
}

/** Cookie banner "Necessary only" / withdrawing consent: stop GA4 and remove its cookies. */
export function revokeAnalyticsConsent() {
  if (loaded) {
    gtag("consent", "update", {
      ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied",
    });
  }
  try {
    for (const c of document.cookie.split(";")) {
      const name = c.split("=")[0].trim();
      if (name === "_ga" || name.startsWith("_ga_") || name === "_gid") {
        for (const domain of ["", location.hostname, "." + location.hostname.replace(/^www\./, "")]) {
          document.cookie = `${name}=; Max-Age=0; path=/${domain ? "; domain=" + domain : ""}`;
        }
      }
    }
  } catch {
    // ignore
  }
}

export function track(event, params = {}) {
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", event, params, loaded ? "(sent)" : "(not sent: no consent or no GA id)");
  }
  if (!loaded || !hasAnalyticsConsent()) return;
  try {
    if (event === "page_view") {
      window.gtag("event", "page_view", { page_location: location.href, page_path: location.pathname, page_title: document.title, ...params });
    } else {
      window.gtag("event", event, params);
    }
  } catch {
    // never let analytics break the page
  }
}

/** Props for a link/button that records a cta_click with the given name. */
export const ctaProps = (ctaName, extra = {}) => ({
  onClick: () => track("cta_click", { cta_name: ctaName, ...extra }),
  "data-cta": ctaName,
});
