# Gamezone streaming — stretch test plan

Status: **internal test plan, not a product promise.** Gamezone stays paused on the live site
(`/games/play` returns 503) until these tests pass. Nothing here may be advertised (CLAUDE.md rule 4).

Goal: find out how far one rented GPU can be stretched for Gamezone, in three modes:

| Mode | What the players see | Example |
|---|---|---|
| **A. One player, one machine** | Their own private game in the browser or Moonlight | Baseline (already working) |
| **B. Shared co-op** | Several players stream *the same* game/screen, each with their own controller | SuperTuxKart 4-player split-screen |
| **C. Many players, one GPU, separate games** | Each player gets their own private desktop + game on a shared GPU | 3–8 light games on one RTX 3090 |
| **D. On-demand game server** | Players run the game on their own PC and join a server we start | SuperTuxKart / Minetest / Xonotic server |

---

## 1. What we already know (measured 2026-10-21, instance 57080935, RTX 3090, India)

| Fact | Measured | Impact |
|---|---|---|
| Container boot (rent → `running`) | ~16 s | fast |
| Rent → desktop services up | ~3–4 min (portal update + pip install on first boot) | needs a custom image / warm pool |
| GPU rendering in container | ✅ OpenGL renderer = RTX 3090 (via VirtualGL on Xvfb) | |
| NVENC in container | ✅ `nvh264enc` selected, `NVIDIA_DRIVER_CAPABILITIES=all` | |
| `/dev/uinput` in container | ❌ missing | **Sunshine cannot inject keyboard/mouse/gamepads in a Vast container.** Selkies works because it injects through X11. |
| Docker socket in container | ❌ none | Can't run per-user containers (e.g. Games-on-Whales *Wolf*) inside a container |
| Port mapping | random external ports, TCP only in this template (e.g. 72299 → 14049) | **Moonlight needs fixed TCP+UDP ports** → not workable in a container |
| CPU on this host | 4 cores, 23 GB RAM | CPU, not GPU, will limit Mode C here |
| Driver | 580.178.04 | consumer NVENC concurrent-session cap applies (believed to be 8 on recent drivers — **verify in T-C2**) |
| Viewers per Selkies desktop | 1 (a second viewer is refused/kicked) | Mode B needs Sunshine multi-client or a shared-session setup |

### Boot-time runs (2026-10-21, `vast_session.py launch`, reports in `test_reports/gamezone/`)

| Phase (s from rent) | TH 3060 | TH 3060 (2nd) | VN 3060 | VN 3070 | IN 3060 (unverified) |
|---|---|---|---|---|---|
| container running | 42 | 48 | 329 | 44 | 416 |
| SSH ready | 159 | 122 | 358 | 110 | 470 |
| desktop ready | 212 | 161 | 398 | **935** | 550 |
| game running | **309** | **298** | **519** | failed (apt) | **692** |

Boot time is dominated by downloads we don't control: image pull on uncached hosts (up to ~7 min),
NVIDIA driver userspace libs fetched at first boot to match the host driver (~13 min on VN 3070),
Vast's first-boot apt runs (PPA 503s seen), and the game install (1.5–2.3 min).
Search results go stale: 2 of 3 India attempts hit "no_such_ask"; India had only 1 rentable GPU.

### NVENC is not guaranteed in Vast containers
TH 3060 (host driver 580.65.06): GStreamer sees "supports NVENC: yes" but `NvEncOpenEncodeSessionEx`
fails with error 2, so no `nvh264enc`. Selkies then exits on every viewer connect. The launcher now
tests NVENC after boot and falls back to `x264enc` (CPU). Re-check whether VM hosts expose NVENC.

### First lag probe (A2-style, TH 3060, x264enc, 1080p, game menu, Delhi client, 60 s)

| Metric | Result | Target |
|---|---|---|
| Round trip | p50 131 ms, p95 142 ms | ≤ 60 ms (India host) / ≤ 120 ms (SE Asia) |
| Frame rate | avg 56.7, min 7.9 | ≥ 55 |
| Packet loss | **15.1 %** | < 1 % |
| Freezes | 11 (3.7 s total), 46 dropped frames | 0 |
| Bitrate | 0.9 Mbps (mostly static menu) | — |
| Time to first frame | 22.6 s after page load | ≤ 5 s |
| Path | direct UDP (prflx), not TURN relay | — |

Verdict: **not yet playable quality** — loss/freezes need investigating (route, CPU encoder settings,
TURN-over-TCP vs UDP) before blaming distance. Repeat with a moving scene and on an India host.

### E2E Networks Delhi, 1x Tesla T4 VM (2026-10-22, ₹30/hr) — first playable-quality result

| Check | Result |
|---|---|
| Boot | Running ~2.2 min, SSH ~4.3 min after create (no image pull: full VM) |
| `/dev/uinput` | ✅ present (VM) — Sunshine/Moonlight and virtual gamepads possible |
| NVENC | ✅ works (ffmpeg h264_nvenc and GStreamer nvh264enc) |
| GPU OpenGL | ✅ Xorg on the VM: Tesla T4, OpenGL 4.6 (drop `UseDisplayDevice None`; the Selkies container's own Xorg fails GLX) |
| Firewall | VM iptables allows only tcp 22/80/443 inbound; WebRTC still connected **direct over UDP** via ICE (no new ports opened); TURN on tcp/443 as fallback |

Lag probe (A2, Delhi client → Delhi T4, 1080p60 H.264 NVENC, game menu, 60 s):

| Metric | Result | Target |
|---|---|---|
| Round trip | **p50 29 ms, p95 44 ms**, max 87 | ≤ 60 ms ✅ |
| Frame rate | **avg 58**, min 41 | ≥ 55 ✅ |
| Packet loss | **0.36 %** | < 1 % ✅ |
| Freezes | 1 (0.4 s), 2 dropped frames | 0 ⚠️ |
| Client delay | buffer 0.4 ms + decode 1.4 ms | — |
| Host GPU / encoder | 22 % / 17 % avg (31 % max) | headroom for more sessions |
| Time to first frame | 27 s after page load | ≤ 5 s ❌ (signalling/ICE setup; investigate) |

Gotcha found during hands-on play: with no PulseAudio server the Selkies audio pipeline fails, the web
client stays on "Waiting for stream" (video plays, but **no mouse/keyboard input is ever sent**). Fix:
run PulseAudio on the VM (`module-native-protocol-tcp` on 127.0.0.1:4713 + a null sink) and start the
streamer with `PULSE_SERVER=tcp:127.0.0.1:4713`. Also size the game window to the full 1920x1080 display.

Verdict: **meets the A2 targets** — first configuration that looks playable for Delhi players.
Bitrate was only 0.1 Mbps because the menu is mostly static; repeat during a race (A2 with motion)
and with Sunshine + Moonlight (A4, B1) on the same VM.

**Conclusion so far:** Sunshine + Moonlight needs the **Vast VM template** (real virtual machine:
uinput, own ports, Docker allowed). Containers are fine for Mode A with browser streaming (Selkies).

---

## 2. Test cases

Each test records: host/offer id, region, GPU, price, start/end time, and the metrics in §3.
Pass/fail thresholds are starting targets for a *non-competitive* game; tighten later.

### Mode A — baseline, one player
| ID | Test | Pass if |
|---|---|---|
| A1 | Boot timing: rent → running → SSH → desktop → game → first video frame | total ≤ 5 min (cold), ≤ 30 s (warm pool) |
| A2 | 10-min play session from Delhi, India host, browser (Selkies) | RTT p95 ≤ 60 ms, ≥ 55 fps, packet loss < 1 % |
| A3 | Same as A2 from a Vietnam/Thailand host | records the cost of distance (expect RTT +60–90 ms) |
| A4 | Same as A2 but Moonlight + Sunshine on a **VM** host | compare to A2; Moonlight expected lower latency |
| A5 | Bandwidth ladder: 5 / 10 / 20 Mbps cap on the client | playable at ≥ 10 Mbps 1080p |
| A6 | Network drop: kill client Wi-Fi 10 s, reconnect | session resumes, game still running, metering continues correctly |
| A7 | Stop → destroy → bill | instance gone in Vast within 60 s, usage record matches |

### Mode B — shared co-op (one game, several controllers)
| ID | Test | Pass if |
|---|---|---|
| B1 | Sunshine on VM: 2 Moonlight clients connect to the same desktop (`channels = 2`) | both see video, both can provide input |
| B2 | Each client's gamepad appears as a separate controller | SuperTuxKart sees Player 1 and Player 2 |
| B3 | Scale to 3 and 4 clients | record fps, encoder %, CPU %, RTT per client |
| B4 | Clients in different cities (Delhi + one remote tester) | both playable, no one > 120 ms RTT |
| B5 | Host leaves / one client drops | game continues for the others |
| B6 | Abuse check: client 2 tries keyboard shortcuts to reach the desktop/terminal | blocked (kiosk mode) |

### Mode C — many players, separate games, one GPU
| ID | Test | Pass if |
|---|---|---|
| C1 | VM + per-user isolated sessions (Wolf, or N × Sunshine on N virtual displays) | 2 independent sessions run |
| C2 | Increase to N = 3, 4, 6, 8 sessions of a light game | find N where any session drops < 50 fps or encoder errors appear |
| C3 | Isolation: user 1 cannot see user 2's files, processes, screen, or audio | no cross-access |
| C4 | Noisy neighbour: one session runs a heavy game | other sessions still ≥ 50 fps |
| C5 | Cost per player-hour at the max stable N | must beat Mode A price per player |

### Mode D — on-demand game servers
| ID | Test | Pass if |
|---|---|---|
| D1 | Start a SuperTuxKart server via onstart script; clients join from home | joinable within 2 min of rent |
| D2 | Players per server: 2 / 4 / 8 | tick rate stable, CPU < 80 % |
| D3 | Cheapest suitable host (CPU-only / small GPU) | compare with a normal VPS price — use whichever is cheaper |
| D4 | Auto-shutdown when empty for 10 min | instance destroyed, bill stops |

### Kiosk template (Vast VM + Sunshine) — `backend/gamezone/vast_template/`
Base: Vast's "Ubuntu Desktop (VM)" image `docker.io/vastai/kvm:ubuntu_desktop_22.04-2025-11-21`
(ships Steam+Proton, Sunshine, Selkies, Tailscale). `gamezone_kiosk_onstart.sh` adds a no-sudo
`player` kiosk session (Openbox, Steam Big Picture fullscreen, optional Heroic for Epic), Sunshine with
only launcher apps (no Desktop app) and web UI limited to the machine, uinput rules, per-session secrets,
and a WireGuard tunnel on the identity UDP port for Productify Connect (`gamezone-wg-peer` for per-session peers).
Host selection: `vast_gaming_filter.py` profiles (esports / 1080p-high / 1440p-ultra) — **check the CPU
model too** (see T-K2 below).

| ID | Test | Pass if |
|---|---|---|
| T-K1 | Boot a VM with the kiosk onstart; check `/var/log/gamezone-setup.log` | setup completes, display manager autologins `player` into the Gamezone session |
| T-K2 | Moonlight → Sunshine over a WireGuard tunnel on the identity UDP port | pairs, streams 1080p60 with NVENC, input works — **✅ passed (functional) 2026-10-22**, see below |
| T-K3 | Escape attempts: Alt+Tab, Alt+F4, Ctrl+Alt+T, Steam's "Exit to desktop", Steam browser | player never reaches a desktop, terminal or file manager |
| T-K4 | Install + play GTA V (story) and a co-op title from the player's own Steam library | 1080p60 High, ≥ 55 fps |
| T-K5 | Session end: destroy VM | no player data or Steam login survives |

#### T-K2 result (2026-10-22, instance 57226505) — passed, functional only
Host: Vast VM, RTX 3060 (driver 580.105.08), Intel Xeon E5-2680 v2 (9 vCPU), 49 GB RAM, Quebec CA,
$0.1437/h, official "Ubuntu Desktop (VM)" template. Client: Productify Connect dev build (Moonlight fork)
on a Windows 10 laptop in India, mock backend. Report: `productify-connect/test_reports/20261022-vast-vm-TK2-productify-connect.json`.

| Check | Result |
|---|---|
| Boot | rent → running ~15 min (VM image pull on this host); SSH ready right after |
| Session code → WireGuard tunnel on the identity UDP port | ✅ (after client fixes) |
| Automatic pairing with a one-time PIN (backend submits it to Sunshine on the VM) | ✅; reconnect skips pairing ✅ |
| App launch | ✅ after host fix: Sunshine's PATH lacks `/usr/games` ("Unable to find executable [steam]") |
| Video | 1920x1080 @ 60, H.264 NVENC → D3D11VA, 20 Mbps |
| Audio / mouse + keyboard | ✅ (audio with losses) / ✅ confirmed by the player |
| Stream end | stream events received; tunnel service and config removed on exit |
| Tunnel ping | avg 438 ms (380–611) — host on another continent; **quality not representative** |

Host findings (now in `gamezone_kiosk_onstart.sh` / `create_template.py`; they were applied by hand on the test VM):
- **Identity port:** the template's `-p 741641:741641/udp` became **54879/udp ↔ 54879**. 741641 is a
  placeholder (> 65535); Vast picks the number. The backend reads it from the instance's `ports` map
  (`"54879/udp": [{"HostPort": "54879"}]`); the onstart detects it from Vast's env or `/etc/default/tailscaled`.
- **tailscaled** in the image already listens on that identity port (`/etc/default/tailscaled` `PORT`):
  stop and disable it before WireGuard binds the port.
- **No apt lists** in the image: run `apt-get update` before installing (e.g. `wireguard-tools`).
- **Sunshine apps** must use absolute paths (`/usr/games/steam ...`).
- Sunshine 2025.924 is installed but not running by default; the image's desktop is user `user` on
  `DISPLAY=:0` via **SDDM** (the onstart now also writes an SDDM autologin — untested).
- **Creating VMs:** Vast requires an SSH key on the **account** (not just the instance). Create with
  `template_hash_id` — the official VM template is `715c192fc2a112574ae5a9efb8c46b3b`; creating with the
  raw image and no `template_hash_id` failed with `no_such_ask`.
- **Filter offers by CPU model, not only GPU:** old Xeons such as the E5-2680 v2 are too slow for modern
  games (fine for this functional test only).

Not covered: kiosk lockdown (the stock `user` desktop was used — T-K1/T-K3), quality from a nearby
host with a modern CPU, real Productify backend endpoints (mock used), and a full run of the updated onstart.

#### T-K1 + T-K2 rerun (2026-11-09, instance 59868530) — kiosk streams end to end
Host: Vast VM, RTX 5060 (driver 580.105.08), Xeon W-2133, Quebec CA, $0.136/h, official VM template
plus `gamezone_kiosk_onstart.sh`. Client: Windows 10 PC in India; official Moonlight 6.2.0 and
PG Connect 0.1.2 (classic UI), manual WireGuard tunnel, PIN submitted to Sunshine's API over SSH.

Result: the kiosk session (`player`, Openbox, Steam Big Picture) streamed to the PC through the tunnel
at 720p60 / 5 Mbps; only Steam and Epic (Heroic) were offered; the player has no sudo. Setup took
263 s after rent. Every fix below is now in the onstart (marked "2026-11-09") or PG Connect 0.1.3.

| Problem seen | Cause | Fix |
|---|---|---|
| Kiosk user never logged in | the image's `/etc/sddm.conf.d/autologin.conf` (user `user`) sorts after ours | delete it |
| Sunshine not running | the systemd user unit was never enabled | start Sunshine from `gamezone-session` |
| PIN refused / pairing stuck, streams froze at the last RTSP step, then "Hang detected" crash | Sunshine's tray icon blocks with no panel to host it (pairing request and session start both update it) | `system_tray = disabled` |
| NvFBC / CUDA capture errors | GeForce cards have no NvFBC | `capture = x11` |
| Steam Big Picture invisible (webhelper `GLXBadPixmap`) | no compositor under Openbox | `picom --backend xrender` in the session |
| Starting the stream blanked Steam | Sunshine re-ran `steam://open/bigpicture` | Steam app has no command; the kiosk keeps Steam open |
| Black stream, "Waiting for IDR frame" | VM path carries ≤ ~1450-byte packets; 1392-byte video + tunnel overhead were dropped | wg0 `MTU = 1280` on the host; 1024-byte video packets for tunnelled sessions (PG Connect 0.1.3) |
| Whole connection saturated, SSH timed out | 15 Mbps stream on the player's line | lower bitrate (5 Mbps worked); make it a per-session default later |

Not covered yet: a fresh VM running the updated onstart start to finish, PG Connect's join flow with
the real backend, Steam sign-in and a game (needs the player's own account), escape tests (T-K3) and
input latency.

#### First outside player (2026-11-09/10, instance 59921029) — passed
Host: Vast VM, RTX 5060 Ti, Ryzen 5 3500, Japan, $0.109/h, updated onstart with no fixes by hand
(rent → kiosk ready in 754 s; the 10 GB VM image was not cached). Player: a friend at home in India,
Windows 11, PG Connect 0.1.4 installed from the live /gamezone page (built-in tunnel: no WireGuard, no
admin prompt per session), launched with a .bat that set `PRODUCTIFY_API_BASE` to a temporary
Cloudflare quick tunnel in front of the mock backend running a private session code.

Result: ~1 hour session (stream_started 23:27, stream_ended 00:24). Signed in with their own Steam
account and played ONE PIECE Bounty Rush offline and online multiplayer. Player's verdict: lag was
noticeable but not bothersome.

Found:
- **Steam stuck on its loading screen after quitting the game:** the game's process was a zombie but
  its launcher (`GameLauncher.exe`) and Proton/wine processes kept running, so Steam thought the game
  was still open. Killing the leftover tree under `reaper SteamLaunch` fixed it at once. To do: a
  kiosk watchdog that clears a game's leftovers ~30 s after its main process exits.
- **Returning players get stuck** (dry run on the tester's own PC): PG Connect remembered an older VM
  with the same name and address `10.77.0.1`; the new VM has a new identity, so the join loop logged
  "Found unexpected PC 'Productify Gamezone'" and never paired. Clearing PG Connect's saved hosts fixed
  it. To do in PG Connect: drop a saved host at the tunnel address whose identity changed.
- **Bitrate:** PG Connect's default (~15-20 Mbps) flooded home connections; the tester set 720p / 5 Mbps
  by hand. To do: default to a lower bitrate for tunnelled sessions.
- Only VM-capable host in India was an unverified RTX 3060 with a 2016 Xeon; nearest good hosts were in
  Japan and Taiwan.

### Cross-cutting
| ID | Test | Pass if |
|---|---|---|
| X1 | Stream link only works with the per-session token; Vast Open-button token never sent to players | verified |
| X2 | Player cannot reach Jupyter / terminal / Syncthing ports | all closed or authed |
| X3 | Host disappears mid-session (Vast host offline) | player sees an error, billing stops, refund rule applied |
| X4 | Spend guard: a forgotten instance is destroyed after max session length | verified |

---

## 3. Metrics and how they are collected

| Metric | Source |
|---|---|
| Boot phases (timestamps) | Vast API polling + SSH/HTTP readiness checks (launcher script) |
| RTT, jitter, fps, packet loss, frames dropped, decode time | browser WebRTC `getStats()` via Playwright / built-in browser (Selkies); Moonlight's on-screen stats overlay (Ctrl+Alt+Shift+S) for Sunshine |
| GPU %, encoder %, VRAM | `nvidia-smi dmon -s u` on the host, logged once a second |
| CPU %, RAM | `mpstat` / `free` on the host |
| Input-to-screen latency | manual: phone slow-motion video of key press vs. screen change (sample 10 presses) |
| Cost | Vast `dph_total` × session length + storage |

Results go in `test_reports/gamezone/<date>-<test id>.json`.

## 4. Order of work
1. Launcher + boot timer (A1, A7, X4).
2. Lag probe (A2, A3, A5).
3. VM template with Sunshine (A4, B1–B6).
4. Multi-session on one GPU (C1–C5).
5. Game servers (D1–D4).
