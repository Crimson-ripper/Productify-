# Gamezone — GPU provider review

Researched 2026-10-24 from each provider's own terms pages (task 1.1–1.3 in `GAMEZONE_TASKS.md`).
This is a reading of public documents, **not legal advice**. Anything marked "ask" needs a written
answer from the provider before we list their machines.

Questions for every provider:
**Resell** = may we offer their machines to our users? · **Gaming** = is game streaming allowed?
· **API** = can we read live stock with GPU model + location? · **Win** = Windows / full VM?

## Summary

| Provider | Resell | Gaming | API (live stock) | Win | Terms date | Verdict |
|---|---|---|---|---|---|---|
| **Productify Node** (ours) | yes (our own) | yes (our rules) | yes (ours) | Linux containers today | — | **Use now** (see NVIDIA note) |
| **TensorDock** | no, without written permission; *Whitelabel* program for partners | marketed ("cloud gaming"; Parsec/Moonlight/Sunshine guide; airgpu built on it) | yes, API with availability; 100+ locations | yes, Windows VMs | AUP 27 Jun 2024, ToS 24 Sep 2024 | **Best candidate — ask for Whitelabel / written OK** |
| **Vast.ai** | not banned; "service bureau / compete" clause is unclear | not mentioned | yes (we already use it) | mostly Linux containers | 1 Sep 2026 | **Ask in writing**; OK for tests |
| **SaladCloud** | raw resale needs written agreement; own services built on it allowed | not mentioned | yes (API) | containers | 29 Sep 2026 | Ask; containers only |
| **RunPod** | needs written consent; reseller accounts exist | not mentioned | API (scripts restricted without consent) | containers / some VMs | 24 Mar 2026 | Ask |
| **Hetzner** | **allowed** (§7.1 third-party use) | not mentioned | cloud API; GPU servers are dedicated | no Windows on GPU servers; pro cards (RTX PRO) | 27 Oct 2021 | Possible later for fixed EU capacity (Helsinki/Falkenstein) |
| **Hostkey** (NL) | reseller program exists | **live streaming needs Hostkey approval** | panel + API | yes | 2019–2022 | Ask |
| **Akash** | not addressed | "Gaming/streaming" listed for RTX 4080 | on-chain provider data | containers only, no Windows | none | Later; Linux-only games |
| **OVHcloud** | reseller/wholesale modes exist; contract PDFs not read | game *servers*, not cloud gaming | API | VMs, pro GPUs | none | Later; read contracts first |
| **immers.cloud** (Russia) | third-party access allowed | **marketed for gaming** | OpenStack API | yes | 21 Mar 2024 | **Avoid** — Russian company, Russian-only binding terms; possible sanctions/payment problems |
| **Lambda** | **forbidden** | — | — | — | Aug 2025 | Out |
| **E2E Networks** (India) | **forbidden** (resale/time-sharing) | — | — | — | undated | Out for resale |
| **Shadeform** | **forbidden** | — | — | — | — | Out |
| Clore.ai, Genesis Cloud | could not read terms (404 / SSL error) | ? | ? | ? | — | Re-check later |

## The NVIDIA driver licence (affects everyone)

NVIDIA GeForce software licence, v. 25 Feb 2025, exact wording:
- "you may not sell, rent, sublicense, distribute or transfer the SOFTWARE **or provide commercial
  hosting services with the SOFTWARE**."
- 2.8: GeForce or Titan SOFTWARE "(i) is licensed for use only on GeForce or Titan hardware
  products you own, and (ii) **is not licensed for datacenter deployment**."
- 1.1(c) allows deploying it "for your own use … on infrastructure you own or lease".

What this means for us (to confirm with a lawyer):
- Consumer GeForce cards (RTX 3060/4090/5090) rented out commercially are a grey area **for the
  whole GPU-rental market**, including Vast.ai and Productify Node hosts. Providers that offer them
  carry that risk; we inherit some of it by reselling.
- Data-centre / pro cards (RTX PRO, L4, L40S, A10) use NVIDIA's data-centre drivers and licences
  instead, and are the clean route for scale (Hetzner, OVH, cloud providers). NVIDIA's own
  vGPU/"cloud gaming" licensing applies there.
- Productify Node: hosts own their cards and run them at home (not a data centre), but renting
  them out may still count as "commercial hosting services". Needs legal review before Gamezone is public.

## Recommendation

1. **Now (preview):** Productify Node + Vast.ai (already integrated) as data sources, behind the
   preview branch only.
2. **Email TensorDock** about the Whitelabel program / written permission to list their Windows
   VMs for bring-your-own-game streaming. This is the strongest match for Gamezone.
3. **Email Vast.ai** to confirm reselling for game streaming is fine under the "service bureau" clause.
4. Get a short legal opinion on the NVIDIA GeForce licence before going public.
5. Later: Hetzner/OVH for pro-GPU capacity; Salad/RunPod/Hostkey if they give written approval.

## Sources (read 2026-10-24)
- Vast.ai terms: https://vast.ai/terms
- TensorDock AUP: https://docs.tensordock.com/legal-information/acceptable-use-policy-aup ·
  ToS: https://docs.tensordock.com/legal-information/terms-of-service-tos.md ·
  Whitelabel: https://docs.tensordock.com/whitelabel/overview.md ·
  streaming guide: https://docs.tensordock.com/virtual-machines/using-parsec-moonlight-and-sunshine.md ·
  site: https://www.tensordock.com/cloud-gpus.html
- RunPod ToS: https://www.runpod.io/legal/terms-of-service
- Lambda ToS: https://lambda.ai/legal/terms-of-service
- SaladCloud ToS: https://salad.com/terms/saladcloud/
- Hetzner T&C: https://www.hetzner.com/legal/terms-and-conditions · GPU: https://www.hetzner.com/dedicated-rootserver/matrix-gpu/
- OVHcloud: https://www.ovhcloud.com/en/terms-and-conditions/contracts/ · https://www.ovhcloud.com/en/public-cloud/gpu/
- E2E Networks ToS: https://www.e2enetworks.com/policies/terms-of-service
- Akash: https://akash.network/docs/learn/core-concepts/gpu-deployments · https://akash.network/pricing/gpus/
- Hostkey: https://hostkey.com/gpu-dedicated-servers/cloud-gpu-gaming/ · https://hostkey.com/about-us/legal/
- immers.cloud: https://en.immers.cloud/terms/
- Shadeform ToS: https://shadeform.com/terms-of-service
- NVIDIA GeForce licence: https://www.nvidia.com/en-us/drivers/geforce-license/
