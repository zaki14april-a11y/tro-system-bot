// ============================================================
//  👥 TRO SYSTEM — Manajemen member
//  📨 DM massal (multi role / orang tertentu)
//  💤 Pelacak keaktifan + DM cek aktif + cabut role / kick
//  🏛️ Struktur & daftar member otomatis + 🗂️ data visitor
// ============================================================
const {
  Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, MessageFlags, PermissionFlagsBits: P,
} = require('discord.js');
const cfg = require('./config');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const DAY = 86_400_000;

function setup({ client, baseEmbed }) {
  const guild = () => client.guilds.cache.get(process.env.GUILD_ID);
  // role tamu: dari pengaturan verifikasi + role tamu lama (GUEST / TAMU dari bot sebelumnya)
  const guestRoleIds = () => { const g = guild(); const v = cfg.get().verify; return [...new Set([...(v.guestRoleIds || []), ...(g ? g.roles.cache.filter((r) => /^(guest|tamu|visitor)$/i.test(r.name.replace(/[^a-z]/gi, ''))).map((r) => r.id) : [])])]; };
  const BC = () => cfg.data('broadcasts', { jobs: [] });
  const AC = () => cfg.data('activity', { users: {}, checks: {} });
  const DIR = () => {
    const s = cfg.get();
    if (!s.directory) s.directory = { structureChannelId: '', structureRoleIds: [], structureMessageIds: [], memberListRoleId: '', visitorChannelId: '', title: '🏛️ STRUKTUR THE RESILIENT ORDER' };
    return s.directory;
  };
  const ACT = () => {
    const s = cfg.get();
    if (!s.activityCfg) s.activityCfg = { inactiveDays: 14, ignoreRoleIds: [], checkMessage: 'Halo {user}! 👋\nKami dari **THE RESILIENT ORDER** kangen nih, kamu udah lama gak kelihatan di server.\n\nKamu masih mau lanjut bareng TRO? Klik salah satu tombol di bawah ya 🦉' };
    return s.activityCfg;
  };

  // ======================= 💤 PELACAK AKTIVITAS =======================
  let dirty = false;
  const touch = (id, kind) => {
    const u = AC().users[id] || (AC().users[id] = { msgs: 0 });
    u[kind] = Date.now(); if (kind === 'msg') u.msgs = (u.msgs || 0) + 1;
    dirty = true;
  };
  setInterval(() => { if (dirty) { dirty = false; cfg.saveSoon(); } }, 60_000);
  client.on(Events.MessageCreate, (m) => { if (m.guild?.id === process.env.GUILD_ID && !m.author.bot) touch(m.author.id, 'msg'); });
  client.on(Events.VoiceStateUpdate, (o, n) => { if (n.guild.id === process.env.GUILD_ID && n.channelId && !n.member?.user.bot) touch(n.id, 'voice'); });
  client.on(Events.GuildMemberAdd, (m) => { if (m.guild.id === process.env.GUILD_ID) { const u = AC().users[m.id] || (AC().users[m.id] = { msgs: 0 }); u.joined = Date.now(); dirty = true; } });

  async function inactiveList(days, roleIds = []) {
    const g = guild(); if (!g) return [];
    const members = await client.fetchMembers(g);
    const ign = ACT().ignoreRoleIds || [], now = Date.now(), A = AC();
    const out = [];
    for (const m of members.values()) {
      if (m.user.bot) continue;
      if (roleIds.length && !roleIds.some((r) => m.roles.cache.has(r))) continue;
      if (ign.some((r) => m.roles.cache.has(r))) continue;
      const u = A.users[m.id] || {};
      const last = Math.max(u.msg || 0, u.voice || 0);
      const since = last || u.joined || m.joinedTimestamp || 0;
      const idle = Math.floor((now - since) / DAY);
      if (idle < days) continue;
      out.push({ id: m.id, name: m.displayName, username: m.user.username, avatar: m.user.displayAvatarURL({ size: 64 }), lastActive: last || null, idleDays: idle, joinedAt: m.joinedTimestamp, msgs: u.msgs || 0,
        roles: m.roles.cache.filter((r) => r.id !== g.id).sort((a, b) => b.position - a.position).map((r) => ({ id: r.id, name: r.name, color: r.hexColor })).slice(0, 4),
        check: A.checks[m.id] || null });
    }
    return out.sort((a, b) => b.idleDays - a.idleDays);
  }

  // 📋 daftar per kategori: member/visitor aktif & tidak aktif + akun kosong
  async function memberList(view, days) {
    const g = guild(); if (!g) return { list: [], counts: {} };
    const members = await client.fetchMembers(g);
    const v = cfg.get().verify, A = AC(), now = Date.now(), ign = ACT().ignoreRoleIds || [];
    const apps = cfg.get().applications || [];
    const counts = { member_active: 0, member_inactive: 0, visitor_active: 0, visitor_inactive: 0, empty: 0 };
    const out = [];
    for (const m of members.values()) {
      if (m.user.bot) continue;
      const isMember = v.memberRoleIds.some((r) => m.roles.cache.has(r));
      const isGuest = !isMember && guestRoleIds().some((r) => m.roles.cache.has(r));
      const u = A.users[m.id] || {};
      const last = Math.max(u.msg || 0, u.voice || 0);
      const idle = Math.floor((now - (last || u.joined || m.joinedTimestamp || 0)) / DAY);
      const flags = [];
      if (!isMember && !isGuest) flags.push('belum verifikasi');
      if (!last) flags.push('belum pernah chat/voice');
      if (!m.user.avatar) flags.push('tanpa foto profil');
      if (now - m.user.createdTimestamp < 30 * DAY) flags.push('akun baru (<30 hari)');
      const hasData = apps.some((a) => a.userId === m.id && a.status === 'accepted' && a.answers?.length);
      if ((isMember || isGuest) && !hasData) flags.push('data belum diisi');
      let cat;
      if (!isMember && !isGuest) cat = 'empty';
      else if (ign.some((r) => m.roles.cache.has(r))) cat = isMember ? 'member_active' : 'visitor_active';
      else cat = (isMember ? 'member_' : 'visitor_') + (idle >= days ? 'inactive' : 'active');
      counts[cat]++;
      if (cat !== view) continue;
      out.push({ id: m.id, name: m.displayName, username: m.user.username, avatar: m.user.displayAvatarURL({ size: 64 }), lastActive: last || null, idleDays: idle, joinedAt: m.joinedTimestamp, created: m.user.createdTimestamp, msgs: u.msgs || 0, flags,
        roles: m.roles.cache.filter((r) => r.id !== g.id).sort((a, b) => b.position - a.position).map((r) => ({ id: r.id, name: r.name, color: r.hexColor })).slice(0, 4),
        check: A.checks[m.id] || null });
    }
    out.sort((a, b) => view.endsWith('_active') ? (b.lastActive || 0) - (a.lastActive || 0) : b.idleDays - a.idleDays);
    return { list: out, counts, scannedAt: A.scannedAt || null };
  }

  // 🔎 isi data keaktifan dari riwayat chat lama (biar daftar tidak aktif akurat dari awal)
  let scanning = null;
  async function scanHistory() {
    if (scanning?.running) return scanning;
    const g = guild(); if (!g) throw new Error('Bot belum siap');
    const chans = g.channels.cache.filter((c) => c.isTextBased() && !c.isThread() && c.viewable && c.permissionsFor(g.members.me)?.has(P.ReadMessageHistory));
    scanning = { running: true, channels: chans.size, done: 0, messages: 0 };
    (async () => {
      const A = AC();
      for (const ch of chans.values()) {
        let before;
        for (let i = 0; i < 10; i++) {
          const batch = await ch.messages.fetch({ limit: 100, before }).catch(() => null);
          if (!batch?.size) break;
          for (const msg of batch.values()) {
            if (msg.author.bot) continue;
            const u = A.users[msg.author.id] || (A.users[msg.author.id] = { msgs: 0 });
            if (!u.msg || msg.createdTimestamp > u.msg) u.msg = msg.createdTimestamp;
            scanning.messages++;
          }
          before = batch.last().id;
          if (batch.size < 100) break;
        }
        scanning.done++;
      }
      A.scannedAt = Date.now(); cfg.save(); scanning.running = false;
      cfg.addLog('Scan riwayat aktivitas', `${scanning.messages} pesan dari ${scanning.channels} channel`);
    })().catch((e) => { scanning.running = false; scanning.error = e.message; });
    return scanning;
  }
  client.once('ready', () => setTimeout(() => { if (!AC().scannedAt) scanHistory().catch(() => {}); }, 60_000));

  const checkRow = () => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tro-act:yes').setLabel('Masih aktif').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('tro-act:izin').setLabel('Lagi sibuk / izin').setEmoji('⏸️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tro-act:leave').setLabel('Mau keluar').setEmoji('👋').setStyle(ButtonStyle.Danger),
  );

  // ======================= 📨 DM MASSAL =======================
  let running = null;
  async function resolveTargets({ roleIds = [], userIds = [], exceptRoleIds = [], match = 'any' }) {
    const g = guild(); if (!g) throw new Error('Bot belum siap');
    const members = await client.fetchMembers(g);
    const set = new Map();
    for (const id of userIds) { const m = members.get(id); if (m && !m.user.bot) set.set(id, m); }
    if (roleIds.length) for (const m of members.values()) {
      if (m.user.bot) continue;
      const ok = match === 'all' ? roleIds.every((r) => m.roles.cache.has(r)) : roleIds.some((r) => m.roles.cache.has(r));
      if (ok) set.set(m.id, m);
    }
    for (const [id, m] of set) if (exceptRoleIds.some((r) => m.roles.cache.has(r))) set.delete(id);
    return [...set.values()];
  }

  async function startBroadcast(body, by) {
    if (running) throw new Error('Masih ada DM massal yang berjalan, tunggu selesai dulu');
    const targets = await resolveTargets(body);
    if (!targets.length) throw new Error('Tidak ada penerima yang cocok');
    if (!String(body.message || '').trim()) throw new Error('Isi pesan wajib diisi');
    const job = { id: newId(), kind: body.kind || 'dm', title: String(body.title || '').slice(0, 200), message: String(body.message).slice(0, 3500), image: body.image || '', link: body.link || '', linkLabel: body.linkLabel || 'Buka',
      roleIds: body.roleIds || [], userCount: targets.length, sent: 0, failed: 0, failedIds: [], by, startedAt: Date.now(), doneAt: null };
    BC().jobs.unshift(job); BC().jobs = BC().jobs.slice(0, 30); cfg.save();
    running = job;
    (async () => {
      for (const m of targets) {
        const text = job.message.replaceAll('{user}', `<@${m.id}>`).replaceAll('{name}', m.displayName).replaceAll('{server}', guild()?.name || 'TRO');
        const payload = { embeds: [baseEmbed({ title: job.title || undefined, description: text, image: job.image || undefined })] };
        if (job.kind === 'check') { payload.components = [checkRow()]; AC().checks[m.id] = { status: 'sent', at: Date.now(), by }; }
        else if (/^https?:\/\//.test(job.link)) payload.components = [new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(job.link).setLabel(job.linkLabel.slice(0, 80)))];
        try { await m.send(payload); job.sent++; } catch { job.failed++; job.failedIds.push(m.id); if (job.kind === 'check') AC().checks[m.id] = { status: 'dm-closed', at: Date.now(), by }; }
        await sleep(1200);
      }
      job.doneAt = Date.now(); running = null; cfg.save();
      cfg.addLog(job.kind === 'check' ? 'Cek keaktifan' : 'DM massal', `${job.sent} terkirim · ${job.failed} DM tertutup — oleh ${by}`);
    })().catch(() => { running = null; });
    return job;
  }

  // ======================= 🏛️ STRUKTUR & DAFTAR MEMBER =======================
  // spec = { title, roleIds, note } — dipakai untuk struktur utama & struktur tambahan (data-anggota, data-clan, dll)
  async function structureEmbeds(spec) {
    const g = guild();
    const members = await client.fetchMembers(g);
    const roles = (spec.roleIds || []).map((id) => g.roles.cache.get(id)).filter(Boolean);
    const shown = new Set();
    const embeds = [];
    const fields = [];
    let no = 0;
    for (const r of roles) {
      const ex = spec.excludeRoleIds || [];
      const list = members.filter((m) => !m.user.bot && m.roles.cache.has(r.id) && !shown.has(m.id) && !ex.some((x) => m.roles.cache.has(x))).sort((a, b) => a.displayName.localeCompare(b.displayName));
      if (!list.size) continue;
      list.forEach((m) => shown.add(m.id));
      const lines = list.map((m) => `\`${String(++no).padStart(2, '0')}\` <@${m.id}>`);
      const chunks = [];
      let cur = '';
      for (const l of lines) { if ((cur + l + '\n').length > 1000) { chunks.push(cur); cur = ''; } cur += l + '\n'; }
      if (cur) chunks.push(cur);
      chunks.forEach((c, i) => fields.push({ name: i ? '‎' : `${r.name} — ${list.size}`, value: c }));
    }
    for (let i = 0; i < fields.length; i += 12) embeds.push(baseEmbed({ title: i ? undefined : spec.title, description: i ? undefined : `${spec.note || `Daftar resmi pengurus & anggota **${g.name}**`}\nUpdate otomatis tiap ada perubahan role · Total: **${shown.size}** orang`, fields: fields.slice(i, i + 12), thumbnail: i ? null : undefined }));
    if (!embeds.length) embeds.push(baseEmbed({ title: spec.title, description: 'Belum ada role yang dipilih untuk struktur ini.' }));
    return embeds;
  }

  async function postTo(channelId, embeds, prevIds) {
    const ch = await client.channels.fetch(channelId).catch(() => null); if (!ch) return null;
    const groups = []; for (let i = 0; i < embeds.length; i += 4) groups.push(embeds.slice(i, i + 4));
    const ids = [];
    for (let i = 0; i < groups.length; i++) {
      const old = prevIds[i] && await ch.messages.fetch(prevIds[i]).catch(() => null);
      const payload = { embeds: groups[i], allowedMentions: { parse: [] } };
      if (old) { await old.edit(payload).catch(() => {}); ids.push(old.id); } else { const m = await ch.send(payload); ids.push(m.id); }
    }
    for (const extra of prevIds.slice(groups.length)) { const m = await ch.messages.fetch(extra).catch(() => null); if (m) await m.delete().catch(() => {}); }
    return ids;
  }

  let structTimer = null;
  async function postStructure() {
    const d = DIR(); d.extra ||= [];
    let any = false;
    if (d.structureChannelId) {
      const ids = await postTo(d.structureChannelId, await structureEmbeds({ title: d.title, roleIds: d.structureRoleIds }), d.structureMessageIds || []);
      if (ids) { d.structureMessageIds = ids; any = true; }
    }
    for (const x of d.extra) {
      if (!x.channelId) continue;
      const ids = await postTo(x.channelId, await structureEmbeds(x), x.messageIds || []);
      if (ids) { x.messageIds = ids; any = true; }
    }
    cfg.save();
    return any ? 'ok' : 'no-channel';
  }
  const allStructRoles = () => { const d = DIR(); return [...new Set([...(d.structureRoleIds || []), ...(d.extra || []).flatMap((x) => x.roleIds || [])])]; };
  const queueStructure = () => { clearTimeout(structTimer); structTimer = setTimeout(() => postStructure().catch(() => {}), 15_000); };
  client.on(Events.GuildMemberUpdate, (o, n) => {
    if (n.guild.id !== process.env.GUILD_ID) return;
    if (allStructRoles().some((r) => o.roles.cache.has(r) !== n.roles.cache.has(r)) || o.displayName !== n.displayName) queueStructure();
  });
  client.on(Events.GuildMemberRemove, (m) => { if (m.guild.id === process.env.GUILD_ID && allStructRoles().some((r) => m.roles.cache.has(r))) queueStructure(); });

  // 🗂️ kartu data visitor (Tamu) setelah di-ACC — member sudah dicatat oleh modul verifikasi
  setInterval(async () => {
    const d = DIR(); if (!d.visitorChannelId) return;
    const apps = (cfg.get().applications || []).filter((a) => a.status === 'accepted' && a.type === 'guest' && !a.visitorCard);
    if (!apps.length) return;
    const ch = await client.channels.fetch(d.visitorChannelId).catch(() => null); if (!ch) return;
    for (const a of apps.slice(0, 5)) {
      const fields = (a.answers || []).map((x) => ({ name: x.q || x.key, value: String(x.a || '-').slice(0, 1000), inline: String(x.a || '').length < 40 }));
      if (a.birth?.age != null) fields.push({ name: 'Usia', value: `${a.birth.age} tahun`, inline: true });
      await ch.send({ embeds: [baseEmbed({ title: '🎟️ DATA VISITOR / TAMU TRO', description: `<@${a.userId}> (${a.username})\n**Masuk sebagai tamu:** <t:${Math.floor(Date.parse(a.reviewedAt || a.createdAt || Date.now()) / 1000)}:D>${a.reviewedBy ? ` · di-ACC **${a.reviewedBy}**` : ''}`, fields, thumbnail: a.avatar, color: '#e5484d' })], allowedMentions: { parse: [] } }).catch(() => {});
      a.visitorCard = true;
    }
    cfg.save();
  }, 60_000);

  client.once('ready', () => { setTimeout(() => postStructure().catch(() => {}), 20_000); setInterval(() => postStructure().catch(() => {}), 30 * 60_000); });

  // 🗄️ sinkron data lama → data-member / data-visitor + catatan di dashboard
  let syncing = null;
  async function seenIn(ch) {
    const ids = new Set(); let before;
    for (let i = 0; i < 15; i++) {
      const batch = await ch.messages.fetch({ limit: 100, before }).catch(() => null);
      if (!batch?.size) break;
      batch.forEach((m) => { const t = [m.content, ...m.embeds.map((e) => e.description || '')].join(' '); for (const x of t.matchAll(/<@!?(\d{15,})>/g)) ids.add(x[1]); });
      before = batch.last().id;
    }
    return ids;
  }
  async function syncOldData(by) {
    if (syncing?.running) throw new Error('Sinkron masih berjalan');
    const s = cfg.get(), v = s.verify, g = guild();
    if (!g) throw new Error('Bot belum siap');
    const dataCh = v.dataChannelId && await client.channels.fetch(v.dataChannelId).catch(() => null);
    const visCh = DIR().visitorChannelId && await client.channels.fetch(DIR().visitorChannelId).catch(() => null);
    if (!dataCh && !visCh) throw new Error('Channel data-member / data-visitor belum diatur');
    syncing = { running: true, total: 0, done: 0, posted: 0, created: 0, startedAt: Date.now(), by };
    try { return await syncPrepare(by, s, v, g, dataCh, visCh); } catch (e) { syncing.running = false; syncing.error = e.message; throw e; }
  }
  async function syncPrepare(by, s, v, g, dataCh, visCh) {
    await client.fetchMembers(g);
    const seenM = dataCh ? await seenIn(dataCh) : new Set(), seenV = visCh ? await seenIn(visCh) : new Set();
    const apps = s.applications || (s.applications = []);
    const jobs = [];
    // 1) yang sudah di-ACC lewat sistem tapi kartunya belum ada
    for (const a of apps.filter((x) => x.status === 'accepted')) {
      if (a.type === 'member' && dataCh && !a.dataCard && !seenM.has(a.userId)) jobs.push({ a, ch: dataCh, kind: 'member' });
      if (a.type === 'guest' && visCh && !seenV.has(a.userId)) { a.visitorCard = false; jobs.push({ a, ch: visCh, kind: 'guest' }); }
      if (a.type === 'member' && seenM.has(a.userId)) a.dataCard = true;
      if (a.type === 'guest' && seenV.has(a.userId)) a.visitorCard = true;
    }
    // 2) yang sudah punya role member/tamu dari sistem lama tapi belum tercatat sama sekali
    const has = (uid, type) => apps.some((x) => x.userId === uid && x.type === type && x.status === 'accepted');
    for (const m of g.members.cache.values()) {
      if (m.user.bot) continue;
      const type = v.memberRoleIds.some((r) => m.roles.cache.has(r)) ? 'member' : guestRoleIds().some((r) => m.roles.cache.has(r)) ? 'guest' : null;
      if (!type || has(m.id, type)) continue;
      const a = { id: Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5), userId: m.id, username: m.user.username, avatar: m.user.displayAvatarURL({ size: 256 }),
        accountCreated: m.user.createdTimestamp, type, answers: [], status: 'accepted', legacy: true, manual: true, reviewedBy: 'data lama', createdAt: new Date(m.joinedTimestamp || Date.now()).toISOString(), reviewedAt: new Date(m.joinedTimestamp || Date.now()).toISOString() };
      apps.push(a); syncing.created++;
      const ch = type === 'member' ? dataCh : visCh, seen = type === 'member' ? seenM : seenV;
      if (ch && !seen.has(m.id)) jobs.push({ a, ch, kind: type, m });
      else if (type === 'member') a.dataCard = true; else a.visitorCard = true;
    }
    cfg.save();
    syncing.total = jobs.length;
    (async () => {
      for (const { a, ch, kind, m } of jobs) {
        const mem = m || g.members.cache.get(a.userId);
        const fields = (a.answers || []).map((x) => ({ name: x.q || x.key || 'Jawaban', value: String(x.a || '-').slice(0, 1000), inline: String(x.a || '').length < 40 }));
        if (a.birth?.age != null) fields.push({ name: 'Usia', value: `${a.birth.age} tahun`, inline: true });
        if (mem) fields.push({ name: 'Role', value: mem.roles.cache.filter((r) => r.id !== g.id).sort((x, y) => y.position - x.position).map((r) => `<@&${r.id}>`).slice(0, 12).join(' ') || '-', inline: false });
        const joined = Math.floor((mem?.joinedTimestamp || Date.parse(a.reviewedAt || a.createdAt)) / 1000);
        const note = a.legacy ? '\n-# Data dari sistem lama · formulir belum diisi (bisa diminta lewat dashboard → Pengajuan → Minta data)' : '';
        const payload = kind === 'member'
          ? { title: '🦉 DATA ANGGOTA TRO', description: `<@${a.userId}> (${a.username})\n**Bergabung:** <t:${joined}:D>${a.reviewedBy ? ` · di-ACC **${a.reviewedBy}**` : ''}${note}`, color: '#d4af37' }
          : { title: '🎟️ DATA VISITOR / TAMU TRO', description: `<@${a.userId}> (${a.username})\n**Masuk sebagai tamu:** <t:${joined}:D>${a.reviewedBy ? ` · di-ACC **${a.reviewedBy}**` : ''}${note}`, color: '#e5484d' };
        const ok = await ch.send({ embeds: [baseEmbed({ ...payload, fields, thumbnail: a.avatar })], allowedMentions: { parse: [] } }).then(() => true).catch(() => false);
        if (ok) { syncing.posted++; if (kind === 'member') a.dataCard = true; else a.visitorCard = true; }
        syncing.done++;
        if (syncing.done % 10 === 0) cfg.save();
        await new Promise((r) => setTimeout(r, 1300));
      }
      cfg.save(); syncing.running = false; syncing.finishedAt = Date.now();
      cfg.addLog('Sinkron data lama', `${syncing.posted} kartu dikirim, ${syncing.created} member lama dicatat — oleh ${by}`);
      queueStructure();
      scanHistory().catch(() => {});
    })().catch((e) => { syncing.running = false; syncing.error = e.message; });
    return syncing;
  }

  // ======================= Interaksi =======================
  client.on(Events.InteractionCreate, async (it) => {
    try {
      if (it.isButton() && it.customId.startsWith('tro-act:')) {
        const st = it.customId.split(':')[1];
        AC().checks[it.user.id] = { ...(AC().checks[it.user.id] || {}), status: st, answeredAt: Date.now() };
        if (st === 'yes') touch(it.user.id, 'msg');
        cfg.save();
        const txt = { yes: '✅ Mantap! Makasih udah konfirmasi, ditunggu di server ya 🦉', izin: '⏸️ Siap, dicatat lagi sibuk/izin. Kabarin kalau udah balik ya!', leave: '👋 Oke, makasih udah pernah bareng TRO. Pintu selalu terbuka kalau mau balik.' }[st];
        await it.update({ components: [] }).catch(() => {});
        await it.followUp({ content: txt }).catch(() => {});
        cfg.addLog('Jawaban cek aktif', `${it.user.username}: ${st}`);
        return;
      }
      if (!it.isChatInputCommand() || it.commandName !== 'struktur') return;
      await it.deferReply({ flags: MessageFlags.Ephemeral });
      const r = await postStructure();
      await it.editReply(r === 'ok' ? '✅ Struktur diperbarui.' : '⚠️ Channel struktur belum diatur di dashboard.');
    } catch (e) { console.error('members:', e.message); }
  });

  // ======================= API dashboard =======================
  function routes(api) {
    api.get('/members/directory', (req, res) => res.json(DIR()));
    api.put('/members/directory', async (req, res) => {
      const d = DIR();
      for (const k of ['structureChannelId', 'visitorChannelId', 'title']) if (req.body[k] !== undefined) d[k] = String(req.body[k]);
      if (Array.isArray(req.body.structureRoleIds)) { if (req.body.structureChannelId !== undefined && d.structureChannelId !== req.body.prevChannelId) d.structureMessageIds = []; d.structureRoleIds = req.body.structureRoleIds; }
      cfg.save(); res.json({ ok: true });
    });
    api.post('/members/sync', async (req, res) => { try { res.json(await syncOldData(req.session.user.username)); } catch (e) { res.status(400).json({ error: e.message }); } });
    api.get('/members/sync', (req, res) => res.json(syncing || { running: false }));
    api.put('/members/directory/extra', async (req, res) => {
      const d = DIR(); const prev = d.extra || [];
      d.extra = (req.body.items || []).map((x) => { const p = prev.find((y) => y.id === x.id); return { id: x.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 5), title: String(x.title || 'Struktur').slice(0, 200), note: String(x.note || '').slice(0, 300), channelId: String(x.channelId || ''), roleIds: (x.roleIds || []).map(String), excludeRoleIds: (x.excludeRoleIds || []).map(String), messageIds: p && p.channelId === x.channelId ? p.messageIds || [] : [] }; });
      cfg.save(); res.json({ ok: true, result: await postStructure().catch((e) => e.message), items: d.extra });
    });
    api.post('/members/directory/post', async (req, res) => { try { res.json({ result: await postStructure() }); } catch (e) { res.status(400).json({ error: e.message }); } });

    api.get('/members/list', async (req, res) => { try { res.json(await memberList(String(req.query.view || 'member_inactive'), Number(req.query.days) || ACT().inactiveDays)); } catch (e) { res.status(400).json({ error: e.message }); } });
    api.post('/members/scan', async (req, res) => { try { res.json(await scanHistory()); } catch (e) { res.status(400).json({ error: e.message }); } });
    api.get('/members/scan', (req, res) => res.json(scanning || { running: false, scannedAt: AC().scannedAt || null }));
    api.get('/members/activity', async (req, res) => {
      try { res.json({ cfg: ACT(), list: await inactiveList(Number(req.query.days) || ACT().inactiveDays, String(req.query.roles || '').split(',').filter(Boolean)), running: running && running.kind === 'check' ? running : null }); } catch (e) { res.status(400).json({ error: e.message }); }
    });
    api.put('/members/activity', (req, res) => { const a = ACT(); if (req.body.inactiveDays) a.inactiveDays = Math.max(1, Number(req.body.inactiveDays)); if (Array.isArray(req.body.ignoreRoleIds)) a.ignoreRoleIds = req.body.ignoreRoleIds; if (req.body.checkMessage) a.checkMessage = String(req.body.checkMessage).slice(0, 2000); cfg.save(); res.json({ ok: true }); });
    api.post('/members/activity/check', async (req, res) => {
      try { res.json(await startBroadcast({ kind: 'check', userIds: req.body.userIds || [], title: '🦉 Cek keaktifan TRO', message: ACT().checkMessage }, req.session.user.username)); } catch (e) { res.status(400).json({ error: e.message }); }
    });
    api.post('/members/activity/action', async (req, res) => {
      try {
        const g = guild(); const { userIds = [], action, roleIds = [], reason = '' } = req.body; let ok = 0;
        for (const id of userIds) {
          const m = await g.members.fetch(id).catch(() => null); if (!m) continue;
          const why = `${reason || 'Tidak aktif'} — oleh ${req.session.user.username} (dashboard)`;
          if (action === 'unrole') { await m.roles.remove(roleIds.filter((r) => m.roles.cache.has(r)), why).then(() => ok++).catch(() => {}); }
          else if (action === 'addrole') { await m.roles.add(roleIds, why).then(() => ok++).catch(() => {}); }
          else if (action === 'kick') { await m.kick(why).then(() => ok++).catch(() => {}); }
          await sleep(400);
        }
        cfg.addLog('Aksi member tidak aktif', `${action} ${ok}/${userIds.length} — oleh ${req.session.user.username}`);
        res.json({ ok });
      } catch (e) { res.status(400).json({ error: e.message }); }
    });

    api.post('/members/broadcast/preview', async (req, res) => { try { const t = await resolveTargets(req.body); res.json({ count: t.length, sample: t.slice(0, 12).map((m) => m.displayName) }); } catch (e) { res.status(400).json({ error: e.message }); } });
    api.post('/members/broadcast', async (req, res) => { try { res.json(await startBroadcast(req.body, req.session.user.username)); } catch (e) { res.status(400).json({ error: e.message }); } });
    api.get('/members/broadcast/search', (req, res) => {
      const g = guild(); const q = String(req.query.q || '').toLowerCase(); if (!g || q.length < 2) return res.json([]);
      res.json([...g.members.cache.filter((m) => !m.user.bot && (m.user.username.toLowerCase().includes(q) || (m.displayName || '').toLowerCase().includes(q))).values()].slice(0, 10).map((m) => ({ id: m.id, name: m.displayName, username: m.user.username })));
    });
    api.get('/members/broadcast', (req, res) => res.json({ jobs: BC().jobs, running }));
  }

  const commands = [new SlashCommandBuilder().setName('struktur').setDescription('Perbarui daftar struktur & member TRO').setDefaultMemberPermissions(P.ManageGuild).toJSON()];
  return { commands, routes, postStructure, inactiveList };
}

module.exports = { setup };
