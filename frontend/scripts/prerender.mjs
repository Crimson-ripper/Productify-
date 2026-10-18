// Build-time pre-render for marketing pages (ROADMAP Task 6, option A).
// Runs after `craco build`: renders each route below with react-dom/server and writes
// build/<route>/index.html with the page's real title, meta tags and text. The browser
// app then renders over it as usual (createRoot), so nothing changes for visitors.
// build/shell.html keeps the empty app shell for every other route (see vercel.json).
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROUTES = [
  "/", "/rent-compute", "/earn-with-hardware", "/waitlist", "/apply",
  "/pricing", "/security", "/faq", "/shop", "/rentals", "/sell",
  "/legal/privacy", "/legal/terms", "/legal/refunds", "/legal/cookies",
  "/legal/acceptable-use", "/legal/contact",
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = path.join(root, "build");
const outFile = path.join(root, "node_modules", ".cache", "prerender", "entry.cjs");

// Same env the CRA build saw (REACT_APP_* from .env files and the host's environment).
const env = { NODE_ENV: "production" };
for (const f of [".env", ".env.production", ".env.local", ".env.production.local"]) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(REACT_APP_[A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
for (const [k, v] of Object.entries(process.env)) if (k.startsWith("REACT_APP_")) env[k] = v;

await build({
  entryPoints: [path.join(root, "scripts", "prerender-entry.jsx")],
  outfile: outFile,
  bundle: true,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  logLevel: "warning",
  alias: { "@": path.join(root, "src") },
  loader: { ".js": "jsx", ".css": "empty", ".png": "empty", ".jpg": "empty", ".jpeg": "empty", ".svg": "empty", ".webp": "empty", ".gif": "empty" },
  define: Object.fromEntries(Object.entries(env).map(([k, v]) => [`process.env.${k}`, JSON.stringify(v)])),
});

const { render } = createRequire(import.meta.url)(outFile);
const shell = fs.readFileSync(path.join(buildDir, "index.html"), "utf8");
fs.writeFileSync(path.join(buildDir, "shell.html"), shell);

const esc = (s) => s.replace(/\$/g, "$$$$");
let failed = 0;
for (const route of ROUTES) {
  try {
    const { html, head } = render(route);
    const page = shell
      .replace(/<title>[^<]*<\/title>/, esc(head))
      .replace('<div id="root"></div>', esc(`<div id="root">${html}</div>`));
    const dir = path.join(buildDir, route);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), page);
    console.log(`prerendered ${route} (${Math.round(page.length / 1024)} KB)`);
  } catch (err) {
    failed += 1;
    console.error(`prerender failed for ${route}: ${err.message}`);
  }
}
if (failed) process.exit(1);
