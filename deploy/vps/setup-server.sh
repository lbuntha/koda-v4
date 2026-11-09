#!/bin/bash
# Once, on a fresh Ubuntu/Debian VPS, as root:  bash setup-server.sh
#
# Docker, a firewall that lets in only SSH and the web, automatic security
# updates, and swap — building the web app needs more memory than a small VPS
# has, and without swap the build is killed halfway with no clear message.
set -euo pipefail

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

apt-get update
apt-get install -y ufw unattended-upgrades rsync
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
dpkg-reconfigure -f noninteractive unattended-upgrades

if ! swapon --show | grep -q .; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

mkdir -p /opt/koda
echo "Ready. Next: deploy/vps/README.md, step 3."
