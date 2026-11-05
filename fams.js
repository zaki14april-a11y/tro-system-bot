// ============================================================
//  🦉 TRO SYSTEM — Verifikasi member & Jadwal Undangan Fams
// ============================================================
const {
  Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder,
  TextInputStyle, PermissionFlagsBits, MessageFlags, SlashCommandBuilder,
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

// tanggal lahir bebas format: "23/03/2000", "27-10-2007", "26.11.99", "23 Maret", "4 November 1998"
const BLN = { jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mar: 3, maret: 3, march: 3, apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, agu: 8, agt: 8, agustus: 8, aug: 8, august: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, november: 11, des: 12, desember: 12, dec: 12, december: 12 };
function parseBirth(input) {
  const s = String(input || '').trim().toLowerCase();
  const m = s.match(/^(\d{1,2})[\s/.-]+(\d{1,2}|[a-z]+)(?:[\s/.-]+(\d{2,4}))?$/);
  if (!m) return null;
  const d = +m[1];
  const mo = /^\d+$/.test(m[2]) ? +m[2] : BLN[m[2]] || BLN[m[2].slice(0, 3)];
  if (!mo || mo > 12 || d < 1 || d > 31) return null;
  let y = m[3] ? +m[3] : null;
  if (y !== null && y < 100) y += y > (new Date().getFullYear() % 100) ? 1900 : 2000;
  const chk = new Date(Date.UTC(y || 2024, mo - 1, d));
  if (chk.getUTCMonth() !== mo - 1) return null;
  const md = `${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  let age = null;
  if (y) {
    const t = todayWIB();
    age = +t.slice(0, 4) - y - (t.slice(5) < md ? 1 : 0);
    if (age < 0 || age > 120) age = null;
  }
  return { md, year: y, age, pretty: `${d} ${['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][mo - 1]}${y ? ` ${y}` : ''}` };
}

function limitFor(date) {
  const inv = cfg.get().invites;
  return isWeekend(date) ? Number(inv.weekendLimit) || 0 : Number(inv.weekdayLimit) || 0; // 0 = tanpa batas
}
function countOn(date, exceptId) {
  return cfg.get().invites.items.filter((i) => i.date === date && i.id !== exceptId).length;
}

function setup({ client, baseEmbed, securityLog }) {
  const canReview = (member) => member?.permissions.has(PermissionFlagsBits.ManageRoles) || member?.permissions.has(PermissionFlagsBits.ManageGuild)
    || ((cfg.get().access?.reviewerRoleIds || []).length
      ? cfg.get().access.reviewerRoleIds.some((r) => member?.roles.cache.has(r))
      : member?.roles.cache.some((r) => /^(admin|owner)$/i.test(r.name.replace(/[^a-z]/gi, ''))))
    || (cfg.get().access?.superAdminIds || []).includes(member?.id);

  // ======================= VERIFIKASI =======================
  const questionsFor = (type) => {
    const v = cfg.get().verify;
    const list = type === 'member' && v.memberQuestions?.length ? v.memberQuestions : v.questions;
    return (list || []).filter((q) => q.label).slice(0, 5);
  };
  function buildModal(customId, title, qs) {
    const modal = new ModalBuilder().setCustomId(customId).setTitle(title.slice(0, 45));
    qs.forEach((q, i) => modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId(`q${i}`).setLabel(q.label.slice(0, 45)).setPlaceholder((q.placeholder || '').slice(0, 100))
        .setStyle(q.long ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(q.required !== false).setMaxLength(q.long ? 1000 : 200),
    )));
    return modal;
  }
  const readAnswers = (it, qs) => qs.map((q, i) => ({ q: q.label, a: it.fields.getTextInputValue(`q${i}`), key: q.key || undefined }));
  function birthOf(answers) {
    const a = answers.find((x) => x.key === 'birthdate');
    return a ? parseBirth(a.a) : null;
  }
  const answerFields = (app) => {
    const out = app.answers.map((a) => ({ name: a.q, value: (a.a || '-').slice(0, 1024), inline: !a.q.toLowerCase().includes('alasan') && (a.a || '').length < 40 }));
    if (app.birth?.age != null) out.splice(out.findIndex((f) => app.answers.find((a) => a.key === 'birthdate')?.q === f.name) + 1, 0, { name: 'Usia', value: `${app.birth.age} tahun`, inline: true });
    return out;
  };
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
      title: app.update ? '🔄 UPDATE DATA ANGGOTA LAMA' : app.type === 'member' ? '📋 PENGAJUAN MASUK ANGGOTA TRO' : `📝 Pengajuan ${typeLabel(app.type)}`,
      description: `**User:** <@${app.userId}> (${app.username})\n**Akun dibuat:** <t:${Math.floor(app.accountCreated / 1000)}:R>\n**Status:** ${st}${app.reviewedBy ? `\n**Oleh:** ${app.reviewedBy}` : ''}${app.reason ? `\n**Alasan:** ${app.reason}` : ''}`,
      fields: answerFields(app),
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
    await afterAccept(app);
    if (v.dmResult) member.send({ embeds: [baseEmbed({ title: app.update ? '✅ Data anggota terverifikasi!' : '✅ Verifikasi diterima!', description: app.update ? `Terima kasih, data kamu di **${g.name}** sudah diverifikasi admin. 🦉` : `Selamat, kamu resmi jadi **${typeLabel(app.type)}** di **${g.name}**. Selamat bergabung! 🦉`, color: '#30a46c' })] }).catch(() => {});
    cfg.addLog('Verifikasi ACC', `<@${app.userId}> sebagai ${typeLabel(app.type)} — oleh ${reviewer}`);
    await refreshReview(app);
    return app;
  }

  // setelah ACC: catat ulang tahun + kartu data anggota
  async function afterAccept(app) {
    const v = cfg.get().verify;
    if (app.birth?.md) { const bd = cfg.data('birthdays', { users: {}, lastRun: '', roleGiven: [] }); bd.users[app.userId] = app.birth.md; cfg.save(); }
    if (app.type === 'member' && v.dataChannelId) {
      const ch = await client.channels.fetch(v.dataChannelId).catch(() => null);
      if (ch) await ch.send({ embeds: [baseEmbed({
        title: '🦉 DATA ANGGOTA TRO',
        description: `<@${app.userId}> (${app.username})\n**Resmi bergabung:** <t:${Math.floor(Date.now() / 1000)}:D> · di-ACC **${app.reviewedBy}**`,
        fields: answerFields(app), thumbnail: app.avatar, color: '#d4af37',
      })], allowedMentions: { parse: [] } }).catch(() => {});
    }
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
        return openForm(it, type);
      }
      if (it.isModalSubmit() && it.customId.startsWith('tro-verify-modal:')) {
        const [, type, flag] = it.customId.split(':');
        return submitApp(it, type, readAnswers(it, questionsFor(type)), flag === 'update');
      }

      // --- tombol "Isi data sekarang" (DM / channel) ---
      if (it.isButton() && it.customId === 'tro-update:member') {
        const s = cfg.get();
        if (s.applications.find((a) => a.userId === it.user.id && a.type === 'member' && a.status === 'pending')) return it.reply({ content: '⏳ Data kamu sudah terkirim & menunggu ACC admin. Terima kasih!', flags: MessageFlags.Ephemeral });
        if (s.applications.find((a) => a.userId === it.user.id && a.type === 'member' && a.status === 'accepted')) return it.reply({ content: '✅ Data kamu sudah lengkap. Terima kasih!', flags: MessageFlags.Ephemeral });
        return openForm(it, 'member', true);
      }

      // --- /daftar (member isi form sendiri) ---
      if (it.isChatInputCommand() && it.commandName === 'daftar') {
        const s = cfg.get(), v = s.verify;
        if (!v.enabled) return it.reply({ content: '⛔ Pendaftaran sedang ditutup.', flags: MessageFlags.Ephemeral });
        const type = it.options.getString('sebagai') || 'member';
        if (s.applications.find((a) => a.userId === it.user.id && a.status === 'pending')) return it.reply({ content: '⏳ Pengajuan kamu masih menunggu ACC admin.', flags: MessageFlags.Ephemeral });
        return openForm(it, type);
      }

      // --- /anggota (admin) ---
      if (it.isChatInputCommand() && it.commandName === 'anggota') {
        if (!canReview(it.member)) return it.reply({ content: '⛔ Khusus admin.', flags: MessageFlags.Ephemeral });
        const sub = it.options.getSubcommand();
        if (sub === 'minta-data') {
          await it.deferReply({ flags: MessageFlags.Ephemeral });
          const j = await requestData({ roleId: it.options.getRole('role')?.id, channelId: it.options.getChannel('channel')?.id, by: it.user.username });
          return it.editReply(j.total ? `📨 Mengirim DM ke **${j.total}** member yang belum isi data (±${Math.ceil(j.total * 1.2 / 60)} menit). Progres bisa dilihat di dashboard → Pengajuan Member.` : '✅ Semua member sudah isi data terbaru!');
        }
        if (sub === 'belum-isi') {
          await it.deferReply({ flags: MessageFlags.Ephemeral });
          const list = await missingMembers();
          return it.editReply({ embeds: [baseEmbed({ title: `📋 Belum isi data — ${list.length} member`, description: list.length ? list.slice(0, 80).map((m) => `<@${m.id}>`).join(' ') + (list.length > 80 ? `\n…dan ${list.length - 80} lainnya` : '') + '\n\nKirim pengingat: `/anggota minta-data`' : '✅ Semua sudah isi!' })], allowedMentions: { parse: [] } });
        }
        const u = it.options.getUser('user');
        if (sub === 'tambah') {
          return it.showModal(buildModal(`tro-admin-add:${u.id}`, `Data anggota — ${u.username}`, questionsFor('member')));
        }
        const list = cfg.get().applications.filter((a) => a.userId === u.id);
        const app = list.find((a) => a.status === 'accepted') || list[0];
        if (!app) return it.reply({ content: `📭 Belum ada data untuk ${u.username}.`, flags: MessageFlags.Ephemeral });
        const [st] = STATUS[app.status];
        return it.reply({ embeds: [baseEmbed({ title: `🦉 Data ${typeLabel(app.type)} — ${u.username}`, description: `**Status:** ${st}${app.reviewedBy ? ` · oleh ${app.reviewedBy}` : ''}\n**Diajukan:** <t:${Math.floor(Date.parse(app.createdAt) / 1000)}:D>`, fields: answerFields(app), thumbnail: u.displayAvatarURL({ size: 256 }) })], flags: MessageFlags.Ephemeral });
      }
      if (it.isModalSubmit() && it.customId.startsWith('tro-admin-add:')) {
        await it.deferReply({ flags: MessageFlags.Ephemeral });
        const userId = it.customId.split(':')[1];
        const user = await client.users.fetch(userId);
        const answers = readAnswers(it, questionsFor('member'));
        const app = {
          id: newId(), userId, username: user.username, avatar: user.displayAvatarURL({ size: 256 }), accountCreated: user.createdTimestamp,
          type: 'member', answers, birth: birthOf(answers), status: 'accepted', createdAt: new Date().toISOString(),
          reviewedBy: it.user.username, reviewedAt: new Date().toISOString(), manual: true,
        };
        const s = cfg.get();
        s.applications.unshift(app); cfg.save();
        const member = await it.guild.members.fetch(userId).catch(() => null);
        if (member && s.verify.memberRoleIds.length) await member.roles.add(s.verify.memberRoleIds, `TRO SYSTEM: didaftarkan ${it.user.username}`).catch(() => {});
        if (member && s.verify.unverifiedRoleId) await member.roles.remove(s.verify.unverifiedRoleId).catch(() => {});
        await afterAccept(app);
        cfg.addLog('Anggota didaftarkan', `<@${userId}> oleh ${it.user.username}`);
        return it.editReply(`✅ Data <@${userId}> tersimpan${member && s.verify.memberRoleIds.length ? ' & role member diberikan' : ''}.`);
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

  // ======================= MINTA DATA MEMBER LAMA =======================
  const REQ = () => cfg.data('dataRequests', { users: {} });
  let job = { running: false, total: 0, sent: 0, failed: 0, failedIds: [], startedAt: null, finishedAt: null, by: '' };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function missingMembers(roleId) {
    const s = cfg.get(), v = s.verify;
    const g = client.guilds.cache.get(process.env.GUILD_ID);
    await g.members.fetch().catch(() => {});
    const role = roleId || v.memberRoleIds[0];
    if (!role) throw new Error('Pilih role member dulu (dashboard Verifikasi → Role untuk Member Baru)');
    const done = new Set(s.applications.filter((a) => a.type === 'member' && ['pending', 'accepted'].includes(a.status)).map((a) => a.userId));
    return [...g.members.cache.filter((m) => !m.user.bot && m.roles.cache.has(role) && !done.has(m.id)).values()];
  }

  const updateButton = () => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tro-update:member').setLabel('Isi data sekarang').setEmoji('📝').setStyle(ButtonStyle.Primary));

  async function requestData({ roleId, channelId, by, onlyIds }) {
    if (job.running) throw new Error(`Masih mengirim (${job.sent + job.failed}/${job.total})`);
    const g = client.guilds.cache.get(process.env.GUILD_ID);
    let list = await missingMembers(roleId);
    if (onlyIds?.length) list = list.filter((m) => onlyIds.includes(m.id));
    job = { running: true, total: list.length, sent: 0, failed: 0, failedIds: [], startedAt: new Date().toISOString(), finishedAt: null, by };
    cfg.addLog('Minta data member lama', `${list.length} member akan dikirimi DM (oleh ${by})`);
    (async () => {
      const req = REQ();
      for (const m of list) {
        const ok = await m.send({
          embeds: [baseEmbed({
            title: '📝 UPDATE DATA ANGGOTA TRO',
            description: `Halo **${m.displayName}**! 👋\n\nTRO sekarang pakai sistem data anggota baru. Kamu belum mengisi data terbaru, jadi mohon isi form singkat ini ya (cuma ±1 menit):\n\n• Nama\n• USN Roblox\n• Tanggal lahir\n• Domisili\n• Alasan bergabung\n\nKlik tombol **📝 Isi data sekarang** di bawah. Terima kasih! 🦉`,
          })],
          components: [updateButton()],
        }).then(() => true).catch(() => false);
        req.users[m.id] = { sentAt: new Date().toISOString(), count: (req.users[m.id]?.count || 0) + 1, dm: ok };
        if (ok) job.sent++; else { job.failed++; job.failedIds.push(m.id); }
        await sleep(1200);
      }
      cfg.save();
      // yang DM-nya tertutup → mention di channel
      if (channelId && job.failedIds.length) {
        const ch = await client.channels.fetch(channelId).catch(() => null);
        for (let i = 0; ch && i < job.failedIds.length; i += 40) {
          const chunk = job.failedIds.slice(i, i + 40);
          await ch.send({
            content: chunk.map((id) => `<@${id}>`).join(' '),
            embeds: [baseEmbed({ title: '📝 UPDATE DATA ANGGOTA TRO', description: 'Member di atas belum mengisi **data anggota terbaru** dan DM-nya tertutup.\nKlik tombol di bawah untuk isi form (±1 menit). Terima kasih! 🦉' })],
            components: [updateButton()],
            allowedMentions: { users: chunk },
          }).catch(() => {});
          await sleep(1500);
        }
      }
      job.running = false; job.finishedAt = new Date().toISOString();
      cfg.addLog('Minta data selesai', `${job.sent} DM terkirim · ${job.failed} DM tertutup${channelId && job.failed ? ' (di-mention di channel)' : ''}`);
    })().catch((e) => { job.running = false; cfg.addLog('Minta data gagal', e.message); });
    return job;
  }

  async function openForm(it, type, update = false) {
    const v = cfg.get().verify;
    const qs = questionsFor(type);
    if (!qs.length) return submitApp(it, type, [], update);
    return it.showModal(buildModal(`tro-verify-modal:${type}${update ? ':update' : ''}`, update ? 'Update Data Anggota TRO' : type === 'member' ? 'Pengajuan Masuk Anggota TRO' : `Verifikasi — ${v.guestLabel}`, qs));
  }

  async function submitApp(it, type, answers, update = false) {
    const s = cfg.get(), v = s.verify;
    const app = {
      id: newId(), userId: it.user.id, username: it.user.username,
      avatar: it.user.displayAvatarURL({ size: 256 }), accountCreated: it.user.createdTimestamp,
      type, answers, birth: birthOf(answers), status: 'pending', createdAt: new Date().toISOString(), update,
    };
    if (answers.some((a) => a.key === 'birthdate') && !app.birth) {
      return it.reply({ content: '❌ Format tanggal lahir tidak dikenali. Contoh: **23/03/2000** atau **23 Maret 2000**. Silakan isi ulang.', flags: MessageFlags.Ephemeral });
    }
    s.applications.unshift(app);
    s.applications = s.applications.slice(0, 1000);
    cfg.save();
    const reviewId = (type === 'member' && v.memberReviewChannelId) || v.reviewChannelId;
    if (reviewId) {
      const ch = await client.channels.fetch(reviewId).catch(() => null);
      if (ch) {
        const msg = await ch.send(reviewPayload(app)).catch(() => null);
        if (msg) { app.reviewMessageId = msg.id; app.reviewChannelId = ch.id; cfg.save(); }
      }
    }
    cfg.addLog(update ? 'Update data anggota' : 'Pengajuan baru', `<@${app.userId}> ${update ? 'mengirim update data' : `mengajukan ${typeLabel(type)}`}`);
    return it.reply({ content: update ? '✅ Data kamu terkirim! Terima kasih sudah update data anggota TRO 🦉' : `📨 Pengajuan **${typeLabel(type)}** terkirim! Tunggu ACC admin ya — kamu akan dapat DM kalau sudah diproses.`, flags: MessageFlags.Ephemeral });
  }

  const commands = [
    new SlashCommandBuilder().setName('daftar').setDescription('Isi form pengajuan masuk TRO')
      .addStringOption((o) => o.setName('sebagai').setDescription('Daftar sebagai').addChoices({ name: '🦉 Member Baru', value: 'member' }, { name: '🎟️ Tamu', value: 'guest' })).toJSON(),
    new SlashCommandBuilder().setName('anggota').setDescription('Data anggota TRO (admin)').setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addSubcommand((sc) => sc.setName('tambah').setDescription('Daftarkan / isi data anggota (member lama)').addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)))
      .addSubcommand((sc) => sc.setName('cek').setDescription('Lihat data anggota').addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)))
      .addSubcommand((sc) => sc.setName('minta-data').setDescription('DM semua member lama yang belum isi data terbaru')
        .addRoleOption((o) => o.setName('role').setDescription('Role member (default: role Member Baru)'))
        .addChannelOption((o) => o.setName('channel').setDescription('Channel untuk mention yang DM-nya tertutup')))
      .addSubcommand((sc) => sc.setName('belum-isi').setDescription('Lihat siapa saja yang belum isi data')).toJSON(),
  ];

  function routes(api) {
    api.get('/data-requests', async (req, res) => {
      try {
        const list = await missingMembers(req.query.roleId);
        const reqs = REQ().users;
        res.json({ job, missing: list.map((m) => ({ id: m.id, name: m.displayName, avatar: m.user.displayAvatarURL({ size: 64 }), sent: reqs[m.id] || null })) });
      } catch (e) { res.status(400).json({ error: e.message }); }
    });
    api.post('/data-requests', async (req, res) => {
      try { res.json(await requestData({ roleId: req.body.roleId, channelId: req.body.channelId, by: req.session.user.username, onlyIds: req.body.onlyIds })); }
      catch (e) { res.status(400).json({ error: e.message }); }
    });
  }

  return { commands, routes, autoSetup, sendPanel, acceptApp, rejectApp, addInvite, removeInvite, postSchedule, parseDate, limitFor, countOn, isWeekend, prettyDate, todayWIB };
}

module.exports = { setup, parseDate, isWeekend, prettyDate, parseBirth };
