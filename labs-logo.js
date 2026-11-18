// 🧪 Logo TRO LABS — digambar bot (navy + emas), dipakai jadi icon server
const path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
let fontOk = false;
function render(S = 1024) {
  if (!fontOk) { try { GlobalFonts.registerFromPath(path.join(__dirname, 'data', 'Cinzel.ttf'), 'Cinzel'); } catch {} fontOk = true; }
  const c = createCanvas(S, S), x = c.getContext('2d'), k = S / 1024, C = S / 2;
  x.scale(k, k); const W = 1024, M = 512;
  let g = x.createRadialGradient(M, M * 0.8, 40, M, M, M);
  g.addColorStop(0, '#26336a'); g.addColorStop(0.65, '#121a3a'); g.addColorStop(1, '#070b1c');
  x.fillStyle = g; x.fillRect(0, 0, W, W);
  const gold = (y0, y1) => { const q = x.createLinearGradient(0, y0, 0, y1); q.addColorStop(0, '#fbe6a8'); q.addColorStop(0.5, '#d9ad52'); q.addColorStop(1, '#a0762a'); return q; };
  x.strokeStyle = 'rgba(212,175,55,0.06)'; x.lineWidth = 2;
  for (let yy = -40; yy < W + 60; yy += 64) for (let xx = -40; xx < W + 60; xx += 74) { const ox = (Math.round(yy / 64) % 2) * 37; x.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; x.lineTo(xx + ox + 30 * Math.cos(a), yy + 30 * Math.sin(a)); } x.closePath(); x.stroke(); }
  x.strokeStyle = gold(0, W); x.lineWidth = 26; x.beginPath(); x.arc(M, M, M - 34, 0, 7); x.stroke();
  x.lineWidth = 5; x.globalAlpha = 0.7; x.beginPath(); x.arc(M, M, M - 72, 0, 7); x.stroke(); x.globalAlpha = 1;
  const fx = M, top = 210, neckW = 118, bodyW = 470, bottom = 760, neckH = 210;
  const flask = () => { x.beginPath(); x.moveTo(fx - neckW / 2, top); x.lineTo(fx - neckW / 2, top + neckH); x.lineTo(fx - bodyW / 2, bottom - 40); x.quadraticCurveTo(fx - bodyW / 2 - 6, bottom, fx - bodyW / 2 + 40, bottom); x.lineTo(fx + bodyW / 2 - 40, bottom); x.quadraticCurveTo(fx + bodyW / 2 + 6, bottom, fx + bodyW / 2, bottom - 40); x.lineTo(fx + neckW / 2, top + neckH); x.lineTo(fx + neckW / 2, top); x.closePath(); };
  x.save(); flask(); x.clip();
  const lv = 470, lq = x.createLinearGradient(0, lv, 0, bottom); lq.addColorStop(0, 'rgba(240,210,122,0.95)'); lq.addColorStop(1, 'rgba(160,118,42,0.95)');
  x.fillStyle = 'rgba(10,15,35,0.55)'; x.fillRect(0, 0, W, W);
  x.fillStyle = lq; x.beginPath(); x.moveTo(0, lv); for (let i = 0; i <= W; i += 8) x.lineTo(i, lv + Math.sin(i / 55) * 12); x.lineTo(W, W); x.lineTo(0, W); x.closePath(); x.fill();
  x.fillStyle = 'rgba(255,245,210,0.75)'; for (const [bx, by, r] of [[fx - 175, 735, 14], [fx + 175, 738, 16], [fx - 70, 745, 9], [fx + 70, 740, 8], [fx + 25, 525, 8], [fx - 30, 560, 6]]) { x.beginPath(); x.arc(bx, by, r, 0, 7); x.fill(); }
  x.restore();
  x.strokeStyle = gold(top, bottom); x.lineWidth = 22; x.lineJoin = 'round'; flask(); x.stroke();
  x.fillStyle = gold(top - 30, top + 10); x.beginPath(); x.roundRect(fx - neckW / 2 - 34, top - 30, neckW + 68, 36, 14); x.fill();
  x.strokeStyle = '#e8c56d'; x.lineWidth = 7; for (const [bx, by, r] of [[fx + 6, 150, 18], [fx + 48, 104, 12], [fx - 30, 92, 9]]) { x.beginPath(); x.arc(bx, by, r, 0, 7); x.stroke(); }
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.font = 'bold 150px Cinzel'; x.fillStyle = '#0b1230'; x.fillText('TRO', fx + 4, 704); x.fillStyle = '#fff6dc'; x.fillText('TRO', fx, 700);
  const by = 830; x.fillStyle = gold(by - 52, by + 52); x.beginPath(); x.roundRect(M - 210, by - 56, 420, 104, 52); x.fill();
  x.font = 'bold 82px Cinzel'; x.fillStyle = '#0b1230'; x.fillText('LABS', M, by + 30);
  return c.toBuffer('image/png');
}
module.exports = { render };
