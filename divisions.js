// ============================================================
//  🗂️ Divisi & Tugas  +  💡 Saran Aktivitas
// ============================================================
const {
  Events, SlashCommandBuilder, MessageFlags, PermissionFlagsBits: P, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const cfg = require('./config');

const newId = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 4);
const ST = { todo: '📝 To-do', doing: '⚙️ Dikerjakan', review: '👀 Review', done: '✅ Selesai' };
const IDEAS = [
  '🎤 Karaoke night di voice — tiap member nyanyi 1 lagu', '📸 Photoshoot outfit seragam TRO di map Roblox', '🏁 Lomba balap / obby antar fams',
  '🎮 Mabar Mobile Legends 5v5 internal', '🕺 Dance battle di On The Rugs Club', '🧩 Kuis trivia TRO berhadiah Robux', '🎬 Nobar film bareng (watch party)',
  '🏰 Tour map baru TRO LABS + kasih feedback', '🎨 Lomba desain avatar tema bulanan', '🎲 Game night: Among Us / Gartic / Skribbl', '🤝 Kunjungan balik ke fams partner',
  '🎂 Pesta ulang tahun member bulan ini', '🌙 Late night talk santai di voice', '🏆 Turnamen Bedwars / Arsenal', '📻 DJ session request lagu member',
];

function setup({ client, baseEmbed }) {
  const C = () => {
    const s = cfg.get();
    if (!s.divisions) s.divisions = { items: [], reminderHours: 24 };
    if (!s.suggest) s.suggest = { channelId: '', panelMessageId: '', staffRoleIds: [], minVotesHint: 5 };
    return s;
  };
  const D = () => cfg.data('divisionData', { tasks: [], boards: {} });
  const SG = () => cfg.data('suggestData', { items: [], counter: 0 });
  const guild = () => client.guilds.cache.get(process.env.GUILD_ID);
  const isStaff = (m) => m?.permissions.has(P.ManageGuild) || C().suggest.staffRoleIds.some((r) => m?.roles.cache.has(r));

  // ======================= 🗂️ DIVISI =======================
  const div = (id) => C().divisions.items.find((d) => d.id === id);
  function boardEmbed(dv) {
    const tasks = D().tasks.filter((t) => t.divisionId === dv.id && (t.status !== 'done' || Date.now() - Date.parse(t.doneAt || 0) < 7 * 86_400_000));
    const fields = Object.entries(ST).map(([k, label]) => {
      const list = tasks.filter((t) => t.status === k);
      return { name: `${label} — ${list.length}`, value: list.length ? list.slice(0, 12).map((t) => `\`${t.id}\` **${t.title}**${t.assigneeIds?.length ? ` → ${t.assigneeIds.map((a) => `<@${a}>`).join(' ')}` : ''}${t.deadline ? ` · ⏰ <t:${Math.floor(Date.parse(t.deadline + 'T23:59:00+07:00') / 1000)}:R>` : ''}`).join('\n').slice(0, 1024) : '—' };
    });
    return baseEmbed({ title: `${dv.emoji || '🗂️'} PAPAN TUGAS — ${dv.name.toUpperCase()}`, description: `Pakai \`/tugas tambah\`, \`/tugas status\` atau dashboard. Update otomatis.${dv.roleId ? `\nDivisi: <@&${dv.roleId}>` : ''}`, fields });
  }
  async function refreshBoard(dv) {
    if (!dv?.boardChannelId) return;
    const ch = await client.channels.fetch(dv.boardChannelId).catch(() => null); if (!ch) return;
    const b = D().boards; const payload = { embeds: [boardEmbed(dv)], allowedMentions: { parse: [] } };
    const old = b[dv.id] && await ch.messages.fetch(b[dv.id]).catch(() => null);
    if (old) await old.edit(payload).catch(() => {}); else { const m = await ch.send(payload).catch(() => null); if (m) { b[dv.id] = m.id; cfg.save(); } }
  }
  function upsertTask(body, by) {
    const d = D(); const dv = div(body.divisionId); if (!dv) throw new Error('Divisi tidak ditemukan');
    let t = body.id && d.tasks.find((x) => x.id === body.id);
    const isNew = !t;
    if (!t) { t = { id: newId(), createdBy: by, createdAt: new Date().toISOString(), status: 'todo' }; d.tasks.push(t); }
    for (const k of ['title', 'desc', 'deadline']) if (body[k] !== undefined) t[k] = String(body[k]).slice(0, k === 'desc' ? 800 : 120);
    if (!t.title) throw new Error('Judul tugas wajib');
    if (Array.isArray(body.assigneeIds)) t.assigneeIds = body.assigneeIds.filter((x) => /^\d{15,}$/.test(x));
    t.divisionId = dv.id;
    if (body.status && ST[body.status] && body.status !== t.status) { t.status = body.status; if (t.status === 'done') { t.doneAt = new Date().toISOString(); t.doneBy = by; } }
    cfg.save(); refreshBoard(dv).catch(() => {});
    if (isNew && dv.chatChannelId) client.channels.fetch(dv.chatChannelId).then((ch) => ch.send({ embeds: [baseEmbed({ title: `🆕 Tugas baru: ${t.title}`, description: `${t.desc || ''}\n\n**Untuk:** ${t.assigneeIds?.length ? t.assigneeIds.map((a) => `<@${a}>`).join(' ') : 'semua anggota divisi'}${t.deadline ? `\n**Deadline:** ${t.deadline}` : ''}\n**Dari:** ${by}`.trim() })], allowedMentions: { users: t.assigneeIds || [] } })).catch(() => {});
    return t;
  }
  // pengingat deadline (H-1) via DM
  setInterval(() => {
    const now = Date.now(), H = (C().divisions.reminderHours || 24) * 3_600_000;
    for (const t of D().tasks) {
      if (t.status === 'done' || !t.deadline || t.reminded) continue;
      const due = Date.parse(t.deadline + 'T23:59:00+07:00');
      if (due - now < H && due > now) {
        t.reminded = true;
        for (const a of t.assigneeIds || []) client.users.fetch(a).then((u) => u.send({ embeds: [baseEmbed({ title: '⏰ Pengingat tugas', description: `**${t.title}** (${div(t.divisionId)?.name || ''}) deadline <t:${Math.floor(due / 1000)}:R>.` })] })).catch(() => {});
        cfg.saveSoon();
      }
    }
  }, 15 * 60_000);

  // ======================= 💡 SARAN AKTIVITAS =======================
  const sgRow = (s) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tro-sg:up:${s.id}`).setLabel(String(s.up.length)).setEmoji('👍').setStyle(ButtonStyle.Success).setDisabled(s.status !== 'open'),
    new ButtonBuilder().setCustomId(`tro-sg:down:${s.id}`).setLabel(String(s.down.length)).setEmoji('👎').setStyle(ButtonStyle.Secondary).setDisabled(s.status !== 'open'),
    new ButtonBuilder().setCustomId(`tro-sg:ok:${s.id}`).setLabel('Terima').setEmoji('✅').setStyle(ButtonStyle.Primary).setDisabled(s.status !== 'open'),
    new ButtonBuilder().setCustomId(`tro-sg:no:${s.id}`).setLabel('Tolak').setEmoji('✖️').setStyle(ButtonStyle.Danger).setDisabled(s.status !== 'open'),
  );
  const sgEmbed = (s) => baseEmbed({
    title: `💡 Saran #${s.no} — ${s.status === 'open' ? 'Voting' : s.status === 'accepted' ? '✅ Diterima' : '✖️ Ditolak'}`,
    description: `**${s.title}**\n${s.detail || ''}\n\nDari <@${s.userId}>${s.reviewedBy ? `\nDiputuskan oleh **${s.reviewedBy}**` : ''}`,
    color: s.status === 'accepted' ? '#30a46c' : s.status === 'rejected' ? '#7f8c8d' : undefined,
  });
  const panelPayload = () => ({ embeds: [baseEmbed({ title: '💡 SARAN AKTIVITAS TRO', description: 'Punya ide kegiatan seru buat TRO Fams? Klik **Kasih saran**, terus member lain bisa vote 👍👎.\nSaran dengan vote terbanyak bakal dipertimbangkan staff jadi event!\n\nBingung mau ngapain? Klik **Ide random** 🎲' })], components: [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tro-sg:new').setLabel('Kasih saran').setEmoji('💡').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('tro-sg:idea').setLabel('Ide random').setEmoji('🎲').setStyle(ButtonStyle.Secondary))] });
  async function sendSgPanel() {
    const s = C().suggest; if (!s.channelId) throw new Error('Pilih channel saran dulu');
    const ch = await client.channels.fetch(s.channelId);
    const old = s.panelMessageId && await ch.messages.fetch(s.panelMessageId).catch(() => null);
    if (old) { await old.edit(panelPayload()); return 'updated'; }
    const m = await ch.send(panelPayload()); s.panelMessageId = m.id; cfg.save(); return 'posted';
  }
  async function createSuggestion(userId, title, detail) {
    const s = C().suggest; if (!s.channelId) throw new Error('Fitur saran belum diatur');
    const d = SG(); d.counter += 1;
    const item = { id: newId(), no: d.counter, userId, title: title.slice(0, 120), detail: (detail || '').slice(0, 800), up: [], down: [], status: 'open', createdAt: new Date().toISOString() };
    const ch = await client.channels.fetch(s.channelId);
    const m = await ch.send({ embeds: [sgEmbed(item)], components: [sgRow(item)], allowedMentions: { parse: [] } });
    item.messageId = m.id; d.items.unshift(item); d.items = d.items.slice(0, 300); cfg.save();
    client.notifyStaff?.('suggest', { title: `Saran #${item.no}: ${item.title}`, description: `Dari <@${userId}>${item.detail ? `\n\n${item.detail}` : ''}\n\nStaff bisa **Terima / Tolak** di channel saran.`, url: `https://discord.com/channels/${ch.guildId}/${ch.id}/${m.id}` });
    // panel dipindah ke bawah biar tetap kelihatan
    const old = s.panelMessageId && await ch.messages.fetch(s.panelMessageId).catch(() => null);
    if (old) { await old.delete().catch(() => {}); s.panelMessageId = ''; }
    await sendSgPanel().catch(() => {});
    return item;
  }

  client.on(Events.InteractionCreate, async (it) => {
    try {
      if (it.isButton() && it.customId === 'tro-sg:new') {
        return it.showModal(new ModalBuilder().setCustomId('tro-sg:modal').setTitle('💡 Saran aktivitas').addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t').setLabel('Ide kegiatannya apa?').setStyle(TextInputStyle.Short).setMaxLength(120).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('d').setLabel('Detail (kapan, di mana, gimana)').setStyle(TextInputStyle.Paragraph).setMaxLength(800).setRequired(false))));
      }
      if (it.isButton() && it.customId === 'tro-sg:idea') return it.reply({ content: `🎲 **Ide aktivitas:** ${IDEAS[Math.floor(Math.random() * IDEAS.length)]}\nSuka? Klik **Kasih saran** biar bisa di-vote!`, flags: MessageFlags.Ephemeral });
      if (it.isModalSubmit() && it.customId === 'tro-sg:modal') {
        await it.deferReply({ flags: MessageFlags.Ephemeral });
        await createSuggestion(it.user.id, it.fields.getTextInputValue('t'), it.fields.getTextInputValue('d'));
        return it.editReply('✅ Saran kamu sudah diposting, ajak teman buat vote!');
      }
      if (it.isButton() && it.customId.startsWith('tro-sg:')) {
        const [, act, id] = it.customId.split(':'); const s = SG().items.find((x) => x.id === id);
        if (!s) return it.reply({ content: 'Saran tidak ditemukan.', flags: MessageFlags.Ephemeral });
        if (act === 'up' || act === 'down') {
          const other = act === 'up' ? 'down' : 'up';
          s[other] = s[other].filter((u) => u !== it.user.id);
          s[act] = s[act].includes(it.user.id) ? s[act].filter((u) => u !== it.user.id) : [...s[act], it.user.id];
          cfg.saveSoon(); return it.update({ embeds: [sgEmbed(s)], components: [sgRow(s)] });
        }
        if (!isStaff(it.member)) return it.reply({ content: '⛔ Hanya staff yang bisa memutuskan saran.', flags: MessageFlags.Ephemeral });
        s.status = act === 'ok' ? 'accepted' : 'rejected'; s.reviewedBy = it.user.username; cfg.save();
        await it.update({ embeds: [sgEmbed(s)], components: [sgRow(s)] });
        client.users.fetch(s.userId).then((u) => u.send({ embeds: [baseEmbed({ title: s.status === 'accepted' ? '🎉 Saran kamu diterima!' : 'Saran kamu belum bisa dijalankan', description: `**${s.title}**\nMakasih udah ikut bikin TRO makin seru 🦉` })] })).catch(() => {});
        return;
      }
      if (!it.isChatInputCommand()) return;
      if (it.commandName === 'saran') {
        await it.deferReply({ flags: MessageFlags.Ephemeral });
        await createSuggestion(it.user.id, it.options.getString('ide'), it.options.getString('detail') || '');
        return it.editReply('✅ Saran kamu sudah diposting!');
      }
      if (it.commandName === 'ide') return it.reply({ content: `🎲 **Ide aktivitas:** ${IDEAS[Math.floor(Math.random() * IDEAS.length)]}` });
      if (it.commandName === 'tugas') {
        const sub = it.options.getSubcommand();
        if (sub === 'tambah') {
          const dvName = it.options.getString('divisi'); const dv = C().divisions.items.find((d) => d.id === dvName || d.name.toLowerCase() === dvName.toLowerCase());
          if (!dv) return it.reply({ content: `❌ Divisi tidak ada. Pilihan: ${C().divisions.items.map((d) => d.name).join(', ')}`, flags: MessageFlags.Ephemeral });
          const who = it.options.getUser('untuk');
          const t = upsertTask({ divisionId: dv.id, title: it.options.getString('judul'), desc: it.options.getString('detail') || '', deadline: it.options.getString('deadline') || '', assigneeIds: who ? [who.id] : [] }, it.user.username);
          return it.reply({ content: `✅ Tugas \`${t.id}\` ditambahkan ke **${dv.name}**.`, flags: MessageFlags.Ephemeral });
        }
        if (sub === 'status') {
          const t = D().tasks.find((x) => x.id === it.options.getString('id'));
          if (!t) return it.reply({ content: '❌ ID tugas tidak ditemukan', flags: MessageFlags.Ephemeral });
          upsertTask({ id: t.id, divisionId: t.divisionId, status: it.options.getString('status') }, it.user.username);
          return it.reply({ content: `✅ \`${t.id}\` → ${ST[t.status]}`, flags: MessageFlags.Ephemeral });
        }
        if (sub === 'saya') {
          const mine = D().tasks.filter((t) => t.status !== 'done' && (t.assigneeIds || []).includes(it.user.id));
          return it.reply({ embeds: [baseEmbed({ title: '📋 Tugas kamu', description: mine.length ? mine.map((t) => `\`${t.id}\` ${ST[t.status]} **${t.title}** · ${div(t.divisionId)?.name || ''}${t.deadline ? ` · ⏰ ${t.deadline}` : ''}`).join('\n') : 'Tidak ada tugas aktif 🎉' })], flags: MessageFlags.Ephemeral });
        }
      }
    } catch (e) { const r = { content: '⚠️ ' + e.message, flags: MessageFlags.Ephemeral }; (it.deferred || it.replied ? it.editReply(r) : it.reply(r)).catch(() => {}); }
  });

  client.once('ready', () => setTimeout(() => C().divisions.items.forEach((dv) => refreshBoard(dv).catch(() => {})), 25_000));

  function routes(api) {
    api.get('/divisions', (req, res) => res.json({ ...C().divisions, tasks: D().tasks, statuses: ST }));
    api.put('/divisions', (req, res) => {
      const items = (req.body.items || []).map((d) => ({ id: d.id || newId(), name: String(d.name || 'Divisi').slice(0, 40), emoji: String(d.emoji || '🗂️').slice(0, 8), roleId: String(d.roleId || ''), boardChannelId: String(d.boardChannelId || ''), chatChannelId: String(d.chatChannelId || '') }));
      C().divisions.items = items; cfg.save(); items.forEach((dv) => refreshBoard(dv).catch(() => {})); res.json({ ok: true, items });
    });
    api.post('/divisions/tasks', (req, res) => { try { res.json(upsertTask(req.body, req.session.user.username)); } catch (e) { res.status(400).json({ error: e.message }); } });
    api.delete('/divisions/tasks/:id', (req, res) => { const d = D(); const t = d.tasks.find((x) => x.id === req.params.id); d.tasks = d.tasks.filter((x) => x.id !== req.params.id); cfg.save(); if (t) refreshBoard(div(t.divisionId)).catch(() => {}); res.json({ ok: true }); });
    api.get('/suggest', (req, res) => res.json({ cfg: C().suggest, items: SG().items }));
    api.put('/suggest', (req, res) => { const s = C().suggest; if (req.body.channelId !== undefined && req.body.channelId !== s.channelId) { s.channelId = String(req.body.channelId); s.panelMessageId = ''; } if (Array.isArray(req.body.staffRoleIds)) s.staffRoleIds = req.body.staffRoleIds; cfg.save(); res.json({ ok: true }); });
    api.post('/suggest/panel', async (req, res) => { try { res.json({ result: await sendSgPanel() }); } catch (e) { res.status(400).json({ error: e.message }); } });
  }

  const commands = [
    new SlashCommandBuilder().setName('saran').setDescription('Kasih saran aktivitas buat TRO')
      .addStringOption((o) => o.setName('ide').setDescription('Ide kegiatan').setRequired(true).setMaxLength(120))
      .addStringOption((o) => o.setName('detail').setDescription('Detail').setMaxLength(800)).toJSON(),
    new SlashCommandBuilder().setName('ide').setDescription('Minta ide aktivitas random 🎲').toJSON(),
    new SlashCommandBuilder().setName('tugas').setDescription('Tugas divisi TRO')
      .addSubcommand((s) => s.setName('tambah').setDescription('Tambah tugas divisi')
        .addStringOption((o) => o.setName('divisi').setDescription('Nama divisi').setRequired(true))
        .addStringOption((o) => o.setName('judul').setDescription('Judul tugas').setRequired(true))
        .addUserOption((o) => o.setName('untuk').setDescription('Ditugaskan ke'))
        .addStringOption((o) => o.setName('deadline').setDescription('YYYY-MM-DD'))
        .addStringOption((o) => o.setName('detail').setDescription('Detail tugas')))
      .addSubcommand((s) => s.setName('status').setDescription('Ubah status tugas')
        .addStringOption((o) => o.setName('id').setDescription('ID tugas').setRequired(true))
        .addStringOption((o) => o.setName('status').setDescription('Status').setRequired(true).addChoices(...Object.entries(ST).map(([v, n]) => ({ name: n, value: v })))))
      .addSubcommand((s) => s.setName('saya').setDescription('Lihat tugas saya')).toJSON(),
  ];
  return { commands, routes };
}

module.exports = { setup };
