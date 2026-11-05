// ============================================================
//  🔔 Notif Staff — DM otomatis ke owner & admin
//  (pengajuan/verifikasi, tiket, order, saran, keamanan, rapat)
// ============================================================
const {
  Events, SlashCommandBuilder, MessageFlags, PermissionFlagsBits: P, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const cfg = require('./config');

const KINDS = {
  app: '📨 Pengajuan & verifikasi', pending: '⏳ Pengingat yang belum di-ACC', ticket: '🎫 Tiket baru', order: '🛒 Order TRO Shop',
  suggest: '💡 Saran aktivitas baru', security: '🛡️ Keamanan (raid, spam, dll)', meeting: '📅 Rapat staff', important: '📣 Info penting manual',
};
const newId = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 4);
const WIB = 7 * 3600_000;

// "06/11/2026 20:00" · "06/11 20:00" · "20:00" (hari ini/besok) → timestamp
function parseWhen(str) {
  const s = String(str || '').trim();
  const now = new Date(Date.now() + WIB);
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?\s+(\d{1,2})[:.](\d{2})$/);
  if (m) {
    let y = m[3] ? Number(m[3]) : now.getUTCFullYear(); if (y < 100) y += 2000;
    return Date.UTC(y, Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5])) - WIB;
  }
  m = s.match(/^(\d{1,2})[:.](\d{2})$/);
  if (m) {
    let t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), Number(m[1]), Number(m[2])) - WIB;
    if (t < Date.now()) t += 86400_000;
    return t;
  }
  return NaN;
}

function setup({ client, baseEmbed }) {
  const C = () => {
    const s = cfg.get();
    if (!s.notify) s.notify = {};
    const n = s.notify;
    n.enabled ??= true; n.roleIds ??= []; n.userIds ??= []; n.kinds ??= Object.fromEntries(Object.keys(KINDS).map((k) => [k, true]));
    n.meetingChannelId ??= ''; n.meetingRoleIds ??= []; n.remindMinutes ??= 30; n.pendingHours ??= 6;
    return n;
  };
  const M = () => cfg.data('meetingData', { items: [], lastPending: 0 });
  const guild = () => client.guilds.cache.get(process.env.GUILD_ID);
  const lastSec = new Map();

  // siapa yang dapat DM: owner server + super admin + role/user pilihan
  async function recipients(roleIds) {
    const g = guild(); if (!g) return [];
    const n = C(); const ids = new Set([g.ownerId, ...cfg.get().access.superAdminIds, ...n.userIds]);
    const roles = roleIds || n.roleIds;
    if (roles.length) {
      await g.members.fetch().catch(() => {});
      for (const r of roles) g.roles.cache.get(r)?.members.forEach((m) => { if (!m.user.bot) ids.add(m.id); });
    }
    return [...ids].filter((x) => /^\d{15,}$/.test(x));
  }
  const isStaff = (m) => m && (m.permissions.has(P.ManageGuild) || C().roleIds.some((r) => m.roles.cache.has(r)) || m.id === guild()?.ownerId);

  async function dmMany(ids, payload) {
    let ok = 0;
    for (const id of ids) {
      const u = await client.users.fetch(id).catch(() => null);
      if (u && await u.send(payload).then(() => true).catch(() => false)) ok++;
      await new Promise((r) => setTimeout(r, 700));
    }
    return ok;
  }

  // dipanggil modul lain: client.notifyStaff('app', { title, description, url, color })
  async function notifyStaff(kind, { title, description, url, color, fields } = {}) {
    const n = C();
    if (!n.enabled || n.kinds[kind] === false) return 0;
    const e = baseEmbed({ title: `🔔 ${title}`, description, color: color || '#c9a227', fields, thumbnail: null });
    const components = url ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Buka di server').setURL(url))] : [];
    const ok = await dmMany(await recipients(), { content: `**${KINDS[kind] || 'Notif staff'}** · ${guild()?.name || 'TRO'}`, embeds: [e], components });
    return ok;
  }
  client.notifyStaff = (kind, data) => notifyStaff(kind, data).catch((e) => console.error('[notify]', e.message));
  // keamanan: max 1 DM per jenis tiap 10 menit biar ga spam
  client.notifySecurity = (type, text) => {
    const t = lastSec.get(type) || 0; if (Date.now() - t < 600_000) return;
    lastSec.set(type, Date.now());
    client.notifyStaff('security', { title: type, description: text, color: '#e5484d' });
  };

  // ---------------- pengingat pengajuan yang belum di-ACC ----------------
  async function pendingSweep(force = false) {
    const n = C(), d = M();
    if (!force && Date.now() - (d.lastPending || 0) < 12 * 3600_000) return;
    const old = (cfg.get().applications || []).filter((a) => a.status === 'pending' && Date.now() - Date.parse(a.createdAt) > n.pendingHours * 3600_000);
    if (!old.length) return;
    d.lastPending = Date.now(); cfg.save();
    const g = guild();
    await notifyStaff('pending', {
      title: `${old.length} pengajuan nunggu di-ACC`,
      description: old.slice(0, 15).map((a) => `• <@${a.userId}> (${a.username}) — ${a.type === 'member' ? 'Member' : 'Tamu'} · <t:${Math.floor(Date.parse(a.createdAt) / 1000)}:R>`).join('\n') + (old.length > 15 ? `\n…dan ${old.length - 15} lagi` : '') + '\n\nCek di channel review atau dashboard → Pengajuan.',
      url: old[0].reviewMessageId && g ? `https://discord.com/channels/${g.id}/${old[0].reviewChannelId}/${old[0].reviewMessageId}` : undefined,
      color: '#f5a524',
    });
  }

  // ---------------- 📅 rapat ----------------
  const fmtWhen = (t) => `<t:${Math.floor(t / 1000)}:F> (<t:${Math.floor(t / 1000)}:R>)`;
  function meetEmbed(mt) {
    const att = mt.rsvp || {};
    const hadir = Object.entries(att).filter(([, v]) => v === 'hadir').map(([k]) => `<@${k}>`);
    const izin = Object.entries(att).filter(([, v]) => v === 'izin').map(([k]) => `<@${k}>`);
    return baseEmbed({
      title: `📅 ${mt.cancelled ? '~~' : ''}Rapat: ${mt.title}${mt.cancelled ? '~~ — DIBATALKAN' : ''}`,
      description: `**Waktu:** ${fmtWhen(mt.at)}\n**Tempat:** ${mt.placeId ? `<#${mt.placeId}>` : (mt.place || 'menyusul')}\n**Peserta:** ${mt.roleIds.length ? mt.roleIds.map((r) => `<@&${r}>`).join(' ') : 'Admin & owner'}\n**Dari:** ${mt.by}${mt.agenda ? `\n\n**Agenda:**\n${mt.agenda}` : ''}`,
      fields: [{ name: `✅ Hadir (${hadir.length})`, value: hadir.join(' ') || '-', inline: true }, { name: `🙏 Izin (${izin.length})`, value: izin.join(' ') || '-', inline: true }],
      color: mt.cancelled ? '#6b6b6b' : '#c9a227',
    });
  }
  const meetRow = (mt) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tro-rapat:hadir:${mt.id}`).setLabel('Hadir').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(!!mt.cancelled),
    new ButtonBuilder().setCustomId(`tro-rapat:izin:${mt.id}`).setLabel('Izin').setEmoji('🙏').setStyle(ButtonStyle.Secondary).setDisabled(!!mt.cancelled),
  );
  async function refreshMeet(mt) {
    if (!mt.channelId || !mt.messageId) return;
    const ch = await client.channels.fetch(mt.channelId).catch(() => null);
    const msg = ch && await ch.messages.fetch(mt.messageId).catch(() => null);
    if (msg) await msg.edit({ embeds: [meetEmbed(mt)], components: [meetRow(mt)] }).catch(() => {});
  }
  async function createMeeting({ title, when, placeId, place, agenda, roleIds, channelId, by }) {
    const at = typeof when === 'number' ? when : parseWhen(when);
    if (!at || Number.isNaN(at)) throw new Error('Format waktu salah. Contoh: 07/11/2026 20:00 atau 20:00');
    if (at < Date.now() - 60_000) throw new Error('Waktu rapat sudah lewat');
    const n = C();
    const mt = { id: newId(), title: String(title).slice(0, 100), at, placeId: placeId || '', place: String(place || '').slice(0, 100), agenda: String(agenda || '').replace(/\\n/g, '\n').slice(0, 1500), roleIds: roleIds?.length ? roleIds : n.meetingRoleIds, by, rsvp: {}, reminded: false, createdAt: new Date().toISOString() };
    const chId = channelId || n.meetingChannelId;
    if (chId) {
      const ch = await client.channels.fetch(chId).catch(() => null);
      if (ch) {
        const m = await ch.send({ content: mt.roleIds.length ? mt.roleIds.map((r) => `<@&${r}>`).join(' ') : undefined, embeds: [meetEmbed(mt)], components: [meetRow(mt)], allowedMentions: { roles: mt.roleIds } }).catch(() => null);
        if (m) { mt.channelId = ch.id; mt.messageId = m.id; }
      }
    }
    const d = M(); d.items.unshift(mt); d.items = d.items.slice(0, 100); cfg.save();
    const g = guild();
    const sent = (n.enabled && n.kinds.meeting !== false) ? await dmMany(await recipients(mt.roleIds.length ? mt.roleIds : undefined), {
      content: `📅 **Undangan rapat** · ${g?.name || 'TRO'}`, embeds: [meetEmbed(mt)],
      components: [meetRow(mt), ...(mt.messageId ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Lihat pengumuman').setURL(`https://discord.com/channels/${g.id}/${mt.channelId}/${mt.messageId}`))] : [])],
    }) : 0;
    mt.dmSent = sent; cfg.save();
    cfg.addLog('Rapat dibuat', `${mt.title} — ${new Date(at + WIB).toISOString().slice(0, 16).replace('T', ' ')} WIB oleh ${by} · DM ${sent}`);
    return mt;
  }
  async function cancelMeeting(id, by) {
    const mt = M().items.find((x) => x.id === id); if (!mt) throw new Error('Rapat tidak ditemukan');
    mt.cancelled = true; cfg.save(); await refreshMeet(mt);
    const ids = await recipients(mt.roleIds.length ? mt.roleIds : undefined);
    dmMany(ids, { embeds: [baseEmbed({ title: `❌ Rapat dibatalkan: ${mt.title}`, description: `Jadwal ${fmtWhen(mt.at)} dibatalkan oleh ${by}.`, color: '#e5484d', thumbnail: null })] }).catch(() => {});
    cfg.addLog('Rapat dibatalkan', `${mt.title} oleh ${by}`);
    return mt;
  }
  async function meetingSweep() {
    const n = C(), d = M(); let dirty = false;
    for (const mt of d.items) {
      if (mt.cancelled || mt.reminded) continue;
      const left = mt.at - Date.now();
      if (left <= n.remindMinutes * 60_000 && left > -10 * 60_000) {
        mt.reminded = true; dirty = true;
        const ids = (await recipients(mt.roleIds.length ? mt.roleIds : undefined)).filter((x) => mt.rsvp?.[x] !== 'izin');
        dmMany(ids, { embeds: [baseEmbed({ title: `⏰ Rapat sebentar lagi: ${mt.title}`, description: `Mulai ${fmtWhen(mt.at)}\n**Tempat:** ${mt.placeId ? `<#${mt.placeId}>` : (mt.place || '-')}`, thumbnail: null })] }).catch(() => {});
      }
    }
    if (dirty) cfg.save();
  }

  client.on(Events.InteractionCreate, async (it) => {
    try {
      if (it.isButton() && it.customId.startsWith('tro-rapat:')) {
        const [, ans, id] = it.customId.split(':');
        const mt = M().items.find((x) => x.id === id);
        if (!mt || mt.cancelled) return it.reply({ content: '❌ Rapat ini sudah tidak aktif.', flags: MessageFlags.Ephemeral });
        mt.rsvp = mt.rsvp || {}; mt.rsvp[it.user.id] = ans; cfg.save();
        refreshMeet(mt).catch(() => {});
        if (!it.inGuild()) await it.update({ embeds: [meetEmbed(mt)] }).catch(() => it.reply({ content: '✅ Tercatat', flags: MessageFlags.Ephemeral }));
        else await it.reply({ content: ans === 'hadir' ? '✅ Kamu tercatat **hadir**.' : '🙏 Kamu tercatat **izin**.', flags: MessageFlags.Ephemeral });
        return;
      }
      if (!it.isChatInputCommand() || it.commandName !== 'rapat') return;
      const me = it.inGuild() ? it.member : await guild()?.members.fetch(it.user.id).catch(() => null);
      const sub = it.options.getSubcommand();
      if (sub === 'list') {
        const up = M().items.filter((x) => !x.cancelled && x.at > Date.now() - 3600_000).sort((a, b) => a.at - b.at);
        return it.reply({ embeds: [baseEmbed({ title: '📅 Rapat mendatang', description: up.length ? up.map((x) => `\`${x.id}\` **${x.title}** — ${fmtWhen(x.at)}`).join('\n') : 'Belum ada rapat terjadwal.' })], flags: MessageFlags.Ephemeral });
      }
      if (!isStaff(me)) return it.reply({ content: '❌ Khusus admin/staff.', flags: MessageFlags.Ephemeral });
      if (sub === 'buat') {
        await it.deferReply({ flags: MessageFlags.Ephemeral });
        const role = it.options.getRole('peserta');
        const mt = await createMeeting({
          title: it.options.getString('judul'), when: it.options.getString('waktu'), placeId: it.options.getChannel('tempat')?.id,
          agenda: it.options.getString('agenda') || '', roleIds: role ? [role.id] : [], channelId: it.options.getChannel('umumkan_di')?.id, by: it.user.username,
        });
        return it.editReply(`✅ Rapat \`${mt.id}\` dijadwalkan ${fmtWhen(mt.at)} · undangan DM terkirim ke ${mt.dmSent} orang${mt.messageId ? ' · pengumuman sudah diposting' : ''}. Pengingat otomatis ${C().remindMinutes} menit sebelum mulai.`);
      }
      if (sub === 'batal') { const mt = await cancelMeeting(it.options.getString('id'), it.user.username); return it.reply({ content: `✅ Rapat **${mt.title}** dibatalkan & peserta dikabari.`, flags: MessageFlags.Ephemeral }); }
      if (sub === 'penting') {
        await it.deferReply({ flags: MessageFlags.Ephemeral });
        const ok = await notifyStaff('important', { title: it.options.getString('judul'), description: `${it.options.getString('isi').replace(/\\n/g, '\n')}\n\n— ${it.user.username}` });
        return it.editReply(`✅ Info penting terkirim ke DM ${ok} admin/owner.`);
      }
    } catch (e) { const r = { content: '⚠️ ' + e.message, flags: MessageFlags.Ephemeral }; (it.deferred || it.replied ? it.editReply(r) : it.reply(r)).catch(() => {}); }
  });

  client.once('ready', () => {
    // pertama kali: isi role penerima otomatis dari role yang punya izin Administrator
    const n = C(), g = guild();
    if (g && !n.roleIds.length && !n.autoFilled) {
      n.roleIds = g.roles.cache.filter((r) => !r.managed && r.id !== g.id && r.permissions.has(P.Administrator)).map((r) => r.id);
      n.autoFilled = true; cfg.save();
    }
    setInterval(() => meetingSweep().catch(() => {}), 60_000);
    setInterval(() => pendingSweep().catch(() => {}), 30 * 60_000);
    setTimeout(() => pendingSweep().catch(() => {}), 90_000);
  });

  const commands = [
    new SlashCommandBuilder().setName('rapat').setDescription('Jadwal rapat & info penting staff TRO')
      .addSubcommand((s) => s.setName('buat').setDescription('Umumkan rapat + DM undangan ke peserta')
        .addStringOption((o) => o.setName('judul').setDescription('Judul rapat').setRequired(true).setMaxLength(100))
        .addStringOption((o) => o.setName('waktu').setDescription('contoh: 07/11/2026 20:00 atau 20:00 (WIB)').setRequired(true))
        .addChannelOption((o) => o.setName('tempat').setDescription('Voice/channel rapat'))
        .addStringOption((o) => o.setName('agenda').setDescription('Agenda (pakai \\n untuk baris baru)').setMaxLength(1500))
        .addRoleOption((o) => o.setName('peserta').setDescription('Role peserta (kosong = admin & owner)'))
        .addChannelOption((o) => o.setName('umumkan_di').setDescription('Channel pengumuman (default dari dashboard)')))
      .addSubcommand((s) => s.setName('list').setDescription('Lihat rapat mendatang'))
      .addSubcommand((s) => s.setName('batal').setDescription('Batalkan rapat').addStringOption((o) => o.setName('id').setDescription('ID rapat (lihat /rapat list)').setRequired(true)))
      .addSubcommand((s) => s.setName('penting').setDescription('Kirim info penting ke DM semua admin & owner')
        .addStringOption((o) => o.setName('judul').setDescription('Judul').setRequired(true).setMaxLength(100))
        .addStringOption((o) => o.setName('isi').setDescription('Isi pesan').setRequired(true).setMaxLength(1800)))
      .toJSON(),
  ];

  function routes(api) {
    api.get('/notify', async (req, res) => res.json({ cfg: C(), kinds: KINDS, meetings: M().items.slice(0, 30), recipients: (await recipients()).length }));
    api.put('/notify', (req, res) => {
      const n = C(), b = req.body;
      if (b.enabled !== undefined) n.enabled = !!b.enabled;
      if (Array.isArray(b.roleIds)) n.roleIds = b.roleIds.map(String);
      if (Array.isArray(b.userIds)) n.userIds = b.userIds.map(String).filter((x) => /^\d{15,}$/.test(x));
      if (Array.isArray(b.meetingRoleIds)) n.meetingRoleIds = b.meetingRoleIds.map(String);
      if (b.kinds) for (const k of Object.keys(KINDS)) if (b.kinds[k] !== undefined) n.kinds[k] = !!b.kinds[k];
      if (b.meetingChannelId !== undefined) n.meetingChannelId = String(b.meetingChannelId);
      if (b.remindMinutes !== undefined) n.remindMinutes = Math.max(5, Math.min(1440, Number(b.remindMinutes) || 30));
      if (b.pendingHours !== undefined) n.pendingHours = Math.max(1, Math.min(168, Number(b.pendingHours) || 6));
      cfg.save(); res.json({ ok: true });
    });
    api.post('/notify/test', async (req, res) => { const ok = await notifyStaff('important', { title: 'Tes notif TRO SYSTEM', description: `Kalau kamu dapat DM ini, notif staff sudah jalan ✅\n— dikirim dari dashboard oleh ${req.session.user.username}` }); res.json({ ok }); });
    api.post('/notify/pending', async (req, res) => { await pendingSweep(true); res.json({ ok: true }); });
    api.post('/meetings', async (req, res) => { try { res.json(await createMeeting({ ...req.body, by: req.session.user.username })); } catch (e) { res.status(400).json({ error: e.message }); } });
    api.post('/meetings/:id/cancel', async (req, res) => { try { res.json(await cancelMeeting(req.params.id, req.session.user.username)); } catch (e) { res.status(400).json({ error: e.message }); } });
  }

  return { commands, routes };
}

module.exports = { setup, parseWhen };
