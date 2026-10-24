# CLAUDE.md — Productify project instructions

Claude Code reads this file automatically. It explains what Productify is, what the
current 90-day plan requires, and the rules to follow when changing this codebase.
The step-by-step work list is in `ROADMAP_TASKS.md`.

---

## 1. What Productify is

Productify is a two-sided marketplace for renting GPU compute.

- **Renters** get supported GPU resources when they need extra compute, without buying hardware.
- **Providers** make eligible, idle GPU hardware rentable through a managed, verified process.
- Productify sits in the middle: matching, provisioning, isolation, usage metering and billing.

Live site: https://www.productifynow.com/

Planning period: **19 Oct 2026 – 10 Jan 2027** (a validation plan, not a public-launch promise).

## 2. Current scope (do not expand without asking)

| Stage | Offer | Status on the website |
|---|---|---|
| **Now** | GPU compute for AI/ML developers (JupyterLab + Python + PyTorch on NVIDIA GPUs) | Primary offer, shown as **waitlist / closed beta** until inventory is real |
| Next | Blender / 3D rendering, CPU instances, remote dev workspaces | "Coming later" / register interest only |
| Later | Full remote PCs, gaming, Adobe/Autodesk workstations | Do not advertise |

**Open decision — ask the user before acting:** the live site currently describes Productify as
"a marketplace for digital products and hourly GPU rentals" (software and templates from
independent sellers + GPU rentals). The roadmap focuses only on GPU compute. Do **not** remove or
hide the digital-products marketplace until the user confirms what to do with it.

## 3. Honesty rules for all copy and UI (non-negotiable)

1. Never show machines as "available" unless they come from verified, live inventory.
   Preview/mock machine cards must be clearly labelled "Preview" or "Example".
2. Never publish performance numbers, uptime, savings or provider-earnings figures that have not
   been measured on real machines.
3. Never guarantee provider income. Earnings depend on utilisation, price, power, downtime and support.
4. Do not advertise unsupported workloads (gaming, Adobe, Autodesk, full remote PCs).
5. Product status language must be accurate: "waitlist", "closed beta", "pilot".
6. Do not use competitor names, prices or features in public copy unless the user supplies a
   dated, sourced comparison.
7. Do not invent testimonials, customer quotes, logos or user counts.
8. Avoid generic AI imagery and heavy "futuristic" effects; keep the visual identity clear and professional.

## 4. Target website structure

Two clear journeys: **Rent Compute** and **Earn with Hardware**.

Homepage sections, in order:
1. **Hero** — "PRODUCTIFY / Rent Compute · Earn with Hardware". Headline: "Computing power when
   you need it." Short explanation + two CTAs (Join renter waitlist / Apply as a provider).
2. **Browse compute** — machine cards (GPU, VRAM, region, availability, price). Labelled as
   preview/waitlist until inventory is live.
3. **Use cases** — AI development, fine-tuning, model testing. 3D rendering marked as a future pilot.
4. **How it works** — Choose a resource → start a rental → connect securely → track usage → stop.
5. **For providers** — application, hardware verification, availability controls, operating
   requirements, payment approach (no income guarantees).
6. **Trust & support** — security approach, pricing explanation, FAQ, contact, privacy notice,
   honest product-status language.

Pages needed: Home, Rent Compute (renter landing), Earn with Hardware (provider landing),
Pricing (pricing logic, not fake prices), Security, FAQ, Contact, Privacy, waitlist confirmation,
provider-application confirmation.

### Renter waitlist form fields
Name, email, role (independent dev / startup / research / 3D artist / other), workload type,
GPU/VRAM needed, how often, region, current provider, approximate monthly spend (optional),
consent checkbox.

### Provider application form fields
Name, preferred contact, country/region, GPU model, VRAM, CPU, RAM, storage, OS, available hours,
power/connectivity notes, individual or business, security concerns, expected compensation
(optional), consent checkbox. **Do not collect ID documents, bank details or other sensitive data.**

## 5. Technical rules

- **Inspect before changing.** Identify the framework, router, styling system, form handling and
  hosting before editing. Follow the existing stack and conventions; do not migrate frameworks
  without explicit approval.
- **SEO / crawlability.** The live site currently returns an empty "enable JavaScript" shell to
  crawlers (client-side-only rendering). Investigate and propose a fix (pre-rendering, SSG/SSR, or
  static HTML for marketing pages) so titles, descriptions and main text are in the initial HTML.
  Propose first; implement only after approval if it changes the build or hosting setup.
- Every page needs a unique `<title>`, meta description, canonical URL and crawlable text.
- **Analytics events** to implement and verify: `page_view`, `cta_click` (with `cta_name`),
  `waitlist_submit`, `provider_form_submit`, `form_success`, `form_error`. Use the existing
  analytics tool if there is one; otherwise ask which to use.
- Forms must show success and error states, validate input, and actually deliver submissions
  (test end-to-end). No secrets or API keys in client code or committed files.
- Mobile-first: test at phone width; no horizontal scroll. Basic accessibility: labels on inputs,
  alt text, colour contrast, keyboard navigation.
- Keep changes small and reviewable. One task per commit/PR with a clear message.

### Later product work (Month 2+, only when the user asks)
The rental platform must separate the **control plane** (API, identity, catalogue, scheduler,
pricing rules, machine state) from the **execution plane** (Host Agent + isolated workload on
provider hardware). Non-negotiables:
- Isolation: customer workloads cannot access host files, home network or other sessions.
- Metering: authoritative start/stop timestamps and usage records.
- Machine health: offline/unhealthy machines cannot be rented.
- Secrets: least privilege, no credentials in images, revocable access.
- Recovery: timeouts, retries, cleanup, refunds.
- Test/sandbox payments only until billing reconciles and legal/payment review is done.

## 6. Definition of done

A task is done only when its acceptance criteria are met, not when code exists. For the website
that means: works on mobile, forms deliver, analytics events fire, copy follows the honesty rules,
and the intended user journey has been clicked through. Report what was tested and what wasn't.

## 7. How to work with the user

- Ask before: deleting features or pages, changing frameworks/hosting, adding paid services,
  adding new third-party tracking, or changing the digital-products marketplace.
- When copy needs a fact you don't have (price, region, GPU model, support hours), use a clearly
  marked placeholder like `[TODO: confirm supported regions]` instead of inventing it.
- At the end of each task, summarise: what changed, files touched, how it was tested, open TODOs.

## 8. Decisions log

Answers the user has already given. Don't ask these again; ask if circumstances change.

| Date | Question | Decision |
|---|---|---|
| 2026-10-19 | Digital-products marketplace | **Separate it later.** Keep it working as-is for now; it will move to its own section/subdomain in a later step. Don't hide or remove it. |
| 2026-10-19 | Self-serve GPU flows vs. waitlist/application | **Keep both public.** Existing self-serve renting and seller pairing stay open; the waitlist and provider application are added alongside. |
| 2026-10-19 | Crawlability fix | **Decide at Task 6.** Options A–D are in the Task 0 audit (recommendation: A, build-time pre-render). |
| 2026-10-19 | Gamezone (advertised but unsupported, rule 4) | **Leave it until later.** Don't change Gamezone during this roadmap. |
| 2026-10-21 | Gamezone hosting experiments | **Test on rented Vast.ai machines.** Backend scripts and test plan only (`backend/gamezone/vast_*.py`, `STREAMING_TEST_PLAN.md`); the live site stays paused and nothing is advertised until tests pass. `VAST_API_KEY` lives only in `backend/.env` / Render env. |
| 2026-10-24 | Gamezone streaming test | **Basic streaming test passed.** Gamezone library work starts on preview branch `gamezone-library`; nothing goes live without the user's review. Plan and progress: `GAMEZONE_TASKS.md`. |
| 2026-10-24 | Gamezone library scope | Bring-your-own games only (users sign in to their own store accounts); we supply no games or paid software. Free/open-source software (e.g. Blender) as pre-configured containers. Availability only from verified live stock (rule 3.1 stays). Prices not shown until pricing is decided. |

## 9. Codebase notes (from the Task 0 audit)

- Frontend: React 19, Create React App via craco, react-router-dom 7, plain CSS in `frontend/src/App.css`
  (tokens on `:root`), axios client in `frontend/src/lib/api.js`, per-page meta via `components/SEO.jsx`.
  Hosted on Vercel (`frontend/`, SPA fallback in `vercel.json`).
- Backend: FastAPI in `backend/server.py`, MongoDB, deployed on Render.
- Payments are simulated (checkout shows "Test mode"); no analytics tool is installed.
- Host agent: Productify Node v2 in the `Crimson-ripper/Productify-Node` repo (branch `v2/go-agent`).
