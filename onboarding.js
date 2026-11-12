// ============================================================
//  🚪 ONBOARDING bawaan Discord — pertanyaan saat member baru join
//  Tamu: verif langsung di onboarding (✅ Verified + 🎟️ TAMU)
//  TRO MEMBER: tetap lewat form pengajuan bot + ACC admin
// ============================================================
const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, GuildOnboardingMode, GuildOnboardingPromptType, PermissionFlagsBits: P, ChannelType } = require('discord.js');
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

// 🧭 Server Guide: sambutan + langkah Get Started (urut, kayak jalan tutorial) + kotak info
const GUIDE = {
  author: '563752367305261107',
  message: 'Selamat datang di THE RESILIENT ORDER! 🦉 Komunitas Roblox TRO TEAM. Ikuti langkah Get Started di bawah: kenalan, baca rules, ambil role, lalu sapa warga TRO. Mau jadi TRO MEMBER? Ajukan di #verifikasi (di-ACC admin).',
  actions: [
    [/who-we-are/, 0, 'Kenalan sama TRO', 'Siapa kami & apa aja di TRO', '🦉'],
    [/」rules$/, 0, 'Baca rules TRO', 'Aturan biar semua nyaman', '📜'],
    [/ambil-role/, 0, 'Ambil role kamu', 'Notif, mabar, karaoke & lainnya', '🎭'],
    [/global-chat/, 1, 'Sapa warga TRO!', 'Kenalin diri kamu di sini', '💬'],
    [/」verifikasi$/, 0, 'Mau jadi TRO MEMBER?', 'Isi form, tunggu ACC admin', '🪪'],
  ],
  resources: [
    [/」announcements$/, 'Pengumuman', 'Info resmi TRO', '🔔'],
    [/」events$/, 'Event', 'Acara & kegiatan TRO', '🎊'],
    [/server-update/, 'Update server', 'Perubahan & fitur baru', '🆕'],
    [/price-list-robux/, 'TROlley — harga Robux', 'Price list & cara beli', '💰'],
    [/trolley-guide/, 'Cara order TROlley', 'Panduan order lewat tiket', '🛒'],
    [/buka-tiket/, 'Butuh bantuan?', 'Buka tiket ke staff', '🎫'],
  ],
};

function setup({ client, baseEmbed }) {
  const D = () => cfg.data('onboarding', { lastApply: null, lastError: '', joined: 0, remindAuto: true, remindMax: 3, reminded: {}, panelMessageId: '' });
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
      const guide = await applyGuide().catch((e) => { D().guideError = e.message; cfg.save(); return { ok: false, error: e.message }; });
      return { ok: true, rolesCreated: made, prompts: res.prompts.size, defaultChannels: res.defaultChannels.size, enabled: res.enabled, guide };
    } catch (e) {
      // kalau syarat channel kurang, coba simpan dulu tanpa enable biar pertanyaan tersimpan
      let saved = false;
      try { await g.editOnboarding({ enabled: false, mode: GuildOnboardingMode.OnboardingAdvanced, prompts, defaultChannels }); saved = true; } catch { /* abaikan */ }
      D().lastError = e.message; cfg.save();
      return { ok: false, error: e.message, savedDisabled: saved, rolesCreated: made, defaultChannels: defaultChannels.length };
    }
  }

  async function applyGuide() {
    const g = guild(); if (!g) throw new Error('Guild belum siap');
    const ar = cfg.data('autoroles', {}), v = cfg.get().verify;
    const seen = chansFor(g, [ar.verifiedId || role(g, '✅ Verified')?.id, (v.guestRoleIds || [])[0]].filter(Boolean));
    const find = (re) => seen.find((c) => re.test(c.name));
    const new_member_actions = GUIDE.actions.map(([re, type, title, description, emoji]) => { const c = find(re); return c && { channel_id: c.id, action_type: type, title, description, emoji: { name: emoji }, icon: null }; }).filter(Boolean);
    const resource_channels = GUIDE.resources.map(([re, title, description, emoji]) => { const c = find(re); return c && { channel_id: c.id, title, description, emoji: { name: emoji }, icon: null }; }).filter(Boolean);
    const body = { enabled: true, welcome_message: { author_ids: [GUIDE.author], message: GUIDE.message }, new_member_actions, resource_channels };
    await client.rest.put(`/guilds/${g.id}/new-member-welcome`, { body });
    D().guideAt = new Date().toISOString(); D().guideError = ''; cfg.save();
    return { ok: true, actions: new_member_actions.length, resources: resource_channels.length };
  }

  // 🔔 notif wajib verifikasi → arahkan ke halaman pertanyaan onboarding (Channels & Roles → Customize)
  const verifyUrl = (g) => `https://discord.com/channels/${g.id}/customize-community`;
  const verifyRow = (g) => new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(verifyUrl(g)).setLabel('Verifikasi sekarang').setEmoji('✅'));
  const unverifiedMembers = async (g) => { const un = cfg.get().verify.unverifiedRoleId; if (!un) return []; const ms = client.fetchMembers ? await client.fetchMembers(g) : await g.members.fetch(); return [...ms.values()].filter((m) => !m.user.bot && m.roles.cache.has(un)); };
  async function postVerifyNotice() {
    const g = guild(); const v = cfg.get().verify; const ch = v.panelChannelId && await client.channels.fetch(v.panelChannelId).catch(() => null);
    if (!ch) throw new Error('Channel verifikasi belum diset');
    const payload = { content: v.unverifiedRoleId ? `<@&${v.unverifiedRoleId}>` : undefined, allowedMentions: { roles: v.unverifiedRoleId ? [v.unverifiedRoleId] : [] },
      embeds: [baseEmbed({ title: '⚠️ WAJIB VERIFIKASI', description: `Kamu belum verifikasi, jadi channel TRO masih terkunci 🔒\n\nKlik **✅ Verifikasi sekarang** → jawab beberapa pertanyaan singkat (gender, generasi, domisili, notif) → semua channel langsung kebuka.\n\n🦉 Mau jadi **TRO MEMBER**? Setelah verifikasi, ajukan lewat panel di channel ini (di-ACC admin).`, color: '#f59e0b' })], components: [verifyRow(g)] };
    const old = D().panelMessageId && await ch.messages.fetch(D().panelMessageId).catch(() => null);
    if (old) await old.edit({ content: null, embeds: [baseEmbed({ title: '⚠️ WAJIB VERIFIKASI', description: '⬇️ Pengingat terbaru ada di bawah.', color: '#7f8c8d' })], components: [] }).catch(() => {}); // pesan lama tidak dihapus, cuma ditandai
    const m = await ch.send(payload); D().panelMessageId = m.id; cfg.save();
    return m.id;
  }
  let reminding = null;
  async function remindAll(force) {
    if (reminding) return { running: true, ...reminding };
    const g = guild(); if (!g) throw new Error('Guild belum siap');
    const list = await unverifiedMembers(g); const d = D(); d.reminded ??= {};
    reminding = { total: list.length, sent: 0, skipped: 0, failed: 0 };
    (async () => {
      for (const m of list) {
        const r = d.reminded[m.id] || { n: 0, at: 0 };
        if (!force && (r.n >= (d.remindMax || 3) || Date.now() - r.at < 20 * 3600e3)) { reminding.skipped++; continue; }
        const ok = await m.send({ embeds: [baseEmbed({ title: '⚠️ Kamu belum verifikasi di THE RESILIENT ORDER', description: `Hai ${m.displayName}! Biar bisa ngobrol & ikut kegiatan di **TRO**, verifikasi dulu ya — cuma beberapa klik.\n\nKlik **✅ Verifikasi sekarang** di bawah, jawab pertanyaan singkatnya, beres 🦉`, color: '#f59e0b' })], components: [verifyRow(g)] }).then(() => 1).catch(() => 0);
        if (ok) { reminding.sent++; d.reminded[m.id] = { n: r.n + 1, at: Date.now() }; } else reminding.failed++;
        await sleep(1500);
      }
      d.lastRemind = { at: new Date().toISOString(), ...reminding }; cfg.save(); reminding = null;
    })().catch(() => { reminding = null; });
    return { started: true, total: list.length };
  }
  // pengingat otomatis sehari sekali (maks remindMax kali per orang)
  setInterval(() => { if (D().remindAuto && D().lastApply && guild()) remindAll(false).catch(() => {}); }, 6 * 3600e3).unref?.();

  // selesai onboarding (dapat ✅ Verified / 🎟️ TAMU) → cabut ⏳ Belum Verifikasi biar Verified tidak dicabut autoroles
  client.on(Events.GuildMemberUpdate, async (o, n) => {
    try {
      const v = cfg.get().verify, un = v.unverifiedRoleId; if (!un || !n.roles.cache.has(un)) return;
      const ar = cfg.data('autoroles', {});
      const ok = [ar.verifiedId, ...(v.guestRoleIds || [])].filter(Boolean);
      const gained = ok.some((id) => n.roles.cache.has(id) && !o.roles?.cache?.has(id));
      if (!gained) return;
      await n.roles.remove(un, 'Selesai onboarding (verif tamu)').catch(() => {}); delete D().reminded?.[n.id];
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
    api.get('/onboarding/unverified', async (req, res) => { try { const g = guild(); const l = await unverifiedMembers(g); res.json({ count: l.length, reminding, last: D().lastRemind || null, auto: D().remindAuto, sample: l.slice(0, 20).map((m) => ({ id: m.id, name: m.displayName, joined: m.joinedAt })) }); } catch (e) { res.status(400).json({ error: e.message }); } });
    api.post('/onboarding/notice', async (req, res) => { try { res.json({ id: await postVerifyNotice() }); } catch (e) { res.status(400).json({ error: e.message }); } });
    api.post('/onboarding/remind', async (req, res) => { try { res.json(await remindAll(!!req.body?.force)); } catch (e) { res.status(400).json({ error: e.message }); } });
    api.put('/onboarding/settings', (req, res) => { const d = D(); if (req.body.remindAuto !== undefined) d.remindAuto = !!req.body.remindAuto; if (Number(req.body.remindMax) >= 0) d.remindMax = Number(req.body.remindMax); cfg.save(); res.json({ ok: true }); });
    api.post('/onboarding/guide', async (req, res) => { try { res.json(await applyGuide()); } catch (e) { D().guideError = e.message; cfg.save(); res.status(400).json({ error: e.message }); } });
    api.post('/onboarding/apply', async (req, res) => { try { res.json(await apply()); } catch (e) { res.status(400).json({ error: e.message }); } });
  }

  return { commands: [], routes };
}

module.exports = { setup };
