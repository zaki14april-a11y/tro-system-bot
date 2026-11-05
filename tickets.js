// ============================================================
//  🎫 TRO SYSTEM — Ticket system
// ============================================================
const {
  Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits: P,
  SlashCommandBuilder, MessageFlags, AttachmentBuilder,
} = require('discord.js');
const cfg = require('./config');

function setup({ client, baseEmbed }) {
  const D = () => cfg.data('ticketsData', { counter: 0, open: {}, history: [] });
  const T = () => cfg.get().tickets;
  const guild = () => client.guilds.cache.get(process.env.GUILD_ID);
  const isStaff = (m) => m?.permissions.has(P.ManageChannels) || T().staffRoleIds.some((r) => m?.roles.cache.has(r));
  const fill = (t, u) => String(t || '').replaceAll('{user}', `<@${u.id}>`).replaceAll('{username}', u.username);

  function panelRows() {
    const types = T().types.filter((t) => t.label).slice(0, 25);
    const rows = [];
    for (let i = 0; i < types.length; i += 5) {
      rows.push(new ActionRowBuilder().addComponents(types.slice(i, i + 5).map((t) => {
        const b = new ButtonBuilder().setCustomId(`tro-tk:open:${t.id}`).setLabel(t.label.slice(0, 80)).setStyle(ButtonStyle.Secondary);
        if (t.emoji) b.setEmoji(t.emoji);
        return b;
      })));
    }
    return rows;
  }

  async function sendPanel() {
    const t = T();
    if (!t.panelChannelId) throw new Error('Pilih channel panel tiket dulu');
    const ch = await client.channels.fetch(t.panelChannelId);
    const payload = { embeds: [baseEmbed({ title: t.panelTitle, description: t.panelText })], components: panelRows() };
    const old = t.panelMessageId && await ch.messages.fetch(t.panelMessageId).catch(() => null);
    if (old) { await old.edit(payload); return 'updated'; }
    const msg = await ch.send(payload);
    t.panelMessageId = msg.id; cfg.save();
    return 'posted';
  }

  const controls = (claimed) => [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tro-tk:claim').setLabel(claimed ? `Diklaim ${claimed}` : 'Klaim').setEmoji('🙋').setStyle(ButtonStyle.Primary).setDisabled(!!claimed),
    new ButtonBuilder().setCustomId('tro-tk:close').setLabel('Tutup tiket').setEmoji('🔒').setStyle(ButtonStyle.Danger),
  )];

  client.openTicket = (it, typeId) => openTicket(it, typeId);
  async function openTicket(it, typeId) {
    const t = T(), d = D();
    if (!t.enabled) return it.reply({ content: '⛔ Tiket sedang ditutup.', flags: MessageFlags.Ephemeral });
    const existing = Object.entries(d.open).find(([, v]) => v.userId === it.user.id);
    if (existing && guild().channels.cache.has(existing[0])) return it.reply({ content: `📌 Kamu masih punya tiket aktif: <#${existing[0]}>`, flags: MessageFlags.Ephemeral });
    if (existing) delete d.open[existing[0]];
    await it.deferReply({ flags: MessageFlags.Ephemeral });
    const type = t.types.find((x) => x.id === typeId) || { id: typeId, label: typeId, emoji: '🎫' };
    d.counter += 1;
    const num = String(d.counter).padStart(4, '0');
    const g = guild();
    const parent = t.categoryId || (await client.channels.fetch(t.panelChannelId).catch(() => null))?.parentId || null;
    const ch = await g.channels.create({
      name: `🎫-${type.id}-${num}`,
      type: ChannelType.GuildText,
      parent,
      topic: `Tiket ${type.label} • ${it.user.username} (${it.user.id})`,
      permissionOverwrites: [
        { id: g.id, deny: [P.ViewChannel] },
        { id: it.user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks] },
        { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.ManageChannels, P.EmbedLinks, P.AttachFiles] },
        ...t.staffRoleIds.map((r) => ({ id: r, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.ManageMessages] })),
      ],
      reason: `TRO SYSTEM tiket ${type.label}`,
    });
    d.open[ch.id] = { userId: it.user.id, username: it.user.username, type: type.id, typeLabel: `${type.emoji || ''} ${type.label}`.trim(), number: num, createdAt: new Date().toISOString() };
    cfg.save();
    await ch.send({
      content: `<@${it.user.id}> ${t.staffRoleIds.map((r) => `<@&${r}>`).join(' ')}`,
      embeds: [baseEmbed({ title: `${type.emoji || '🎫'} Tiket #${num} — ${type.label}`, description: fill(t.welcome, it.user) + (client.isOrderType?.(type.id) ? '\n\n🛒 **Mau order?** Klik **Isi form order** di bawah biar pesanan langsung tercatat & total harga keluar otomatis.' : ''), thumbnail: it.user.displayAvatarURL({ size: 128 }) })],
      components: [...controls(), ...(client.isOrderType?.(type.id) ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`tro-shop:form:${type.id}`).setLabel('Isi form order').setEmoji('📝').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('tro-shop:prices').setLabel('Lihat harga').setEmoji('💰').setStyle(ButtonStyle.Secondary))] : [])],
      allowedMentions: { users: [it.user.id], roles: t.staffRoleIds },
    });
    cfg.addLog('Tiket dibuka', `#${num} ${type.label} oleh ${it.user.username}`);
    client.notifyStaff?.('ticket', { title: `Tiket #${num} — ${type.label}`, description: `<@${it.user.id}> (${it.user.username}) buka tiket **${type.emoji || ''} ${type.label}** di <#${ch.id}>. Perlu dibalas staff.`, url: `https://discord.com/channels/${g.id}/${ch.id}` });
    return it.editReply(`✅ Tiket kamu sudah dibuat: <#${ch.id}>`);
  }

  async function transcript(ch) {
    let all = [], before;
    for (let i = 0; i < 5; i++) {
      const batch = await ch.messages.fetch({ limit: 100, before }).catch(() => null);
      if (!batch?.size) break;
      all = all.concat([...batch.values()]);
      before = batch.last().id;
    }
    return all.reverse().map((m) => `[${new Date(m.createdTimestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}] ${m.author.username}: ${m.content}${m.embeds.length ? ` [embed: ${m.embeds[0].title || ''}]` : ''}${m.attachments.size ? ` [file: ${[...m.attachments.values()].map((a) => a.url).join(' ')}]` : ''}`).join('\n');
  }

  async function closeTicket(channelId, by) {
    const d = D(), info = d.open[channelId];
    if (!info) throw new Error('Ini bukan channel tiket');
    const ch = await client.channels.fetch(channelId);
    const text = await transcript(ch);
    const file = new AttachmentBuilder(Buffer.from(text || '(kosong)', 'utf8'), { name: `tiket-${info.number}.txt` });
    const summary = baseEmbed({
      title: `🔒 Tiket #${info.number} ditutup`,
      description: `**Jenis:** ${info.typeLabel}\n**Pembuat:** <@${info.userId}>\n**Ditutup oleh:** ${by}${info.claimedBy ? `\n**Diklaim:** ${info.claimedBy}` : ''}\n**Dibuka:** <t:${Math.floor(Date.parse(info.createdAt) / 1000)}:R>`,
      thumbnail: null,
    });
    const log = T().logChannelId && await client.channels.fetch(T().logChannelId).catch(() => null);
    if (log) await log.send({ embeds: [summary], files: [file] }).catch(() => {});
    const user = await client.users.fetch(info.userId).catch(() => null);
    if (user) user.send({ embeds: [summary], files: [new AttachmentBuilder(Buffer.from(text || '(kosong)', 'utf8'), { name: `tiket-${info.number}.txt` })] }).catch(() => {});
    d.history.unshift({ ...info, channelId, closedBy: by, closedAt: new Date().toISOString() });
    d.history = d.history.slice(0, 500);
    delete d.open[channelId];
    cfg.save();
    cfg.addLog('Tiket ditutup', `#${info.number} oleh ${by}`);
    await ch.send('🔒 Tiket ditutup. Channel akan dihapus dalam 5 detik...').catch(() => {});
    setTimeout(() => ch.delete('TRO SYSTEM: tiket ditutup').catch(() => {}), 5000);
  }

  client.on(Events.InteractionCreate, async (it) => {
    try {
      if (it.isButton() && it.customId.startsWith('tro-tk:open:')) return openTicket(it, it.customId.split(':')[2]);
      if (it.isButton() && it.customId === 'tro-tk:claim') {
        if (!isStaff(it.member)) return it.reply({ content: '⛔ Hanya staff yang bisa klaim.', flags: MessageFlags.Ephemeral });
        const info = D().open[it.channelId];
        if (!info) return it.reply({ content: 'Bukan channel tiket.', flags: MessageFlags.Ephemeral });
        info.claimedBy = it.user.username; cfg.save();
        await it.update({ components: controls(it.user.username) });
        return it.channel.send(`🙋 Tiket ini ditangani oleh <@${it.user.id}>.`);
      }
      if (it.isButton() && it.customId === 'tro-tk:close') {
        const info = D().open[it.channelId];
        if (!info) return it.reply({ content: 'Bukan channel tiket.', flags: MessageFlags.Ephemeral });
        if (!isStaff(it.member) && info.userId !== it.user.id) return it.reply({ content: '⛔ Tidak bisa menutup tiket ini.', flags: MessageFlags.Ephemeral });
        await it.reply({ content: '🔒 Menutup tiket & menyimpan transcript...' });
        return closeTicket(it.channelId, it.user.username);
      }
      if (it.isChatInputCommand() && it.commandName === 'tiket') {
        const sub = it.options.getSubcommand();
        const info = D().open[it.channelId];
        if (sub === 'panel') {
          if (!it.memberPermissions.has(P.ManageGuild)) return it.reply({ content: '⛔ Khusus admin.', flags: MessageFlags.Ephemeral });
          const r = await sendPanel();
          return it.reply({ content: r === 'updated' ? '🔄 Panel tiket diupdate.' : '✅ Panel tiket dikirim.', flags: MessageFlags.Ephemeral });
        }
        if (!info) return it.reply({ content: 'Command ini hanya di channel tiket.', flags: MessageFlags.Ephemeral });
        if (!isStaff(it.member)) return it.reply({ content: '⛔ Khusus staff.', flags: MessageFlags.Ephemeral });
        if (sub === 'tambah' || sub === 'keluarkan') {
          const u = it.options.getUser('user');
          await it.channel.permissionOverwrites[sub === 'tambah' ? 'edit' : 'delete'](u.id, ...(sub === 'tambah' ? [{ ViewChannel: true, SendMessages: true, ReadMessageHistory: true }] : []));
          return it.reply(sub === 'tambah' ? `➕ <@${u.id}> ditambahkan ke tiket.` : `➖ <@${u.id}> dikeluarkan dari tiket.`);
        }
        if (sub === 'tutup') { await it.reply('🔒 Menutup tiket...'); return closeTicket(it.channelId, it.user.username); }
      }
    } catch (err) {
      const msg = { content: `❌ ${err.message}`, flags: MessageFlags.Ephemeral };
      if (it.deferred || it.replied) it.editReply(msg).catch(() => {}); else if (it.isRepliable()) it.reply(msg).catch(() => {});
    }
  });

  // channel tiket dihapus manual → bersihkan data
  client.on(Events.ChannelDelete, (ch) => { const d = D(); if (d.open[ch.id]) { delete d.open[ch.id]; cfg.save(); } });

  const command = new SlashCommandBuilder().setName('tiket').setDescription('Kelola tiket')
    .addSubcommand((s) => s.setName('panel').setDescription('Kirim / update panel tiket'))
    .addSubcommand((s) => s.setName('tambah').setDescription('Tambah orang ke tiket ini').addUserOption((o) => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand((s) => s.setName('keluarkan').setDescription('Keluarkan orang dari tiket ini').addUserOption((o) => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand((s) => s.setName('tutup').setDescription('Tutup tiket ini'));

  function routes(api) {
    api.post('/tickets/panel', async (req, res) => { try { res.json({ result: await sendPanel() }); } catch (e) { res.status(400).json({ error: e.message }); } });
    api.get('/tickets', (req, res) => { const d = D(); res.json({ open: Object.entries(d.open).map(([channelId, v]) => ({ channelId, ...v })), history: d.history.slice(0, 100), counter: d.counter }); });
    api.post('/tickets/:id/close', async (req, res) => { try { await closeTicket(req.params.id, req.session.user.username); res.json({ ok: true }); } catch (e) { res.status(400).json({ error: e.message }); } });
  }

  return { commands: [command.toJSON()], routes, sendPanel };
}

module.exports = { setup };
