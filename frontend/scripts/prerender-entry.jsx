// Server-side render entry, bundled by scripts/prerender.mjs (ROADMAP Task 6).
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProviders, AppRouter } from "@/App";

export function render(url) {
  const helmetContext = {};
  const html = renderToString(
    <HelmetProvider context={helmetContext}>
      <QueryClientProvider client={new QueryClient()}>
        <StaticRouter location={url}>
          <AppProviders>
            <AppRouter />
          </AppProviders>
        </StaticRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
  const { helmet } = helmetContext;
  const head = helmet
    ? [helmet.title, helmet.meta, helmet.link, helmet.script].map((h) => h.toString()).join("\n")
    : "";
  return { html, head };
}
