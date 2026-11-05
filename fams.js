// ============================================================
//  🦉 TRO SYSTEM — Verifikasi member & Jadwal Undangan Fams
// ============================================================
const {
  Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder,
  TextInputStyle, PermissionFlagsBits, MessageFlags,
} = require('discord.js');
const cfg = require('./config');

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// tanggal hari ini di WIB (YYYY-MM-DD)
const todayWIB = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

// "05/11/2026", "5-11", "2026-11-05", "besok", "hari ini" → YYYY-MM-DD
function parseDate(input) {
  const s = String(input || '').trim().toLowerCase();
  const t = todayWIB();
  if (['hari ini', 'today', 'sekarang'].includes(s)) return t;
  if (['besok', 'tomorrow'].includes(s)) return new Date(Date.parse(t) + 86_400_000).toISOString().slice(0, 10);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return fmt(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
  if (m) {
    let y = m[3] ? +m[3] : +t.slice(0, 4);
    if (y < 100) y += 2000;
    return fmt(y, +m[2], +m[1]);
  }
  return null;
}
function fmt(y, mo, d) {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}
const dayOf = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();
const isWeekend = (date) => [0, 6].includes(dayOf(date));
const prettyDate = (date) => { const d = new Date(`${date}T00:00:00Z`); return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

function limitFor(date) {
  const inv = cfg.get().invites;
  return isWeekend(date) ? Number(inv.weekendLimit) || 0 : Number(inv.weekdayLimit) || 0; // 0 = tanpa batas
}
function countOn(date, exceptId) {
  return cfg.get().invites.items.filter((i) => i.date === date && i.id !== exceptId).length;
}

function setup({ client, baseEmbed, securityLog }) {
  const canReview = (member) => member?.permissions.has(PermissionFlagsBits.ManageRoles) || member?.permissions.has(PermissionFlagsBits.ManageGuild);

  // ======================= VERIFIKASI =======================
  function panelComponents() {
    const v = cfg.get().verify;
    return [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('tro-verify:guest').setLabel(v.guestLabel || 'Tamu').setEmoji(v.guestEmoji || '🎟️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('tro-verify:member').setLabel(v.memberLabel || 'Member Baru').setEmoji(v.memberEmoji || '🦉').setStyle(ButtonStyle.Primary),
    )];
  }

  async function sendPanel() {
    const v = cfg.get().verify;
    if (!v.panelChannelId) throw new Error('Pilih channel panel verifikasi dulu');
    const ch = await client.channels.fetch(v.panelChannelId);
    const payload = { embeds: [baseEmbed({ title: v.panelTitle, description: v.panelText })], components: panelComponents() };
    if (v.panelMessageId) {
      const old = await ch.messages.fetch(v.panelMessageId).catch(() => null);
      if (old) { await old.edit(payload); return 'updated'; }
    }
    const msg = await ch.send(payload);
    v.panelMessageId = msg.id;
    cfg.save();
    return 'posted';
  }

  const typeLabel = (type) => { const v = cfg.get().verify; return type === 'guest' ? `${v.guestEmoji} ${v.guestLabel}` : `${v.memberEmoji} ${v.memberLabel}`; };
  const STATUS = { pending: ['⏳ Menunggu ACC', '#f1c40f'], accepted: ['✅ Diterima', '#30a46c'], rejected: ['❌ Ditolak', '#e5484d'] };

  function reviewPayload(app) {
    const [st, color] = STATUS[app.status];
    const e = baseEmbed({
      title: `📝 Pengajuan ${typeLabel(app.type)}`,
      description: `**User:** <@${app.userId}> (${app.username})\n**Akun dibuat:** <t:${Math.floor(app.accountCreated / 1000)}:R>\n**Status:** ${st}${app.reviewedBy ? `\n**Oleh:** ${app.reviewedBy}` : ''}${app.reason ? `\n**Alasan:** ${app.reason}` : ''}`,
      fields: app.answers.map((a) => ({ name: a.q, value: a.a || '-' })),
      thumbnail: app.avatar,
      color,
    });
    const done = app.status !== 'pending';
    return {
      embeds: [e],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`tro-app:accept:${app.id}`).setLabel('ACC').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(done),
        new ButtonBuilder().setCustomId(`tro-app:reject:${app.id}`).setLabel('Tolak').setEmoji('❌').setStyle(ButtonStyle.Danger).setDisabled(done),
      )],
      allowedMentions: { parse: [] },
    };
  }

  async function refreshReview(app) {
    if (!app.reviewMessageId || !app.reviewChannelId) return;
    const ch = await client.channels.fetch(app.reviewChannelId).catch(() => null);
    const msg = ch && await ch.messages.fetch(app.reviewMessageId).catch(() => null);
    if (msg) await msg.edit(reviewPayload(app)).catch(() => {});
  }

  async function acceptApp(id, reviewer) {
    const s = cfg.get(), v = s.verify;
    const app = s.applications.find((a) => a.id === id);
    if (!app) throw new Error('Pengajuan tidak ditemukan');
    if (app.status !== 'pending') throw new Error(`Sudah ${app.status === 'accepted' ? 'diterima' : 'ditolak'} oleh ${app.reviewedBy}`);
    const g = client.guilds.cache.get(process.env.GUILD_ID);
    const member = await g.members.fetch(app.userId).catch(() => null);
    if (!member) throw new Error('User sudah keluar dari server');
    const roles = app.type === 'guest' ? v.guestRoleIds : v.memberRoleIds;
    if (roles.length) await member.roles.add(roles, `TRO SYSTEM: verifikasi di-ACC ${reviewer}`);
    if (v.unverifiedRoleId) await member.roles.remove(v.unverifiedRoleId).catch(() => {});
    Object.assign(app, { status: 'accepted', reviewedBy: reviewer, reviewedAt: new Date().toISOString() });
    cfg.save();
    if (v.dmResult) member.send({ embeds: [baseEmbed({ title: '✅ Verifikasi diterima!', description: `Selamat, kamu resmi jadi **${typeLabel(app.type)}** di **${g.name}**. Selamat bergabung! 🦉`, color: '#30a46c' })] }).catch(() => {});
    cfg.addLog('Verifikasi ACC', `<@${app.userId}> sebagai ${typeLabel(app.type)} — oleh ${reviewer}`);
    await refreshReview(app);
    return app;
  }

  async function rejectApp(id, reviewer, reason = '') {
    const s = cfg.get(), v = s.verify;
    const app = s.applications.find((a) => a.id === id);
    if (!app) throw new Error('Pengajuan tidak ditemukan');
    if (app.status !== 'pending') throw new Error(`Sudah ${app.status === 'accepted' ? 'diterima' : 'ditolak'} oleh ${app.reviewedBy}`);
    Object.assign(app, { status: 'rejected', reviewedBy: reviewer, reviewedAt: new Date().toISOString(), reason: reason.slice(0, 500) });
    cfg.save();
    const g = client.guilds.cache.get(process.env.GUILD_ID);
    const member = await g.members.fetch(app.userId).catch(() => null);
    if (member && v.dmResult) await member.send({ embeds: [baseEmbed({ title: '❌ Verifikasi ditolak', description: `Pengajuan kamu di **${g.name}** belum bisa diterima.${reason ? `\n**Alasan:** ${reason}` : ''}\n\nKamu boleh mengajukan ulang lewat panel verifikasi.`, color: '#e5484d' })] }).catch(() => {});
    if (member && v.kickOnReject) await member.kick(`TRO SYSTEM: verifikasi ditolak oleh ${reviewer}`).catch(() => {});
    cfg.addLog('Verifikasi ditolak', `<@${app.userId}> (${typeLabel(app.type)}) — oleh ${reviewer}${reason ? ` — ${reason}` : ''}`);
    await refreshReview(app);
    return app;
  }

  // setup otomatis: role + channel + panel
  async function autoSetup() {
    const { ChannelType, PermissionFlagsBits: P } = require('discord.js');
    const g = client.guilds.cache.get(process.env.GUILD_ID);
    await g.roles.fetch(); await g.channels.fetch();
    const v = cfg.get().verify;
    const done = [];
    const findRole = (re) => g.roles.cache.find((r) => re.test(r.name));
    let guest = v.guestRoleIds.length ? null : findRole(/tamu/i);
    if (!v.guestRoleIds.length) {
      if (!guest) { guest = await g.roles.create({ name: '🎟️ TAMU', color: 0x3498db, reason: 'TRO SYSTEM setup verifikasi' }); done.push('role 🎟️ TAMU dibuat'); }
      v.guestRoleIds = [guest.id];
    }
    if (!v.memberRoleIds.length) {
      let mem = findRole(/^tro member$/i) || findRole(/tro member/i);
      if (!mem) { mem = await g.roles.create({ name: '🦉 TRO MEMBER', color: 0xd4af37, reason: 'TRO SYSTEM setup verifikasi' }); done.push('role 🦉 TRO MEMBER dibuat'); }
      v.memberRoleIds = [mem.id];
    }
    if (!v.unverifiedRoleId) {
      let unv = findRole(/belum verif/i);
      if (!unv) { unv = await g.roles.create({ name: '⏳ Belum Verifikasi', color: 0x7f8c8d, reason: 'TRO SYSTEM setup verifikasi' }); done.push('role ⏳ Belum Verifikasi dibuat'); }
      v.unverifiedRoleId = unv.id;
    }
    const cat = (re) => g.channels.cache.find((c) => c.type === ChannelType.GuildCategory && re.test(c.name));
    if (!v.panelChannelId || !g.channels.cache.has(v.panelChannelId)) {
      const info = cat(/information/i);
      const ch = await g.channels.create({
        name: '「🪪」verifikasi', type: ChannelType.GuildText, parent: info?.id, position: 0,
        permissionOverwrites: [{ id: g.id, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages, P.AddReactions, P.CreatePublicThreads] }, { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks] }],
        reason: 'TRO SYSTEM setup verifikasi',
      });
      v.panelChannelId = ch.id; v.panelMessageId = ''; done.push('channel #「🪪」verifikasi dibuat');
    }
    if (!v.reviewChannelId || !g.channels.cache.has(v.reviewChannelId)) {
      const mgmt = cat(/management|staff|admin/i);
      const ch = await g.channels.create({
        name: '「📥」review-verifikasi', type: ChannelType.GuildText, parent: mgmt?.id,
        permissionOverwrites: mgmt ? mgmt.permissionOverwrites.cache.map((o) => ({ id: o.id, allow: o.allow, deny: o.deny, type: o.type })).concat([{ id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks] }])
          : [{ id: g.id, deny: [P.ViewChannel] }, { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks] }],
        reason: 'TRO SYSTEM setup verifikasi',
      });
      v.reviewChannelId = ch.id; done.push('channel #「📥」review-verifikasi dibuat (khusus staff)');
    }
    v.enabled = true;
    cfg.save();
    const r = await sendPanel();
    done.push(r === 'updated' ? 'panel verifikasi diupdate' : 'panel verifikasi dikirim');
    cfg.addLog('Setup verifikasi', done.join(' · '));
    return done;
  }

  // role "belum verifikasi" untuk member baru
  client.on(Events.GuildMemberAdd, async (member) => {
    const v = cfg.get().verify;
    if (member.guild.id !== process.env.GUILD_ID || member.user.bot || !v.enabled || !v.unverifiedRoleId) return;
    await member.roles.add(v.unverifiedRoleId, 'TRO SYSTEM: belum verifikasi').catch(() => {});
  });

  // ======================= UNDANGAN FAMS =======================
  function addInvite(data, by) {
    const inv = cfg.get().invites;
    const date = parseDate(data.date);
    if (!date) throw new Error('Format tanggal salah (contoh: 08/11/2026)');
    if (date < todayWIB()) throw new Error('Tanggal sudah lewat');
    if (!String(data.fams || '').trim()) throw new Error('Nama fams wajib diisi');
    const limit = limitFor(date);
    const used = countOn(date, data.id);
    if (limit > 0 && used >= limit) throw new Error(`${prettyDate(date)} sudah penuh (${used}/${limit} undangan${isWeekend(date) ? ' weekend' : ' hari kerja'})`);
    const item = {
      id: data.id || newId(),
      fams: String(data.fams).trim().slice(0, 80),
      date,
      time: String(data.time || '').trim().slice(0, 20),
      place: String(data.place || '').trim().slice(0, 120),
      link: String(data.link || '').trim().slice(0, 300),
      note: String(data.note || '').trim().slice(0, 300),
      createdBy: by,
      createdAt: new Date().toISOString(),
    };
    const idx = inv.items.findIndex((i) => i.id === item.id);
    if (idx >= 0) { item.createdBy = inv.items[idx].createdBy; item.createdAt = inv.items[idx].createdAt; item.editedBy = by; inv.items[idx] = item; }
    else inv.items.push(item);
    inv.items.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    cfg.save();
    cfg.addLog(idx >= 0 ? 'Undangan diubah' : 'Undangan dicatat', `${item.fams} — ${prettyDate(date)}${item.time ? ` ${item.time}` : ''} (oleh ${by})`);
    postSchedule().catch(() => {});
    return { item, used: used + (idx >= 0 ? 0 : 1), limit };
  }

  function removeInvite(id, by) {
    const inv = cfg.get().invites;
    const it = inv.items.find((i) => i.id === id);
    if (!it) throw new Error('Undangan tidak ditemukan');
    inv.items = inv.items.filter((i) => i.id !== id);
    cfg.save();
    cfg.addLog('Undangan dihapus', `${it.fams} — ${prettyDate(it.date)} (oleh ${by})`);
    postSchedule().catch(() => {});
  }

  function scheduleEmbed() {
    const inv = cfg.get().invites;
    const up = inv.items.filter((i) => i.date >= todayWIB());
    const byDate = {};
    up.forEach((i) => (byDate[i.date] = byDate[i.date] || []).push(i));
    const fields = Object.entries(byDate).slice(0, 20).map(([date, list]) => {
      const lim = limitFor(date);
      return {
        name: `📅 ${prettyDate(date)}  ·  ${list.length}${lim ? `/${lim}` : ''}`,
        value: list.map((i) => `**${i.time || '—'}** · ${i.fams}${i.place ? ` @ ${i.place}` : ''}${i.link ? ` · [link](${i.link})` : ''}${i.note ? `\n> ${i.note}` : ''}`).join('\n').slice(0, 1024),
      };
    });
    return baseEmbed({
      title: '🗓️ JADWAL UNDANGAN FAMS — TRO',
      description: up.length ? `Undangan fams yang akan datang. Maks **${inv.weekdayLimit || '∞'}/hari** (Senin–Jumat)${inv.weekendLimit ? ` · **${inv.weekendLimit}/hari** weekend` : ' · weekend bebas'}.` : '*Belum ada undangan terjadwal.*',
      fields,
    });
  }

  async function postSchedule() {
    const inv = cfg.get().invites;
    if (!inv.channelId) return 'no-channel';
    const ch = await client.channels.fetch(inv.channelId);
    if (inv.messageId) {
      const old = await ch.messages.fetch(inv.messageId).catch(() => null);
      if (old) { await old.edit({ embeds: [scheduleEmbed()] }); return 'updated'; }
    }
    const msg = await ch.send({ embeds: [scheduleEmbed()], allowedMentions: { parse: [] } });
    inv.messageId = msg.id;
    cfg.save();
    return 'posted';
  }

  // ======================= INTERAKSI =======================
  client.on(Events.InteractionCreate, async (it) => {
    try {
      // --- tombol panel verifikasi ---
      if (it.isButton() && it.customId.startsWith('tro-verify:')) {
        const s = cfg.get(), v = s.verify;
        if (!v.enabled) return it.reply({ content: '⛔ Verifikasi sedang ditutup.', flags: MessageFlags.Ephemeral });
        const type = it.customId.split(':')[1];
        const pending = s.applications.find((a) => a.userId === it.user.id && a.status === 'pending');
        if (pending) return it.reply({ content: '⏳ Pengajuan kamu masih menunggu ACC admin. Sabar ya!', flags: MessageFlags.Ephemeral });
        const roles = type === 'guest' ? v.guestRoleIds : v.memberRoleIds;
        if (roles.length && roles.every((r) => it.member.roles.cache.has(r))) return it.reply({ content: '✅ Kamu sudah terverifikasi.', flags: MessageFlags.Ephemeral });
        const qs = (v.questions || []).filter((q) => q.label).slice(0, 5);
        if (!qs.length) return submitApp(it, type, []);
        const modal = new ModalBuilder().setCustomId(`tro-verify-modal:${type}`).setTitle(`Verifikasi — ${type === 'guest' ? v.guestLabel : v.memberLabel}`.slice(0, 45));
        qs.forEach((q, i) => modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId(`q${i}`).setLabel(q.label.slice(0, 45)).setPlaceholder((q.placeholder || '').slice(0, 100))
            .setStyle(q.long ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(q.required !== false).setMaxLength(q.long ? 1000 : 200),
        )));
        return it.showModal(modal);
      }
      if (it.isModalSubmit() && it.customId.startsWith('tro-verify-modal:')) {
        const type = it.customId.split(':')[1];
        const qs = (cfg.get().verify.questions || []).filter((q) => q.label).slice(0, 5);
        return submitApp(it, type, qs.map((q, i) => ({ q: q.label, a: it.fields.getTextInputValue(`q${i}`) })));
      }

      // --- tombol ACC / Tolak di channel admin ---
      if (it.isButton() && it.customId.startsWith('tro-app:')) {
        const [, action, id] = it.customId.split(':');
        if (!canReview(it.member)) return it.reply({ content: '⛔ Hanya admin yang bisa ACC / tolak.', flags: MessageFlags.Ephemeral });
        if (action === 'accept') {
          await it.deferReply({ flags: MessageFlags.Ephemeral });
          const app = await acceptApp(id, it.user.username);
          return it.editReply(`✅ <@${app.userId}> diterima sebagai ${typeLabel(app.type)}.`);
        }
        const modal = new ModalBuilder().setCustomId(`tro-reject:${id}`).setTitle('Tolak pengajuan')
          .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Alasan (dikirim ke user)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)));
        return it.showModal(modal);
      }
      if (it.isModalSubmit() && it.customId.startsWith('tro-reject:')) {
        await it.deferReply({ flags: MessageFlags.Ephemeral });
        const app = await rejectApp(it.customId.split(':')[1], it.user.username, it.fields.getTextInputValue('reason') || '');
        return it.editReply(`❌ Pengajuan <@${app.userId}> ditolak.`);
      }

      // --- /undangan ---
      if (it.isChatInputCommand() && it.commandName === 'undangan') {
        const sub = it.options.getSubcommand();
        if (sub === 'tambah') {
          const r = addInvite({ fams: it.options.getString('fams'), date: it.options.getString('tanggal'), time: it.options.getString('jam'), place: it.options.getString('tempat'), link: it.options.getString('link'), note: it.options.getString('catatan') }, it.user.username);
          return it.reply({ content: `✅ Dicatat: **${r.item.fams}** — ${prettyDate(r.item.date)}${r.item.time ? ` jam ${r.item.time}` : ''}\n📊 Kuota hari itu: **${r.used}${r.limit ? `/${r.limit}` : ''}**`, flags: MessageFlags.Ephemeral });
        }
        if (sub === 'hapus') {
          removeInvite(it.options.getString('id'), it.user.username);
          return it.reply({ content: '🗑️ Undangan dihapus.', flags: MessageFlags.Ephemeral });
        }
        if (sub === 'list') {
          const up = cfg.get().invites.items.filter((i) => i.date >= todayWIB()).slice(0, 25);
          return it.reply({ embeds: [scheduleEmbed().addFields(up.length ? [{ name: '🆔 ID (untuk hapus)', value: up.map((i) => `\`${i.id}\` ${i.fams} · ${i.date}`).join('\n').slice(0, 1024) }] : [])], flags: MessageFlags.Ephemeral });
        }
      }
    } catch (err) {
      const msg = { content: `❌ ${err.message}`, flags: MessageFlags.Ephemeral };
      if (it.deferred || it.replied) it.editReply(msg).catch(() => {}); else if (it.isRepliable()) it.reply(msg).catch(() => {});
    }
  });

  async function submitApp(it, type, answers) {
    const s = cfg.get(), v = s.verify;
    const app = {
      id: newId(), userId: it.user.id, username: it.user.username,
      avatar: it.user.displayAvatarURL({ size: 256 }), accountCreated: it.user.createdTimestamp,
      type, answers, status: 'pending', createdAt: new Date().toISOString(),
    };
    s.applications.unshift(app);
    s.applications = s.applications.slice(0, 1000);
    cfg.save();
    if (v.reviewChannelId) {
      const ch = await client.channels.fetch(v.reviewChannelId).catch(() => null);
      if (ch) {
        const msg = await ch.send(reviewPayload(app)).catch(() => null);
        if (msg) { app.reviewMessageId = msg.id; app.reviewChannelId = ch.id; cfg.save(); }
      }
    }
    cfg.addLog('Pengajuan baru', `<@${app.userId}> mengajukan ${typeLabel(type)}`);
    return it.reply({ content: `📨 Pengajuan **${typeLabel(type)}** terkirim! Tunggu ACC admin ya — kamu akan dapat DM kalau sudah diproses.`, flags: MessageFlags.Ephemeral });
  }

  return { autoSetup, sendPanel, acceptApp, rejectApp, addInvite, removeInvite, postSchedule, parseDate, limitFor, countOn, isWeekend, prettyDate, todayWIB };
}

module.exports = { setup, parseDate, isWeekend, prettyDate };
