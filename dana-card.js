// ============================================================
//  💳 Kartu QR DANA tema TRO (navy & emas) — dibuat bot sendiri
//  Hasil disimpan di data/dana-qr.png, dipakai di tiket TROlley
// ============================================================
const fs = require('fs');
const path = require('path');

let canvasLib = null;
try { canvasLib = require('@napi-rs/canvas'); } catch { /* tanpa canvas → pakai QR asli / tombol saja */ }

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const OUT = path.join(DATA_DIR, 'dana-qr.png');
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
  const W = 1080, H = 1350;
  const NAVY = '#0e1324', INK = '#11182e', GOLD = '#c9a24b', GOLD2 = '#e8cb84', CREAM = '#f7f1e4', MUTED = '#aab0c4';
  const cv = createCanvas(W, H), x = cv.getContext('2d');
  x.fillStyle = NAVY; x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W / 2, 760, 60, W / 2, 760, 620); g.addColorStop(0, 'rgba(40,52,92,.55)'); g.addColorStop(1, 'rgba(14,19,36,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = GOLD; x.lineWidth = 3; rr(x, 36, 36, W - 72, H - 72, 34); x.stroke();
  x.lineWidth = 1; rr(x, 50, 50, W - 100, H - 100, 26); x.stroke();
  const center = (t, y, font, fill) => { x.font = font; x.fillStyle = fill; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillText(t, W / 2, y); };
  center('TROlley', 190, `700 92px ${display}`, GOLD2);
  center('Pembayaran resmi via DANA', 250, '500 34px sans-serif', CREAM);
  x.strokeStyle = GOLD; x.lineWidth = 2; x.beginPath(); x.moveTo(W / 2 - 170, 286); x.lineTo(W / 2 - 22, 286); x.moveTo(W / 2 + 22, 286); x.lineTo(W / 2 + 170, 286); x.stroke();
  x.fillStyle = GOLD; x.beginPath(); x.moveTo(W / 2, 276); x.lineTo(W / 2 + 10, 286); x.lineTo(W / 2, 296); x.lineTo(W / 2 - 10, 286); x.closePath(); x.fill();
  // panel QR
  const panel = 640, px = (W - panel) / 2, py = 328;
  x.fillStyle = CREAM; rr(x, px, py, panel, panel, 40); x.fill();
  const cell = panel / (N + 8), ox = px + 4 * cell, oy = py + 4 * cell;
  const finder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= N - 7) || (r >= N - 7 && c < 7);
  x.fillStyle = INK;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (on(r, c) && !finder(r, c)) { rr(x, ox + c * cell, oy + r * cell, cell + 0.4, cell + 0.4, cell * 0.16); x.fill(); }
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
  x.strokeStyle = GOLD; x.lineWidth = 4; x.stroke();
  x.font = `700 ${Math.round(R * 0.72)}px ${display}`; x.fillStyle = GOLD2; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('TRO', cx, cy + 2);
  // petunjuk
  const y0 = py + panel + 96;
  center('Scan pakai aplikasi DANA', y0, '600 40px sans-serif', CREAM);
  center('atau klik tombol "Bayar via DANA" di tiket', y0 + 56, '400 28px sans-serif', MUTED);
  const chip = 'Kirim screenshot bukti TF di tiket'; x.font = '500 28px sans-serif'; const tw = x.measureText(chip).width, cw = tw + 64;
  x.strokeStyle = GOLD; x.lineWidth = 2; rr(x, (W - cw) / 2, y0 + 96, cw, 60, 30); x.stroke();
  x.fillStyle = GOLD2; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(chip, W / 2, y0 + 127);
  center('THE RESILIENT ORDER', H - 86, `600 24px ${display}`, GOLD);
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
