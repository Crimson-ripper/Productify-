# Renter flow — task list (resume file)

Find the first task not `[x]`, read its notes, continue. Update after every step.
Rule from the user: ask before anything new; these were approved on 2026-11-02.

Status: `[ ]` not started · `[~]` in progress · `[x]` done · `[?]` waiting for the user

## Decisions (user, 2026-11-02)
- Rentals page: live status badges, "available now" count, auto-refresh, filters, "notify me when a
  GPU is free".
- **Vast.ai permission received by phone call** (2026-11-02). Ask Vast to confirm in writing by
  email for the records. Use providers to supply machines.
- JupyterLab: move to a **waitlist** (not "on the way").
- Files: save renters' files to **Cloudflare R2** before a GPU is stopped.
- Emails via **Resend** from noreply@productifynow.com: email verification, sign-up confirmation,
  instance started/stopped, credits running low, receipts.

## Tasks
- [x] 1. Rentals page: badges, available-now count, available first, auto-refresh (30 s, paused in
      background tabs), filters (GPU, min VRAM, location, available now). Notes: live 2026-11-02 (e462dad).
- [x] 2. JupyterLab → waitlist wording (FAQ, templates) + "join the JupyterLab waitlist". Notes: live (e462dad); waitlist form asks to mention JupyterLab.
- [~] 3. Emails: backend Resend client (RESEND_API_KEY in Render env, set by the user), templates,
      verify-email flow, sign-up confirmation, instance started/stopped, credits low, receipts. Notes: code live (bbafe73). Emails only log until RESEND_API_KEY is set in Render (user). Not yet: free-credit/receipt for claims; verified email not required for anything yet.
- [x] 4. "Notify me when a GPU is free": subscribe on the rentals page / machine page; email when
      it becomes available (needs 3). Notes: live (d629525); emails need RESEND_API_KEY.
- [ ] 5. Save files to R2 before stop: "Save my files" on the instance page; on stop, archive the
      workspace to R2 (per-user prefix, expiry), download link; restore on next start. Needs an R2
      bucket + keys in Render env (user). Notes: —
- [ ] 6. Vast.ai machines rentable: list live Vast offers on /rentals (labelled), rent through the
      Vast API on our account, exec/terminal via the instance, billing with Productify credits,
      stop destroys the Vast instance. Notes: —
