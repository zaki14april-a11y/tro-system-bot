// ============================================================
//  💎 Nitro Booster — role spesial, ucapan terima kasih, perks
// ============================================================
const {
  Events, SlashCommandBuilder, MessageFlags, PermissionFlagsBits: P, ChannelType, MessageType,
} = require('discord.js');
const cfg = require('./config');

const DEFAULT_PERKS = [
  '💎 Role **TRO Booster** — nama kamu tampil terpisah di daftar member',
  '🎨 Role pribadi: pilih **warna & nama** sendiri lewat `/booster warna` dan `/booster nama`',
  '⚡ **Bonus XP +50%** setiap chat & voice',
  '🔒 Akses channel khusus **booster-lounge**',
  '🎁 Prioritas ikut giveaway & event spesial TRO',
  '🦉 Nama kamu tercatat di **Hall of Boosters** TRO',
];

function setup({ client, baseEmbed }) {
  const C = () => {
    const s = cfg.get();
    if (!s.boost) s.boost = {};
    const b = s.boost;
    b.enabled ??= true; b.roleId ??= ''; b.loungeChannelId ??= ''; b.thanksChannelId ??= ''; b.dm ??= true; b.xpBonus ??= 50;
    b.perks ??= DEFAULT_PERKS.slice(); b.panelChannelId ??= ''; b.panelMessageId ??= '';
    b.thanksMessage ??= 'Makasih banyak {user} udah nge-boost **{server}**! 💎 Berkat kamu server makin keren. Semua perks booster udah aktif buat kamu 🦉';
    return b;
  };
  const D = () => cfg.data('boostData', { custom: {}, history: [], last: {} });
  const guild = () => client.guilds.cache.get(process.env.GUILD_ID);
  const fill = (t, m, g) => String(t || '').replaceAll('{user}', `<@${m.id}>`).replaceAll('{username}', m.user.username).replaceAll('{server}', g.name).replaceAll('{boosts}', g.premiumSubscriptionCount || 0).replaceAll('{tier}', g.premiumTier || 0);

  // XP bonus untuk booster (dipakai modul level)
  client.xpMultiplier = (member) => {
    const b = C();
    return b.enabled && member?.premiumSinceTimestamp ? 1 + (Number(b.xpBonus) || 0) / 100 : 1;
  };

  const perksText = () => C().perks.filter(Boolean).map((p) => `• ${p}`).join('\n');

  async function thank(member, again = false) {
    const b = C(), g = member.guild, d = D();
    if (!b.enabled) return;
    if (Date.now() - (d.last[member.id] || 0) < 60_000) return; // jangan dobel (event + pesan sistem)
    d.last[member.id] = Date.now();
    if (b.roleId) await member.roles.add(b.roleId, 'TRO SYSTEM: Nitro booster').catch(() => {});
    d.history.unshift({ userId: member.id, username: member.user.username, at: new Date().toISOString(), again });
    d.history = d.history.slice(0, 200); cfg.save();
    const ch = b.thanksChannelId && await client.channels.fetch(b.thanksChannelId).catch(() => null);
    const e = baseEmbed({
      title: again ? '💎 Boost lagi! Terima kasih!' : '💎 Booster baru di TRO!',
      description: `${fill(b.thanksMessage, member, g)}\n\n**Server sekarang punya ${g.premiumSubscriptionCount || 0} boost · Level ${g.premiumTier || 0}**`,
      thumbnail: member.user.displayAvatarURL({ size: 256 }), color: '#f47fff',
    });
    if (ch) ch.send({ content: `<@${member.id}>`, embeds: [e], allowedMentions: { users: [member.id] } }).catch(() => {});
    if (b.dm) member.send({ embeds: [baseEmbed({
      title: `💎 Makasih udah boost ${g.name}!`,
      description: `Kamu keren banget 🦉 Ini perks yang udah aktif buat kamu:\n\n${perksText()}\n\n**Cara pakai role pribadi:**\n\`/booster warna #ff66cc\` — ganti warna\n\`/booster nama Nama Keren\` — ganti nama role\n\`/booster info\` — lihat perks kapan aja${b.loungeChannelId ? `\n\nNongkrong bareng booster lain di <#${b.loungeChannelId}> ✨` : ''}`,
      color: '#f47fff',
    })] }).catch(() => {});
    client.notifyStaff?.('important', { title: `Booster ${again ? 'boost lagi' : 'baru'}: ${member.user.username}`, description: `<@${member.id}> nge-boost server. Total sekarang **${g.premiumSubscriptionCount || 0} boost** (level ${g.premiumTier || 0}).`, color: '#f47fff' });
    cfg.addLog('Nitro boost', `${member.user.username}${again ? ' (boost lagi)' : ''} — total ${g.premiumSubscriptionCount || 0}`);
    refreshPanel().catch(() => {});
  }

  async function unboost(member) {
    const b = C(), d = D();
    if (b.roleId) await member.roles.remove(b.roleId, 'TRO SYSTEM: boost berakhir').catch(() => {});
    const rid = d.custom[member.id];
    if (rid) { await member.guild.roles.cache.get(rid)?.delete('TRO SYSTEM: boost berakhir').catch(() => {}); delete d.custom[member.id]; }
    cfg.save();
    if (b.dm) member.send({ embeds: [baseEmbed({ title: '💜 Boost kamu sudah berakhir', description: `Makasih banyak udah pernah nge-boost **${member.guild.name}**. Perks booster dinonaktifkan dulu ya — kapan pun boost lagi, semuanya langsung balik otomatis 🦉`, color: '#a78bfa' })] }).catch(() => {});
    cfg.addLog('Boost berakhir', member.user.username);
    refreshPanel().catch(() => {});
  }

  client.on(Events.GuildMemberUpdate, (o, n) => {
    if (n.guild.id !== process.env.GUILD_ID) return;
    if (!o.premiumSinceTimestamp && n.premiumSinceTimestamp) thank(n).catch(() => {});
    else if (o.premiumSinceTimestamp && !n.premiumSinceTimestamp) unboost(n).catch(() => {});
  });
  const BOOST_TYPES = [MessageType.GuildBoost, MessageType.GuildBoostTier1, MessageType.GuildBoostTier2, MessageType.GuildBoostTier3];
  client.on(Events.MessageCreate, (m) => {
    if (m.guild?.id !== process.env.GUILD_ID || !BOOST_TYPES.includes(m.type) || !m.member) return;
    thank(m.member, !!D().history.find((h) => h.userId === m.author.id)).catch(() => {});
  });

  // sinkron: role booster untuk yang sudah boost sebelum fitur ini ada
  async function sweep() {
    const b = C(), g = guild(); if (!g || !b.roleId || !b.enabled) return;
    const members = await client.fetchMembers(g);
    for (const m of members.values()) {
      const has = m.roles.cache.has(b.roleId);
      if (m.premiumSinceTimestamp && !has) await m.roles.add(b.roleId, 'TRO SYSTEM: booster').catch(() => {});
      if (!m.premiumSinceTimestamp && has) await m.roles.remove(b.roleId, 'TRO SYSTEM: bukan booster').catch(() => {});
    }
  }

  // panel penjelasan untuk semua member
  function panelPayload() {
    const g = guild(), b = C();
    const boosters = [...(g?.members.cache.filter((m) => m.premiumSinceTimestamp).values() || [])].sort((a, c) => a.premiumSinceTimestamp - c.premiumSinceTimestamp);
    return { embeds: [baseEmbed({
      title: '💎 NITRO BOOSTER — THE RESILIENT ORDER',
      description: `Boost server bikin TRO makin keren: kualitas voice lebih jernih, upload lebih besar, emoji & stiker lebih banyak, dan banner server.\n\n**Apa yang kamu dapat kalau boost:**\n${perksText()}\n\n**Cara boost:** klik nama server di kiri atas → **Server Boost** → pilih jumlah boost. Perks aktif otomatis dalam hitungan detik.`,
      fields: [
        { name: '🚀 Status server', value: `**${g?.premiumSubscriptionCount || 0} boost** · Level ${g?.premiumTier || 0}`, inline: true },
        { name: `🏆 Hall of Boosters (${boosters.length})`, value: boosters.length ? boosters.slice(0, 30).map((m) => `<@${m.id}> · sejak <t:${Math.floor(m.premiumSinceTimestamp / 1000)}:D>`).join('\n') : 'Jadilah booster pertama TRO! 💎', inline: false },
      ],
      color: '#f47fff',
    })], allowedMentions: { parse: [] } };
  }
  async function refreshPanel() {
    const b = C(); if (!b.panelChannelId) return 'nochannel';
    const ch = await client.channels.fetch(b.panelChannelId).catch(() => null); if (!ch) return 'nochannel';
    const old = b.panelMessageId && await ch.messages.fetch(b.panelMessageId).catch(() => null);
    if (old) { await old.edit(panelPayload()); return 'updated'; }
    const m = await ch.send(panelPayload()); b.panelMessageId = m.id; cfg.save(); return 'posted';
  }

  async function autoSetup() {
    const b = C(), g = guild(); if (!g) throw new Error('Bot belum siap');
    const done = [];
    if (!b.roleId || !g.roles.cache.has(b.roleId)) {
      const r = await g.roles.create({ name: '💎 TRO Booster', color: 0xf47fff, hoist: true, mentionable: false, reason: 'TRO SYSTEM: role Nitro booster' });
      const sb = g.roles.premiumSubscriberRole; if (sb) await r.setPosition(Math.max(1, sb.position)).catch(() => {});
      b.roleId = r.id; done.push('role 💎 TRO Booster dibuat');
    }
    if (!b.loungeChannelId || !g.channels.cache.has(b.loungeChannelId)) {
      const staff = g.roles.cache.filter((r) => !r.managed && r.permissions.has(P.Administrator)).map((r) => r.id);
      const parent = g.channels.cache.find((c) => c.type === ChannelType.GuildCategory && /komunitas|community|yapping|general|lounge/i.test(c.name));
      const ow = [{ id: g.id, deny: [P.ViewChannel] }, { id: b.roleId, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks] }, { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks] }];
      if (g.roles.premiumSubscriberRole) ow.push({ id: g.roles.premiumSubscriberRole.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] });
      staff.forEach((id) => ow.push({ id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] }));
      const ch = await g.channels.create({ name: '「💎」booster-lounge', type: ChannelType.GuildText, parent: parent?.id, topic: '💎 Khusus Nitro Booster TRO — makasih udah support server!', permissionOverwrites: ow, reason: 'TRO SYSTEM: lounge booster' });
      b.loungeChannelId = ch.id; done.push('channel 「💎」booster-lounge dibuat (khusus booster)');
    }
    if (!b.thanksChannelId) { b.thanksChannelId = cfg.get().welcome?.channelId || g.systemChannelId || ''; if (b.thanksChannelId) done.push('ucapan terima kasih dikirim ke channel welcome'); }
    cfg.save();
    await sweep();
    return done;
  }

  client.on(Events.InteractionCreate, async (it) => {
    try {
      if (!it.isChatInputCommand() || it.commandName !== 'booster') return;
      const sub = it.options.getSubcommand();
      const g = guild(); const me = await g.members.fetch(it.user.id).catch(() => null);
      if (sub === 'info') return it.reply({ embeds: [baseEmbed({ title: '💎 Perks Nitro Booster TRO', description: `${perksText()}\n\n${me?.premiumSinceTimestamp ? `✅ Kamu booster sejak <t:${Math.floor(me.premiumSinceTimestamp / 1000)}:D>. Makasih! 🦉` : 'Kamu belum boost. Boost server buat dapetin semua perks di atas 💎'}`, color: '#f47fff' })], flags: MessageFlags.Ephemeral });
      if (!me?.premiumSinceTimestamp) return it.reply({ content: '💎 Fitur ini khusus Nitro Booster TRO. Boost server dulu ya!', flags: MessageFlags.Ephemeral });
      await it.deferReply({ flags: MessageFlags.Ephemeral });
      const d = D(); let role = d.custom[me.id] && g.roles.cache.get(d.custom[me.id]);
      if (!role) {
        role = await g.roles.create({ name: `✨ ${me.displayName}`.slice(0, 100), color: 0xf47fff, reason: `TRO SYSTEM: role pribadi booster ${me.user.username}` });
        const anchor = C().roleId && g.roles.cache.get(C().roleId); if (anchor) await role.setPosition(anchor.position).catch(() => {});
        await me.roles.add(role).catch(() => {}); d.custom[me.id] = role.id; cfg.save();
      }
      if (sub === 'warna') {
        const hex = it.options.getString('hex').trim().replace(/^#?/, '#');
        if (!/^#[0-9a-f]{6}$/i.test(hex)) return it.editReply('❌ Format warna salah. Contoh: `#ff66cc`');
        await role.setColor(hex); return it.editReply(`✅ Warna role kamu sekarang **${hex}** 🎨`);
      }
      if (sub === 'nama') {
        const name = it.options.getString('nama').replace(/@everyone|@here/gi, '').trim().slice(0, 40);
        if (!name) return it.editReply('❌ Nama tidak boleh kosong');
        await role.setName(`✨ ${name}`); return it.editReply(`✅ Nama role kamu sekarang **✨ ${name}**`);
      }
    } catch (e) { const r = { content: '⚠️ ' + e.message, flags: MessageFlags.Ephemeral }; (it.deferred || it.replied ? it.editReply(r) : it.reply(r)).catch(() => {}); }
  });

  client.once('ready', () => { setTimeout(() => { sweep().catch(() => {}); refreshPanel().catch(() => {}); }, 45_000); setInterval(() => sweep().catch(() => {}), 30 * 60_000); });

  const commands = [
    new SlashCommandBuilder().setName('booster').setDescription('Perks Nitro Booster TRO 💎')
      .addSubcommand((s) => s.setName('info').setDescription('Lihat perks booster'))
      .addSubcommand((s) => s.setName('warna').setDescription('Ganti warna role pribadi (khusus booster)').addStringOption((o) => o.setName('hex').setDescription('contoh: #ff66cc').setRequired(true)))
      .addSubcommand((s) => s.setName('nama').setDescription('Ganti nama role pribadi (khusus booster)').addStringOption((o) => o.setName('nama').setDescription('Nama role').setRequired(true).setMaxLength(40)))
      .toJSON(),
  ];

  function routes(api) {
    api.get('/boost', async (req, res) => {
      const g = guild(); const members = g ? await client.fetchMembers(g) : new Map();
      const list = [...members.values()].filter((m) => m.premiumSinceTimestamp).map((m) => ({ id: m.id, name: m.displayName, username: m.user.username, avatar: m.user.displayAvatarURL({ size: 64 }), since: m.premiumSinceTimestamp, custom: !!D().custom[m.id] }));
      res.json({ cfg: C(), boosters: list, count: g?.premiumSubscriptionCount || 0, tier: g?.premiumTier || 0, history: D().history.slice(0, 30) });
    });
    api.put('/boost', (req, res) => {
      const b = C(), x = req.body;
      for (const k of ['roleId', 'loungeChannelId', 'thanksChannelId', 'thanksMessage']) if (x[k] !== undefined) b[k] = String(x[k]);
      if (x.panelChannelId !== undefined && x.panelChannelId !== b.panelChannelId) { b.panelChannelId = String(x.panelChannelId); b.panelMessageId = ''; }
      if (x.enabled !== undefined) b.enabled = !!x.enabled; if (x.dm !== undefined) b.dm = !!x.dm;
      if (x.xpBonus !== undefined) b.xpBonus = Math.max(0, Math.min(300, Number(x.xpBonus) || 0));
      if (Array.isArray(x.perks)) b.perks = x.perks.map((p) => String(p).slice(0, 200)).filter(Boolean).slice(0, 15);
      cfg.save(); res.json({ ok: true });
    });
    api.post('/boost/setup', async (req, res) => { try { res.json({ done: await autoSetup() }); } catch (e) { res.status(400).json({ error: e.message }); } });
    api.post('/boost/panel', async (req, res) => { try { res.json({ result: await refreshPanel() }); } catch (e) { res.status(400).json({ error: e.message }); } });
    api.post('/boost/test', async (req, res) => {
      // preview ucapan ke DM kamu saja (tidak diposting & tidak dicatat)
      const g = guild(); const m = await g.members.fetch(req.session.user.id).catch(() => null); if (!m) return res.status(400).json({ error: 'Member tidak ditemukan' });
      const b = C();
      await m.send({ content: '🧪 **[TES]** contoh ucapan booster (akan dihapus)', embeds: [baseEmbed({ title: '💎 Booster baru di TRO!', description: fill(b.thanksMessage, m, g), thumbnail: m.user.displayAvatarURL({ size: 256 }), color: '#f47fff' }), baseEmbed({ title: `💎 Makasih udah boost ${g.name}!`, description: perksText(), color: '#f47fff' })] }).then(() => res.json({ ok: true })).catch((e) => res.status(400).json({ error: 'DM gagal: ' + e.message }));
    });
  }

  return { commands, routes };
}

module.exports = { setup };
