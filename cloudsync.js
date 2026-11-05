// ============================================================
//  ☁️ Cadangan data ke Discord
//  Hosting gratis (Render dll) menghapus file tiap restart.
//  Jadi data/config.json dikirim ke channel privat #tro-database
//  dan diambil lagi otomatis saat bot nyala.
// ============================================================
const fs = require('fs');
const path = require('path');

const API = 'https://discord.com/api/v10';
const NAME = 'tro-database';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'config.json');
const H = () => ({ Authorization: `Bot ${process.env.DISCORD_TOKEN}` });
const on = () => process.env.CLOUD_BACKUP !== 'off';

let needFirst = false;
let channelId = null, lastMsg = null, timer = null, busy = false, pending = false;

async function req(method, url, body, json = true) {
  const r = await fetch(API + url, { method, headers: { ...H(), ...(json && body ? { 'Content-Type': 'application/json' } : {}) }, body: json && body ? JSON.stringify(body) : body });
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status} ${await r.text().catch(() => '')}`.slice(0, 300));
  return r.status === 204 ? null : r.json();
}

async function findChannel(create) {
  if (channelId) return channelId;
  const g = process.env.GUILD_ID;
  const chans = await req('GET', `/guilds/${g}/channels`);
  let ch = chans.find((c) => c.type === 0 && c.name === NAME);
  if (!ch && create) {
    const me = await req('GET', '/users/@me');
    ch = await req('POST', `/guilds/${g}/channels`, {
      name: NAME, type: 0, topic: '🔒 Cadangan data TRO SYSTEM — jangan dihapus / jangan chat di sini.',
      permission_overwrites: [{ id: g, type: 0, deny: '1024' }, { id: me.id, type: 1, allow: '101376' }],
    });
  }
  channelId = ch?.id || null;
  return channelId;
}

// dipanggil sebelum bot jalan
async function restore() {
  if (!on()) return;
  try {
    const id = await findChannel(false);
    if (!id) { needFirst = true; return console.log('  ☁️ Belum ada cadangan di Discord (akan dibuat otomatis).'); }
    const msgs = await req('GET', `/channels/${id}/messages?limit=20`);
    const m = msgs.find((x) => x.attachments?.some((a) => a.filename === 'config.json'));
    if (!m) { needFirst = true; return; }
    lastMsg = m.id;
    const att = m.attachments.find((a) => a.filename === 'config.json');
    const remote = await (await fetch(att.url)).text();
    JSON.parse(remote); // pastikan valid
    let localTime = 0;
    try { localTime = fs.statSync(FILE).mtimeMs; } catch { /* belum ada */ }
    const remoteTime = Date.parse(m.timestamp);
    if (!localTime || remoteTime > localTime) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(FILE, remote);
      console.log(`  ☁️ Data dipulihkan dari #${NAME} (${new Date(remoteTime).toLocaleString('id-ID')})`);
    }
  } catch (e) { console.error('  ⚠️ Gagal ambil cadangan:', e.message); }
}

async function upload() {
  if (busy) { pending = true; return; }
  busy = true;
  try {
    const id = await findChannel(true);
    const fd = new FormData();
    fd.append('payload_json', JSON.stringify({ content: `💾 Cadangan otomatis • <t:${Math.floor(Date.now() / 1000)}:f>` }));
    fd.append('files[0]', new Blob([fs.readFileSync(FILE)], { type: 'application/json' }), 'config.json');
    const m = await req('POST', `/channels/${id}/messages`, fd, false);
    const old = lastMsg; lastMsg = m.id;
    if (old) await req('DELETE', `/channels/${id}/messages/${old}`).catch(() => {});
  } catch (e) { console.error('  ⚠️ Gagal simpan cadangan:', e.message); }
  busy = false;
  if (pending) { pending = false; schedule(); }
}

// dipanggil tiap kali data disimpan (dikumpulkan 20 detik biar tidak spam)
function schedule() {
  if (!on()) return;
  clearTimeout(timer);
  timer = setTimeout(upload, 20_000);
}

async function flush() { if (on() && timer) { clearTimeout(timer); timer = null; await upload(); } }

function ensureFirst() { if (needFirst && on()) { needFirst = false; setTimeout(upload, 15_000); } }

module.exports = { restore, schedule, flush, ensureFirst };
