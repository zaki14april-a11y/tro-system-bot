// ============================================================
//  📅 Event & reminder · 🎂 Ulang tahun · 📊 Statistik · 🔊 Custom voice
// ============================================================
const {
  Events, SlashCommandBuilder, MessageFlags, PermissionFlagsBits: P, ChannelType,
} = require('discord.js');
const cfg = require('./config');
const { parseDate, prettyDate } = require('./fams');

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const wibNow = () => new Date(Date.now() + 7 * 3600_000); // jam dinding WIB (pakai getUTC*)
const eventTime = (e) => Date.parse(`${e.date}T${(e.time || '00:00').padStart(5, '0')}:00+07:00`);

function setup({ client, baseEmbed }) {
  const guild = () => client.guilds.cache.get(process.env.GUILD_ID);
  const ts = (ms) => Math.floor(ms / 1000);

  // ======================= EVENT =======================
  const ED = () => cfg.data('eventsData', { items: [] });
  const E = () => cfg.get().events;

  function eventEmbed(e, title) {
    const t = eventTime(e);
    return baseEmbed({
      title: title || `🎊 ${e.title}`,
      description: `${e.desc ? `${e.desc}\n\n` : ''}📅 **${prettyDate(e.date)}** · ⏰ **${e.time || '-'} WIB**\n🕒 <t:${ts(t)}:F> (<t:${ts(t)}:R>)${e.place ? `\n📍 **Tempat:** ${e.place}` : ''}${e.host ? `\n🎧 **Host / DJ:** ${e.host}` : ''}${e.link ? `\n🔗 ${e.link}` : ''}`,
      image: e.image || undefined,
    });
  }

  async function eventSend(e, title, ping = true) {
    const ch = E().channelId && await client.channels.fetch(E().channelId).catch(() => null);
    if (!ch) return;
    const role = ping && (e.pingRoleId || E().pingRoleId);
    await ch.send({ content: role ? `<@&${role}>` : undefined, embeds: [eventEmbed(e, title)], allowedMentions: { roles: role ? [role] : [] } }).catch(() => {});
  }

  async function eventAdd(data, by) {
    const date = parseDate(data.date);
    if (!date) throw new Error('Format tanggal salah (contoh: 08/11/2026)');
    if (!/^\d{1,2}[:.]\d{2}$/.test(String(data.time || '').trim())) throw new Error('Format jam salah (contoh: 20:00)');
    const e = {
      id: data.id || newId(), title: String(data.title || '').trim().slice(0, 120), desc: String(data.desc || '').slice(0, 1500),
      date, time: String(data.time).trim().replace('.', ':').padStart(5, '0'), place: String(data.place || '').slice(0, 120),
      host: String(data.host || '').slice(0, 120), link: String(data.link || '').slice(0, 300), image: String(data.image || '').slice(0, 500),
      pingRoleId: data.pingRoleId || '', createdBy: by, sent: [], started: false,
    };
    if (!e.title) throw new Error('Judul event wajib diisi');
    if (eventTime(e) < Date.now()) throw new Error('Waktu event sudah lewat');
    const items = ED().items;
    const idx = items.findIndex((x) => x.id === e.id);
    if (idx >= 0) items[idx] = { ...items[idx], ...e, sent: [], started: false }; else items.push(e);
    items.sort((a, b) => eventTime(a) - eventTime(b));
    cfg.save();
    cfg.addLog(idx >= 0 ? 'Event diubah' : 'Event dibuat', `${e.title} — ${prettyDate(date)} ${e.time} (oleh ${by})`);
    if (data.announce !== false) await eventSend(e, `📢 EVENT BARU — ${e.title}`);
    return e;
  }

  // ======================= ULANG TAHUN =======================
  const BD = () => cfg.data('birthdays', { users: {}, lastRun: '', roleGiven: [] });
  const B = () => cfg.get().birthday;
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  function parseBirthday(s) {
    const m = String(s || '').trim().match(/^(\d{1,2})[/.-](\d{1,2})$/);
    if (!m) return null;
    const d = +m[1], mo = +m[2];
    const dt = new Date(Date.UTC(2024, mo - 1, d));
    return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? `${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
  }
  const prettyBd = (md) => `${+md.slice(3)} ${BULAN[+md.slice(0, 2) - 1]}`;

  async function birthdayRun(force = false) {
    const b = B(), d = BD(), g = guild();
    if (!b.enabled || !g) return [];
    const now = wibNow();
    const today = now.toISOString().slice(0, 10);
    if (!force && (d.lastRun === today || now.getUTCHours() < (Number(b.hour) || 0))) return [];
    d.lastRun = today;
    // cabut role ulang tahun kemarin
    for (const id of d.roleGiven) { const m = await g.members.fetch(id).catch(() => null); if (m && b.roleId) await m.roles.remove(b.roleId).catch(() => {}); }
    d.roleGiven = [];
    const md = today.slice(5);
    const ids = Object.entries(d.users).filter(([, v]) => v === md).map(([id]) => id);
    const ch = b.channelId && await client.channels.fetch(b.channelId).catch(() => null);
    for (const id of ids) {
      const m = await g.members.fetch(id).catch(() => null);
      if (!m) continue;
      if (b.roleId) { await m.roles.add(b.roleId).catch(() => {}); d.roleGiven.push(id); }
      if (ch) await ch.send({ content: `<@${id}>`, embeds: [baseEmbed({ title: '🎂 HAPPY BIRTHDAY!', description: String(b.message).replaceAll('{user}', `<@${id}>`).replaceAll('{username}', m.user.username), thumbnail: m.user.displayAvatarURL({ size: 256 }), color: '#ff7eb6' })], allowedMentions: { users: [id] } }).catch(() => {});
    }
    cfg.save();
    if (ids.length) cfg.addLog('Ulang tahun', `${ids.length} member ulang tahun hari ini`);
    return ids;
  }

  // ======================= STATISTIK =======================
  async function statsRun() {
    const s = cfg.get().stats, g = guild();
    if (!s.enabled || !g) return [];
    const members = g.memberCount;
    const bots = g.members.cache.filter((m) => m.user.bot).size;
    const online = g.members.cache.filter((m) => m.presence && m.presence.status !== 'offline').size;
    const vals = { members, humans: members - bots, bots, online, boosts: g.premiumSubscriptionCount || 0, voice: g.voiceStates.cache.filter((v) => v.channelId).size };
    const done = [];
    for (const slot of s.slots) {
      if (!slot.channelId || !slot.template) continue;
      const ch = g.channels.cache.get(slot.channelId);
      if (!ch) continue;
      const name = slot.template.replace(/\{(\w+)\}/g, (_, k) => vals[k] ?? `{${k}}`).slice(0, 100);
      if (ch.name !== name) { await ch.setName(name, 'TRO SYSTEM statistik').catch(() => {}); done.push(name); }
    }
    return done;
  }

  // ======================= CUSTOM VOICE =======================
  const TD = () => cfg.data('tempVoice', { channels: {} });
  const TV = () => cfg.get().tempvoice;

  client.on(Events.VoiceStateUpdate, async (oldS, newS) => {
    const tv = TV(), d = TD();
    if (newS.guild.id !== process.env.GUILD_ID) return;
    // join hub → buat voice pribadi
    if (tv.enabled && tv.hubChannelId && newS.channelId === tv.hubChannelId && newS.member && !newS.member.user.bot) {
      const hub = newS.channel;
      const name = String(tv.nameTemplate || '🔊 {user}').replaceAll('{user}', newS.member.displayName).slice(0, 100);
      const ch = await newS.guild.channels.create({
        name, type: ChannelType.GuildVoice, parent: tv.categoryId || hub.parentId || null, userLimit: Number(tv.defaultLimit) || 0,
        permissionOverwrites: [{ id: newS.member.id, allow: [P.ManageChannels, P.MoveMembers, P.Connect, P.Speak, P.MuteMembers] }],
        reason: 'TRO SYSTEM custom voice',
      }).catch(() => null);
      if (ch) {
        d.channels[ch.id] = newS.member.id; cfg.save();
        await newS.member.voice.setChannel(ch).catch(() => {});
      }
    }
    // voice pribadi kosong → hapus
    const left = oldS.channel;
    if (left && d.channels[left.id] && left.members.filter((m) => !m.user.bot).size === 0) {
      delete d.channels[left.id]; cfg.save();
      await left.delete('TRO SYSTEM custom voice kosong').catch(() => {});
    }
  });

  // ======================= TIMER =======================
  setInterval(async () => {
    // reminder event
    const now = Date.now();
    for (const e of ED().items) {
      const t = eventTime(e);
      for (const min of (E().reminders || [])) {
        const key = `r${min}`;
        if (!e.sent.includes(key) && now >= t - min * 60_000 && now < t) {
          e.sent.push(key); cfg.save();
          await eventSend(e, `⏰ ${min >= 60 ? `${Math.round(min / 60)} jam` : `${min} menit`} lagi — ${e.title}`);
        }
      }
      if (!e.started && now >= t && now < t + 30 * 60_000) { e.started = true; cfg.save(); await eventSend(e, `🔴 DIMULAI SEKARANG — ${e.title}`); }
    }
    // buang event yang sudah lewat > 7 hari
    const before = ED().items.length;
    ED().items = ED().items.filter((e) => eventTime(e) > now - 7 * 86_400_000);
    if (ED().items.length !== before) cfg.save();
    birthdayRun().catch(() => {});
  }, 30_000);
  setInterval(() => statsRun().catch(() => {}), 10 * 60_000);
  client.once(Events.ClientReady, () => setTimeout(() => statsRun().catch(() => {}), 15_000));

  // ======================= COMMANDS =======================
  client.on(Events.InteractionCreate, async (it) => {
    if (!it.isChatInputCommand()) return;
    try {
      if (it.commandName === 'event') {
        const sub = it.options.getSubcommand();
        if (sub === 'tambah') {
          const e = await eventAdd({ title: it.options.getString('judul'), date: it.options.getString('tanggal'), time: it.options.getString('jam'), place: it.options.getString('tempat'), host: it.options.getString('host'), desc: it.options.getString('deskripsi'), pingRoleId: it.options.getRole('ping')?.id }, it.user.username);
          return it.reply({ content: `✅ Event **${e.title}** dijadwalkan ${prettyDate(e.date)} ${e.time} WIB. Reminder otomatis aktif. ID: \`${e.id}\``, flags: MessageFlags.Ephemeral });
        }
        if (sub === 'list') {
          const up = ED().items.filter((e) => eventTime(e) > Date.now()).slice(0, 15);
          return it.reply({ embeds: [baseEmbed({ title: '📅 Jadwal Event TRO', description: up.length ? up.map((e) => `**${e.title}** — <t:${ts(eventTime(e))}:F> (<t:${ts(eventTime(e))}:R>)${e.place ? ` · 📍 ${e.place}` : ''}\n\`${e.id}\``).join('\n\n') : 'Belum ada event terjadwal.' })], flags: MessageFlags.Ephemeral });
        }
        if (sub === 'hapus') {
          const id = it.options.getString('id');
          ED().items = ED().items.filter((e) => e.id !== id); cfg.save();
          return it.reply({ content: '🗑️ Event dihapus.', flags: MessageFlags.Ephemeral });
        }
      }
      if (it.commandName === 'ultah') {
        const sub = it.options.getSubcommand();
        const d = BD();
        if (sub === 'set') {
          const md = parseBirthday(it.options.getString('tanggal'));
          if (!md) return it.reply({ content: '❌ Format salah. Contoh: `13/11`', flags: MessageFlags.Ephemeral });
          d.users[it.user.id] = md; cfg.save();
          return it.reply({ content: `🎂 Ulang tahun kamu dicatat: **${prettyBd(md)}**`, flags: MessageFlags.Ephemeral });
        }
        if (sub === 'hapus') { delete d.users[it.user.id]; cfg.save(); return it.reply({ content: '🗑️ Data ulang tahun dihapus.', flags: MessageFlags.Ephemeral }); }
        if (sub === 'lihat') {
          const u = it.options.getUser('user') || it.user;
          return it.reply({ content: d.users[u.id] ? `🎂 Ulang tahun **${u.username}**: ${prettyBd(d.users[u.id])}` : `${u.username} belum mengisi ulang tahun.`, flags: MessageFlags.Ephemeral });
        }
      }
      if (it.commandName === 'voice') {
        const ch = it.member.voice.channel;
        const d = TD();
        if (!ch || !d.channels[ch.id]) return it.reply({ content: '❌ Kamu harus berada di voice pribadi kamu.', flags: MessageFlags.Ephemeral });
        const sub = it.options.getSubcommand();
        if (sub === 'klaim') {
          if (ch.members.has(d.channels[ch.id])) return it.reply({ content: '⛔ Pemiliknya masih ada di voice.', flags: MessageFlags.Ephemeral });
          d.channels[ch.id] = it.user.id; cfg.save();
          await ch.permissionOverwrites.edit(it.user.id, { ManageChannels: true, MoveMembers: true });
          return it.reply({ content: '👑 Voice ini sekarang milik kamu.', flags: MessageFlags.Ephemeral });
        }
        if (d.channels[ch.id] !== it.user.id) return it.reply({ content: '⛔ Hanya pemilik voice.', flags: MessageFlags.Ephemeral });
        if (sub === 'kunci') { await ch.permissionOverwrites.edit(ch.guild.id, { Connect: false }); return it.reply({ content: '🔒 Voice dikunci.', flags: MessageFlags.Ephemeral }); }
        if (sub === 'buka') { await ch.permissionOverwrites.edit(ch.guild.id, { Connect: null }); return it.reply({ content: '🔓 Voice dibuka.', flags: MessageFlags.Ephemeral }); }
        if (sub === 'limit') { await ch.setUserLimit(it.options.getInteger('jumlah')); return it.reply({ content: `👥 Limit: ${it.options.getInteger('jumlah') || 'tanpa batas'}`, flags: MessageFlags.Ephemeral }); }
        if (sub === 'nama') { await ch.setName(it.options.getString('nama').slice(0, 100)); return it.reply({ content: '✏️ Nama voice diganti.', flags: MessageFlags.Ephemeral }); }
        if (sub === 'kick') {
          const u = it.options.getUser('user');
          const m = ch.members.get(u.id);
          if (m) await m.voice.disconnect('Dikeluarkan pemilik voice');
          await ch.permissionOverwrites.edit(u.id, { Connect: false });
          return it.reply({ content: `👢 ${u.username} dikeluarkan.`, flags: MessageFlags.Ephemeral });
        }
        if (sub === 'izinkan') {
          const u = it.options.getUser('user');
          await ch.permissionOverwrites.edit(u.id, { Connect: true });
          return it.reply({ content: `✅ ${u.username} boleh masuk.`, flags: MessageFlags.Ephemeral });
        }
      }
    } catch (err) {
      const msg = { content: `❌ ${err.message}`, flags: MessageFlags.Ephemeral };
      if (it.deferred || it.replied) it.editReply(msg).catch(() => {}); else it.reply(msg).catch(() => {});
    }
  });

  const commands = [
    new SlashCommandBuilder().setName('event').setDescription('Jadwal event TRO')
      .addSubcommand((s) => s.setName('tambah').setDescription('Jadwalkan event (khusus staff)')
        .addStringOption((o) => o.setName('judul').setDescription('Nama event').setRequired(true))
        .addStringOption((o) => o.setName('tanggal').setDescription('contoh: 08/11/2026').setRequired(true))
        .addStringOption((o) => o.setName('jam').setDescription('contoh: 20:00 (WIB)').setRequired(true))
        .addStringOption((o) => o.setName('tempat').setDescription('Map / lokasi'))
        .addStringOption((o) => o.setName('host').setDescription('Host / DJ'))
        .addStringOption((o) => o.setName('deskripsi').setDescription('Deskripsi'))
        .addRoleOption((o) => o.setName('ping').setDescription('Role yang di-ping')))
      .addSubcommand((s) => s.setName('list').setDescription('Lihat jadwal event'))
      .addSubcommand((s) => s.setName('hapus').setDescription('Hapus event').addStringOption((o) => o.setName('id').setDescription('ID event').setRequired(true)))
      .setDefaultMemberPermissions(P.ManageEvents),
    new SlashCommandBuilder().setName('ultah').setDescription('Ulang tahun')
      .addSubcommand((s) => s.setName('set').setDescription('Catat ulang tahun kamu').addStringOption((o) => o.setName('tanggal').setDescription('contoh: 13/11').setRequired(true)))
      .addSubcommand((s) => s.setName('lihat').setDescription('Lihat ulang tahun').addUserOption((o) => o.setName('user').setDescription('User')))
      .addSubcommand((s) => s.setName('hapus').setDescription('Hapus data ulang tahun kamu')),
    new SlashCommandBuilder().setName('voice').setDescription('Atur voice pribadi kamu')
      .addSubcommand((s) => s.setName('kunci').setDescription('Kunci voice'))
      .addSubcommand((s) => s.setName('buka').setDescription('Buka voice'))
      .addSubcommand((s) => s.setName('limit').setDescription('Batas orang').addIntegerOption((o) => o.setName('jumlah').setDescription('0 = tanpa batas').setRequired(true).setMinValue(0).setMaxValue(99)))
      .addSubcommand((s) => s.setName('nama').setDescription('Ganti nama voice').addStringOption((o) => o.setName('nama').setDescription('Nama baru').setRequired(true)))
      .addSubcommand((s) => s.setName('kick').setDescription('Keluarkan orang').addUserOption((o) => o.setName('user').setDescription('User').setRequired(true)))
      .addSubcommand((s) => s.setName('izinkan').setDescription('Izinkan orang masuk saat dikunci').addUserOption((o) => o.setName('user').setDescription('User').setRequired(true)))
      .addSubcommand((s) => s.setName('klaim').setDescription('Ambil alih voice kalau pemiliknya pergi')),
  ].map((c) => c.toJSON());

  function routes(api) {
    api.get('/events', (req, res) => res.json(ED().items.map((e) => ({ ...e, at: eventTime(e) }))));
    api.post('/events', async (req, res) => { try { res.json(await eventAdd(req.body, req.session.user.username)); } catch (e) { res.status(400).json({ error: e.message }); } });
    api.delete('/events/:id', (req, res) => { ED().items = ED().items.filter((e) => e.id !== req.params.id); cfg.save(); res.json({ ok: true }); });
    api.post('/events/:id/announce', async (req, res) => { const e = ED().items.find((x) => x.id === req.params.id); if (!e) return res.status(404).json({ error: 'Tidak ada' }); await eventSend(e); res.json({ ok: true }); });
    api.get('/birthdays', (req, res) => {
      const g = guild();
      res.json(Object.entries(BD().users).map(([id, md]) => ({ id, md, pretty: prettyBd(md), name: g?.members.cache.get(id)?.displayName || id })).sort((a, b) => a.md.localeCompare(b.md)));
    });
    api.post('/birthdays', (req, res) => { const md = parseBirthday(req.body.date); if (!md || !/^\d{15,}$/.test(req.body.userId || '')) return res.status(400).json({ error: 'User ID / tanggal salah (contoh 13/11)' }); BD().users[req.body.userId] = md; cfg.save(); res.json({ ok: true }); });
    api.delete('/birthdays/:id', (req, res) => { delete BD().users[req.params.id]; cfg.save(); res.json({ ok: true }); });
    api.post('/birthdays/run', async (req, res) => { BD().lastRun = ''; res.json({ ids: await birthdayRun(true) }); });
    api.post('/stats/run', async (req, res) => res.json({ done: await statsRun() }));
    api.get('/tempvoice', (req, res) => { const g = guild(); res.json(Object.entries(TD().channels).map(([id, owner]) => ({ id, owner, ownerName: g?.members.cache.get(owner)?.displayName || owner, name: g?.channels.cache.get(id)?.name || '?', members: g?.channels.cache.get(id)?.members.size || 0 }))); });
  }

  return { commands, routes };
}

module.exports = { setup, eventTime };
