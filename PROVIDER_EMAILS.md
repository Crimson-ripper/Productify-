# Provider emails — drafts for the user to send

Fill in the `[TODO]` parts before sending. Not sent by Claude.

---

## 1. TensorDock — Whitelabel / written permission

**To:** TensorDock support / partnerships (the "Contact us" route on https://docs.tensordock.com/whitelabel/overview.md)
**Subject:** Whitelabel / reseller permission for a bring-your-own-game streaming service

Hello TensorDock team,

I run Productify (https://www.productifynow.com), a GPU compute marketplace. We are building
Gamezone, a service where users stream games **they already own** (they sign in to their own
Steam/Epic accounts) from a rented GPU machine to their own PC, using our
Moonlight-based client, PG Connect. We do not supply or license any games.

Your site lists cloud gaming as a supported workload and your docs cover Parsec, Moonlight and
Sunshine on Windows VMs, so TensorDock looks like a very good fit. Your Terms of Service (§3.2) and
AUP (§8) say compute may not be resold without your written permission, so before we list any
TensorDock machines to our users we would like to ask:

1. Can Productify join your Whitelabel program, or get written permission to offer TensorDock
   Windows VMs to our users under the Productify / Gamezone brand?
2. Is bring-your-own-game streaming (Windows VM + NVENC + Sunshine) acceptable on your hosts,
   including the outbound video bandwidth it uses (about [TODO: e.g. 20–50 Mbps] per session)?
3. Can we use your API to read live availability (GPU model, VRAM, CPU, RAM, location) so our users
   see accurate stock, and what rate limits apply?
4. Which hosts or GPU types do you recommend for this (data-centre vs consumer GPUs)?

Expected volume to start: [TODO: e.g. a closed pilot of 20–50 users, a few concurrent sessions].

Thank you,
[TODO: your name]
Productify — [TODO: email / phone]

---

## 2. Vast.ai — confirm reselling for game streaming

**To:** Vast.ai support ([TODO: support address from your Vast.ai account / https://vast.ai contact page])
**Subject:** Confirming permitted use: bring-your-own-game streaming offered to our users

Hello Vast.ai team,

Productify (https://www.productifynow.com) already rents Vast.ai instances for testing (account:
[TODO: account email / ID]). We are building Gamezone, where our users stream games **they already
own** (their own Steam/Epic logins) from a GPU machine to their own PC with our Moonlight-based
client. We supply no games.

We would like to rent Vast.ai instances through the API on our users' behalf and show live
availability (GPU model, location) on our site. Before doing so publicly, could you confirm in
writing:

1. That offering Vast.ai instances to our own customers as part of our service is allowed, given the
   "service bureau" / "compete with Company" wording in Prohibited Activities item 10 of your Terms
   (version 1 Sep 2026).
2. That game streaming (Sunshine + NVENC, outbound video) is an acceptable workload on your hosts.
3. Whether showing live offer data (GPU model, count, location) to our users is allowed under the
   data-redistribution limits in the same item, and any API rate limits we should respect.

Thank you,
[TODO: your name]
Productify — [TODO: email / phone]
