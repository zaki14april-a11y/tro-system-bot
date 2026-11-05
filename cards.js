// ============================================================
//  🖼️ Kartu gambar Welcome / Goodbye tema TRO (emas & navy)
// ============================================================
const fs = require('fs');
const path = require('path');

let canvasLib = null;
try { canvasLib = require('@napi-rs/canvas'); } catch { /* belum terpasang → pakai embed biasa */ }

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FONT_URL = 'https://github.com/google/fonts/raw/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf';
const FONT_FILE = path.join(DATA_DIR, 'Cinzel.ttf');
let fontReady = null;

async function ensureFont() {
  if (!canvasLib) return false;
  if (fontReady !== null) return fontReady;
  try {
    if (!fs.existsSync(FONT_FILE)) {
      const r = await fetch(FONT_URL);
      if (!r.ok) throw new Error('font ' + r.status);
      fs.writeFileSync(FONT_FILE, Buffer.from(await r.arrayBuffer()));
    }
    canvasLib.GlobalFonts.registerFromPath(FONT_FILE, 'Cinzel');
    fontReady = true;
  } catch { fontReady = false; }
  return fontReady;
}

function fitText(ctx, text, max, size, font) {
  let s = size;
  do { ctx.font = `${font.replace('{s}', s)}`; s -= 2; } while (ctx.measureText(text).width > max && s > 14);
}

/** kind: 'welcome' | 'goodbye' → Buffer PNG (atau null kalau canvas tidak ada) */
async function makeCard(kind, { username, avatarUrl, guildName, memberCount, iconUrl }) {
  if (!canvasLib) return null;
  const { createCanvas, loadImage } = canvasLib;
  const hasCinzel = await ensureFont();
  const display = hasCinzel ? 'Cinzel' : 'serif';
  const W = 1024, H = 400;
  const c = createCanvas(W, H), x = c.getContext('2d');

  // latar navy + cahaya emas
  const bg = x.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0d1220'); bg.addColorStop(1, kind === 'welcome' ? '#211c3d' : '#1a1a24');
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W * 0.78, -40, 10, W * 0.78, -40, 520);
  glow.addColorStop(0, kind === 'welcome' ? 'rgba(233,209,139,.35)' : 'rgba(169,176,190,.22)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = glow; x.fillRect(0, 0, W, H);
  // pola belah ketupat tipis
  x.strokeStyle = 'rgba(201,162,75,.07)'; x.lineWidth = 1;
  for (let i = -H; i < W + H; i += 46) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + H, H); x.stroke(); x.beginPath(); x.moveTo(i + H, 0); x.lineTo(i, H); x.stroke(); }
  // bingkai emas
  x.strokeStyle = 'rgba(233,209,139,.55)'; x.lineWidth = 3; x.strokeRect(14, 14, W - 28, H - 28);
  x.strokeStyle = 'rgba(201,162,75,.25)'; x.lineWidth = 1; x.strokeRect(24, 24, W - 48, H - 48);

  // avatar dalam perisai
  const ax = 200, ay = 200, R = 120;
  const shield = () => { x.beginPath(); x.moveTo(ax, ay - R); x.lineTo(ax + R, ay - R * 0.7); x.lineTo(ax + R, ay + R * 0.15); x.quadraticCurveTo(ax + R * 0.95, ay + R * 0.85, ax, ay + R * 1.05); x.quadraticCurveTo(ax - R * 0.95, ay + R * 0.85, ax - R, ay + R * 0.15); x.lineTo(ax - R, ay - R * 0.7); x.closePath(); };
  x.save(); shield(); x.shadowColor = 'rgba(233,209,139,.7)'; x.shadowBlur = 30; x.fillStyle = '#c9a24b'; x.fill(); x.restore();
  x.save(); x.translate(ax, ay); x.scale(0.93, 0.93); x.translate(-ax, -ay); shield(); x.clip();
  try { const img = await loadImage(avatarUrl); x.drawImage(img, ax - R, ay - R, R * 2, R * 2.1); } catch { x.fillStyle = '#211c3d'; x.fill(); }
  if (kind === 'goodbye') { x.fillStyle = 'rgba(13,18,32,.35)'; x.fillRect(ax - R, ay - R, R * 2, R * 2.2); }
  x.restore();

  // teks
  const gold = x.createLinearGradient(0, 120, 0, 200); gold.addColorStop(0, '#fff3cf'); gold.addColorStop(0.5, '#e9d18b'); gold.addColorStop(1, '#c9a24b');
  x.fillStyle = gold; x.textBaseline = 'alphabetic';
  fitText(x, kind === 'welcome' ? 'WELCOME' : 'GOODBYE', 560, 78, `700 {s}px ${display}`);
  x.fillText(kind === 'welcome' ? 'WELCOME' : 'GOODBYE', 380, 165);
  // garis ornamen
  x.strokeStyle = 'rgba(233,209,139,.7)'; x.lineWidth = 2; x.beginPath(); x.moveTo(382, 188); x.lineTo(560, 188); x.stroke();
  x.fillStyle = '#e9d18b'; x.beginPath(); x.moveTo(572, 181); x.lineTo(579, 188); x.lineTo(572, 195); x.lineTo(565, 188); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(586, 188); x.lineTo(760, 188); x.stroke();

  x.fillStyle = '#ede6d6';
  fitText(x, username, 580, 46, `600 {s}px ${hasCinzel ? 'Cinzel' : 'sans-serif'}`);
  x.fillText(username, 382, 246);
  x.fillStyle = '#a9b0be'; x.font = '24px sans-serif';
  const sub = kind === 'welcome' ? `Member ke-${memberCount} • ${guildName}` : `Terima kasih sudah singgah di ${guildName}`;
  fitText(x, sub, 580, 24, '{s}px sans-serif'); x.fillText(sub, 384, 290);
  x.fillStyle = 'rgba(233,209,139,.85)'; x.font = `italic 20px ${display}`; x.fillText('In wisdom, we endure.', 384, 334);

  // logo server kecil kanan bawah
  if (iconUrl) { try { const ic = await loadImage(iconUrl); x.save(); x.globalAlpha = 0.9; x.beginPath(); x.arc(W - 86, H - 86, 40, 0, Math.PI * 2); x.clip(); x.drawImage(ic, W - 126, H - 126, 80, 80); x.restore(); } catch { /* skip */ } }
  return c.toBuffer('image/png');
}

module.exports = { makeCard, available: () => !!canvasLib };
