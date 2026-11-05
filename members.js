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
    const members = await g.members.fetch().catch(() => g.members.cache);
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

  const checkRow = () => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tro-act:yes').setLabel('Masih aktif').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('tro-act:izin').setLabel('Lagi sibuk / izin').setEmoji('⏸️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tro-act:leave').setLabel('Mau keluar').setEmoji('👋').setStyle(ButtonStyle.Danger),
  );

  // ======================= 📨 DM MASSAL =======================
  let running = null;
  async function resolveTargets({ roleIds = [], userIds = [], exceptRoleIds = [], match = 'any' }) {
    const g = guild(); if (!g) throw new Error('Bot belum siap');
    const members = await g.members.fetch().catch(() => g.members.cache);
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
  async function structureEmbeds() {
    const g = guild(); const d = DIR();
    const members = await g.members.fetch().catch(() => g.members.cache);
    const roles = d.structureRoleIds.map((id) => g.roles.cache.get(id)).filter(Boolean);
    const shown = new Set();
    const embeds = [];
    let fields = [];
    for (const r of roles) {
      const list = members.filter((m) => !m.user.bot && m.roles.cache.has(r.id) && !shown.has(m.id)).sort((a, b) => a.displayName.localeCompare(b.displayName));
      if (!list.size) continue;
      list.forEach((m) => shown.add(m.id));
      const lines = list.map((m) => `• <@${m.id}>`);
      const chunks = [];
      let cur = '';
      for (const l of lines) { if ((cur + l + '\n').length > 1000) { chunks.push(cur); cur = ''; } cur += l + '\n'; }
      if (cur) chunks.push(cur);
      chunks.forEach((c, i) => fields.push({ name: i ? '‎' : `${r.name} — ${list.size}`, value: c }));
    }
    for (let i = 0; i < fields.length; i += 12) embeds.push(baseEmbed({ title: i ? undefined : d.title, description: i ? undefined : `Daftar resmi pengurus & anggota **${g.name}**, update otomatis tiap ada perubahan role.\nTotal: **${shown.size}** orang`, fields: fields.slice(i, i + 12) }));
    if (!embeds.length) embeds.push(baseEmbed({ title: d.title, description: 'Belum ada role yang dipilih untuk struktur.' }));
    return embeds;
  }

  let structTimer = null;
  async function postStructure() {
    const d = DIR(); if (!d.structureChannelId) return 'no-channel';
    const ch = await client.channels.fetch(d.structureChannelId).catch(() => null); if (!ch) return 'no-channel';
    const embeds = await structureEmbeds();
    const groups = []; for (let i = 0; i < embeds.length; i += 4) groups.push(embeds.slice(i, i + 4));
    const ids = [];
    for (let i = 0; i < groups.length; i++) {
      const old = d.structureMessageIds[i] && await ch.messages.fetch(d.structureMessageIds[i]).catch(() => null);
      const payload = { embeds: groups[i], allowedMentions: { parse: [] } };
      if (old) { await old.edit(payload).catch(() => {}); ids.push(old.id); } else { const m = await ch.send(payload); ids.push(m.id); }
    }
    for (const extra of d.structureMessageIds.slice(groups.length)) { const m = await ch.messages.fetch(extra).catch(() => null); if (m) await m.delete().catch(() => {}); }
    d.structureMessageIds = ids; cfg.save();
    return 'ok';
  }
  const queueStructure = () => { clearTimeout(structTimer); structTimer = setTimeout(() => postStructure().catch(() => {}), 15_000); };
  client.on(Events.GuildMemberUpdate, (o, n) => {
    if (n.guild.id !== process.env.GUILD_ID) return;
    const ids = DIR().structureRoleIds;
    if (ids.some((r) => o.roles.cache.has(r) !== n.roles.cache.has(r))) queueStructure();
  });
  client.on(Events.GuildMemberRemove, (m) => { if (m.guild.id === process.env.GUILD_ID && DIR().structureRoleIds.some((r) => m.roles.cache.has(r))) queueStructure(); });

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
    api.post('/members/directory/post', async (req, res) => { try { res.json({ result: await postStructure() }); } catch (e) { res.status(400).json({ error: e.message }); } });

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
