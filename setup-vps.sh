#!/bin/bash
# ============================================================
#  🦉 TRO SYSTEM — pasang bot di VPS Ubuntu (sekali jalan)
#  Pakai: bash setup-vps.sh
# ============================================================
set -e
REPO_DIR=/opt/tro-system-bot
IP=$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')

echo "== 1/5 Pasang Node.js 20 + git =="
apt-get update -y
apt-get install -y curl git ca-certificates
if ! command -v node >/dev/null || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "== 2/5 Ambil kode bot =="
if [ ! -d "$REPO_DIR/.git" ]; then
  git clone https://github.com/zaki14april-a11y/tro-system-bot.git "$REPO_DIR"
else
  git -C "$REPO_DIR" pull
fi
cd "$REPO_DIR"
npm install --omit=dev

echo "== 3/5 Isi rahasia bot =="
if [ ! -f .env ]; then
  read -rsp "Paste DISCORD_TOKEN lalu Enter: " TOKEN; echo
  read -rsp "Paste CLIENT_SECRET lalu Enter: " SECRET; echo
  cat > .env <<EOF
DISCORD_TOKEN=$TOKEN
CLIENT_SECRET=$SECRET
CLIENT_ID=1567251006528688278
GUILD_ID=1437179205740658899
PORT=80
BASE_URL=http://$IP
SESSION_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '/+=')
EOF
  chmod 600 .env
fi

echo "== 4/5 Bikin layanan otomatis (nyala sendiri & restart kalau error) =="
cat > /etc/systemd/system/tro-system.service <<EOF
[Unit]
Description=TRO SYSTEM Discord bot + dashboard
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=$REPO_DIR
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now tro-system
command -v ufw >/dev/null && ufw allow 80/tcp >/dev/null 2>&1 || true

echo "== 5/5 Selesai =="
sleep 5
systemctl --no-pager status tro-system | head -n 12
echo
echo "🌐 Dashboard : http://$IP"
echo "🔗 Tambahkan Redirect ini di Discord Developer Portal > OAuth2:"
echo "   http://$IP/callback"
echo "📜 Lihat log : journalctl -u tro-system -f"
echo "🔄 Update   : cd $REPO_DIR && git pull && npm install && systemctl restart tro-system"
