// ============================================================
//  🛒 TRO SHOP — produk (Robux / asset / script) & order
// ============================================================
const { Events, SlashCommandBuilder, MessageFlags, PermissionFlagsBits: P, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const cfg = require('./config');
const fs = require('fs');
const { danaCardPath } = require('./dana-card');

const newId = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 4);
const rp = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const CATS = { robux: '💰 Robux', asset: '🧩 Asset', script: '📜 Script', map: '🗺️ Map', jasa: '🛠️ Jasa', lain: '📦 Lainnya' };
const STATUS = { baru: '🆕 Baru', cek: '🔎 Cek bukti TF', dibayar: '💳 Dibayar', proses: '⚙️ Diproses', selesai: '✅ Selesai', batal: '❌ Batal' };

function setup({ client, baseEmbed }) {
  const S = () => {
    const s = cfg.get();
    if (!s.shop) s.shop = { catalogChannelId: '', catalogMessageId: '', logChannelId: '', staffRoleIds: [], title: '🛒 TRO SHOP — KATALOG', footerNote: 'Order lewat channel 「🎫」buka-tiket → Order Robux / Asset / Script.' };
    const x = s.shop;
    x.brand ??= 'TROlley'; x.orderTypeIds ??= ['robux', 'asset'];
    x.panelChannelId ??= ''; x.panelMessageId ??= ''; x.priceChannelId ??= ''; x.priceMessageId ??= ''; x.guideChannelId ??= ''; x.guideMessageId ??= '';
    x.reviewChannelId ??= ''; x.dmBuyer ??= true; x.askReview ??= true;
    // 💳 pembayaran DANA + harga Robux per 1.000
    x.robuxRate ??= 157000; x.robuxMin ??= 100; x.robuxTax ??= 0; x.robuxCost ??= 145000; x.danaNumber ??= ''; x.danaName ??= ''; x.danaLink ??= 'https://link.dana.id/minta?full_url=https://qr.dana.id/v1/281012012026030286102268&r=kYJ875'; x.proofChannelId ??= '';
    // 📦 tugas kirim Robux: DM ke penerima tugas setelah order dibayar
    x.deliverUserIds ??= ['563752367305261107', '1417817696048775190']; x.robloxGroupId ??= '901582211'; x.deliverRemindMin ??= 15;
    if (!x.payMigrated) { x.payMigrated = true; if (/saweria|qris|gopay|transfer bank/i.test(x.payInfo || '')) x.payInfo = ''; }
    x.payInfo ??= '';
    x.guideText ??= '**1.** Cek harga di 「💰」price-list-robux atau 「🛍️」katalog-shop\n**2.** Buka tiket di 「🎟️」open-ticket-robux → pilih jenis order\n**3.** Klik **Isi form order** di tiket → total harga keluar otomatis\n**4.** Bayar sesuai metode yang tertera, kirim bukti di tiket\n**5.** Staff proses pesanan → kamu dapat DM tiap status berubah\n**6.** Selesai! Kasih review bintang ⭐ lewat DM — tampil di 「⭐」review-cust-trolley\n\n⚠️ **Transaksi hanya lewat tiket resmi.** Staff TRO tidak pernah minta bayar lewat DM pribadi.';
    return x;
  };
  const D = () => cfg.data('shopData', { products: [], orders: [], counter: 0 });
  // via USN: tax 0% (Robux masuk utuh). Kalau suatu saat via gamepass, isi tax (mis. 30%) di dashboard → harga dihitung dari harga gamepass
  const gpPrice = (n) => { const t = Math.min(90, Math.max(0, Number(S().robuxTax) || 0)); return t ? Math.ceil((Number(n) || 0) * 100 / (100 - t)) : (Number(n) || 0); };
  const robuxPrice = (n) => Math.round(gpPrice(n) * (Number(S().robuxRate) || 157000) / 1000);
  const robuxCostOf = (n) => Math.round(gpPrice(n) * (Number(S().robuxCost) || 0) / 1000);
  // "1000", "1.000 robux", "1k rbx", "2,5k" → jumlah Robux; selain itu null
  function parseRobux(t) {
    const x = String(t || '').trim().toLowerCase();
    const m = x.match(/(?:r\$\s*)?(\d[\d.,]*)\s*(k|rb|ribu)?\s*(rbx|robux)/) || x.match(/^r\$\s*(\d[\d.,]*)\s*(k)?$/) || x.match(/^(\d[\d.]*)\s*(k|rb|ribu)?$/) || x.match(/^(\d+,\d+)\s*(k|rb|ribu)$/);
    if (!m) return null;
    const n = m[2] ? parseFloat(m[1].replace(/\./g, '').replace(',', '.')) * 1000 : parseInt(m[1].replace(/[.,]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }
  const payText = () => { const s = S();
    const hasQr = !!danaCardPath(s.danaLink);
    const to = s.danaNumber ? `→ **${s.danaNumber}**${s.danaName ? ` a.n. **${s.danaName}**` : ''}` : (hasQr || s.danaLink ? `→ ${hasQr ? '**scan QR DANA** di bawah' : ''}${hasQr && s.danaLink ? ' atau ' : ''}${s.danaLink ? 'klik tombol **Bayar via DANA**' : ''}` : '→ (nomor DANA belum diisi)');
    return `💳 Pembayaran **hanya via DANA** ${to}\n📸 Setelah transfer, **kirim screenshot bukti TF di tiket ini** — bot otomatis catat & staff konfirmasi.${s.payInfo ? `\n${s.payInfo}` : ''}`; };
  // QR DANA + tombol link, ikut dikirim bareng info pembayaran di tiket
  const payExtras = () => { const s = S(), out = { files: [], components: [], image: undefined };
    const qr = danaCardPath(s.danaLink); if (qr) { out.files.push(new AttachmentBuilder(qr, { name: 'dana-qr.png' })); out.image = 'attachment://dana-qr.png'; }
    if (/^https:\/\//.test(s.danaLink || '')) out.components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(s.danaLink).setLabel('Bayar via DANA').setEmoji('💳')));
    return out; };
  const isStaff = (m) => !!m && (m.permissions?.has(P.ManageMessages) || (S().staffRoleIds || []).some((r) => m.roles?.cache?.has(r)));

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
        ...(o.gamepass && o.gamepass > (o.robux || 0) ? [{ name: 'Harga gamepass', value: `**${o.gamepass.toLocaleString('id-ID')} Robux** (terima ${Number(o.robux || 0).toLocaleString('id-ID')} bersih)`, inline: true }] : []),
        ...(o.robloxUser ? [{ name: 'Username Roblox', value: o.robloxUser, inline: true }] : []),
        ...(o.danaName || o.danaNo ? [{ name: 'DANA pengirim', value: [o.danaName, o.danaNo].filter(Boolean).join(' · '), inline: true }] : []),
        ...(o.proof?.url ? [{ name: 'Bukti TF', value: `[Lihat bukti](${o.proof.url})${o.proof.msgUrl ? ` · [pesan di tiket](${o.proof.msgUrl})` : ''}`, inline: true }] : []),
        ...(o.note ? [{ name: 'Catatan', value: o.note }] : []),
      ],
      color: { selesai: '#30a46c', batal: '#7f8c8d', dibayar: '#3b82f6', proses: '#f59e0b', cek: '#a855f7' }[o.status],
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
    if (b.status && b.status !== o.status) { o.history.push({ from: o.status, to: b.status, by, at: new Date().toISOString() }); o.status = b.status; if (['proses', 'selesai'].includes(b.status)) o.handledBy = by; if (b.status === 'dibayar') { o.paidAt = new Date().toISOString(); setTimeout(() => sendDeliveryTask(o).catch((e) => console.error('[shop deliver]', e.message)), 500); } if (b.status === 'selesai') { o.doneAt = new Date().toISOString(); if (p && p.stock !== '' && p.stock != null) p.stock = Math.max(0, Number(p.stock) - qty); } }
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
        const o = upsertOrder({ customerId: it.options.getUser('pembeli').id, customerName: it.options.getUser('pembeli').username, productId: p?.id, productName: prod, qty: it.options.getInteger('jumlah') || 1, total: it.options.getInteger('total') ?? '', payment: it.options.getString('bayar') || 'DANA', ticketChannelId: it.channelId }, by);
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
    return baseEmbed({ title: cat === 'robux' ? `💰 PRICE LIST ROBUX — ${S().brand}` : `💰 DAFTAR HARGA — ${S().brand}`, description: list.length ? list.map((p) => `**${p.name}** — ${rp(p.price)}${p.stock !== '' && p.stock != null && Number(p.stock) <= 0 ? ' · ~~habis~~' : ''}${p.desc ? `\n> ${p.desc}` : ''}`).join('\n').slice(0, 4000) + `\n\n${payText()}` : 'Harga sedang diperbarui. Tanya staff lewat tiket ya 🙏', color: '#f5c542' });
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
    return { embeds: [baseEmbed({ title: `🛒 ${S().brand.toUpperCase()} — ORDER`, description: `Mau beli **Robux, asset, script, map, atau jasa**? Klik tombol di bawah → tiket privat kebuka → **isi form order** → bayar via **DANA** (scan QR / tombol di tiket) → **kirim screenshot bukti TF** → staff proses → beres.\n\n💰 Robux via USN: **${rp(S().robuxRate)} / 1.000 RBX** · nominal bebas, min. ${S().robuxMin} RBX\n💰 Harga: ${(S().priceChannelId || cfg.get().posts?.['price-list']?.channelId) ? `<#${S().priceChannelId || cfg.get().posts['price-list'].channelId}>` : 'lihat katalog'}${S().catalogChannelId ? ` · 🛍️ Katalog: <#${S().catalogChannelId}>` : ''} · 📖 Panduan: ${S().guideChannelId ? `<#${S().guideChannelId}>` : '-'}\n⭐ Review pembeli: ${S().reviewChannelId ? `<#${S().reviewChannelId}>` : '-'}\n\n_1 orang 1 tiket aktif. Transaksi hanya lewat tiket resmi._`, color: '#f5c542' })],
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
    const msg = { cek: 'Bukti transfer kamu **sudah diterima**, lagi dicek staff 🔎', dibayar: 'Pembayaran kamu sudah dikonfirmasi 💳', proses: 'Pesanan kamu sedang diproses ⚙️', selesai: 'Pesanan kamu **selesai**! Makasih udah belanja 🦉', batal: 'Pesanan kamu dibatalkan.' }[o.status];
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
        modal.addComponents(f('prod', 'Jumlah Robux / nama produk', 'contoh: 1000 Robux · 2500 rbx · nama asset', false), f('rbx', 'Username Roblox (USN) penerima', 'username akun Roblox, bukan display name', false), f('dname', 'Nama akun DANA kamu (pengirim)', 'nama yang muncul di DANA', false), f('dno', 'Nomor DANA kamu (pengirim)', '08xxxxxxxxxx', false, false), f('note', 'Catatan (opsional)', 'link gamepass / detail lain', true, false));
        return it.showModal(modal);
      }
      if (it.isModalSubmit() && it.customId.startsWith('tro-shopm:')) {
        const g = (k) => { try { return it.fields.getTextInputValue(k) || ''; } catch { return ''; } };
        const prod = g('prod'); const rbxN = parseRobux(prod); const p = rbxN ? null : findProduct(prod);
        if (rbxN && rbxN < (Number(S().robuxMin) || 0)) return it.reply({ content: `⚠️ Minimal order **${S().robuxMin} Robux**.`, flags: MessageFlags.Ephemeral });
        const qty = 1;
        const o = upsertOrder({ customerId: it.user.id, customerName: it.user.username, productId: p?.id, productName: rbxN ? `${rbxN.toLocaleString('id-ID')} Robux` : (p ? p.name : prod), category: rbxN ? 'robux' : p?.category, qty, total: rbxN ? robuxPrice(rbxN) : (p ? '' : 0), payment: 'DANA', note: g('note'), ticketChannelId: it.channelId }, `${it.user.username} (form)`);
        Object.assign(o, rbxN ? { gamepass: gpPrice(rbxN) > rbxN ? gpPrice(rbxN) : undefined, cost: robuxCostOf(rbxN), profit: o.total - robuxCostOf(rbxN) } : {}, { robux: rbxN || undefined, robloxUser: g('rbx').slice(0, 60), danaName: g('dname').slice(0, 60), danaNo: g('dno').replace(/[^\d+]/g, '').slice(0, 20) }); cfg.save(); setTimeout(() => logOrder(o).catch(() => {}), 4000);
        const known = rbxN || p; const px = payExtras();
        return it.reply({ content: (S().staffRoleIds || []).map((r) => `<@&${r}>`).join(' ') || undefined, embeds: [orderEmbed(o), baseEmbed({ title: '💳 Langkah berikutnya', description: `${known ? `Total yang harus dibayar: **${rp(o.total)}**${rbxN ? (gpPrice(rbxN) > rbxN ? `\n\n🎟️ **Bikin gamepass seharga ${gpPrice(rbxN).toLocaleString('id-ID')} Robux** (Roblox potong tax ${S().robuxTax}% → kamu terima **${rbxN.toLocaleString('id-ID')} Robux bersih**)` : `\n_${rbxN.toLocaleString('id-ID')} Robux × ${rp(S().robuxRate)} / 1.000 · via USN (username), Robux masuk utuh_`) : ''}` : '⚠️ Produk belum ada di katalog — staff akan konfirmasi harganya dulu, **jangan transfer dulu** sebelum harga dikonfirmasi.'}\n\n${payText()}`, color: '#f5c542', image: known ? px.image : undefined })], files: known ? px.files : [], components: known ? px.components : [], allowedMentions: { roles: S().staffRoleIds || [] } });
      }
      // ✅ / ❌ staff cek bukti TF
      if (it.isButton() && it.customId.startsWith('tro-pay:')) {
        const [, act, oid] = it.customId.split(':'); const o = D().orders.find((x) => x.id === oid);
        if (!o) return it.reply({ content: '❌ Order tidak ditemukan.', flags: MessageFlags.Ephemeral });
        if (!isStaff(it.member)) return it.reply({ content: '⛔ Cuma staff shop yang bisa konfirmasi pembayaran.', flags: MessageFlags.Ephemeral });
        if (act === 'ok') {
          upsertOrder({ id: o.id, status: 'dibayar' }, it.user.username);
          await it.update({ components: [] }).catch(() => {});
          return it.followUp({ content: `✅ Pembayaran order **#${o.no}** dikonfirmasi oleh ${it.user}. Pesanan segera diproses <@${o.customerId}> 🦉`, allowedMentions: { users: [o.customerId] } });
        }
        if (o.proof) o.proof.rejected = true;
        upsertOrder({ id: o.id, status: 'baru' }, it.user.username);
        await it.update({ components: [] }).catch(() => {});
        return it.followUp({ content: `❌ Bukti TF order **#${o.no}** belum valid (dicek oleh ${it.user}). <@${o.customerId}> tolong kirim ulang screenshot bukti transfer DANA yang jelas ya.`, allowedMentions: { users: [o.customerId] } });
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

  // 📦 kartu tugas kirim Robux → DM penerima tugas (USN dikirim terpisah biar gampang di-copy)
  const payoutUrl = () => `https://www.roblox.com/communities/configure?id=${S().robloxGroupId}#!/revenue/payouts`;
  function deliveryEmbed(o, doneBy) {
    return baseEmbed({ title: `📦 Kirim Robux — Order #${o.no}${doneBy ? ' ✅' : ''}`,
      description: doneBy ? `✅ **Sudah dikirim** oleh **${doneBy}** <t:${Math.floor(Date.now() / 1000)}:R>.` : `Pembayaran **sudah dikonfirmasi**. Kirim Robux lewat **One-time Payout** grup, lalu klik **Robux sudah dikirim**.\nUsername dikirim terpisah di bawah — tahan & **Copy**.`,
      fields: [
        { name: 'Username Roblox (USN)', value: o.robloxUser ? `\`${o.robloxUser}\`` : '⚠️ belum diisi — cek tiket', inline: true },
        { name: 'Jumlah', value: `**${o.robux ? Number(o.robux).toLocaleString('id-ID') + ' Robux' : o.productName}**`, inline: true },
        { name: 'Total dibayar', value: rp(o.total), inline: true },
        { name: 'Pembeli', value: `<@${o.customerId}>`, inline: true },
        { name: 'Tiket', value: o.ticketChannelId ? `<#${o.ticketChannelId}>` : '-', inline: true },
      ], color: doneBy ? '#30a46c' : '#f59e0b' });
  }
  function deliveryRow(o, disabled) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`tro-dlv:done:${o.id}`).setLabel('Robux sudah dikirim').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(!!disabled),
      new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(payoutUrl()).setLabel('Buka One-time Payout').setEmoji('💸'),
      ...(o.robloxUser ? [new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(`https://www.roblox.com/search/users?keyword=${encodeURIComponent(o.robloxUser)}`).setLabel('Cek profil').setEmoji('🔎')] : []));
  }
  async function sendDeliveryTask(o, reminder) {
    if (o.status !== 'dibayar') return;
    o.deliveryMsgs ??= [];
    for (const uid of S().deliverUserIds || []) {
      const u = await client.users.fetch(uid).catch(() => null); if (!u) continue;
      const m = await u.send({ content: reminder ? `⏰ **Pengingat:** order #${o.no} sudah dibayar tapi Robux belum dikirim.` : undefined, embeds: [deliveryEmbed(o)], components: [deliveryRow(o)] }).catch(() => null);
      if (!m) continue;
      o.deliveryMsgs.push({ ch: m.channelId, id: m.id });
      if (o.robloxUser) await u.send({ content: o.robloxUser }).catch(() => {});
    }
    cfg.save();
  }
  // pengingat kalau sudah dibayar tapi belum dikirim
  setInterval(() => {
    const lim = (Number(S().deliverRemindMin) || 15) * 60e3, now = Date.now();
    for (const o of D().orders) {
      if (o.status !== 'dibayar' || !o.paidAt) continue;
      const last = o.remindedAt ? new Date(o.remindedAt).getTime() : new Date(o.paidAt).getTime();
      if (now - last >= lim && (o.reminders || 0) < 3) { o.remindedAt = new Date().toISOString(); o.reminders = (o.reminders || 0) + 1; sendDeliveryTask(o, true).catch(() => {}); }
    }
  }, 60e3).unref?.();
  client.on(Events.InteractionCreate, async (it) => {
    if (!it.isButton() || !it.customId.startsWith('tro-dlv:')) return;
    try {
      const o = D().orders.find((x) => x.id === it.customId.split(':')[2]);
      if (!o) return it.reply({ content: '❌ Order tidak ditemukan.', flags: MessageFlags.Ephemeral });
      if (!(S().deliverUserIds || []).includes(it.user.id) && !isStaff(it.member)) return it.reply({ content: '⛔ Kamu bukan penerima tugas kirim Robux.', flags: MessageFlags.Ephemeral });
      if (o.status === 'selesai') return it.reply({ content: `✅ Order #${o.no} sudah ditandai selesai${o.deliveredBy ? ` oleh ${o.deliveredBy}` : ''}.`, flags: MessageFlags.Ephemeral });
      o.deliveredBy = it.user.username; o.deliveredAt = new Date().toISOString();
      upsertOrder({ id: o.id, status: 'selesai' }, `${it.user.username} (kirim Robux)`);
      await it.update({ embeds: [deliveryEmbed(o, it.user.username)], components: [deliveryRow(o, true)] }).catch(() => {});
      for (const d of o.deliveryMsgs || []) { if (d.id === it.message?.id) continue; const ch = await client.channels.fetch(d.ch).catch(() => null); const m = ch && await ch.messages.fetch(d.id).catch(() => null); if (m) m.edit({ embeds: [deliveryEmbed(o, it.user.username)], components: [deliveryRow(o, true)] }).catch(() => {}); }
      const tk = o.ticketChannelId && await client.channels.fetch(o.ticketChannelId).catch(() => null);
      if (tk) tk.send({ content: `<@${o.customerId}>`, embeds: [baseEmbed({ title: `✅ Robux terkirim — Order #${o.no}`, description: `**${o.robux ? Number(o.robux).toLocaleString('id-ID') + ' Robux' : o.productName}** sudah dikirim ke **${o.robloxUser || 'akun kamu'}** 🦉\nCek di Roblox ya (riwayat Robux / Transactions). Makasih udah belanja di ${S().brand}! Rating bisa lewat DM dari bot.`, color: '#30a46c' })], allowedMentions: { users: [o.customerId] } }).catch(() => {});
    } catch (e) { it.reply({ content: '⚠️ ' + e.message, flags: MessageFlags.Ephemeral }).catch(() => {}); }
  });

  // 📸 terima bukti TF: pembeli kirim gambar di tiket yang punya order menunggu bayar
  client.on(Events.MessageCreate, async (msg) => {
    try {
      if (!msg.guild || msg.author.bot || !msg.attachments?.size) return;
      const img = [...msg.attachments.values()].find((a) => /^image\//.test(a.contentType || '') || /\.(png|jpe?g|webp|gif|heic)$/i.test(a.name || ''));
      if (!img) return;
      const o = D().orders.find((x) => x.ticketChannelId === msg.channelId && x.customerId === msg.author.id && ['baru', 'cek'].includes(x.status));
      if (!o) return;
      let url = img.url;
      const keepCh = (S().proofChannelId || S().logChannelId) && await client.channels.fetch(S().proofChannelId || S().logChannelId).catch(() => null);
      if (keepCh) { const kept = await keepCh.send({ content: `📸 Bukti TF order **#${o.no}** dari <@${o.customerId}> · total ${rp(o.total)}`, files: [new AttachmentBuilder(img.url, { name: img.name || 'bukti.png' })], allowedMentions: { parse: [] } }).catch(() => null); if (kept?.attachments?.first()) url = kept.attachments.first().url; }
      o.proof = { url, msgUrl: msg.url, at: new Date().toISOString() }; o.proofs = [...(o.proofs || []), o.proof].slice(-5);
      upsertOrder({ id: o.id, status: 'cek' }, `${msg.author.username} (bukti TF)`);
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`tro-pay:ok:${o.id}`).setLabel('Konfirmasi dibayar').setEmoji('✅').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`tro-pay:no:${o.id}`).setLabel('Bukti tidak valid').setEmoji('❌').setStyle(ButtonStyle.Danger));
      await msg.reply({ content: (S().staffRoleIds || []).map((r) => `<@&${r}>`).join(' ') || undefined, embeds: [baseEmbed({ title: `🔎 Bukti TF diterima — Order #${o.no}`, description: `Makasih ${msg.author}! Bukti transfer kamu sudah **tercatat**. Staff akan cek mutasi DANA lalu konfirmasi.\n\n**Order:** ${o.productName}\n**Total:** ${rp(o.total)}\n**Username Roblox:** ${o.robloxUser || '-'}\n**DANA pengirim:** ${[o.danaName, o.danaNo].filter(Boolean).join(' · ') || '-'}`, image: url, color: '#a855f7' })], components: [row], allowedMentions: { roles: S().staffRoleIds || [] } });
      client.notifyStaff?.('order', { title: `Bukti TF masuk — Order #${o.no}`, description: `**Pembeli:** <@${o.customerId}>\n**Order:** ${o.productName} · **Total:** ${rp(o.total)}\n**DANA pengirim:** ${[o.danaName, o.danaNo].filter(Boolean).join(' · ') || '-'}\n**Tiket:** <#${o.ticketChannelId}>\nCek mutasi DANA lalu klik ✅ Konfirmasi di tiket.` });
    } catch (e) { console.error('[shop proof]', e.message); }
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
      for (const k of ['brand', 'payInfo', 'guideText', 'danaNumber', 'danaName', 'danaLink', 'proofChannelId']) if (b[k] !== undefined) s[k] = String(b[k]).slice(0, 3000);
      for (const k of ['robuxRate', 'robuxMin', 'robuxTax', 'robuxCost']) if (b[k] !== undefined && b[k] !== '' && Number(b[k]) >= 0) s[k] = Math.round(Number(b[k]));
      for (const [k, m] of [['panelChannelId', 'panelMessageId'], ['priceChannelId', 'priceMessageId'], ['guideChannelId', 'guideMessageId']]) if (b[k] !== undefined && b[k] !== s[k]) { s[k] = String(b[k]); s[m] = ''; }
      if (b.reviewChannelId !== undefined) s.reviewChannelId = String(b.reviewChannelId);
      if (Array.isArray(b.staffRoleIds)) s.staffRoleIds = b.staffRoleIds.map(String);
      if (Array.isArray(b.deliverUserIds)) s.deliverUserIds = b.deliverUserIds.map(String).filter((x) => /^\d{15,}$/.test(x));
      if (b.robloxGroupId !== undefined) s.robloxGroupId = String(b.robloxGroupId).replace(/\D/g, '');
      if (b.deliverRemindMin !== undefined && Number(b.deliverRemindMin) >= 0) s.deliverRemindMin = Number(b.deliverRemindMin);
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
      .addStringOption((o) => o.setName('bayar').setDescription('Metode bayar (default DANA)')))
    .addSubcommand((s) => s.setName('status').setDescription('Ubah status order')
      .addStringOption((o) => o.setName('nomor').setDescription('Nomor order, contoh 0001').setRequired(true))
      .addStringOption((o) => o.setName('status').setDescription('Status baru').setRequired(true).addChoices(...Object.entries(STATUS).map(([v, n]) => ({ name: n, value: v })))))
    .addSubcommand((s) => s.setName('list').setDescription('Lihat order yang masih aktif')).toJSON()];

  client.trolley = { robuxPrice, gpPrice, payText, rate: () => S().robuxRate };
  return { commands, routes, postCatalog };
}

module.exports = { setup };
