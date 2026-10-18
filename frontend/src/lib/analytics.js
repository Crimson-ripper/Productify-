// Analytics events (CLAUDE.md §5): page_view, cta_click, waitlist_submit,
// provider_form_submit, form_success, form_error.
//
// No analytics tool is connected yet (ROADMAP Task 7). Until then events go to
// window.dataLayer (harmless if nothing reads it) and to the console in development,
// so every call site is already in place when a tool is chosen.

export function track(event, params = {}) {
  const payload = { event, ...params, ts: Date.now() };
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
  } catch {
    // never let analytics break the page
  }
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", event, params);
  }
}

/** Props for a link/button that records a cta_click with the given name. */
export const ctaProps = (ctaName, extra = {}) => ({
  onClick: () => track("cta_click", { cta_name: ctaName, ...extra }),
  "data-cta": ctaName,
});
