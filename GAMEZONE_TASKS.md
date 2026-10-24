# Gamezone library — task list (resume file)

**How to resume after any interruption:** open this file, find the first task that is not `[x]`,
read its "Notes / state" line, and continue from there. Update the checkbox and the notes line
after every step, so this file is always the true state of the work.
Rule from the user: **ask before doing anything** — each phase starts only after the user says go.

Status keys: `[ ]` not started · `[~]` in progress · `[x]` done · `[?]` waiting for the user

## Decisions (2026-10-24)
- Gamezone message: users play games **they already own** (own Steam/Epic login). We supply no games
  and no paid software. Free/open-source software (e.g. Blender) is offered as pre-configured containers.
- Availability shown only from verified live stock (CLAUDE.md §3.1 stays). Built on a **preview branch**
  first; nothing goes live until the user reviews it.
- Basic streaming test has passed (user, 2026-10-24) — CLAUDE.md decisions log still says
  "paused"; update it in task 0.2.
- Two searches: (1) game/software library, (2) machine/GPU search with filters (distance, RAM,
  CPU cores, CPU model, GPU cores, GPU VRAM, GPU model, more).
- Prices: **not shown yet** — pricing still to be discussed. Leave a slot for them in the design.
- Cover art: open-licence only, saved in `Desktop\images001\game cover art\` named after the game
  (e.g. `veloren.jpg`), with a credits file listing source + licence for each.

## Phase 0 — Setup
- [x] 0.1 Create preview branch `gamezone-library` (frontend + backend). Notes: created on GitHub from main 2026-10-24.
- [x] 0.2 Update CLAUDE.md decisions log (streaming test passed; library plan; prices pending). Notes: two rows added locally; pushed to the branch with GAMEZONE_TASKS.md.

## Phase 1 — Research (no code)
- [x] 1.1 Check terms of current providers (Vast.ai, Productify Node, others in setup): reselling allowed?
      game streaming allowed? API for live stock + location? Notes: done, see PROVIDERS_REVIEW.md.
- [x] 1.2 Web search for other GPU providers that allow game streaming; same three questions. Notes: done 2026-10-24, results in PROVIDERS_REVIEW.md.
- [?] 1.3 Write `PROVIDERS_REVIEW.md` (sources + dates) and get the user's pick of providers. `[?]` Notes: review written; waiting for the user to pick providers.

## Phase 2 — Cover art
- [ ] 2.1 Pick the starting game list (open-source/free-to-play first, plus popular games users own). Notes: —
- [ ] 2.2 Find open-licence cover art, save to `Desktop\images001\game cover art\<game>.jpg`. Notes: —
- [ ] 2.3 Write `CREDITS.md` in that folder (file, game, source URL, author, licence). User reviews. `[?]` Notes: —

## Phase 3 — Live inventory backend
- [ ] 3.1 Common machine format (GPU model/VRAM/cores, CPU model/cores, RAM, disk, location, provider, status). Notes: —
- [ ] 3.2 One adapter per approved provider; poll into a central inventory store. Notes: —
- [ ] 3.3 API: `GET /gamezone/inventory` grouped by GPU model, sorted by distance (IP-based location,
      not stored); `GET /gamezone/machines` with filters. Notes: —
- [ ] 3.4 Tests: stale/offline machines never shown; provider outage does not break the list. Notes: —

## Phase 4 — Frontend (preview branch)
- [ ] 4.1 "Bring your own games" notice: banner + FAQ entry. Notes: —
- [ ] 4.2 Library page: search + game/software grid. Notes: —
- [ ] 4.3 Game detail page: description, min/recommended requirements, live GPU list
      (e.g. "RTX 3060 · 20 available"), nearest first marked "Recommended", below-minimum GPUs marked. Notes: —
- [ ] 4.4 Machine/GPU search page with filters. Notes: —
- [ ] 4.5 Software pages (open-source containers, e.g. Blender). Notes: —
- [ ] 4.6 Mobile + accessibility check, analytics events. Notes: —

## Phase 5 — Review
- [ ] 5.1 Preview URL to the user; collect changes. `[?]` Notes: —
- [ ] 5.2 Publish only after the user approves. Notes: —

## Later (remembered, not now)
- Prices next to GPU counts (pricing discussion first).
- Scaling to many providers / millions of users (see design notes below).

## Design notes: scaling live listings
Users never query providers directly. Adapters pull (or receive webhooks) from each provider every
~30–60 s into one inventory store; the website reads only from that store via a cache, so a million
users cost the providers nothing extra. Counts per GPU model per region are pre-computed each cycle.
For worldwide users, the store/cache is replicated per region (CDN + regional read copies).
Machines whose data is older than a few minutes are hidden, and stock is re-checked at the moment
of booking, so the list can be slightly behind but a booking is never made on a stale machine.
