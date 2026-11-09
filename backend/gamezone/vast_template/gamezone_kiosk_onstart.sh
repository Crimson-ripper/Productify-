#!/bin/bash
# Productify Gamezone kiosk for Vast's "Ubuntu Desktop (VM)" image (docker.io/vastai/kvm:ubuntu_desktop_*).
# Runs once as root on first boot (Vast onstart; VMs need this shebang).
#
# Result: a locked-down "player" session that shows only Steam Big Picture (or the Epic launcher)
# through Sunshine. No desktop, panel, terminal or sudo for the player.
#
# Settings come from the template / launch env (written by Vast to /etc/environment):
#   GZ_SUNSHINE_USER, GZ_SUNSHINE_PASS  Sunshine web-UI login (generate per session; never reuse)
#   GZ_PLAYER_PASS                      password for the kiosk user (random per session)
#   GZ_HEROIC_VERSION                   Heroic (Epic/GOG) AppImage version, e.g. 2.18.1 (optional)
#   GZ_RESOLUTION                       e.g. 1920x1080 (default)
#   GZ_WG_PORT                          WireGuard UDP port (optional; normally detected, see step 6)
#   GZ_WG_NET                           tunnel /24, default 10.77.0 (host .1, client .2)
#
# STATUS: tested 2026-11-09 on an RTX 5060 VM (Quebec) streaming to a PC in India: kiosk login,
# Steam Big Picture, Sunshine (NVENC) and the WireGuard tunnel worked end to end with official
# Moonlight 6.2. The fixes found that day are in this file (each marked "2026-11-09").
# See STREAMING_TEST_PLAN.md, "Kiosk template".
set -uo pipefail
exec > >(tee -a /var/log/gamezone-setup.log) 2>&1
echo "[gamezone] setup start $(date -Is)"
set -a; . /etc/environment 2>/dev/null; set +a

PLAYER=player
RES="${GZ_RESOLUTION:-1920x1080}"
rand() { head -c 32 /dev/urandom | base64 | tr -dc A-Za-z0-9 | head -c "${1:-24}"; }
SUN_USER="${GZ_SUNSHINE_USER:-gzadmin}"
SUN_PASS="${GZ_SUNSHINE_PASS:-$(rand 24)}"
PLAYER_PASS="${GZ_PLAYER_PASS:-$(rand 24)}"

# 1. Lock the image's default desktop account (Vast ships user/password) and create the kiosk user.
if id user >/dev/null 2>&1; then passwd -l user || true; fi
id "$PLAYER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$PLAYER"
echo "$PLAYER:$PLAYER_PASS" | chpasswd
for g in input video audio render; do getent group "$g" >/dev/null && usermod -aG "$g" "$PLAYER"; done
deluser "$PLAYER" sudo 2>/dev/null || true

# 2. Virtual input for Sunshine (keyboard, mouse, gamepads).
modprobe uinput || true
echo uinput > /etc/modules-load.d/uinput.conf
cat > /etc/udev/rules.d/85-sunshine.rules <<'EOF'
KERNEL=="uinput", SUBSYSTEM=="misc", OPTIONS+="static_node=uinput", TAG+="uaccess", GROUP="input", MODE="0660"
EOF
udevadm control --reload-rules && udevadm trigger || true

# 3. Launchers. Steam (with Proton) is preinstalled in the Vast desktop image; Heroic covers Epic/GOG.
export DEBIAN_FRONTEND=noninteractive
# The image ships without apt lists, so installs fail until an update; tolerate flaky third-party repos.
apt-get -o DPkg::Lock::Timeout=600 update -qq || true
# picom: Steam's Big Picture UI fails to draw (GLXBadPixmap) without a compositor (2026-11-09).
apt-get -o DPkg::Lock::Timeout=600 install -y -qq openbox x11-xserver-utils unclutter wireguard-tools iptables picom >/dev/null || true
if [ -n "${GZ_HEROIC_VERSION:-}" ]; then
  mkdir -p /opt/heroic
  curl -fsSL -o /opt/heroic/Heroic.AppImage \
    "https://github.com/Heroic-Games-Launcher/HeroicGamesLauncher/releases/download/v${GZ_HEROIC_VERSION}/Heroic-${GZ_HEROIC_VERSION}-linux-x86_64.AppImage" \
    && chmod 755 /opt/heroic/Heroic.AppImage || echo "[gamezone] Heroic download failed"
fi

# 4. Kiosk X session: Openbox with no menus or key bindings, Steam Big Picture kept running fullscreen.
install -d -o "$PLAYER" -g "$PLAYER" /home/$PLAYER/.config/openbox
cat > /home/$PLAYER/.config/openbox/rc.xml <<'EOF'
<?xml version="1.0"?>
<openbox_config xmlns="http://openbox.org/3.4/rc">
  <keyboard><chainQuitKey/></keyboard>
  <mouse><context name="Root"/></mouse>
  <applications><application class="*"><decor>no</decor><maximized>yes</maximized><fullscreen>yes</fullscreen></application></applications>
</openbox_config>
EOF
cat > /usr/local/bin/gamezone-session <<EOF
#!/bin/bash
xrandr -s $RES 2>/dev/null || true
xset s off -dpms
unclutter -idle 2 &
openbox --config-file \$HOME/.config/openbox/rc.xml &
picom -b --backend xrender 2>/dev/null || true
# Sunshine runs inside this session so it captures this display (a systemd user service never
# started in testing, 2026-11-09).
/usr/bin/sunshine > /tmp/sunshine.log 2>&1 &
# Steam Big Picture is the "home screen"; restart it if the player quits it.
while true; do /usr/games/steam -gamepadui -fulldesktopres; sleep 2; done
EOF
chmod 755 /usr/local/bin/gamezone-session
cat > /usr/share/xsessions/gamezone.desktop <<'EOF'
[Desktop Entry]
Name=Gamezone Kiosk
Exec=/usr/local/bin/gamezone-session
Type=Application
EOF
chown -R "$PLAYER:$PLAYER" /home/$PLAYER/.config

# Autologin the kiosk user into that session (LightDM or GDM, whichever the image uses).
if [ -d /etc/lightdm ]; then
  mkdir -p /etc/lightdm/lightdm.conf.d
  printf '[Seat:*]\nautologin-user=%s\nautologin-session=gamezone\nuser-session=gamezone\n' "$PLAYER" \
    > /etc/lightdm/lightdm.conf.d/90-gamezone.conf
elif [ -f /etc/gdm3/custom.conf ]; then
  sed -i "s/^#\?\s*AutomaticLoginEnable.*/AutomaticLoginEnable=true/; s/^#\?\s*AutomaticLogin\s*=.*/AutomaticLogin=$PLAYER/" /etc/gdm3/custom.conf
  printf '[User]\nSession=gamezone\n' > /var/lib/AccountsService/users/$PLAYER
fi
# The 2025-11-21 VM image actually runs SDDM (seen in T-K2: user "user" on DISPLAY=:0).
if [ -d /etc/sddm.conf.d ] || command -v sddm >/dev/null 2>&1; then
  mkdir -p /etc/sddm.conf.d
  printf '[Autologin]\nUser=%s\nSession=gamezone\nRelogin=true\n' "$PLAYER" > /etc/sddm.conf.d/90-gamezone.conf
  # The image's own autologin.conf (user "user", Plasma) sorts after 90-gamezone.conf and wins (2026-11-09).
  rm -f /etc/sddm.conf.d/autologin.conf
fi

# Remove terminals and the file manager from the player's reach.
for t in xterm gnome-terminal konsole xfce4-terminal lxterminal tilix kitty; do
  [ -x /usr/bin/$t ] && chmod o-x /usr/bin/$t
done

# 5. Sunshine: only the launchers are listed as apps (no "Desktop"); web UI only from this machine.
SUNCONF=/home/$PLAYER/.config/sunshine
install -d -o "$PLAYER" -g "$PLAYER" "$SUNCONF"
cat > "$SUNCONF/sunshine.conf" <<EOF
sunshine_name = Productify Gamezone
encoder = nvenc
origin_web_ui_allowed = pc
min_log_level = info
# 2026-11-09: NvFBC isn't available on GeForce cards; use X11 capture.
capture = x11
# 2026-11-09: with no panel to host it, the tray icon blocks session start (no RTSP reply, then a crash).
system_tray = disabled
EOF
# Steam runs constantly in the kiosk session, so its app only shows the screen: launching
# "steam://open/bigpicture" again blanked Steam's window (2026-11-09). Absolute paths only for others.
APPS='{"env":{},"apps":[{"name":"Steam","image-path":"steam.png"}'
[ -x /opt/heroic/Heroic.AppImage ] && APPS="$APPS"',{"name":"Epic Games (Heroic)","cmd":"/opt/heroic/Heroic.AppImage --no-sandbox --fullscreen","auto-detach":"true"}'
echo "$APPS]}" > "$SUNCONF/apps.json"
chown -R "$PLAYER:$PLAYER" "$SUNCONF"
SUNBIN=$(command -v sunshine || ls /usr/bin/sunshine* 2>/dev/null | head -1)
if [ -n "$SUNBIN" ]; then
  sudo -u "$PLAYER" "$SUNBIN" --creds "$SUN_USER" "$SUN_PASS" >/dev/null 2>&1 || true
  # Sunshine itself is started by gamezone-session (step 4).
else
  echo "[gamezone] WARNING: sunshine binary not found in the base image"
fi

# 6. Store per-session secrets for the Productify backend to read over SSH, root-only.
umask 077
printf 'SUNSHINE_USER=%s\nSUNSHINE_PASS=%s\nPLAYER_PASS=%s\n' "$SUN_USER" "$SUN_PASS" "$PLAYER_PASS" > /root/gamezone-secrets
umask 022

# 7. WireGuard tunnel for Productify Connect (merged from productify-connect's
#    client/tools/host/gamezone-wireguard-setup.sh). Vast maps ports randomly, but Moonlight/Sunshine
#    need fixed TCP+UDP ports. The template asks for one identity-mapped UDP port ("-p 741641:741641/udp";
#    741641 is a placeholder, Vast picks the real number, e.g. 54879 <-> 54879 in T-K2). WireGuard
#    listens there and Sunshine's ports are reachable only inside the tunnel.
#    Port lookup, in order: GZ_WG_PORT; an identity entry in Vast's env (VAST_UDP_PORT_<n>=<n>);
#    VAST_UDP_PORT_741641; the image's tailscaled PORT, which Vast sets to the identity port (seen in T-K2).
#    The backend still resolves the port from the instance's ports map and can compare with WG_PORT below.
WG_NET="${GZ_WG_NET:-10.77.0}"
WG_PORT="${GZ_WG_PORT:-}"
if [ -z "$WG_PORT" ]; then
  while IFS='=' read -r k v; do
    [ "${k#VAST_UDP_PORT_}" = "$v" ] && { WG_PORT=$v; break; }
  done < <(env | grep '^VAST_UDP_PORT_[0-9]*=[0-9]*$')
fi
[ -z "$WG_PORT" ] && WG_PORT="${VAST_UDP_PORT_741641:-}"
TS_DEFAULTS=/etc/default/tailscaled
if [ -z "$WG_PORT" ] && [ -f "$TS_DEFAULTS" ]; then
  WG_PORT=$(sed -n 's/^PORT="\{0,1\}\([0-9]*\)"\{0,1\}.*/\1/p' "$TS_DEFAULTS" | head -1)
fi
# tailscaled (logged out) already listens on the identity port; Gamezone uses it for WireGuard instead.
systemctl disable --now tailscaled 2>/dev/null || true
if ! [[ "$WG_PORT" =~ ^[0-9]+$ ]] || [ "$WG_PORT" -lt 1 ] || [ "$WG_PORT" -gt 65535 ]; then
  echo "[gamezone] WARNING: no identity UDP port found (got '${WG_PORT}'); WireGuard not set up"
elif ! command -v wg >/dev/null; then
  echo "[gamezone] WARNING: wireguard-tools not installed; WireGuard not set up"
else
  umask 077
  mkdir -p /etc/wireguard
  [ -f /etc/wireguard/host.key ] || wg genkey > /etc/wireguard/host.key
  wg pubkey < /etc/wireguard/host.key > /etc/wireguard/host.pub

  # Sunshine's ports: reachable only through wg0 (and loopback); everything else on them is dropped.
  # Applied from PostUp so the rules come back after a reboot.
  cat > /usr/local/sbin/gamezone-wg-firewall <<EOF
#!/bin/bash
SUN_TCP="47984,47989,47990,48010"
SUN_UDP="47998:48000,48002,48010"
for chain in "-p tcp -m multiport --dports \$SUN_TCP" "-p udp -m multiport --dports \$SUN_UDP"; do
  iptables -C INPUT -i wg0 \$chain -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -i wg0 \$chain -j ACCEPT
  iptables -C INPUT -i lo  \$chain -j ACCEPT 2>/dev/null || iptables -I INPUT 2 -i lo  \$chain -j ACCEPT
  iptables -C INPUT \$chain -j DROP 2>/dev/null || iptables -A INPUT \$chain -j DROP
done
iptables -C INPUT -p udp --dport $WG_PORT -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p udp --dport $WG_PORT -j ACCEPT
EOF
  chmod 700 /usr/local/sbin/gamezone-wg-firewall

  cat > /etc/wireguard/wg0.conf <<EOF
[Interface]
Address = ${WG_NET}.1/24
ListenPort = ${WG_PORT}
# 2026-11-09: Vast VM networking carried no more than ~1450-byte packets; at the default 1420 the
# tunnelled video packets were dropped and the stream stayed black.
MTU = 1280
PrivateKey = $(cat /etc/wireguard/host.key)
PostUp = /usr/local/sbin/gamezone-wg-firewall
EOF
  systemctl enable --now wg-quick@wg0 || echo "[gamezone] WARNING: wg-quick@wg0 failed to start"

  # Per-session peer management, called by the Productify backend over SSH:
  #   gamezone-wg-peer add <client_public_key>     -> prints the client's tunnel address
  #   gamezone-wg-peer remove-all                  -> at session end
  cat > /usr/local/sbin/gamezone-wg-peer <<EOF
#!/bin/bash
set -euo pipefail
case "\${1:-}" in
  add)
    [[ "\${2:-}" =~ ^[A-Za-z0-9+/]{43}=\$ ]] || { echo "bad key" >&2; exit 2; }
    for p in \$(wg show wg0 peers); do wg set wg0 peer "\$p" remove; done   # one player per machine
    wg set wg0 peer "\$2" allowed-ips ${WG_NET}.2/32
    echo ${WG_NET}.2/32 ;;
  remove-all)
    for p in \$(wg show wg0 peers); do wg set wg0 peer "\$p" remove; done ;;
  *) echo "usage: \$0 add <pubkey> | remove-all" >&2; exit 2 ;;
esac
EOF
  chmod 700 /usr/local/sbin/gamezone-wg-peer

  printf 'WG_PUBLIC_KEY=%s\nWG_PORT=%s\nWG_HOST_ADDRESS=%s.1\n' "$(cat /etc/wireguard/host.pub)" "$WG_PORT" "$WG_NET" >> /root/gamezone-secrets
  echo "[gamezone] wireguard ready on udp/$WG_PORT"
fi

echo "[gamezone] setup done $(date -Is); rebooting into kiosk session"
touch /var/lib/gamezone-ready
systemctl restart display-manager 2>/dev/null || reboot
