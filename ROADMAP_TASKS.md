# ROADMAP_TASKS.md — Productify website work list

Work through these in order. Rules, scope and copy guidelines are in `CLAUDE.md`. Mark each
checkbox when its acceptance criteria are met. Stop and ask the user where a task says ASK.

## How to start (paste this into Claude Code)

> Read `CLAUDE.md` and `ROADMAP_TASKS.md`. Start with Task 0: audit the project and give me the
> report. Don't change any files until I approve the plan. After that, do one task at a time and
> summarise each one before moving on.

## Task 0 — Audit the project (no file changes)

- [x] Identify framework, build tool, router, styling, form handling, analytics and hosting/deploy setup.
- [x] List existing pages/routes and what each contains.
- [x] Find all copy that conflicts with the honesty rules (fake availability, unmeasured claims, income promises, unsupported workloads, competitor mentions).
- [x] Note how the digital-products marketplace is built and how intertwined it is with GPU rental.
- [x] Explain why crawlers get an empty "enable JavaScript" page and list fix options with trade-offs.
- [x] Produce a short plan mapping Tasks 1–9 onto the actual codebase.

Done when: the user has a written audit report and has approved the plan. ASK: what to do with
the digital-products marketplace (keep, separate, or hide). — *Done 2026-10-19; decisions are in
`CLAUDE.md` §8.*

## Task 1 — Brand foundations

- [ ] Centralise colours, typography, spacing, button and card styles as reusable tokens/components (use the existing styling system).
- [ ] Apply them consistently; remove generic AI imagery and excessive effects.

Done when: pages share one consistent set of tokens and components; no visual regressions on mobile.

## Task 2 — Homepage restructure

- [ ] Rebuild the homepage with the six sections from `CLAUDE.md` §4, in order.
- [ ] Hero: two CTAs (Join renter waitlist / Apply as a provider), each firing `cta_click`.
- [ ] Machine cards labelled "Preview" unless backed by live verified inventory.
- [ ] 3D rendering shown only as a future pilot.

Done when: homepage matches the structure, copy passes the honesty rules, works at phone width.

## Task 3 — Two landing pages

- [ ] `Rent Compute` page for AI developers: problem, supported workloads, how it works, pricing logic, FAQ, waitlist CTA.
- [ ] `Earn with Hardware` page: eligibility, verification, provider control (pause/de-list), security approach, how payouts will work, "earnings depend on utilisation" disclaimer, application CTA.

Done when: both pages are live in the dev build, linked from nav and homepage, with unique meta tags.

## Task 4 — Forms

- [ ] Renter waitlist form and provider application form with the fields in `CLAUDE.md` §4.
- [ ] Validation, success state, error state, confirmation page/message.
- [ ] Submissions delivered to the existing backend/service (ASK if none exists).
- [ ] Draft waitlist confirmation email text: what happens next and what is available now.

Done when: a test submission of each form arrives at its destination, tested on desktop and a phone-sized viewport.

## Task 5 — Trust pages

- [ ] Pricing (explain billing interval, when billing starts/stops, storage/bandwidth treatment; use `[TODO]` placeholders for real rates), Security, FAQ, Contact, Privacy.
- [ ] Footer links to all of them.

Done when: every page exists, is linked, and contains no invented facts.

## Task 6 — SEO and crawlability

- [ ] Implement the approved fix so marketing pages serve real HTML (titles, descriptions, headings, text).
- [ ] Unique title, meta description and canonical URL per page; sitemap.xml and robots.txt.
- [ ] Internal links between landing pages, pricing and FAQ.

Done when: fetching each marketing page without JavaScript shows its real content. ASK before
changing build or hosting configuration.

## Task 7 — Analytics

- [ ] Implement `page_view`, `cta_click`, `waitlist_submit`, `provider_form_submit`, `form_success`, `form_error`.
- [ ] Add consent handling if the analytics tool requires it.

Done when: each event is verified firing once per action (show how it was verified).

## Task 8 — QA pass

- [ ] Mobile layouts, page speed, broken links, accessibility basics (labels, alt text, contrast, keyboard).
- [ ] Test in at least two browsers.
- [ ] Re-check all copy against the honesty rules.

Done when: a QA checklist is written with pass/fail per item and failures fixed or logged.

## Task 9 — Lead tracking (only if the project has a backend/database)

- [ ] Store leads with: type (renter/provider), source/channel, region, use case or hardware profile, qualification status, stage, owner, last contact, next action, outcome.
- [ ] Simple internal view or export (CSV). Protect it behind auth.

Done when: form submissions appear as leads with a stage and can be exported. ASK before adding a
database or third-party CRM.

## Later (Month 2+, only when the user asks)

- MVP spec and acceptance tests for the renter lifecycle: account → select → request → provision → connect → meter → stop → clean up.
- Provider lifecycle: register hardware → verify → set availability → view status/earnings.
- Host Agent prototype with isolated GPU workloads (see `CLAUDE.md` §5 non-negotiables).
- Machine inventory where only verified, healthy machines are listable.
- Test-mode payments and usage reconciliation.
