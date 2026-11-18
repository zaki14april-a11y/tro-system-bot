// 🧪 Logo TRO LABS — digambar bot (hexagon emas + labu </> + wordmark), dipakai jadi icon server
const path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
let fontOk = false;
function render(S = 1024) {
  if (!fontOk) { try { GlobalFonts.registerFromPath(path.join(__dirname, 'data', 'Cinzel.ttf'), 'Cinzel'); } catch {} fontOk = true; }
  const c = createCanvas(S, S), x = c.getContext('2d'); x.scale(S / 1024, S / 1024);
  const W = 1024, M = 512;
  const gold = (x0, y0, x1, y1) => { const q = x.createLinearGradient(x0, y0, x1, y1); q.addColorStop(0, '#fff3c4'); q.addColorStop(0.28, '#f2cf72'); q.addColorStop(0.55, '#c9962f'); q.addColorStop(0.78, '#f6d98a'); q.addColorStop(1, '#8a5f1c'); return q; };
  // background
  let g = x.createRadialGradient(M, 440, 30, M, M, 760);
  g.addColorStop(0, '#2b3f86'); g.addColorStop(0.45, '#141d45'); g.addColorStop(1, '#05081a');
  x.fillStyle = g; x.fillRect(0, 0, W, W);
  // rays
  x.save(); x.translate(M, 430); for (let i = 0; i < 24; i++) { x.rotate(Math.PI / 12); x.fillStyle = i % 2 ? 'rgba(242,207,114,0.035)' : 'rgba(120,150,255,0.03)'; x.beginPath(); x.moveTo(0, 0); x.lineTo(-40, -720); x.lineTo(40, -720); x.closePath(); x.fill(); } x.restore();
  // hexagon frame
  const hex = (r, cx = M, cy = M) => { x.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 2; x.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); } x.closePath(); };
  x.save(); x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 30;
  hex(470); x.lineWidth = 30; x.strokeStyle = gold(0, 40, 0, 980); x.stroke(); x.restore();
  hex(470); x.lineWidth = 4; x.strokeStyle = 'rgba(255,248,220,0.55)'; x.stroke();
  hex(428); x.lineWidth = 5; x.strokeStyle = 'rgba(242,207,114,0.55)'; x.stroke();
  // molecule nodes on vertices
  for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 2, px = M + 470 * Math.cos(a), py = M + 470 * Math.sin(a);
    const rg = x.createRadialGradient(px - 8, py - 8, 2, px, py, 30); rg.addColorStop(0, '#fffbe8'); rg.addColorStop(0.4, '#f2cf72'); rg.addColorStop(1, '#8a5f1c');
    x.fillStyle = rg; x.beginPath(); x.arc(px, py, 30, 0, 7); x.fill(); x.strokeStyle = '#0b1230'; x.lineWidth = 5; x.stroke(); }
  // glow behind flask
  let gl = x.createRadialGradient(M, 520, 10, M, 520, 330); gl.addColorStop(0, 'rgba(255,214,110,0.45)'); gl.addColorStop(1, 'rgba(255,214,110,0)'); x.fillStyle = gl; x.fillRect(0, 0, W, W);
  // flask
  const top = 170, neckW = 112, neckH = 190, bodyW = 450, bottom = 690, fx = M;
  const flask = () => { x.beginPath(); x.moveTo(fx - neckW / 2, top); x.lineTo(fx - neckW / 2, top + neckH); x.lineTo(fx - bodyW / 2, bottom - 46); x.quadraticCurveTo(fx - bodyW / 2 - 8, bottom, fx - bodyW / 2 + 46, bottom); x.lineTo(fx + bodyW / 2 - 46, bottom); x.quadraticCurveTo(fx + bodyW / 2 + 8, bottom, fx + bodyW / 2, bottom - 46); x.lineTo(fx + neckW / 2, top + neckH); x.lineTo(fx + neckW / 2, top); x.closePath(); };
  x.save(); flask(); x.clip();
  let glass = x.createLinearGradient(fx - bodyW / 2, 0, fx + bodyW / 2, 0); glass.addColorStop(0, 'rgba(160,190,255,0.22)'); glass.addColorStop(0.5, 'rgba(40,60,120,0.25)'); glass.addColorStop(1, 'rgba(160,190,255,0.16)');
  x.fillStyle = 'rgba(8,12,32,0.65)'; x.fillRect(0, 0, W, W); x.fillStyle = glass; x.fillRect(0, 0, W, W);
  const lv = 430; let lq = x.createLinearGradient(0, lv, 0, bottom); lq.addColorStop(0, '#ffe9a6'); lq.addColorStop(0.35, '#f2c25a'); lq.addColorStop(1, '#a8701e');
  x.fillStyle = lq; x.beginPath(); x.moveTo(0, lv); for (let i = 0; i <= W; i += 6) x.lineTo(i, lv + Math.sin(i / 48) * 11); x.lineTo(W, W); x.lineTo(0, W); x.closePath(); x.fill();
  // liquid inner glow
  let lg = x.createRadialGradient(fx, 560, 10, fx, 560, 220); lg.addColorStop(0, 'rgba(255,255,230,0.55)'); lg.addColorStop(1, 'rgba(255,255,230,0)'); x.fillStyle = lg; x.fillRect(0, 0, W, W);
  // </> symbol in liquid
  x.save(); x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = 30; x.strokeStyle = '#0b1230';
  x.beginPath(); x.moveTo(fx - 70, 515); x.lineTo(fx - 130, 575); x.lineTo(fx - 70, 635); x.stroke();
  x.beginPath(); x.moveTo(fx + 70, 515); x.lineTo(fx + 130, 575); x.lineTo(fx + 70, 635); x.stroke();
  x.beginPath(); x.moveTo(fx + 30, 505); x.lineTo(fx - 30, 645); x.stroke(); x.restore();
  // bubbles
  for (const [bx, by, r] of [[fx - 165, 660, 12], [fx + 170, 655, 14], [fx + 120, 470, 8], [fx - 115, 480, 10], [fx + 30, 455, 6], [fx - 40, 670, 7]]) { x.fillStyle = 'rgba(255,250,225,0.8)'; x.beginPath(); x.arc(bx, by, r, 0, 7); x.fill(); }
  // glass highlight
  x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 14; x.lineCap = 'round'; x.beginPath(); x.moveTo(fx - neckW / 2 + 22, top + 30); x.lineTo(fx - neckW / 2 + 22, top + neckH - 10); x.lineTo(fx - bodyW / 2 + 62, bottom - 90); x.stroke();
  x.restore();
  // flask outline + rim
  x.save(); x.shadowColor = 'rgba(0,0,0,0.5)'; x.shadowBlur = 18; x.strokeStyle = gold(fx - 240, top, fx + 240, bottom); x.lineWidth = 20; x.lineJoin = 'round'; flask(); x.stroke(); x.restore();
  x.fillStyle = gold(0, top - 34, 0, top + 6); x.beginPath(); x.roundRect(fx - neckW / 2 - 36, top - 34, neckW + 72, 40, 16); x.fill();
  x.strokeStyle = 'rgba(11,18,48,0.6)'; x.lineWidth = 3; x.stroke();
  // rising bubbles
  // sparkles
  const spark = (sx, sy, s) => { x.fillStyle = '#fff6d8'; x.beginPath(); x.moveTo(sx, sy - s); x.quadraticCurveTo(sx, sy, sx + s, sy); x.quadraticCurveTo(sx, sy, sx, sy + s); x.quadraticCurveTo(sx, sy, sx - s, sy); x.quadraticCurveTo(sx, sy, sx, sy - s); x.fill(); };
  spark(300, 300, 26); spark(735, 360, 20); spark(760, 250, 12); spark(270, 420, 12);
  // wordmark ribbon
  const ry = 800;
  x.save(); x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 20;
  x.fillStyle = '#0b1230'; x.beginPath(); x.roundRect(M - 300, ry - 70, 600, 140, 26); x.fill(); x.restore();
  x.strokeStyle = gold(0, ry - 70, 0, ry + 70); x.lineWidth = 8; x.beginPath(); x.roundRect(M - 300, ry - 70, 600, 140, 26); x.stroke();
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = 'bold 104px Cinzel'; x.lineWidth = 6; x.strokeStyle = '#05081a'; x.strokeText('TRO LABS', M, ry + 6);
  x.fillStyle = gold(0, ry - 50, 0, ry + 50); x.fillText('TRO LABS', M, ry + 6);
  x.font = 'bold 30px Cinzel'; x.fillStyle = '#f2cf72'; x.fillText('SCRIPT STUDIO', M, ry + 108);
  const tw = x.measureText('SCRIPT STUDIO').width / 2; spark(M - tw - 30, ry + 106, 13); spark(M + tw + 30, ry + 106, 13);
  return c.toBuffer('image/png');
}
module.exports = { render };
