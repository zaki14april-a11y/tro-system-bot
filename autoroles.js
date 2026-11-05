// ============================================================
//  ✅ Role Verified + ♈ Role Zodiac otomatis
//  - Verified: semua yang punya role Member/Tamu (hasil verifikasi)
//  - Zodiac  : dari tanggal lahir yang diisi saat verifikasi
// ============================================================
const cfg = require('./config');

const VERIFIED = { name: '✅ Verified', color: 0x30a46c };
const ZODIAC = [
  ['♑ Capricorn', '12-22', '01-19', 0x6b7280], ['♒ Aquarius', '01-20', '02-18', 0x38bdf8],
  ['♓ Pisces', '02-19', '03-20', 0x818cf8], ['♈ Aries', '03-21', '04-19', 0xef4444],
  ['♉ Taurus', '04-20', '05-20', 0x22c55e], ['♊ Gemini', '05-21', '06-20', 0xfacc15],
  ['♋ Cancer', '06-21', '07-22', 0xe2e8f0], ['♌ Leo', '07-23', '08-22', 0xf97316],
  ['♍ Virgo', '08-23', '09-22', 0xa3e635], ['♎ Libra', '09-23', '10-22', 0xf472b6],
  ['♏ Scorpio', '10-23', '11-21', 0x991b1b], ['♐ Sagittarius', '11-22', '12-21', 0xa855f7],
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function zodiacOf(md) {
  if (!/^\d{2}-\d{2}$/.test(md || '')) return null;
  for (const [name, from, to] of ZODIAC) {
    if (from <= to ? md >= from && md <= to : md >= from || md <= to) return name;
  }
  return null;
}

function setup(bot) {
  const client = bot.client;
  const D = () => cfg.data('autoroles', { enabled: true, verifiedId: '', zodiac: {}, extraVerifiedRoleIds: [] });
  let ready = false;

  async function ensureRoles(g) {
    const d = D();
    const find = async (name, color) => {
      let r = g.roles.cache.get(d.zodiac[name] || (name === VERIFIED.name ? d.verifiedId : '')) || g.roles.cache.find((x) => x.name === name);
      if (!r) r = await g.roles.create({ name, colors: { primaryColor: color }, hoist: false, mentionable: false, reason: 'TRO SYSTEM role otomatis' }).catch(() => null)
        || await g.roles.create({ name, color, hoist: false, mentionable: false, reason: 'TRO SYSTEM role otomatis' }).catch(() => null);
      return r;
    };
    const v = await find(VERIFIED.name, VERIFIED.color);
    if (v) d.verifiedId = v.id;
    for (const [name, , , color] of ZODIAC) { const r = await find(name, color); if (r) d.zodiac[name] = r.id; await sleep(250); }
    // role notifikasi untuk panel ambil-role
    for (const [name, color] of [['🔔 Notif Event', 0xe9d18b], ['🎁 Notif Giveaway', 0xf472b6], ['🛒 Notif TRO Shop', 0x38bdf8], ['🎮 Mabar', 0x22c55e], ['🎤 Karaoke & Music', 0xa855f7]]) {
      if (!g.roles.cache.find((x) => x.name === name)) { await g.roles.create({ name, color, hoist: false, mentionable: true, reason: 'TRO SYSTEM role notif' }).catch(() => {}); await sleep(250); }
    }
    if (!d.extraVerifiedRoleIds.length) { const guest = g.roles.cache.find((r) => r.name === 'GUEST'); if (guest) d.extraVerifiedRoleIds = [guest.id]; }
    cfg.save();
  }

  function isVerified(m) {
    const v = cfg.get().verify, d = D();
    if (v.unverifiedRoleId && m.roles.cache.has(v.unverifiedRoleId)) return false;
    const ok = [...(v.memberRoleIds || []), ...(v.guestRoleIds || []), ...(d.extraVerifiedRoleIds || [])];
    return ok.some((id) => m.roles.cache.has(id));
  }

  async function sync(m) {
    const d = D();
    if (!d.enabled || m.user.bot) return 0;
    let changes = 0;
    if (d.verifiedId) {
      const want = isVerified(m), has = m.roles.cache.has(d.verifiedId);
      if (want && !has) { await m.roles.add(d.verifiedId, 'Sudah verifikasi').catch(() => {}); changes++; }
      if (!want && has) { await m.roles.remove(d.verifiedId, 'Belum verifikasi').catch(() => {}); changes++; }
    }
    const md = cfg.data('birthdays', { users: {}, lastRun: '', roleGiven: [] }).users[m.id];
    const target = zodiacOf(md);
    for (const [name, id] of Object.entries(d.zodiac)) {
      const has = m.roles.cache.has(id);
      if (name === target && !has) { await m.roles.add(id, `Zodiac dari tanggal lahir ${md}`).catch(() => {}); changes++; }
      if (name !== target && has && target) { await m.roles.remove(id, 'Zodiac diperbarui').catch(() => {}); changes++; }
    }
    return changes;
  }

  async function sweep() {
    const g = client.guilds.cache.get(process.env.GUILD_ID);
    if (!g) return;
    const members = await client.fetchMembers(g);
    let n = 0;
    for (const m of members.values()) { const c = await sync(m); if (c) { n += c; await sleep(400); } }
    if (n) cfg.addLog('Role otomatis', `${n} perubahan role Verified/Zodiac`);
  }

  client.once('ready', async () => {
    const g = client.guilds.cache.get(process.env.GUILD_ID);
    if (!g) return;
    await ensureRoles(g).catch((e) => console.error('  ⚠️ autoroles:', e.message));
    ready = true;
    await sweep().catch(() => {});
    console.log('  ✅ Role Verified & Zodiac aktif');
    setInterval(() => sweep().catch(() => {}), 10 * 60_000);
  });

  // role berubah (misal habis di-ACC) → cek ulang beberapa detik kemudian
  client.on('guildMemberUpdate', (oldM, newM) => {
    if (!ready || newM.guild.id !== process.env.GUILD_ID) return;
    if (oldM.roles.cache.size === newM.roles.cache.size && oldM.roles.cache.every((r) => newM.roles.cache.has(r.id))) return;
    setTimeout(() => newM.guild.members.fetch(newM.id).then(sync).catch(() => {}), 4000);
  });

  return { sync, sweep, zodiacOf };
}

module.exports = { setup, zodiacOf };
