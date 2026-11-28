#!/bin/bash
# Productify Gamezone: bake the E2E Networks GPU image (2026-11-27; tested end to end on a T4, fixes also from an L4).
# Runs once as root on a fresh E2E "Ubuntu-22.04-GPU" L4 or T4 VM. Installs everything a session needs;
# creates NO secrets. Each VM made from the saved image runs gamezone-firstboot once (fresh
# Sunshine / player / WireGuard secrets), then gamezone-kiosk on every boot.
# Every fix below was found on the E2E L4/T4 test VMs on 2026-11-27 (see ../STREAMING_TEST_PLAN.md).
# Expects /root/gamezone-game-watchdog next to it: the watchdog heredoc from
# ../vast_template/gamezone_kiosk_onstart.sh, extracted as-is.
set +e
export DEBIAN_FRONTEND=noninteractive
A="apt-get -o DPkg::Lock::Timeout=900 -y -qq"
PLAYER=player
t0=$(date +%s); log() { echo "== $* [$(( $(date +%s)-t0 ))s]"; }

log "MACHINE"
grep -m1 "model name" /proc/cpuinfo; nproc; nvidia-smi --query-gpu=name,driver_version --format=csv,noheader; lsb_release -ds

log "PACKAGES"
dpkg --add-architecture i386
$A update >/dev/null 2>&1
# xserver-xorg-input-*: without an input driver X ignored Sunshine's virtual mouse/keyboard.
$A install xserver-xorg-core xserver-xorg-input-libinput xserver-xorg-input-evdev x11-xserver-utils x11-utils \
  xdotool mesa-utils openbox unclutter pulseaudio dbus-x11 ffmpeg curl wget wireguard-tools iptables \
  xvfb xauth libfuse2 > /tmp/apt1.log 2>&1; echo "apt rc=$?"
# Heroic (Epic) is an Electron AppImage and uses the system's libraries: without these it exits at
# "libnspr4.so: cannot open shared object file" (A40, 2026-11-28). Steam brings its own.
$A install libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libgtk-3-0 libgbm1 libasound2 libxss1 \n  libxshmfence1 libdrm2 libxkbcommon0 libsecret-1-0 > /tmp/apt-heroic.log 2>&1; echo "heroic libs rc=$?"

log "NVIDIA 580 DRIVER"
# The E2E image ships a compute-only 570 driver: no X driver, and its CUDA is too old for Sunshine.
cd /tmp && wget -q -O nv580.run "https://us.download.nvidia.com/tesla/580.105.08/NVIDIA-Linux-x86_64-580.105.08.run"
rmmod nvidia_drm nvidia_uvm nvidia_modeset nvidia 2>/dev/null
sh nv580.run --silent --no-questions --kernel-module-type=open --install-libglvnd --no-nouveau-check > /tmp/nvinst.log 2>&1
echo "driver install rc=$?"
# NVIDIA's libglvnd broke Sunshine (libOpenGL.so.0: undefined symbol _glapi_tls_Current); use Ubuntu's.
$A install --reinstall libglvnd0 libopengl0 libgl1 libglx0 libegl1 libgles2 > /tmp/apt-glvnd.log 2>&1; echo "libglvnd rc=$?"
modprobe nvidia; modprobe nvidia-modeset; modprobe nvidia-uvm; modprobe nvidia-drm
nvidia-smi --query-gpu=name,driver_version --format=csv,noheader; cd /
ffmpeg -hide_banner -loglevel error -f lavfi -i testsrc2=size=1920x1080:rate=60 -t 2 -c:v h264_nvenc -f null - && echo NVENC_OK || echo NVENC_FAIL

log "PLAYER AND INPUT"
id $PLAYER >/dev/null 2>&1 || useradd -m -s /bin/bash $PLAYER
passwd -l $PLAYER >/dev/null
for g in input video audio render; do getent group $g >/dev/null && usermod -aG $g $PLAYER; done
deluser $PLAYER sudo 2>/dev/null
echo uinput > /etc/modules-load.d/uinput.conf
echo 'KERNEL=="uinput", SUBSYSTEM=="misc", OPTIONS+="static_node=uinput", TAG+="uaccess", GROUP="input", MODE="0660"' > /etc/udev/rules.d/85-sunshine.rules
for t in xterm gnome-terminal konsole xfce4-terminal lxterminal; do [ -x /usr/bin/$t ] && chmod o-x /usr/bin/$t; done

log "SUNSHINE"
# Stable release; the 2026.1123 pre-release was pulled (404).
wget -q -O /tmp/sunshine.deb "https://github.com/SunshineStream/Sunshine/releases/download/v2026.914.233613/sunshine_2026.914.233613-1%2Bubuntu22.04_amd64.deb"
$A install /tmp/sunshine.deb > /tmp/apt2.log 2>&1; echo "sunshine rc=$? $(sunshine --version 2>&1 | grep -o 'version: [0-9.]*' | head -1)"

log "STEAM"
echo steam steam/question select "I AGREE" | debconf-set-selections
echo steam steam/license note '' | debconf-set-selections
$A install steam-installer > /tmp/apt3.log 2>&1 || $A install steam > /tmp/apt3.log 2>&1
echo "steam rc=$? $(ls /usr/games/steam 2>&1)"

log "HEROIC (Epic)"
HV=$(curl -fsSL https://api.github.com/repos/Heroic-Games-Launcher/HeroicGamesLauncher/releases/latest | sed -n 's/.*"tag_name": *"v\{0,1\}\([^"]*\)".*/\1/p' | head -1)
mkdir -p /opt/heroic && curl -fsSL -o /opt/heroic/Heroic.AppImage \
  "https://github.com/Heroic-Games-Launcher/HeroicGamesLauncher/releases/download/v${HV}/Heroic-${HV}-linux-x86_64.AppImage" \
  && chmod 755 /opt/heroic/Heroic.AppImage && echo "heroic $HV" || echo "heroic download failed"

log "KIOSK FILES"
install -m 755 /root/gamezone-game-watchdog /usr/local/bin/gamezone-game-watchdog
install -d -o $PLAYER -g $PLAYER /home/$PLAYER/.config /home/$PLAYER/.config/openbox /home/$PLAYER/.config/sunshine
cat > /home/$PLAYER/.config/openbox/rc.xml <<'EOF'
<?xml version="1.0"?>
<openbox_config xmlns="http://openbox.org/3.4/rc">
  <keyboard><chainQuitKey/></keyboard>
  <mouse><context name="Root"/></mouse>
  <applications><application class="*"><decor>no</decor><maximized>yes</maximized><fullscreen>yes</fullscreen></application></applications>
</openbox_config>
EOF
cat > /home/$PLAYER/.config/sunshine/sunshine.conf <<'EOF'
sunshine_name = Productify Gamezone
capture = x11
encoder = nvenc
origin_web_ui_allowed = pc
min_log_level = info
# Without a panel the tray icon stops Sunshine at "Starting system tray".
system_tray = disabled
EOF
# Steam: run from the player's home (else "rm: cannot remove steam-runtime.tar.xz"), and with CEF's
# GPU paths off (else Big Picture is black: GLXBadPixmap). The session supplies the D-Bus bus.
cat > /home/$PLAYER/.config/sunshine/apps.json <<'EOF'
{"env":{},"apps":[
 {"name":"Steam","image-path":"steam.png","working-dir":"/home/player","detached":["/usr/games/steam -gamepadui -cef-disable-gpu -cef-disable-gpu-compositing"]},
 {"name":"Epic Games","working-dir":"/home/player","detached":["/opt/heroic/Heroic.AppImage --no-sandbox --fullscreen"]}
]}
EOF
chown -R $PLAYER:$PLAYER /home/$PLAYER/.config

# Player session (runs as the player inside a D-Bus session; Steam needs the session bus).
cat > /usr/local/bin/gamezone-session <<'EOF'
#!/bin/bash
cd "$HOME"
xset s off -dpms
pulseaudio --start --exit-idle-time=-1
openbox --config-file "$HOME/.config/openbox/rc.xml" &
unclutter -idle 2 &
/usr/local/bin/gamezone-game-watchdog > /tmp/gamezone-watchdog.log 2>&1 &
exec /usr/bin/sunshine "$HOME/.config/sunshine/sunshine.conf" > /tmp/sunshine.log 2>&1
EOF
chmod 755 /usr/local/bin/gamezone-session

# Root side: X on the L4 (no monitor) at 1080p, then the player session. Runs on every boot.
cat > /usr/local/sbin/gamezone-kiosk <<'EOF'
#!/bin/bash
RES=${GZ_RESOLUTION:-1920x1080}; W=${RES%x*}; H=${RES#*x}
P=player; PUID=$(id -u $P)
BUS=$(nvidia-xconfig --query-gpu-info 2>/dev/null | awk '/PCI BusID/{print $4; exit}')
nvidia-xconfig --virtual=${W}x${H} --depth=24 --allow-empty-initial-configuration --busid=$BUS -o /etc/X11/xorg.conf >/dev/null 2>&1
sed -i '/UseDisplayDevice/d' /etc/X11/xorg.conf
modprobe uinput; udevadm trigger --subsystem-match=misc; chgrp input /dev/uinput; chmod 660 /dev/uinput
mkdir -p /run/user/$PUID; chown $P: /run/user/$PUID; chmod 700 /run/user/$PUID
# -ac: only local sockets (-nolisten tcp); the only local users are root and the player.
Xorg :0 -config /etc/X11/xorg.conf -noreset -nolisten tcp -ac +extension GLX vt7 > /var/log/gamezone-xorg.out 2>&1 &
for i in $(seq 1 30); do DISPLAY=:0 xdpyinfo >/dev/null 2>&1 && break; sleep 1; done
OUT=$(DISPLAY=:0 xrandr --query | awk '/ connected/{print $1; exit}')
DISPLAY=:0 xrandr --output "$OUT" --mode ${W}x${H} --pos 0x0 2>/dev/null || DISPLAY=:0 xrandr -s ${W}x${H}
# Full-screen Vulkan/Proton games flip straight to the display and Sunshine's X11 capture saw only
# black (Witcher 3 on the T4, 2026-11-27: sound, no picture). Keep every frame in the captured buffer.
DISPLAY=:0 nvidia-settings -a AllowFlipping=0 >/dev/null 2>&1
exec runuser -u $P -- env -i DISPLAY=:0 HOME=/home/$P USER=$P XDG_RUNTIME_DIR=/run/user/$PUID \
  PATH=/usr/local/bin:/usr/bin:/bin:/usr/games dbus-run-session -- /usr/local/bin/gamezone-session
EOF
chmod 755 /usr/local/sbin/gamezone-kiosk

# Once per VM: fresh secrets. Same files the Vast backend already reads (/root/gamezone-secrets,
# /etc/wireguard/host.pub, /var/lib/gamezone-ready, gamezone-wg-peer).
cat > /usr/local/sbin/gamezone-firstboot <<'EOF'
#!/bin/bash
set -u
[ -f /var/lib/gamezone-ready ] && exit 0
rand() { head -c 48 /dev/urandom | base64 | tr -dc A-Za-z0-9 | head -c "${1:-24}"; }
SUN_USER=gzadmin; SUN_PASS=$(rand 24); PLAYER_PASS=$(rand 24)
WG_NET=${GZ_WG_NET:-10.77.0}; WG_PORT=${GZ_WG_PORT:-51820}
echo "player:$PLAYER_PASS" | chpasswd; passwd -l player >/dev/null
runuser -u player -- env HOME=/home/player /usr/bin/sunshine --creds "$SUN_USER" "$SUN_PASS" >/dev/null 2>&1
umask 077; mkdir -p /etc/wireguard
wg genkey > /etc/wireguard/host.key; wg pubkey < /etc/wireguard/host.key > /etc/wireguard/host.pub
cat > /etc/wireguard/wg0.conf <<C
[Interface]
Address = ${WG_NET}.1/24
ListenPort = ${WG_PORT}
MTU = 1280
PostUp = wg set %i private-key /etc/wireguard/host.key
PostUp = /usr/local/sbin/gamezone-wg-firewall
C
systemctl enable --now wg-quick@wg0
printf 'SUNSHINE_USER=%s\nSUNSHINE_PASS=%s\nPLAYER_PASS=%s\nWG_PUBLIC_KEY=%s\nWG_PORT=%s\nWG_HOST_ADDRESS=%s.1\n' \
  "$SUN_USER" "$SUN_PASS" "$PLAYER_PASS" "$(cat /etc/wireguard/host.pub)" "$WG_PORT" "$WG_NET" > /root/gamezone-secrets
touch /var/lib/gamezone-ready
EOF
chmod 700 /usr/local/sbin/gamezone-firstboot

# Sunshine's ports only through the tunnel (and loopback).
cat > /usr/local/sbin/gamezone-wg-firewall <<'EOF'
#!/bin/bash
for chain in "-p tcp -m multiport --dports 47984,47989,47990,48010" "-p udp -m multiport --dports 47998:48000,48002,48010"; do
  iptables -C INPUT -i wg0 $chain -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -i wg0 $chain -j ACCEPT
  iptables -C INPUT -i lo  $chain -j ACCEPT 2>/dev/null || iptables -I INPUT 2 -i lo  $chain -j ACCEPT
  iptables -C INPUT $chain -j DROP 2>/dev/null || iptables -A INPUT $chain -j DROP
done
# E2E images keep a saved iptables firewall with INPUT policy DROP: let WireGuard in (key-authenticated).
WG_PORT=$(sed -n "s/^ListenPort *= *//p" /etc/wireguard/wg0.conf)
iptables -C INPUT -p udp --dport $WG_PORT -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p udp --dport $WG_PORT -j ACCEPT
EOF
chmod 700 /usr/local/sbin/gamezone-wg-firewall
cat > /usr/local/sbin/gamezone-wg-peer <<'EOF'
#!/bin/bash
# Called by the Productify backend over SSH: add <client_public_key> | remove-all
set -euo pipefail
NET=$(sed -n 's/^WG_HOST_ADDRESS=\(.*\)\.1$/\1/p' /root/gamezone-secrets)
case "${1:-}" in
  add)
    [[ "${2:-}" =~ ^[A-Za-z0-9+/]{43}=$ ]] || { echo "bad key" >&2; exit 2; }
    for p in $(wg show wg0 peers); do wg set wg0 peer "$p" remove; done   # one player per machine
    wg set wg0 peer "$2" allowed-ips ${NET}.2/32
    echo ${NET}.2/32 ;;
  remove-all)
    for p in $(wg show wg0 peers); do wg set wg0 peer "$p" remove; done ;;
  *) echo "usage: $0 add <pubkey> | remove-all" >&2; exit 2 ;;
esac
EOF
chmod 700 /usr/local/sbin/gamezone-wg-peer

# Wipe per-VM state before saving the image (run last, then power off and save).
cat > /usr/local/sbin/gamezone-image-clean <<'EOF'
#!/bin/bash
systemctl stop gamezone-kiosk; wg-quick down wg0 2>/dev/null; systemctl disable wg-quick@wg0 2>/dev/null
rm -f /root/gamezone-secrets /var/lib/gamezone-ready /etc/wireguard/host.key /etc/wireguard/host.pub /etc/wireguard/wg0.conf
S=/home/player/.config/sunshine; rm -rf $S/sunshine_state.json $S/credentials $S/covers $S/*.log
H=/home/player; D=$H/.steam/debian-installation   # Ubuntu's steam-installer keeps Steam here
rm -rf $D/local.vdf $D/config/config.vdf $D/config/loginusers.vdf $D/config/htmlcache $D/config/avatarcache $D/userdata $D/ssfn*
rm -rf $H/.local/share/Steam/config/loginusers.vdf $H/.local/share/Steam/config/config.vdf \
  $H/.local/share/Steam/config/htmlcache $H/.local/share/Steam/userdata $H/.steam/registry.vdf \
  $H/.config/heroic $H/.bash_history /root/.bash_history /tmp/* /var/log/gamezone-*
rm -f /etc/ssh/ssh_host_*; truncate -s 0 /etc/machine-id
command -v cloud-init >/dev/null && cloud-init clean --logs >/dev/null 2>&1
journalctl --rotate >/dev/null 2>&1; journalctl --vacuum-time=1s >/dev/null 2>&1
sync; echo CLEAN_DONE
EOF
chmod 700 /usr/local/sbin/gamezone-image-clean

cat > /etc/systemd/system/gamezone-sshkeys.service <<'EOF'
[Unit]
Description=Gamezone: SSH host keys for a VM made from the image
Before=ssh.service
[Service]
Type=oneshot
ExecStart=/usr/bin/ssh-keygen -A
[Install]
WantedBy=multi-user.target
EOF
cat > /etc/systemd/system/gamezone-firstboot.service <<'EOF'
[Unit]
Description=Gamezone: per-VM secrets (once)
After=network-online.target
Wants=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/gamezone-firstboot
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
EOF
cat > /etc/systemd/system/gamezone-kiosk.service <<'EOF'
[Unit]
Description=Gamezone: X on the GPU + player session with Sunshine
After=gamezone-firstboot.service systemd-udevd.service
Requires=gamezone-firstboot.service
[Service]
ExecStart=/usr/local/sbin/gamezone-kiosk
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable gamezone-sshkeys gamezone-firstboot gamezone-kiosk >/dev/null 2>&1

log "STEAM CLIENT PRE-UPDATE (so players don't wait on 'Updating Steam')"
runuser -u $PLAYER -- env HOME=/home/$PLAYER bash -c '
  cd ~; xvfb-run -a /usr/games/steam -silent -no-browser > /tmp/steam-preupdate.log 2>&1 &
  for i in $(seq 1 180); do pgrep -u "$(id -u)" -x steamwebhelper >/dev/null && { sleep 20; break; }; sleep 5; done
  /usr/games/steam -shutdown >/dev/null 2>&1; sleep 15
  for n in steamwebhelper steam reaper Xvfb; do pkill -u "$(id -u)" -x "$n" >/dev/null 2>&1; done'
ls /home/$PLAYER/.steam/debian-installation/ubuntu12_32/steamui.so >/dev/null 2>&1 && echo STEAM_CLIENT_READY || echo STEAM_CLIENT_MISSING

log "FIRST BOOT + KIOSK (test on this VM)"
systemctl start gamezone-firstboot && systemctl start gamezone-kiosk
sleep 20
systemctl is-active gamezone-kiosk; wg show wg0 | head -3 | sed 's/public key: .*/public key: (set)/'
pgrep -x sunshine >/dev/null && echo SUNSHINE_UP || echo SUNSHINE_DOWN
grep -iE "Found .*encoder|Creating encoder|Unable to find|Detected display: .* connected: true|Fatal" /tmp/sunshine.log | head -5
DISPLAY=:0 glxinfo -B 2>&1 | grep -E "OpenGL renderer"
iptables -S INPUT | grep -c gamezone >/dev/null; iptables -S INPUT | grep -E "47989|wg0" | head -3
log "DONE"
