// ============================================================
//  🛒 TRO SHOP — produk (Robux / asset / script) & order
// ============================================================
const { Events, SlashCommandBuilder, MessageFlags, PermissionFlagsBits: P, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const cfg = require('./config');

const newId = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 4);
const rp = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const CATS = { robux: '💰 Robux', asset: '🧩 Asset', script: '📜 Script', map: '🗺️ Map', jasa: '🛠️ Jasa', lain: '📦 Lainnya' };
const STATUS = { baru: '🆕 Baru', dibayar: '💳 Dibayar', proses: '⚙️ Diproses', selesai: '✅ Selesai', batal: '❌ Batal' };

function setup({ client, baseEmbed }) {
  const S = () => {
    const s = cfg.get();
    if (!s.shop) s.shop = { catalogChannelId: '', catalogMessageId: '', logChannelId: '', staffRoleIds: [], title: '🛒 TRO SHOP — KATALOG', footerNote: 'Order lewat channel 「🎫」buka-tiket → Order Robux / Asset / Script.' };
    const x = s.shop;
    x.brand ??= 'TROlley'; x.orderTypeIds ??= ['robux', 'asset'];
    x.panelChannelId ??= ''; x.panelMessageId ??= ''; x.priceChannelId ??= ''; x.priceMessageId ??= ''; x.guideChannelId ??= ''; x.guideMessageId ??= '';
    x.reviewChannelId ??= ''; x.dmBuyer ??= true; x.askReview ??= true;
    x.payInfo ??= 'Pembayaran: **QRIS / DANA / GoPay / transfer bank**. Kirim bukti bayar di tiket ini, staff akan cek & proses.';
    x.guideText ??= '**1.** Cek harga di 「💰」price-list-robux atau 「🛍️」katalog-shop\n**2.** Buka tiket di 「🎟️」open-ticket-robux → pilih jenis order\n**3.** Klik **Isi form order** di tiket → total harga keluar otomatis\n**4.** Bayar sesuai metode yang tertera, kirim bukti di tiket\n**5.** Staff proses pesanan → kamu dapat DM tiap status berubah\n**6.** Selesai! Kasih review bintang ⭐ lewat DM — tampil di 「⭐」review-cust-trolley\n\n⚠️ **Transaksi hanya lewat tiket resmi.** Staff TRO tidak pernah minta bayar lewat DM pribadi.';
    return x;
  };
  const D = () => cfg.data('shopData', { products: [], orders: [], counter: 0 });

  function catalogEmbeds() {
    const s = S(), d = D();
    const active = d.products.filter((p) => p.active !== false);
    const fields = Object.entries(CATS).map(([k, label]) => {
      const list = active.filter((p) => p.category === k);
      if (!list.length) return null;
      return { name: label, value: list.map((p) => `**${p.name}** — ${rp(p.price)}${p.stock !== '' && p.stock != null && p.stock !== undefined && Number(p.stock) <= 0 ? ' · ~~habis~~' : ''}${p.desc ? `\n> ${p.desc}` : ''}`).join('\n').slice(0, 1024) };
    }).filter(Boolean);
    return [baseEmbed({ title: s.title, description: (fields.length ? 'Harga resmi TRO SHOP. Semua transaksi lewat tiket biar aman & tercatat.\n' : 'Belum ada produk.') + `\n${s.footerNote}`, fields })];
  }

  async function postCatalog() {
    const s = S(); if (!s.catalogChannelId) throw new Error('Pilih channel katalog dulu');
    const ch = await client.channels.fetch(s.catalogChannelId);
    const payload = { embeds: catalogEmbeds() };
    const old = s.catalogMessageId && await ch.messages.fetch(s.catalogMessageId).catch(() => null);
    if (old) { await old.edit(payload); return 'updated'; }
    const m = await ch.send(payload); s.catalogMessageId = m.id; cfg.save(); return 'posted';
  }

  function orderEmbed(o) {
    return baseEmbed({
      title: `🧾 ORDER #${o.no} — ${STATUS[o.status] || o.status}`,
      fields: [
        { name: 'Pembeli', value: o.customerId ? `<@${o.customerId}>` : (o.customerName || '-'), inline: true },
        { name: 'Produk', value: `${o.productName}${o.qty > 1 ? ` ×${o.qty}` : ''}`, inline: true },
        { name: 'Total', value: rp(o.total), inline: true },
        { name: 'Pembayaran', value: o.payment || '-', inline: true },
        { name: 'Ditangani', value: o.handledBy || '-', inline: true },
        { name: 'Tiket', value: o.ticketChannelId ? `<#${o.ticketChannelId}>` : '-', inline: true },
        ...(o.note ? [{ name: 'Catatan', value: o.note }] : []),
      ],
      color: { selesai: '#30a46c', batal: '#7f8c8d', dibayar: '#3b82f6', proses: '#f59e0b' }[o.status],
    });
  }

  async function logOrder(o, action) {
    const ch = S().logChannelId && await client.channels.fetch(S().logChannelId).catch(() => null);
    if (!ch) return;
    const payload = { content: action ? `*${action}*` : undefined, embeds: [orderEmbed(o)], allowedMentions: { parse: [] } };
    const old = o.logMessageId && await ch.messages.fetch(o.logMessageId).catch(() => null);
    if (old) await old.edit(payload).catch(() => {}); else { const m = await ch.send(payload).catch(() => null); if (m) { o.logMessageId = m.id; cfg.save(); } }
  }

  function upsertOrder(b, by) {
    const d = D();
    const p = d.products.find((x) => x.id === b.productId);
    const qty = Math.max(1, Number(b.qty) || 1);
    let o = b.id && d.orders.find((x) => x.id === b.id);
    const isNew = !o;
    if (!o) { d.counter += 1; o = { id: newId(), no: String(d.counter).padStart(4, '0'), createdAt: new Date().toISOString(), createdBy: by, status: 'baru', history: [] }; d.orders.unshift(o); }
    Object.assign(o, {
      customerId: String(b.customerId || o.customerId || '').replace(/\D/g, ''), customerName: String(b.customerName ?? o.customerName ?? '').slice(0, 80),
      productId: p?.id || o.productId || '', productName: p?.name || String(b.productName || o.productName || 'Custom').slice(0, 100), category: p?.category || b.category || o.category || 'lain',
      qty, total: b.total !== undefined && b.total !== '' ? Number(b.total) : (p ? p.price * qty : Number(o.total) || 0),
      payment: String(b.payment ?? o.payment ?? '').slice(0, 60), note: String(b.note ?? o.note ?? '').slice(0, 500), ticketChannelId: String(b.ticketChannelId ?? o.ticketChannelId ?? ''),
    });
    const prevStatus = o.status;
    if (b.status && b.status !== o.status) { o.history.push({ from: o.status, to: b.status, by, at: new Date().toISOString() }); o.status = b.status; if (['proses', 'selesai'].includes(b.status)) o.handledBy = by; if (b.status === 'selesai') { o.doneAt = new Date().toISOString(); if (p && p.stock !== '' && p.stock != null) p.stock = Math.max(0, Number(p.stock) - qty); } }
    cfg.save();
    logOrder(o, b.status ? `Status → ${STATUS[o.status]} oleh ${by}` : `Order dicatat oleh ${by}`).catch(() => {});
    dmBuyer(o, isNew ? null : prevStatus).catch(() => {});
    if (isNew) client.notifyStaff?.('order', { title: `Order #${o.no} — ${o.productName}`, description: `**Pembeli:** ${o.customerId ? `<@${o.customerId}>` : ''} ${o.customerName || ''}\n**Jumlah:** ${o.qty} · **Total:** Rp${Number(o.total || 0).toLocaleString('id-ID')}\n**Dicatat oleh:** ${by}${o.ticketChannelId ? `\n**Tiket:** <#${o.ticketChannelId}>` : ''}` });
    return o;
  }

  function summary() {
    const d = D(); const done = d.orders.filter((o) => o.status === 'selesai');
    const month = new Date().toISOString().slice(0, 7);
    const by = (list, key) => list.reduce((a, o) => { a[o[key]] = (a[o[key]] || 0) + Number(o.total || 0); return a; }, {});
    return { total: done.reduce((a, o) => a + Number(o.total || 0), 0), thisMonth: done.filter((o) => (o.doneAt || o.createdAt).startsWith(month)).reduce((a, o) => a + Number(o.total || 0), 0), count: done.length, open: d.orders.filter((o) => !['selesai', 'batal'].includes(o.status)).length, byCategory: by(done, 'category') };
  }

  client.on(Events.InteractionCreate, async (it) => {
    if (!it.isChatInputCommand() || it.commandName !== 'order') return;
    try {
      const sub = it.options.getSubcommand(); const by = it.user.username;
      if (sub === 'catat') {
        const prod = it.options.getString('produk'); const d = D();
        const p = d.products.find((x) => x.name.toLowerCase() === prod.toLowerCase() || x.id === prod);
        const o = upsertOrder({ customerId: it.options.getUser('pembeli').id, customerName: it.options.getUser('pembeli').username, productId: p?.id, productName: prod, qty: it.options.getInteger('jumlah') || 1, total: it.options.getInteger('total') ?? '', payment: it.options.getString('bayar') || '', ticketChannelId: it.channelId }, by);
        return it.reply({ embeds: [orderEmbed(o)], allowedMentions: { parse: [] } });
      }
      if (sub === 'status') {
        const no = it.options.getString('nomor').replace(/\D/g, '').padStart(4, '0');
        const o = D().orders.find((x) => x.no === no); if (!o) return it.reply({ content: '❌ Order tidak ditemukan', flags: MessageFlags.Ephemeral });
        upsertOrder({ id: o.id, status: it.options.getString('status') }, by);
        return it.reply({ embeds: [orderEmbed(o)], allowedMentions: { parse: [] } });
      }
      if (sub === 'list') {
        const open = D().orders.filter((o) => !['selesai', 'batal'].includes(o.status)).slice(0, 15);
        return it.reply({ embeds: [baseEmbed({ title: '🧾 Order aktif', description: open.length ? open.map((o) => `\`#${o.no}\` ${STATUS[o.status]} · ${o.productName} · ${rp(o.total)} · ${o.customerId ? `<@${o.customerId}>` : o.customerName}`).join('\n') : 'Tidak ada order aktif 🎉' })], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
      }
    } catch (e) { it.reply({ content: '⚠️ ' + e.message, flags: MessageFlags.Ephemeral }).catch(() => {}); }
  });

  // ======================= 🛒 TROlley: panel order, harga, panduan, review =======================
  client.isOrderType = (id) => S().orderTypeIds.includes(id);
  const findProduct = (q) => { const d = D(); const t = String(q || '').toLowerCase().trim(); return d.products.find((p) => p.active !== false && (p.name.toLowerCase() === t)) || d.products.find((p) => p.active !== false && t && (p.name.toLowerCase().includes(t) || t.includes(p.name.toLowerCase()))); };
  function priceEmbed(cat) {
    const list = D().products.filter((p) => p.active !== false && (!cat || p.category === cat));
    return baseEmbed({ title: cat === 'robux' ? `💰 PRICE LIST ROBUX — ${S().brand}` : `💰 DAFTAR HARGA — ${S().brand}`, description: list.length ? list.map((p) => `**${p.name}** — ${rp(p.price)}${p.stock !== '' && p.stock != null && Number(p.stock) <= 0 ? ' · ~~habis~~' : ''}${p.desc ? `\n> ${p.desc}` : ''}`).join('\n').slice(0, 4000) + `\n\n${S().payInfo}` : 'Harga sedang diperbarui. Tanya staff lewat tiket ya 🙏', color: '#f5c542' });
  }
  async function upsertMsg(chKey, msgKey, payload) {
    const s = S(); if (!s[chKey]) return 'nochannel';
    const ch = await client.channels.fetch(s[chKey]).catch(() => null); if (!ch) return 'nochannel';
    const old = s[msgKey] && await ch.messages.fetch(s[msgKey]).catch(() => null);
    if (old) { await old.edit(payload); return 'updated'; }
    const m = await ch.send(payload); s[msgKey] = m.id; cfg.save(); return 'posted';
  }
  function orderPanel() {
    const types = (cfg.get().tickets?.types || []).filter((t) => S().orderTypeIds.includes(t.id));
    return { embeds: [baseEmbed({ title: `🛒 ${S().brand.toUpperCase()} — ORDER`, description: `Mau beli **Robux, asset, script, map, atau jasa**? Klik tombol di bawah → tiket privat kebuka → isi form order → bayar → beres.\n\n💰 Harga: ${S().priceChannelId ? `<#${S().priceChannelId}>` : 'lihat katalog'} · 📖 Panduan: ${S().guideChannelId ? `<#${S().guideChannelId}>` : '-'}\n⭐ Review pembeli: ${S().reviewChannelId ? `<#${S().reviewChannelId}>` : '-'}\n\n_1 orang 1 tiket aktif. Transaksi hanya lewat tiket resmi._`, color: '#f5c542' })],
      components: types.length ? [new ActionRowBuilder().addComponents(types.slice(0, 5).map((t) => { const b = new ButtonBuilder().setCustomId(`tro-tk:open:${t.id}`).setLabel(t.label.slice(0, 80)).setStyle(ButtonStyle.Success); if (t.emoji) b.setEmoji(t.emoji); return b; }))] : [] };
  }
  const guidePayload = () => ({ embeds: [baseEmbed({ title: `📖 CARA ORDER DI ${S().brand.toUpperCase()}`, description: S().guideText, color: '#f5c542' })] });
  async function postAllTrolley() {
    const r = {};
    r.panel = await upsertMsg('panelChannelId', 'panelMessageId', orderPanel());
    r.price = await upsertMsg('priceChannelId', 'priceMessageId', { embeds: [priceEmbed('robux')] });
    r.guide = await upsertMsg('guideChannelId', 'guideMessageId', guidePayload());
    r.catalog = await postCatalog().catch((e) => e.message);
    return r;
  }
  const reviewStats = () => { const rs = D().orders.filter((o) => o.rating); return { count: rs.length, avg: rs.length ? rs.reduce((a, o) => a + o.rating, 0) / rs.length : 0 }; };
  const stars = (n) => '⭐'.repeat(n) + '☆'.repeat(5 - n);

  async function dmBuyer(o, prev) {
    const s = S(); if (!o.customerId || !s.dmBuyer || prev === o.status) return;
    const u = await client.users.fetch(o.customerId).catch(() => null); if (!u) return;
    const msg = { dibayar: 'Pembayaran kamu sudah dikonfirmasi 💳', proses: 'Pesanan kamu sedang diproses ⚙️', selesai: 'Pesanan kamu **selesai**! Makasih udah belanja 🦉', batal: 'Pesanan kamu dibatalkan.' }[o.status];
    if (!msg) return;
    const comps = o.status === 'selesai' && s.askReview && !o.rating ? [new ActionRowBuilder().addComponents([1, 2, 3, 4, 5].map((n) => new ButtonBuilder().setCustomId(`tro-rev:${o.id}:${n}`).setLabel('⭐'.repeat(n)).setStyle(n >= 4 ? ButtonStyle.Success : ButtonStyle.Secondary)))] : [];
    u.send({ embeds: [baseEmbed({ title: `🧾 ${s.brand} — Order #${o.no}`, description: `${msg}\n\n**Produk:** ${o.productName}${o.qty > 1 ? ` ×${o.qty}` : ''}\n**Total:** ${rp(o.total)}${comps.length ? '\n\n**Kasih rating dong!** Klik bintang di bawah — review kamu bantu pembeli lain 🙏' : ''}`, color: '#f5c542' })], components: comps }).catch(() => {});
  }

  client.on(Events.InteractionCreate, async (it) => {
    try {
      if (it.isButton() && it.customId === 'tro-shop:prices') return it.reply({ embeds: [priceEmbed()], flags: MessageFlags.Ephemeral });
      if (it.isButton() && it.customId.startsWith('tro-shop:form:')) {
        const names = D().products.filter((p) => p.active !== false).map((p) => p.name).join(', ');
        const modal = new ModalBuilder().setCustomId(`tro-shopm:${it.customId.split(':')[2]}`).setTitle(`Form order ${S().brand}`.slice(0, 45));
        const f = (id, label, ph, long, req = true) => new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setPlaceholder(ph.slice(0, 100)).setStyle(long ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(req).setMaxLength(long ? 500 : 100));
        modal.addComponents(f('prod', 'Produk', names ? `contoh: ${names}` : 'contoh: 1000 Robux', false), f('qty', 'Jumlah', '1', false), f('rbx', 'Username Roblox', 'username akun Roblox kamu', false), f('pay', 'Metode bayar', 'QRIS / DANA / GoPay / transfer', false), f('note', 'Catatan (opsional)', 'link gamepass / detail lain', true, false));
        return it.showModal(modal);
      }
      if (it.isModalSubmit() && it.customId.startsWith('tro-shopm:')) {
        const prod = it.fields.getTextInputValue('prod'); const p = findProduct(prod);
        const qty = Math.max(1, parseInt(it.fields.getTextInputValue('qty'), 10) || 1);
        const note = [`Roblox: ${it.fields.getTextInputValue('rbx')}`, it.fields.getTextInputValue('note')].filter(Boolean).join(' · ');
        const o = upsertOrder({ customerId: it.user.id, customerName: it.user.username, productId: p?.id, productName: p ? p.name : prod, category: p?.category, qty, total: p ? '' : 0, payment: it.fields.getTextInputValue('pay'), note, ticketChannelId: it.channelId }, `${it.user.username} (form)`);
        return it.reply({ content: (S().staffRoleIds || []).map((r) => `<@&${r}>`).join(' ') || undefined, embeds: [orderEmbed(o), baseEmbed({ title: '💳 Langkah berikutnya', description: `${p ? `Total yang harus dibayar: **${rp(o.total)}**` : '⚠️ Produk belum ada di katalog — staff akan konfirmasi harganya dulu.'}\n\n${S().payInfo}`, color: '#f5c542' })], allowedMentions: { roles: S().staffRoleIds || [] } });
      }
      if (it.isButton() && it.customId.startsWith('tro-rev:')) {
        const [, oid, n] = it.customId.split(':'); const o = D().orders.find((x) => x.id === oid);
        if (!o || o.customerId !== it.user.id) return it.reply({ content: '❌ Order tidak ditemukan.' });
        if (o.rating) return it.reply({ content: '✅ Kamu sudah kasih review untuk order ini. Makasih!' });
        const modal = new ModalBuilder().setCustomId(`tro-revm:${oid}:${n}`).setTitle(`Review ${stars(+n)}`);
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c').setLabel('Ceritain pengalaman kamu (opsional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)));
        return it.showModal(modal);
      }
      if (it.isModalSubmit() && it.customId.startsWith('tro-revm:')) {
        const [, oid, n] = it.customId.split(':'); const o = D().orders.find((x) => x.id === oid); if (!o || o.rating) return it.reply({ content: '✅ Tercatat.' });
        o.rating = Math.min(5, Math.max(1, +n)); o.review = it.fields.getTextInputValue('c') || ''; o.reviewAt = new Date().toISOString(); cfg.save();
        const st = reviewStats();
        const ch = S().reviewChannelId && await client.channels.fetch(S().reviewChannelId).catch(() => null);
        if (ch) ch.send({ embeds: [baseEmbed({ title: `${stars(o.rating)}  Review pembeli ${S().brand}`, description: `${o.review ? `“${o.review}”\n\n` : ''}**Pembeli:** <@${o.customerId}>\n**Produk:** ${o.productName}${o.qty > 1 ? ` ×${o.qty}` : ''}\n**Order:** #${o.no}`, thumbnail: it.user.displayAvatarURL({ size: 128 }), color: '#f5c542' }).setFooter({ text: `Rating rata-rata ${st.avg.toFixed(1)} ⭐ dari ${st.count} review` })], allowedMentions: { parse: [] } }).catch(() => {});
        cfg.addLog('Review shop', `#${o.no} ${o.rating}⭐ oleh ${it.user.username}`);
        if (it.message) it.message.edit({ components: [] }).catch(() => {});
        return it.reply({ content: `🙏 Makasih reviewnya (${stars(o.rating)})! Sudah tampil di channel review.` });
      }
    } catch (e) { const r = { content: '⚠️ ' + e.message, flags: MessageFlags.Ephemeral }; (it.deferred || it.replied ? it.editReply(r) : it.reply(r)).catch(() => {}); }
  });

  function routes(api) {
    api.get('/shop', (req, res) => res.json({ cfg: S(), ...D(), summary: summary(), cats: CATS, statuses: STATUS }));
    api.put('/shop/settings', (req, res) => { const s = S(); for (const k of ['catalogChannelId', 'logChannelId', 'title', 'footerNote']) if (req.body[k] !== undefined) { if (k === 'catalogChannelId' && s.catalogChannelId !== req.body[k]) s.catalogMessageId = ''; s[k] = String(req.body[k]); } cfg.save(); res.json({ ok: true }); });
    api.post('/shop/products', (req, res) => {
      const d = D(); const b = req.body; if (!String(b.name || '').trim()) return res.status(400).json({ error: 'Nama produk wajib' });
      let p = b.id && d.products.find((x) => x.id === b.id); if (!p) { p = { id: newId() }; d.products.push(p); }
      Object.assign(p, { name: String(b.name).slice(0, 80), category: CATS[b.category] ? b.category : 'lain', price: Math.max(0, Number(b.price) || 0), stock: b.stock === '' || b.stock == null ? '' : Number(b.stock), desc: String(b.desc || '').slice(0, 200), active: b.active !== false });
      cfg.save(); postCatalog().catch(() => {}); upsertMsg('priceChannelId', 'priceMessageId', { embeds: [priceEmbed('robux')] }).catch(() => {}); res.json(p);
    });
    api.delete('/shop/products/:id', (req, res) => { const d = D(); d.products = d.products.filter((p) => p.id !== req.params.id); cfg.save(); postCatalog().catch(() => {}); res.json({ ok: true }); });
    api.put('/shop/trolley', (req, res) => { const s = S(); const b = req.body;
      for (const k of ['brand', 'payInfo', 'guideText']) if (b[k] !== undefined) s[k] = String(b[k]).slice(0, 3000);
      for (const [k, m] of [['panelChannelId', 'panelMessageId'], ['priceChannelId', 'priceMessageId'], ['guideChannelId', 'guideMessageId']]) if (b[k] !== undefined && b[k] !== s[k]) { s[k] = String(b[k]); s[m] = ''; }
      if (b.reviewChannelId !== undefined) s.reviewChannelId = String(b.reviewChannelId);
      if (Array.isArray(b.staffRoleIds)) s.staffRoleIds = b.staffRoleIds.map(String);
      for (const k of ['dmBuyer', 'askReview']) if (b[k] !== undefined) s[k] = !!b[k];
      cfg.save(); res.json({ ok: true }); });
    api.post('/shop/trolley/post', async (req, res) => { try { res.json(await postAllTrolley()); } catch (e) { res.status(400).json({ error: e.message }); } });
    api.get('/shop/reviews', (req, res) => res.json({ ...reviewStats(), items: D().orders.filter((o) => o.rating).map((o) => ({ no: o.no, rating: o.rating, review: o.review, customerName: o.customerName, productName: o.productName, at: o.reviewAt })) }));
    api.post('/shop/catalog', async (req, res) => { try { res.json({ result: await postCatalog() }); } catch (e) { res.status(400).json({ error: e.message }); } });
    api.post('/shop/orders', (req, res) => { try { res.json(upsertOrder(req.body, req.session.user.username)); } catch (e) { res.status(400).json({ error: e.message }); } });
  }

  const commands = [new SlashCommandBuilder().setName('order').setDescription('Catat & kelola order TRO SHOP').setDefaultMemberPermissions(P.ManageMessages)
    .addSubcommand((s) => s.setName('catat').setDescription('Catat order baru (pakai di channel tiket)')
      .addUserOption((o) => o.setName('pembeli').setDescription('Pembeli').setRequired(true))
      .addStringOption((o) => o.setName('produk').setDescription('Nama produk').setRequired(true))
      .addIntegerOption((o) => o.setName('jumlah').setDescription('Jumlah (default 1)'))
      .addIntegerOption((o) => o.setName('total').setDescription('Total harga (kosong = otomatis dari katalog)'))
      .addStringOption((o) => o.setName('bayar').setDescription('Metode bayar (QRIS, Dana, dll)')))
    .addSubcommand((s) => s.setName('status').setDescription('Ubah status order')
      .addStringOption((o) => o.setName('nomor').setDescription('Nomor order, contoh 0001').setRequired(true))
      .addStringOption((o) => o.setName('status').setDescription('Status baru').setRequired(true).addChoices(...Object.entries(STATUS).map(([v, n]) => ({ name: n, value: v })))))
    .addSubcommand((s) => s.setName('list').setDescription('Lihat order yang masih aktif')).toJSON()];

  return { commands, routes, postCatalog };
}

module.exports = { setup };
