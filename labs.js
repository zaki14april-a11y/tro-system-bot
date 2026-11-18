// ============================================================
//  🧪 TRO LABS — server khusus jual beli script buatan TRO TEAM
//  Server terpisah dari TRO. Bot TRO SYSTEM ngurus:
//  setup channel/role · order lewat tiket (DANA / Robux) · bukti TF → ACC staff
//  → role 💎 CLIENT · log proof · review khusus client
//  Data disimpan di cfg.data('labs') — tidak menyentuh data TRO lain.
// ============================================================
const { Events, ChannelType, PermissionFlagsBits: P, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const cfg = require('./config');

const GOLD = 0xd4af37, NAVY = 0x1b2448, GREEN = 0x30a46c, RED = 0xe5484d, AMBER = 0xf59e0b;
const ROLES = { staff: ['🧪 LABS STAFF', 0xd4af37], client: ['💎 CLIENT', 0x5865f2], member: ['👤 MEMBER', 0x9a9aa8] };
const STATUS = { baru: '🆕 Menunggu harga', bayar: '💳 Menunggu pembayaran', cek: '🔎 Cek bukti bayar', dibayar: '✅ Dibayar — script disiapkan', selesai: '📦 Selesai', batal: '❌ Batal' };

// struktur server: [kategori, [[nama, tipe, mode]]]
//  mode: ro = cuma staff yang bisa nulis · open = semua bisa nulis · client = cuma 💎 CLIENT · panel = tombol saja
const LAYOUT = [
  ['📌 INFORMATION', [
    ['「📢」announcement', 'text', 'ro'],
    ['「📜」script-tos', 'text', 'ro'],
    ['「💳」payment', 'text', 'ro'],
    ['「🧾」proof', 'text', 'ro'],
    ['「⭐」customer-review', 'text', 'client'],
    ['「👋」welcome', 'text', 'ro'],
  ]],
  ['🧪 TRO LABS SCRIPT', [
    ['「💎」paid-script', 'forum', 'ro'],
    ['「🎁」free-script', 'forum', 'ro'],
    ['「🆕」update-log', 'text', 'ro'],
  ]],
  ['🛒 ORDER', [
    ['「🛒」order-script', 'text', 'panel'],
  ]],
  ['💬 GENERAL', [
    ['「💬」chat', 'text', 'open'],
    ['「🛠️」support', 'text', 'open'],
    ['🔊 VOICE', 'voice', 'open'],
  ]],
];

function setup({ client }) {
  const D = () => cfg.data('labs', { guildId: '', roles: {}, channels: {}, orderCategoryId: '', panelMessageId: '', posts: {}, seq: 0, orders: [],
    danaNumber: '', danaName: '', danaLink: '', robuxNote: 'Bayar Robux lewat gamepass yang dikirim staff di tiket, atau via USN (kirim ke grup).', lastSetup: null, lastError: '' });
  const labsGuild = () => {
    const d = D(); if (d.guildId) { const g = client.guilds.cache.get(d.guildId); if (g) return g; }
    const g = client.guilds.cache.find((x) => x.id !== process.env.GUILD_ID && /TRO\s*LABS/i.test(x.name));
    if (g && d.guildId !== g.id) { d.guildId = g.id; cfg.save(); }
    return g || null;
  };
  const isLabs = (g) => !!g && g.id === labsGuild()?.id;
  const shop = () => cfg.data('shop', {});
  const dana = () => { const d = D(), s = shop(); return { no: d.danaNumber || s.danaNumber || '', name: d.danaName || s.danaName || '', link: d.danaLink || s.danaLink || '' }; };

  const E = ({ title, description, color = GOLD, fields, image } = {}) => {
    const g = labsGuild(), e = new EmbedBuilder().setColor(color).setFooter({ text: 'TRO LABS • script buatan TRO TEAM', iconURL: g?.iconURL() || client.user?.displayAvatarURL() }).setTimestamp();
    if (title) e.setTitle(String(title).slice(0, 256));
    if (description) e.setDescription(String(description).slice(0, 4096));
    if (fields?.length) e.addFields(fields.filter((f) => f.value).slice(0, 25).map((f) => ({ name: String(f.name).slice(0, 256), value: String(f.value).slice(0, 1024), inline: !!f.inline })));
    if (image) e.setImage(image);
    if (g?.iconURL()) e.setThumbnail(g.iconURL({ size: 256 }));
    return e;
  };
  const isStaff = (m) => !!m && (m.permissions.has(P.Administrator) || m.roles.cache.has(D().roles.staff) || m.id === m.guild.ownerId);

  // ---------- SETUP (idempotent: yang sudah ada dipakai ulang, tidak dihapus) ----------
  async function ensureRole(g, key) {
    const [name, color] = ROLES[key], d = D();
    let r = (d.roles[key] && g.roles.cache.get(d.roles[key])) || g.roles.cache.find((x) => x.name === name);
    if (!r) r = await g.roles.create({ name, color, hoist: true, mentionable: key === 'staff', reason: 'TRO LABS setup',
      permissions: key === 'staff' ? [P.ManageMessages, P.ManageThreads, P.ManageChannels, P.ViewChannel, P.SendMessages, P.AttachFiles, P.EmbedLinks, P.ReadMessageHistory, P.MentionEveryone] : [] });
    d.roles[key] = r.id; return r;
  }
  function overwrites(g, mode, R, voice = false) {
    const ev = g.roles.everyone.id, me = client.user.id;
    const base = [{ id: me, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.AttachFiles, P.ManageMessages, P.ManageThreads, P.ReadMessageHistory, P.CreatePublicThreads, P.SendMessagesInThreads] },
      { id: R.staff.id, allow: [P.ViewChannel, P.SendMessages, P.AttachFiles, P.EmbedLinks, P.ManageMessages, P.ManageThreads, P.CreatePublicThreads, P.SendMessagesInThreads] }];
    if (mode === 'open') return [{ id: ev, allow: voice ? [P.ViewChannel, P.SendMessages, P.Connect, P.Speak] : [P.ViewChannel, P.SendMessages], deny: [] }, ...base];
    if (mode === 'client') return [{ id: ev, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages, P.CreatePublicThreads] }, { id: R.client.id, allow: [P.SendMessages, P.AttachFiles, P.EmbedLinks] }, ...base];
    // ro / panel: semua lihat, cuma staff nulis; forum: member boleh komentar di post
    return [{ id: ev, allow: [P.ViewChannel, P.ReadMessageHistory, P.SendMessagesInThreads], deny: [P.SendMessages, P.CreatePublicThreads, P.CreatePrivateThreads] }, ...base];
  }
  async function setupServer() {
    const g = labsGuild(); if (!g) throw new Error('Server TRO LABS belum ketemu. Bikin servernya (nama mengandung "TRO LABS") lalu invite bot TRO SYSTEM.');
    if (!g.members.me.permissions.has(P.Administrator) && !g.members.me.permissions.has(P.ManageChannels)) throw new Error('Bot butuh izin Administrator / Manage Channels & Roles di TRO LABS.');
    const d = D(), done = [];
    const R = { staff: await ensureRole(g, 'staff'), client: await ensureRole(g, 'client'), member: await ensureRole(g, 'member') };
    await g.channels.fetch();
    for (const [catName, chans] of LAYOUT) {
      let cat = g.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === catName);
      if (!cat) { cat = await g.channels.create({ name: catName, type: ChannelType.GuildCategory, reason: 'TRO LABS setup' }); done.push(`kategori ${catName}`); }
      if (catName === '🛒 ORDER') d.orderCategoryId = cat.id;
      for (const [name, type, mode] of chans) {
        let ch = g.channels.cache.find((c) => c.parentId === cat.id && c.name === name) || (d.channels[name] && g.channels.cache.get(d.channels[name]));
        const permissionOverwrites = overwrites(g, mode, R, type === 'voice');
        if (!ch) {
          const t = type === 'voice' ? ChannelType.GuildVoice : type === 'forum' ? ChannelType.GuildForum : ChannelType.GuildText;
          ch = await g.channels.create({ name, type: t, parent: cat.id, permissionOverwrites, reason: 'TRO LABS setup' })
            .catch(async (e) => { if (t !== ChannelType.GuildForum) throw e; return g.channels.create({ name, type: ChannelType.GuildText, parent: cat.id, permissionOverwrites, reason: 'TRO LABS setup (forum tidak tersedia)' }); });
          done.push(`#${name}`);
        } else await ch.permissionOverwrites.set(permissionOverwrites).catch(() => {});
        d.channels[name] = ch.id;
      }
    }
    await postInfo(); await postPanel();
    d.lastSetup = new Date().toISOString(); d.lastError = ''; cfg.save();
    return { guild: g.name, created: done, channels: Object.keys(d.channels).length };
  }

  // ---------- POSTINGAN INFO (diedit kalau sudah ada, bukan dobel) ----------
  const ch = (name) => { const id = D().channels[name]; return id ? client.channels.cache.get(id) : null; };
  async function upsert(key, chName, payload) {
    const c = ch(chName); if (!c || !c.isTextBased?.()) return;
    const d = D(), old = d.posts[key] && await c.messages.fetch(d.posts[key]).catch(() => null);
    if (old) { await old.edit(payload); return; }
    const m = await c.send({ ...payload, allowedMentions: { parse: [] } }); d.posts[key] = m.id;
  }
  const at = (name) => (D().channels[name] ? `<#${D().channels[name]}>` : `#${name}`);
  async function postInfo() {
    const pay = dana();
    await upsert('welcome', '「👋」welcome', { embeds: [E({ title: '🧪 SELAMAT DATANG DI TRO LABS',
      description: `Tempat resmi **jual beli script Roblox buatan TRO TEAM** — semua script dibikin dari nol sama tim kita sendiri.\n\n**Cara mulai:**\n1️⃣ Baca aturan di ${at('「📜」script-tos')}\n2️⃣ Lihat katalog di ${at('「💎」paid-script')} & ${at('「🎁」free-script')}\n3️⃣ Cara bayar ada di ${at('「💳」payment')}\n4️⃣ Order lewat tombol di ${at('「🛒」order-script')}\n5️⃣ Udah beli? Kasih ulasan di ${at('「⭐」customer-review')}\n\nAda kendala? Tanya di ${at('「🛠️」support')}.` })] });
    await upsert('tos', '「📜」script-tos', { embeds: [E({ title: '📜 SCRIPT TERMS OF SERVICE', color: NAVY,
      description: '**Dengan membeli script TRO LABS, kamu setuju:**\n\n🔒 **Lisensi pribadi** — script cuma buat game/map kamu sendiri.\n🚫 **Dilarang** jual ulang, bagi-bagi, leak, atau klaim script sebagai buatan sendiri.\n🏷️ **Credit** `-- BY TRO TEAM` di dalam script jangan dihapus.\n🛠️ **Support & bug fix** gratis buat versi yang kamu beli, lewat tiket/#support.\n🆕 **Update** versi baru diumumkan di update-log.\n💸 **Refund** cuma kalau script tidak berfungsi sama sekali & tidak bisa kami perbaiki.\n⚠️ Melanggar = akses support dicabut & role 💎 CLIENT dilepas.' })] });
    await upsert('payment', '「💳」payment', { embeds: [E({ title: '💳 METODE PEMBAYARAN', color: GREEN,
      description: `Order **selalu lewat tiket** di ${at('「🛒」order-script')} — staff kirim harga final di tiket kamu.`,
      fields: [
        { name: '💙 DANA', value: `${pay.no ? `Nomor: \`${pay.no}\`${pay.name ? ` a.n. **${pay.name}**` : ''}\n` : ''}${pay.link ? `[Bayar via link DANA](${pay.link})\n` : ''}Transfer sesuai harga di tiket → kirim **screenshot bukti TF** di tiket.` },
        { name: '🟢 ROBUX', value: `${D().robuxNote}\nKirim **screenshot bukti pembelian** di tiket.` },
        { name: '📦 Setelah bayar', value: 'Staff cek bukti → ACC → script dikirim di tiket + kamu dapat role **💎 CLIENT**.' },
      ] })] });
  }
  async function postPanel() {
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('labs:order').setLabel('Order Script').setEmoji('🛒').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('labs:help').setLabel('Cara order').setEmoji('❔').setStyle(ButtonStyle.Secondary));
    await upsert('panel', '「🛒」order-script', { embeds: [E({ title: '🛒 ORDER SCRIPT TRO LABS',
      description: `Mau beli script? Klik **🛒 Order Script**, isi form, tiket pribadi kamu langsung dibuat.\n\n**Alur:** isi form → staff kirim harga → bayar **DANA / Robux** → kirim bukti → script dikirim + role 💎 CLIENT.\n\nKatalog: ${at('「💎」paid-script')}` })], components: [row] });
  }

  // ---------- ORDER / TIKET ----------
  const orderOf = (channelId) => D().orders.find((o) => o.channelId === channelId);
  const staffRow = (o) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`labs:price:${o.id}`).setLabel('Set harga').setEmoji('💰').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`labs:acc:${o.id}`).setLabel('ACC bayar').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`labs:done:${o.id}`).setLabel('Script terkirim').setEmoji('📦').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`labs:cancel:${o.id}`).setLabel('Batal').setEmoji('❌').setStyle(ButtonStyle.Danger));
  const orderEmbed = (o) => E({ title: `🧾 ORDER #${String(o.no).padStart(4, '0')} — ${STATUS[o.status]}`, color: o.status === 'selesai' ? GREEN : o.status === 'batal' ? RED : o.status === 'cek' ? AMBER : GOLD,
    fields: [
      { name: '👤 Pembeli', value: `<@${o.userId}>`, inline: true },
      { name: '📦 Script', value: o.script, inline: true },
      { name: '💳 Metode', value: o.method === 'robux' ? '🟢 Robux' : '💙 DANA', inline: true },
      { name: '🎮 Username Roblox', value: `\`${o.rbx || '-'}\``, inline: true },
      { name: '💰 Harga', value: o.price || '_menunggu staff_', inline: true },
      { name: '📝 Catatan', value: o.note || '-' },
    ] });
  async function refresh(o) {
    const c = client.channels.cache.get(o.channelId); if (!c) return;
    const m = o.msgId && await c.messages.fetch(o.msgId).catch(() => null);
    const comps = ['selesai', 'batal'].includes(o.status) ? [] : [staffRow(o)];
    if (m) await m.edit({ embeds: [orderEmbed(o)], components: comps }).catch(() => {});
  }
  function payInstructions(o) {
    const pay = dana();
    if (o.method === 'robux') return `🟢 **Bayar pakai Robux: ${o.price}**\n${D().robuxNote}\n\nUdah bayar? **Kirim screenshot bukti** di sini.`;
    return `💙 **Bayar via DANA: ${o.price}**\n${pay.no ? `Nomor: \`${pay.no}\`${pay.name ? ` a.n. **${pay.name}**` : ''}\n` : ''}${pay.link ? `Link: ${pay.link}\n` : ''}\nUdah transfer? **Kirim screenshot bukti TF** di sini.`;
  }
  async function createOrder(it, f) {
    const g = it.guild, d = D();
    const open = d.orders.find((o) => o.userId === it.user.id && !['selesai', 'batal'].includes(o.status) && g.channels.cache.has(o.channelId));
    if (open) return it.editReply(`Kamu masih punya order aktif: <#${open.channelId}>`);
    d.seq = (d.seq || 0) + 1;
    const o = { id: `L${Date.now().toString(36)}`, no: d.seq, userId: it.user.id, username: it.user.username, script: f.script, method: f.method, rbx: f.rbx, note: f.note, price: '', status: 'baru', createdAt: new Date().toISOString() };
    const c = await g.channels.create({ name: `order-${String(o.no).padStart(4, '0')}-${it.user.username}`.slice(0, 90).toLowerCase(), type: ChannelType.GuildText, parent: d.orderCategoryId || null,
      permissionOverwrites: [{ id: g.roles.everyone.id, deny: [P.ViewChannel] },
        { id: it.user.id, allow: [P.ViewChannel, P.SendMessages, P.AttachFiles, P.ReadMessageHistory] },
        { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.AttachFiles, P.EmbedLinks, P.ManageChannels, P.ReadMessageHistory] },
        ...(d.roles.staff ? [{ id: d.roles.staff, allow: [P.ViewChannel, P.SendMessages, P.AttachFiles, P.ReadMessageHistory] }] : [])],
      reason: `TRO LABS order #${o.no}` });
    o.channelId = c.id;
    const m = await c.send({ content: `<@${it.user.id}>${d.roles.staff ? ` <@&${d.roles.staff}>` : ''}`, embeds: [orderEmbed(o)], components: [staffRow(o)], allowedMentions: { users: [it.user.id], roles: d.roles.staff ? [d.roles.staff] : [] } });
    o.msgId = m.id; d.orders.push(o); cfg.save();
    await c.send({ embeds: [E({ description: `Halo <@${it.user.id}>! Order kamu udah masuk 🧪\nTunggu staff kirim **harga final**, abis itu ikutin instruksi bayar yang muncul di sini.`, color: NAVY })] });
    return it.editReply(`✅ Tiket order dibuat: <#${c.id}>`);
  }
  async function lock(o) { const c = client.channels.cache.get(o.channelId); if (c) await c.permissionOverwrites.edit(o.userId, { SendMessages: false }).catch(() => {}); }

  client.on(Events.InteractionCreate, async (it) => {
    if (!it.guild || !isLabs(it.guild) || !(it.isButton() || it.isModalSubmit()) || !it.customId.startsWith('labs:')) return;
    try {
      const [, act, id] = it.customId.split(':');
      if (it.isButton() && act === 'help') return it.reply({ flags: MessageFlags.Ephemeral, content: '**Cara order:**\n1. Klik 🛒 Order Script & isi form\n2. Staff kirim harga di tiket kamu\n3. Bayar DANA / Robux\n4. Kirim screenshot bukti di tiket\n5. Script dikirim + dapat role 💎 CLIENT' });
      if (it.isButton() && act === 'order') {
        const m = new ModalBuilder().setCustomId('labs:form').setTitle('Order Script TRO LABS').addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('script').setLabel('Script yang mau dibeli').setPlaceholder('contoh: Dance Sync System').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('method').setLabel('Bayar pakai: DANA atau ROBUX').setPlaceholder('DANA / ROBUX').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rbx').setLabel('Username Roblox kamu').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(40)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('note').setLabel('Catatan (opsional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)));
        return it.showModal(m);
      }
      if (it.isModalSubmit() && act === 'form') {
        await it.deferReply({ flags: MessageFlags.Ephemeral });
        const v = (k) => it.fields.getTextInputValue(k).trim();
        return createOrder(it, { script: v('script'), method: /rob|rbx/i.test(v('method')) ? 'robux' : 'dana', rbx: v('rbx'), note: v('note') });
      }
      const o = D().orders.find((x) => x.id === id); if (!o) return it.reply({ flags: MessageFlags.Ephemeral, content: 'Order tidak ditemukan.' });
      if (!isStaff(it.member)) return it.reply({ flags: MessageFlags.Ephemeral, content: '🔒 Tombol ini khusus staff TRO LABS.' });
      if (it.isButton() && act === 'price') {
        return it.showModal(new ModalBuilder().setCustomId(`labs:setprice:${o.id}`).setTitle(`Harga order #${o.no}`).addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('price').setLabel(o.method === 'robux' ? 'Harga (Robux)' : 'Harga (Rupiah)').setPlaceholder(o.method === 'robux' ? 'contoh: 500 Robux' : 'contoh: Rp75.000').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60))));
      }
      if (it.isModalSubmit() && act === 'setprice') {
        o.price = it.fields.getTextInputValue('price').trim(); o.status = 'bayar'; cfg.save(); await refresh(o);
        const extra = o.method !== 'robux' && dana().link ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(dana().link).setLabel('Bayar via DANA').setEmoji('💙'))] : [];
        await it.reply({ content: `<@${o.userId}>`, embeds: [E({ title: '💳 INSTRUKSI PEMBAYARAN', description: payInstructions(o), color: GREEN })], components: extra, allowedMentions: { users: [o.userId] } });
        return;
      }
      if (act === 'acc') {
        o.status = 'dibayar'; o.paidAt = new Date().toISOString(); o.accBy = it.user.username; cfg.save(); await refresh(o);
        const mem = await it.guild.members.fetch(o.userId).catch(() => null);
        if (mem && D().roles.client) await mem.roles.add(D().roles.client, `TRO LABS order #${o.no} dibayar`).catch(() => {});
        return it.reply({ content: `<@${o.userId}>`, embeds: [E({ title: '✅ PEMBAYARAN DITERIMA', description: `Makasih! Pembayaran kamu udah di-ACC **${it.user.username}**.\nKamu sekarang **💎 CLIENT** TRO LABS. Script lagi disiapkan & dikirim di sini.`, color: GREEN })], allowedMentions: { users: [o.userId] } });
      }
      if (act === 'done') {
        o.status = 'selesai'; o.doneAt = new Date().toISOString(); cfg.save(); await refresh(o); await lock(o);
        const p = ch('「🧾」proof');
        if (p) await p.send({ embeds: [E({ title: `🧾 ORDER #${String(o.no).padStart(4, '0')} SELESAI`, color: GREEN, fields: [{ name: 'Pembeli', value: `<@${o.userId}>`, inline: true }, { name: 'Script', value: o.script, inline: true }, { name: 'Metode', value: o.method === 'robux' ? '🟢 Robux' : '💙 DANA', inline: true }] })], allowedMentions: { parse: [] } }).catch(() => {});
        return it.reply({ embeds: [E({ title: '📦 ORDER SELESAI', description: `Script udah dikirim. Jangan lupa kasih ulasan di ${at('「⭐」customer-review')} ya <@${o.userId}> 🙏\nTiket ini dikunci, staff bisa hapus kalau udah nggak dipakai.`, color: GREEN })], allowedMentions: { users: [o.userId] } });
      }
      if (act === 'cancel') { o.status = 'batal'; cfg.save(); await refresh(o); await lock(o); return it.reply({ embeds: [E({ description: `❌ Order dibatalkan oleh **${it.user.username}**.`, color: RED })] }); }
    } catch (e) { console.error('[labs]', e.message); if (!it.replied && !it.deferred) it.reply({ flags: MessageFlags.Ephemeral, content: `❌ ${e.message}` }).catch(() => {}); }
  });

  // bukti bayar: pembeli kirim gambar di tiketnya → status 🔎 + ping staff
  client.on(Events.MessageCreate, async (m) => {
    try {
      if (m.author.bot || !isLabs(m.guild)) return;
      const o = orderOf(m.channelId); if (!o || m.author.id !== o.userId || !['baru', 'bayar'].includes(o.status)) return;
      const img = m.attachments.find((a) => (a.contentType || '').startsWith('image/')); if (!img) return;
      o.status = 'cek'; o.proof = img.url; cfg.save(); await refresh(o);
      const st = D().roles.staff;
      await m.reply({ content: st ? `<@&${st}>` : '', embeds: [E({ title: '🔎 BUKTI BAYAR MASUK', description: 'Staff lagi ngecek bukti kamu. Tunggu sebentar ya!', color: AMBER, image: img.url })], allowedMentions: { roles: st ? [st] : [] } });
    } catch (e) { console.error('[labs]', e.message); }
  });

  // member baru di TRO LABS → role 👤 MEMBER
  client.on(Events.GuildMemberAdd, async (m) => { if (isLabs(m.guild) && D().roles.member) await m.roles.add(D().roles.member, 'TRO LABS join').catch(() => {}); });

  function routes(api) {
    api.get('/labs', (req, res) => { const g = labsGuild(), d = D(); res.json({ found: !!g, guild: g ? { id: g.id, name: g.name, members: g.memberCount } : null, lastSetup: d.lastSetup, lastError: d.lastError, channels: Object.keys(d.channels).length, orders: d.orders.length, open: d.orders.filter((o) => !['selesai', 'batal'].includes(o.status)).length, invite: `https://discord.com/oauth2/authorize?client_id=${client.user?.id}&scope=bot%20applications.commands&permissions=8` }); });
    api.post('/labs/setup', async (req, res) => { try { res.json(await setupServer()); } catch (e) { D().lastError = e.message; cfg.save(); res.status(400).json({ error: e.message }); } });
    api.put('/labs/settings', async (req, res) => { const d = D(); for (const k of ['danaNumber', 'danaName', 'danaLink', 'robuxNote']) if (typeof req.body[k] === 'string') d[k] = req.body[k].trim(); cfg.save(); await postInfo().catch(() => {}); cfg.save(); res.json({ ok: true }); });
    api.get('/labs/orders', (req, res) => res.json(D().orders.slice(-100).reverse()));
  }
  return { commands: [], routes };
}

module.exports = { setup };
