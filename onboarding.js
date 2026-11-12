// ============================================================
//  🚪 ONBOARDING bawaan Discord — pertanyaan saat member baru join
//  Tamu: verif langsung di onboarding (✅ Verified + 🎟️ TAMU)
//  TRO MEMBER: tetap lewat form pengajuan bot + ACC admin
// ============================================================
const { Events, GuildOnboardingMode, GuildOnboardingPromptType, PermissionFlagsBits: P, ChannelType } = require('discord.js');
const cfg = require('./config');

const GEN = [
  ['Gen Milenial', 'Kelahiran 1981–1996', '💼', 0xef4444],
  ['Gen Z', 'Kelahiran 1997–2012', '⚡', 0x3b82f6],
  ['Gen Alpha', 'Kelahiran 2013–sekarang', '🌱', 0x22c55e],
];
const PROV = [
  ['📍 Jabodetabek', 'Jakarta, Bogor, Depok, Tangerang, Bekasi', '🏙️'],
  ['📍 Banten', 'Serang, Cilegon, Pandeglang, Lebak', '🏯'],
  ['📍 Jawa Barat', 'Bandung, Cirebon, Sukabumi, dll', '⛰️'],
  ['📍 Jawa Tengah & DIY', 'Semarang, Solo, Yogyakarta, dll', '🛕'],
  ['📍 Jawa Timur', 'Surabaya, Malang, dll', '🌋'],
  ['📍 Bali & Nusa Tenggara', 'Bali, NTB, NTT', '🏝️'],
  ['📍 Sumatra', 'Medan, Padang, Palembang, Lampung, dll', '🌴'],
  ['📍 Kalimantan', 'Pontianak, Balikpapan, Banjarmasin, dll', '🌳'],
  ['📍 Sulawesi', 'Makassar, Manado, Palu, dll', '🐟'],
  ['📍 Maluku & Papua', 'Ambon, Jayapura, Sorong, dll', '🦜'],
  ['📍 Luar Negeri', 'Tinggal di luar Indonesia', '✈️'],
];
const NOTIF = [
  ['🔔 Notif Event', 'Info event & acara TRO', '🔔'],
  ['🎁 Notif Giveaway', 'Kabar giveaway', '🎁'],
  ['🛒 Notif TRO Shop', 'Restock Robux & promo TROlley', '🛒'],
  ['🎮 Mabar', 'Ajakan main bareng', '🎮'],
  ['🎤 Karaoke & Music', 'Sesi karaoke & musik', '🎤'],
];

function setup({ client }) {
  const D = () => cfg.data('onboarding', { lastApply: null, lastError: '', joined: 0 });
  const guild = () => client.guilds.cache.get(process.env.GUILD_ID) || client.guilds.cache.first();
  const role = (g, name) => g.roles.cache.find((r) => r.name === name);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function ensureRoles(g) {
    const made = [];
    for (const [name, , , color] of GEN) if (!role(g, name)) { await g.roles.create({ name, color, hoist: false, mentionable: false, reason: 'TRO onboarding: generasi' }).catch(() => {}); made.push(name); await sleep(300); }
    for (const [name] of PROV) if (!role(g, name)) { await g.roles.create({ name, hoist: false, mentionable: false, reason: 'TRO onboarding: domisili' }).catch(() => {}); made.push(name); await sleep(300); }
    return made;
  }

  // channel yang boleh dilihat + dipakai chat oleh role tertentu
  function chansFor(g, roleIds, onlyText = true) {
    return g.channels.cache.filter((c) => (!onlyText || c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) && !/ticket-|tro-database/i.test(c.name)).filter((c) => {
      const ev = c.permissionsFor(g.roles.everyone); if (!ev) return false;
      // anggap member punya @everyone + roleIds
      let allow = ev.has(P.ViewChannel);
      for (const id of roleIds) { const ow = c.permissionOverwrites.cache.get(id); if (ow?.allow.has(P.ViewChannel)) allow = true; if (ow?.deny.has(P.ViewChannel)) allow = false; }
      return allow;
    });
  }

  function buildPrompts(g) {
    const ar = cfg.data('autoroles', {}), v = cfg.get().verify;
    const verified = ar.verifiedId || role(g, '✅ Verified')?.id;
    const tamu = (v.guestRoleIds || [])[0] || role(g, '🎟️ TAMU')?.id;
    const ids = (arr) => arr.map((x) => role(g, x[0])?.id).filter(Boolean);
    const opt = (title, description, emoji, roles) => ({ title, description, emoji: { name: emoji }, roles: roles.filter(Boolean), channels: [] });
    return [
      { title: 'Klik di sini untuk verifikasi!', singleSelect: true, required: true, inOnboarding: true, type: GuildOnboardingPromptType.MultipleChoice,
        options: [opt('Verifikasi', 'Masuk sebagai tamu. Mau jadi TRO MEMBER? Ajukan di #verifikasi (ACC admin)', '✅', [verified, tamu])] },
      { title: 'Pilih gender kamu', singleSelect: true, required: true, inOnboarding: true, type: GuildOnboardingPromptType.MultipleChoice,
        options: [opt('Femme', 'Perempuan', '🌸', [role(g, 'Femme')?.id]), opt('Gentleman', 'Laki-laki', '🎩', [role(g, 'Gentleman')?.id])] },
      { title: 'Pilih generasi kamu', singleSelect: true, required: true, inOnboarding: true, type: GuildOnboardingPromptType.MultipleChoice,
        options: GEN.map(([n, d, e]) => opt(n, d, e, [role(g, n)?.id])) },
      { title: 'Domisili kamu di mana?', singleSelect: true, required: true, inOnboarding: true, type: GuildOnboardingPromptType.Dropdown,
        options: PROV.map(([n, d, e]) => opt(n.replace('📍 ', ''), d, e, [role(g, n)?.id])) },
      { title: 'Mau dapat notifikasi apa aja?', singleSelect: false, required: false, inOnboarding: true, type: GuildOnboardingPromptType.MultipleChoice,
        options: NOTIF.map(([n, d, e]) => opt(n.replace(/^\S+\s/, ''), d, e, [role(g, n)?.id])) },
    ].map((p) => ({ ...p, options: p.options.filter((o) => o.roles.length) })).filter((p) => p.options.length);
  }

  async function apply() {
    const g = guild(); if (!g) throw new Error('Guild belum siap');
    if (!g.features.includes('COMMUNITY')) throw new Error('Server belum jadi Community Server. Aktifkan dulu: Server Settings → Enable Community.');
    const made = await ensureRoles(g);
    const prompts = buildPrompts(g);
    const ar = cfg.data('autoroles', {}), v = cfg.get().verify;
    const verified = ar.verifiedId || role(g, '✅ Verified')?.id, tamu = (v.guestRoleIds || [])[0];
    // default channel: yang kelihatan untuk tamu terverifikasi (info + ngobrol), maks 30
    const pool = chansFor(g, [verified, tamu].filter(Boolean)).sort((a, b) => a.rawPosition - b.rawPosition);
    const defaultChannels = [...pool.keys()].slice(0, 30);
    try {
      const res = await g.editOnboarding({ enabled: true, mode: GuildOnboardingMode.OnboardingAdvanced, prompts, defaultChannels, reason: 'TRO SYSTEM onboarding' });
      Object.assign(D(), { lastApply: new Date().toISOString(), lastError: '' }); cfg.save();
      return { ok: true, rolesCreated: made, prompts: res.prompts.size, defaultChannels: res.defaultChannels.size, enabled: res.enabled };
    } catch (e) {
      // kalau syarat channel kurang, coba simpan dulu tanpa enable biar pertanyaan tersimpan
      let saved = false;
      try { await g.editOnboarding({ enabled: false, mode: GuildOnboardingMode.OnboardingAdvanced, prompts, defaultChannels }); saved = true; } catch { /* abaikan */ }
      D().lastError = e.message; cfg.save();
      return { ok: false, error: e.message, savedDisabled: saved, rolesCreated: made, defaultChannels: defaultChannels.length };
    }
  }

  // selesai onboarding (dapat ✅ Verified / 🎟️ TAMU) → cabut ⏳ Belum Verifikasi biar Verified tidak dicabut autoroles
  client.on(Events.GuildMemberUpdate, async (o, n) => {
    try {
      const v = cfg.get().verify, un = v.unverifiedRoleId; if (!un || !n.roles.cache.has(un)) return;
      const ar = cfg.data('autoroles', {});
      const ok = [ar.verifiedId, ...(v.guestRoleIds || [])].filter(Boolean);
      const gained = ok.some((id) => n.roles.cache.has(id) && !o.roles?.cache?.has(id));
      if (!gained) return;
      await n.roles.remove(un, 'Selesai onboarding (verif tamu)').catch(() => {});
      D().joined = (D().joined || 0) + 1; cfg.saveSoon?.();
    } catch (e) { console.error('[onboarding]', e.message); }
  });

  function routes(api) {
    api.get('/onboarding', async (req, res) => {
      try {
        const g = guild(); if (!g) return res.json({ ready: false });
        const cur = await g.fetchOnboarding().catch(() => null);
        res.json({ ready: true, community: g.features.includes('COMMUNITY'), ...D(),
          current: cur ? { enabled: cur.enabled, mode: cur.mode, prompts: [...cur.prompts.values()].map((p) => ({ title: p.title, required: p.required, options: p.options.size })), defaultChannels: cur.defaultChannels.size } : null });
      } catch (e) { res.status(400).json({ error: e.message }); }
    });
    api.post('/onboarding/apply', async (req, res) => { try { res.json(await apply()); } catch (e) { res.status(400).json({ error: e.message }); } });
  }

  return { commands: [], routes };
}

module.exports = { setup };
