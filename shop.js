// ============================================================
//  🛒 TRO SHOP — produk (Robux / asset / script) & order
// ============================================================
const { Events, SlashCommandBuilder, MessageFlags, PermissionFlagsBits: P, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cfg = require('./config');

const newId = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 4);
const rp = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const CATS = { robux: '💰 Robux', asset: '🧩 Asset', script: '📜 Script', map: '🗺️ Map', jasa: '🛠️ Jasa', lain: '📦 Lainnya' };
const STATUS = { baru: '🆕 Baru', dibayar: '💳 Dibayar', proses: '⚙️ Diproses', selesai: '✅ Selesai', batal: '❌ Batal' };

function setup({ client, baseEmbed }) {
  const S = () => {
    const s = cfg.get();
    if (!s.shop) s.shop = { catalogChannelId: '', catalogMessageId: '', logChannelId: '', staffRoleIds: [], title: '🛒 TRO SHOP — KATALOG', footerNote: 'Order lewat channel 「🎫」buka-tiket → Order Robux / Asset / Script.' };
    return s.shop;
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
    if (!o) { d.counter += 1; o = { id: newId(), no: String(d.counter).padStart(4, '0'), createdAt: new Date().toISOString(), createdBy: by, status: 'baru', history: [] }; d.orders.unshift(o); }
    Object.assign(o, {
      customerId: String(b.customerId || o.customerId || '').replace(/\D/g, ''), customerName: String(b.customerName ?? o.customerName ?? '').slice(0, 80),
      productId: p?.id || o.productId || '', productName: p?.name || String(b.productName || o.productName || 'Custom').slice(0, 100), category: p?.category || b.category || o.category || 'lain',
      qty, total: b.total !== undefined && b.total !== '' ? Number(b.total) : (p ? p.price * qty : Number(o.total) || 0),
      payment: String(b.payment ?? o.payment ?? '').slice(0, 60), note: String(b.note ?? o.note ?? '').slice(0, 500), ticketChannelId: String(b.ticketChannelId ?? o.ticketChannelId ?? ''),
    });
    if (b.status && b.status !== o.status) { o.history.push({ from: o.status, to: b.status, by, at: new Date().toISOString() }); o.status = b.status; if (['proses', 'selesai'].includes(b.status)) o.handledBy = by; if (b.status === 'selesai') { o.doneAt = new Date().toISOString(); if (p && p.stock !== '' && p.stock != null) p.stock = Math.max(0, Number(p.stock) - qty); } }
    cfg.save();
    logOrder(o, b.status ? `Status → ${STATUS[o.status]} oleh ${by}` : `Order dicatat oleh ${by}`).catch(() => {});
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

  function routes(api) {
    api.get('/shop', (req, res) => res.json({ cfg: S(), ...D(), summary: summary(), cats: CATS, statuses: STATUS }));
    api.put('/shop/settings', (req, res) => { const s = S(); for (const k of ['catalogChannelId', 'logChannelId', 'title', 'footerNote']) if (req.body[k] !== undefined) { if (k === 'catalogChannelId' && s.catalogChannelId !== req.body[k]) s.catalogMessageId = ''; s[k] = String(req.body[k]); } cfg.save(); res.json({ ok: true }); });
    api.post('/shop/products', (req, res) => {
      const d = D(); const b = req.body; if (!String(b.name || '').trim()) return res.status(400).json({ error: 'Nama produk wajib' });
      let p = b.id && d.products.find((x) => x.id === b.id); if (!p) { p = { id: newId() }; d.products.push(p); }
      Object.assign(p, { name: String(b.name).slice(0, 80), category: CATS[b.category] ? b.category : 'lain', price: Math.max(0, Number(b.price) || 0), stock: b.stock === '' || b.stock == null ? '' : Number(b.stock), desc: String(b.desc || '').slice(0, 200), active: b.active !== false });
      cfg.save(); postCatalog().catch(() => {}); res.json(p);
    });
    api.delete('/shop/products/:id', (req, res) => { const d = D(); d.products = d.products.filter((p) => p.id !== req.params.id); cfg.save(); postCatalog().catch(() => {}); res.json({ ok: true }); });
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
