// ============================================================
//  🗂️ Arsip Member — riwayat keluar, kick, ban, resign (log & bukti)
// ============================================================
const {
  Events, SlashCommandBuilder, MessageFlags, PermissionFlagsBits: P, AuditLogEvent,
} = require('discord.js');
const cfg = require('./config');

const TYPES = {
  keluar: { label: '🚪 Keluar sendiri', color: '#8b95a5' },
  kick: { label: '👢 Di-kick', color: '#f5a524' },
  ban: { label: '⛔ Di-ban', color: '#e5484d' },
  unban: { label: '🔓 Unban', color: '#30a46c' },
  resign: { label: '📝 Resign', color: '#5b8def' },
  out: { label: '📤 Out / dikeluarkan dari clan', color: '#a78bfa' },
  blacklist: { label: '🚫 Blacklist', color: '#b3261e' },
  kembali: { label: '🔁 Join kembali', color: '#2fb5a0' },
};
const newId = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 4);

function setup({ client, baseEmbed }) {
  const C = () => {
    const s = cfg.get();
    if (!s.archive) s.archive = {};
    const a = s.archive;
    a.enabled ??= true; a.channelId ??= ''; a.logLeave ??= true; a.alertReturn ??= true;
    return a;
  };
  const D = () => cfg.data('archiveData', { items: [] });
  const guild = () => client.guilds.cache.get(process.env.GUILD_ID);
  const isStaff = (m) => m && (m.permissions.has(P.KickMembers) || m.permissions.has(P.ManageGuild));

  // ringkasan data member (dari verifikasi, level, aktivitas)
  function profile(userId) {
    const s = cfg.get();
    const app = (s.applications || []).find((x) => x.userId === userId && x.status === 'accepted');
    const act = cfg.data('activityData', { users: {} }).users?.[userId] || {};
    const lv = cfg.data('levelsData', { users: {} }).users?.[userId];
    const out = [];
    if (app) out.push(`Data: **${app.type === 'member' ? 'Member' : 'Tamu'}**${app.legacy ? ' (data lama)' : ''}${app.reviewedBy && !app.legacy ? ` · di-ACC ${app.reviewedBy}` : ''}`);
    const nama = app?.answers?.find((x) => /nama/i.test(x.q || ''))?.a; if (nama) out.push(`Nama: ${String(nama).slice(0, 60)}`);
    const last = Math.max(act.msg || 0, act.voice || 0); if (last) out.push(`Terakhir aktif: <t:${Math.floor(last / 1000)}:R>`);
    if (lv?.xp) out.push(`XP: ${lv.xp} · ${lv.msgs || 0} pesan`);
    return out.join('\n');
  }

  async function record({ userId, username, avatar, type, reason, by, proof, roles, joinedAt, auto }) {
    const a = C(); if (!a.enabled) return null;
    const it = { id: newId(), userId, username, type, reason: String(reason || '').slice(0, 1000), by: by || '', proof: proof || '', roles: roles || [], joinedAt: joinedAt || null, at: new Date().toISOString(), auto: !!auto };
    const d = D(); d.items.unshift(it); d.items = d.items.slice(0, 1500); cfg.save();
    const t = TYPES[type] || TYPES.keluar;
    const ch = a.channelId && await client.channels.fetch(a.channelId).catch(() => null);
    if (ch) {
      const prev = userId ? d.items.filter((x) => x.userId === userId && x.id !== it.id).length : 0;
      const fields = [
        { name: 'Status', value: t.label, inline: true },
        { name: 'Oleh', value: by || (auto ? 'otomatis' : '-'), inline: true },
        { name: 'Tanggal', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      ];
      if (joinedAt) fields.push({ name: 'Bergabung sejak', value: `<t:${Math.floor(joinedAt / 1000)}:D>`, inline: true });
      if (roles?.length) fields.push({ name: 'Role terakhir', value: roles.slice(0, 12).join(', ').slice(0, 1000), inline: false });
      const pf = userId ? profile(userId) : ''; if (pf) fields.push({ name: 'Data anggota', value: pf.slice(0, 1000), inline: false });
      if (prev) fields.push({ name: 'Riwayat', value: `Sudah ${prev} catatan sebelumnya — cek \`/arsip cek\``, inline: false });
      const e = baseEmbed({
        title: `🗂️ ARSIP — ${t.label.replace(/^\S+\s/, '').toUpperCase()}`,
        description: `${userId ? `<@${userId}> (${username || userId})\n**ID:** \`${userId}\`` : `**${username}** _(data lama, tanpa ID)_`}${it.reason ? `\n**Alasan:** ${it.reason}` : ''}`,
        fields, thumbnail: avatar || null, color: t.color, image: /\.(png|jpe?g|gif|webp)(\?|$)/i.test(proof || '') ? proof : undefined,
      });
      const m = await ch.send({ embeds: [e], content: proof && !/\.(png|jpe?g|gif|webp)(\?|$)/i.test(proof) ? `📎 Bukti: ${proof}` : undefined, allowedMentions: { parse: [] } }).catch(() => null);
      if (m) { it.messageId = m.id; cfg.save(); }
    }
    cfg.addLog('Arsip member', `${username || userId}: ${t.label}${by ? ` oleh ${by}` : ''}`);
    return it;
  }

  // cari pelaku dari audit log (kick/ban)
  async function audit(g, type, targetId) {
    const logs = await g.fetchAuditLogs({ type, limit: 5 }).catch(() => null);
    const e = logs?.entries.find((x) => x.target?.id === targetId && Date.now() - x.createdTimestamp < 20_000);
    return e ? { by: e.executor?.bot && e.executor.id === client.user.id ? 'TRO SYSTEM' : (e.executor?.username || ''), reason: e.reason || '' } : null;
  }

  const recentBan = new Set();
  client.on(Events.GuildBanAdd, async (ban) => {
    if (ban.guild.id !== process.env.GUILD_ID) return;
    recentBan.add(ban.user.id); setTimeout(() => recentBan.delete(ban.user.id), 30_000);
    await new Promise((r) => setTimeout(r, 1500));
    const au = await audit(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    const full = await ban.fetch().catch(() => ban);
    record({ userId: ban.user.id, username: ban.user.username, avatar: ban.user.displayAvatarURL({ size: 256 }), type: 'ban', reason: au?.reason || full.reason || '', by: au?.by, auto: true, roles: cache.get(ban.user.id)?.roles, joinedAt: cache.get(ban.user.id)?.joinedAt }).catch(() => {});
  });
  client.on(Events.GuildBanRemove, async (ban) => {
    if (ban.guild.id !== process.env.GUILD_ID) return;
    await new Promise((r) => setTimeout(r, 1500));
    const au = await audit(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    record({ userId: ban.user.id, username: ban.user.username, avatar: ban.user.displayAvatarURL({ size: 256 }), type: 'unban', reason: au?.reason || '', by: au?.by, auto: true }).catch(() => {});
  });

  // simpan role terakhir sebelum keluar (dipakai juga oleh ban)
  const cache = new Map();
  client.on(Events.GuildMemberRemove, async (m) => {
    if (m.guild.id !== process.env.GUILD_ID || m.user.bot) return;
    const roles = m.roles?.cache ? m.roles.cache.filter((r) => r.id !== m.guild.id).sort((a, b) => b.position - a.position).map((r) => r.name) : [];
    cache.set(m.id, { roles, joinedAt: m.joinedTimestamp }); setTimeout(() => cache.delete(m.id), 60_000);
    if (!C().logLeave) return;
    await new Promise((r) => setTimeout(r, 2500));
    if (recentBan.has(m.id)) return; // sudah dicatat sebagai ban
    const au = await audit(m.guild, AuditLogEvent.MemberKick, m.id);
    record({ userId: m.id, username: m.user.username, avatar: m.user.displayAvatarURL({ size: 256 }), type: au ? 'kick' : 'keluar', reason: au?.reason || '', by: au?.by, roles, joinedAt: m.joinedTimestamp, auto: true }).catch(() => {});
  });

  // yang pernah di-ban / out / blacklist join lagi → kabari staff
  client.on(Events.GuildMemberAdd, async (m) => {
    if (m.guild.id !== process.env.GUILD_ID || !C().alertReturn) return;
    const past = D().items.filter((x) => x.userId === m.id && ['ban', 'out', 'blacklist', 'kick', 'resign'].includes(x.type));
    if (!past.length) return;
    const last = past[0];
    await record({ userId: m.id, username: m.user.username, avatar: m.user.displayAvatarURL({ size: 256 }), type: 'kembali', reason: `Pernah ${TYPES[last.type].label.replace(/^\S+\s/, '').toLowerCase()} (${new Date(last.at).toLocaleDateString('id-ID')})${last.reason ? ` — ${last.reason}` : ''}`, auto: true });
    client.notifyStaff?.(['blacklist', 'ban', 'out'].includes(last.type) ? 'security' : 'important', { title: `Mantan anggota join lagi: ${m.user.username}`, description: `<@${m.id}> pernah **${TYPES[last.type].label}**${last.reason ? `\nAlasan: ${last.reason}` : ''}\nTotal catatan: ${past.length}. Cek channel arsip.`, color: '#f5a524' });
  });

  client.on(Events.InteractionCreate, async (it) => {
    try {
      if (!it.isChatInputCommand() || it.commandName !== 'arsip') return;
      if (!isStaff(it.member)) return it.reply({ content: '❌ Khusus staff.', flags: MessageFlags.Ephemeral });
      const sub = it.options.getSubcommand();
      const u = it.options.getUser('user');
      if (sub === 'cek') {
        const list = D().items.filter((x) => x.userId === u.id);
        return it.reply({ embeds: [baseEmbed({ title: `🗂️ Riwayat ${u.username}`, description: list.length ? list.slice(0, 20).map((x) => `${TYPES[x.type]?.label || x.type} — <t:${Math.floor(Date.parse(x.at) / 1000)}:D>${x.by ? ` · ${x.by}` : ''}${x.reason ? `\n  ↳ ${x.reason.slice(0, 120)}` : ''}`).join('\n') : 'Belum ada catatan. Bersih ✅', thumbnail: u.displayAvatarURL({ size: 128 }) })], flags: MessageFlags.Ephemeral });
      }
      if (sub === 'catat') {
        await it.deferReply({ flags: MessageFlags.Ephemeral });
        const mem = await it.guild.members.fetch(u.id).catch(() => null);
        const att = it.options.getAttachment('bukti');
        const r = await record({ userId: u.id, username: u.username, avatar: u.displayAvatarURL({ size: 256 }), type: it.options.getString('status'), reason: it.options.getString('alasan') || '', by: it.user.username, proof: att?.url || '', roles: mem ? mem.roles.cache.filter((x) => x.id !== it.guild.id).sort((a, b) => b.position - a.position).map((x) => x.name) : [], joinedAt: mem?.joinedTimestamp });
        return it.editReply(r ? `✅ Dicatat di arsip: **${TYPES[r.type].label}** untuk ${u.username}.` : '⚠️ Arsip sedang nonaktif.');
      }
    } catch (e) { const r = { content: '⚠️ ' + e.message, flags: MessageFlags.Ephemeral }; (it.deferred || it.replied ? it.editReply(r) : it.reply(r)).catch(() => {}); }
  });

  client.once('ready', () => {
    const a = C(), g = guild();
    if (g && !a.channelId) { const ch = g.channels.cache.find((c) => /archive-members|arsip-member/i.test(c.name)); if (ch) { a.channelId = ch.id; cfg.save(); } }
  });

  const commands = [
    new SlashCommandBuilder().setName('arsip').setDescription('Arsip member TRO (keluar, kick, ban, resign)')
      .addSubcommand((s) => s.setName('catat').setDescription('Catat status member ke arsip')
        .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
        .addStringOption((o) => o.setName('status').setDescription('Status').setRequired(true).addChoices(
          { name: 'Resign', value: 'resign' }, { name: 'Out / dikeluarkan dari clan', value: 'out' }, { name: 'Ban permanen', value: 'ban' },
          { name: 'Kick', value: 'kick' }, { name: 'Blacklist', value: 'blacklist' }, { name: 'Keluar sendiri', value: 'keluar' }))
        .addStringOption((o) => o.setName('alasan').setDescription('Alasan / keterangan').setMaxLength(1000))
        .addAttachmentOption((o) => o.setName('bukti').setDescription('Screenshot bukti')))
      .addSubcommand((s) => s.setName('cek').setDescription('Lihat riwayat arsip seseorang').addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)))
      .toJSON(),
  ];

  function routes(api) {
    api.get('/archive', (req, res) => res.json({ cfg: C(), items: D().items.slice(0, 500), types: Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [k, v.label])) }));
    api.put('/archive', (req, res) => {
      const a = C(), b = req.body;
      if (b.channelId !== undefined) a.channelId = String(b.channelId);
      for (const k of ['enabled', 'logLeave', 'alertReturn']) if (b[k] !== undefined) a[k] = !!b[k];
      cfg.save(); res.json({ ok: true });
    });
    api.post('/archive', async (req, res) => {
      try {
        const b = req.body; const id = String(b.userId || '').replace(/\D/g, '');
        if (id && !/^\d{15,}$/.test(id)) throw new Error('ID Discord tidak valid');
        if (!id && !String(b.username || '').trim()) throw new Error('Isi ID Discord atau nama');
        if (!TYPES[b.type]) throw new Error('Status tidak valid');
        const u = id ? await client.users.fetch(id).catch(() => null) : null;
        const mem = id ? await guild()?.members.fetch(id).catch(() => null) : null;
        const r = await record({ userId: id, username: u?.username || b.username || id, avatar: u?.displayAvatarURL({ size: 256 }), type: b.type, reason: b.reason, by: req.session.user.username, proof: String(b.proof || '').slice(0, 500), roles: mem ? mem.roles.cache.filter((x) => x.id !== mem.guild.id).map((x) => x.name) : [], joinedAt: mem?.joinedTimestamp });
        res.json(r);
      } catch (e) { res.status(400).json({ error: e.message }); }
    });
    api.delete('/archive/:id', async (req, res) => {
      const d = D(); const it = d.items.find((x) => x.id === req.params.id);
      if (it?.messageId && C().channelId) { const ch = await client.channels.fetch(C().channelId).catch(() => null); await ch?.messages.delete(it.messageId).catch(() => {}); }
      d.items = d.items.filter((x) => x.id !== req.params.id); cfg.save(); res.json({ ok: true });
    });
  }

  return { commands, routes };
}

module.exports = { setup };
