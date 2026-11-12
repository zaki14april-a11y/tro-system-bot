// ============================================================
//  💳 Kartu QR DANA tema TRO (navy & emas) — dibuat bot sendiri
//  Hasil disimpan di data/dana-qr.png, dipakai di tiket TROlley
// ============================================================
const fs = require('fs');
const path = require('path');

let canvasLib = null;
try { canvasLib = require('@napi-rs/canvas'); } catch { /* tanpa canvas → pakai QR asli / tombol saja */ }

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const OUT = path.join(DATA_DIR, 'dana-qr-v2.png'); // ganti versi kalau desain diubah
const FONT_FILE = path.join(DATA_DIR, 'Cinzel.ttf');

// QR (error correction H, 49×49) untuk link DANA resmi TRO di bawah. Ganti link = matrix tidak berlaku.
const LINK = 'https://link.dana.id/minta?full_url=https://qr.dana.id/v1/281012012026030286102268&r=kYJ875';
const N = 49;
const HEX = 'fe25c4c9b0bfc10fbba5fbd06ebb5610296bb758fcdc17a5dba038feb8c2ec11eb11c69107faaaaaaaaafe00d36c4fd4001b2b8be35d0636efd258bf7f14b29e713843e8aab666c93e6f2b788a5d96968469857273ca094186cb9437e24faa99448cde457107d80cece1bce1d5d8af9a4a379fcfb3b3927cfe249833e0daedba194b771d9f57523e999f91c3e391053c6ced1e6ac00eae69ad6c4c9f19adc66bf2f5feb1febb162f612cabf437e8882cb0f9acb3b333ca6398b6913a00e338a907555f020e1f99273145243fbf49ff2591a8a42bb84c6c9d1fdfde234a36909a08f65b8a21806940511c804919b0aee0a3ae908b22e39ee3eae9f8006e4f1328c7bfaa8eab39abb04718c744118bae79ffe1bf95d5efcfa5fd2ae92e68db82ff04e3914f6ccffe4a3717ab248';
const bits = [...HEX].map((h) => parseInt(h, 16).toString(2).padStart(4, '0')).join('');
const on = (r, c) => bits[r * N + c] === '1';

function rr(x, X, Y, W, H, R) { x.beginPath(); x.roundRect(X, Y, W, H, R); }

function render() {
  const { createCanvas, GlobalFonts } = canvasLib;
  let display = 'serif';
  try { if (fs.existsSync(FONT_FILE)) { GlobalFonts.registerFromPath(FONT_FILE, 'Cinzel'); display = 'Cinzel'; } } catch { /* pakai serif */ }
  const W = 1080, H = 1620;
  const NAVY = '#0b1020', NAVY2 = '#141b33', INK = '#10172c', GOLD = '#c9a24b', GOLD2 = '#ecd28f', GOLD3 = '#9c7a2e', CREAM = '#f8f2e5', MUTED = '#9aa3bd', DANA = '#118ee9';
  const cv = createCanvas(W, H), x = cv.getContext('2d');
  const goldGrad = (y1, y2) => { const g = x.createLinearGradient(0, y1, 0, y2); g.addColorStop(0, '#f6e3a8'); g.addColorStop(0.5, GOLD2); g.addColorStop(1, GOLD3); return g; };
  // latar + vinyet + motif belah ketupat emas tipis
  x.fillStyle = NAVY; x.fillRect(0, 0, W, H);
  let g = x.createRadialGradient(W / 2, 640, 80, W / 2, 640, 900); g.addColorStop(0, NAVY2); g.addColorStop(1, NAVY); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.save(); x.strokeStyle = 'rgba(201,162,75,.06)'; x.lineWidth = 1;
  for (let i = -H; i < W + H; i += 54) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + H, H); x.moveTo(i, H); x.lineTo(i + H, 0); x.stroke(); }
  x.restore();
  // bingkai ganda + ornamen sudut
  x.strokeStyle = GOLD; x.lineWidth = 3; rr(x, 34, 34, W - 68, H - 68, 30); x.stroke();
  x.strokeStyle = 'rgba(201,162,75,.45)'; x.lineWidth = 1; rr(x, 48, 48, W - 96, H - 96, 22); x.stroke();
  const corner = (cx, cy, sx, sy) => { x.save(); x.translate(cx, cy); x.scale(sx, sy); x.strokeStyle = GOLD; x.lineWidth = 2.5;
    x.beginPath(); x.moveTo(0, 70); x.lineTo(0, 14); x.quadraticCurveTo(0, 0, 14, 0); x.lineTo(70, 0); x.stroke();
    x.fillStyle = GOLD; x.beginPath(); x.moveTo(22, 22); x.lineTo(31, 31); x.lineTo(22, 40); x.lineTo(13, 31); x.closePath(); x.fill(); x.restore(); };
  corner(70, 70, 1, 1); corner(W - 70, 70, -1, 1); corner(70, H - 70, 1, -1); corner(W - 70, H - 70, -1, -1);
  const center = (t, y, font, fill, base = 'alphabetic') => { x.font = font; x.fillStyle = fill; x.textAlign = 'center'; x.textBaseline = base; x.fillText(t, W / 2, y); };
  const track = (t, y, font, fill, sp) => { x.font = font; const ws = [...t].map((ch) => x.measureText(ch).width); const tot = ws.reduce((a, b) => a + b, 0) + sp * (t.length - 1); let cx = (W - tot) / 2; x.fillStyle = fill; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; [...t].forEach((ch, i) => { x.fillText(ch, cx, y); cx += ws[i] + sp; }); };
  // kepala
  track('THE RESILIENT ORDER', 150, `600 24px ${display}`, GOLD, 6);
  x.shadowColor = 'rgba(236,210,143,.35)'; x.shadowBlur = 30;
  center('TROlley', 262, `700 112px ${display}`, goldGrad(170, 270));
  x.shadowBlur = 0;
  // garis + permata
  x.strokeStyle = GOLD; x.lineWidth = 2; x.beginPath(); x.moveTo(W / 2 - 230, 312); x.lineTo(W / 2 - 26, 312); x.moveTo(W / 2 + 26, 312); x.lineTo(W / 2 + 230, 312); x.stroke();
  x.fillStyle = GOLD2; x.beginPath(); x.moveTo(W / 2, 300); x.lineTo(W / 2 + 12, 312); x.lineTo(W / 2, 324); x.lineTo(W / 2 - 12, 312); x.closePath(); x.fill();
  // pil "Pembayaran resmi · DANA"
  x.font = '600 30px sans-serif'; const t1 = 'Pembayaran resmi via', t1w = x.measureText(t1).width; x.font = '800 30px sans-serif'; const t2w = x.measureText('DANA').width;
  const pw = t1w + t2w + 14 + 56 + 36, pX = (W - pw) / 2, pY = 352;
  x.fillStyle = 'rgba(248,242,229,.06)'; rr(x, pX, pY, pw, 60, 30); x.fill(); x.strokeStyle = 'rgba(201,162,75,.5)'; x.lineWidth = 1.5; x.stroke();
  x.fillStyle = CREAM; x.font = '600 30px sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(t1, pX + 28, pY + 31);
  const dX = pX + 28 + t1w + 14; x.fillStyle = DANA; rr(x, dX, pY + 11, t2w + 36, 38, 19); x.fill();
  x.fillStyle = '#fff'; x.font = '800 30px sans-serif'; x.fillText('DANA', dX + 18, pY + 31);
  // panel QR: bayangan + bingkai emas + krem
  const panel = 660, px = (W - panel) / 2, py = 460;
  x.save(); x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 50; x.shadowOffsetY = 18; x.fillStyle = CREAM; rr(x, px, py, panel, panel, 44); x.fill(); x.restore();
  x.strokeStyle = goldGrad(py, py + panel); x.lineWidth = 8; rr(x, px - 12, py - 12, panel + 24, panel + 24, 54); x.stroke();
  x.fillStyle = CREAM; rr(x, px, py, panel, panel, 44); x.fill();
  const cell = Math.floor(panel / (N + 8)), ox = Math.round(px + (panel - cell * N) / 2), oy = Math.round(py + (panel - cell * N) / 2);
  const finder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= N - 7) || (r >= N - 7 && c < 7);
  x.fillStyle = INK;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (on(r, c) && !finder(r, c)) { rr(x, ox + c * cell, oy + r * cell, cell, cell, cell * 0.16); x.fill(); }
  for (const [r, c] of [[0, 0], [0, N - 7], [N - 7, 0]]) {
    const X = ox + c * cell, Y = oy + r * cell, S = 7 * cell;
    x.fillStyle = INK; rr(x, X, Y, S, S, cell * 1.2); x.fill();
    x.fillStyle = CREAM; rr(x, X + cell, Y + cell, S - 2 * cell, S - 2 * cell, cell * 0.7); x.fill();
    x.fillStyle = INK; rr(x, X + 2 * cell, Y + 2 * cell, S - 4 * cell, S - 4 * cell, cell * 0.5); x.fill();
  }
  // lencana tengah
  const cx = px + panel / 2, cy = py + panel / 2, R = cell * 3.4;
  x.fillStyle = CREAM; x.beginPath(); x.arc(cx, cy, R + 10, 0, Math.PI * 2); x.fill();
  x.fillStyle = NAVY; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();
  x.strokeStyle = goldGrad(cy - R, cy + R); x.lineWidth = 5; x.stroke();
  x.font = `700 ${Math.round(R * 0.7)}px ${display}`; x.fillStyle = goldGrad(cy - R / 2, cy + R / 2); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('TRO', cx, cy + 2);
  // langkah 1-2-3
  const steps = [['Scan QR', 'pakai aplikasi DANA'], ['Transfer', 'sesuai total di tiket'], ['Kirim bukti', 'screenshot di tiket']];
  const sy = py + panel + 76, colW = (W - 200) / 3;
  steps.forEach(([a, b], i) => {
    const sx = 100 + colW * i + colW / 2;
    if (i) { x.strokeStyle = 'rgba(201,162,75,.35)'; x.lineWidth = 2; x.setLineDash([4, 8]); x.beginPath(); x.moveTo(sx - colW + 44, sy + 34); x.lineTo(sx - 44, sy + 34); x.stroke(); x.setLineDash([]); }
    x.fillStyle = 'rgba(201,162,75,.12)'; x.beginPath(); x.arc(sx, sy + 34, 34, 0, Math.PI * 2); x.fill();
    x.strokeStyle = GOLD; x.lineWidth = 2.5; x.stroke();
    x.fillStyle = GOLD2; x.font = `700 32px ${display}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(i + 1), sx, sy + 36);
    x.fillStyle = CREAM; x.font = '700 32px sans-serif'; x.textBaseline = 'alphabetic'; x.fillText(a, sx, sy + 120);
    x.fillStyle = MUTED; x.font = '400 24px sans-serif'; x.fillText(b, sx, sy + 156);
  });
  // kaki
  center('Bayar hanya lewat QR & tombol resmi di tiket TROlley', H - 150, '500 25px sans-serif', 'rgba(236,210,143,.85)');
  center('In wisdom, we endure.', H - 104, `italic 400 22px ${display}`, 'rgba(154,163,189,.8)');
  return cv.toBuffer('image/png');
}

// Path kartu QR (dibuat sekali, dicache). Null kalau link beda / canvas tidak ada.
function danaCardPath(link) {
  if (link && link !== LINK) return null;
  if (fs.existsSync(OUT)) return OUT;
  if (!canvasLib) return null;
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(OUT, render()); return OUT; } catch (e) { console.error('[dana-card]', e.message); return null; }
}

module.exports = { danaCardPath, render, LINK };
