// ============================================================
//  🛒 TRO LABS — TOKO SCRIPT OTOMATIS (tanpa staff) — BY TRO TEAM AZAZEL
//  Alur: buyer pilih script -> dapat KODE BELI unik + link Bagi-Bagi (nominal & kode keisi)
//        -> buyer bayar (kode ikut di pesan) -> webhook Bagi-Bagi nangkep
//        -> bot cocokin kode+nominal -> OTOMATIS: terbit lisensi + link download -> DM buyer.
//  Nol campur tangan orang. Kalau kode nggak cocok -> pembayaran tetap jadi donasi biasa (duit aman).
//  Integrasi:
//    - client.labsCekBeli(payment)  dipanggil bagibagi.js tiap ada pembayaran (lihat hook di bagibagi.js)
//    - client.labsTerbitLisensi(...) dari labslisensi.js buat nerbitin kunci
//  File script (udah diobfuscate) disimpan di data/labs-produk/<id>.lua, dikirim lewat link bertoken.
//  Data di cfg.data('labstoko') — nggak nyentuh data modul lain.
// ============================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const cfg = require('./config');

const GOLD = 0xf5c542;
const now = () => new Date().toISOString();
const DIR = path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'labs-produk');
fs.mkdirSync(DIR, { recursive: true });
const fileProduk = (id) => path.join(DIR, `${String(id).replace(/[^\w-]/g, '')}.lua`);

function setup({ client }) {
  const D = () => cfg.data('labstoko', {
    produk: [],   // { id, nama, hargaRp, kodeProduk, desc, aktif, adaFile }
    sales: [],    // { kode, produkId, nama, hargaRp, kodeProduk, status, buyerId, buyerName, buatAt, bayar, lunasAt, lisensiKey, unduhToken, unduhCount }
    counter: 0,
    katalogChannelId: '', katalogMessageId: '',
    bagibagiUrl: 'https://bagibagi.co/TRO_LABS',
  });

  const rngKode = (n) => { const H = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({ length: n }, () => H[crypto.randomInt(H.length)]).join(''); };
  const produkById = (id) => (D().produk || []).find((p) => p.id === id);
  const normal = (s) => String(s || '').toUpperCase().replace(/\s+/g, '');
  // cara pasang yang dikirim ke buyer: kalau produk punya require-asset -> loader 1 baris (kode asli ketutup di Roblox);
  // kalau belum -> link download file.
  function caraPasang(produk, key, link) {
    const aid = produk && produk.requireAssetId;
    if (aid) {
      return `**📦 Pasang (tempel di Script, sisi server):**\n\`\`\`lua\nrequire(${aid})("${key}")\n\`\`\`\n> Nyalain **Allow HTTP Requests** di Game Settings › Security.`;
    }
    return `**⬇️ Download script:**\n${link}`;
  }

  // buat sesi beli -> kode unik yang nanti dicocokin di pesan Bagi-Bagi
  function buatSale(produk, buyer) {
    const d = D();
    let kode; do { kode = `BELI-${rngKode(5)}`; } while ((d.sales || []).some((s) => s.kode === kode));
    const sale = {
      kode, produkId: produk.id, nama: produk.nama, hargaRp: produk.hargaRp, kodeProduk: produk.kodeProduk,
      status: 'nunggu', buyerId: buyer?.id || '', buyerName: buyer?.username || '', buatAt: now(),
      bayar: null, lunasAt: null, lisensiKey: '', unduhToken: '', unduhCount: 0,
    };
    d.sales.unshift(sale); d.sales = d.sales.slice(0, 3000); cfg.save();
    return sale;
  }

  const linkBayar = (sale) => {
    const base = D().bagibagiUrl || 'https://bagibagi.co/TRO_LABS';
    const msg = encodeURIComponent(`${sale.kode} - ${sale.nama}`);
    return `${base}?amount=${sale.hargaRp}&message=${msg}`;
  };

  // ---------- PEMENUHAN OTOMATIS: dipanggil dari webhook Bagi-Bagi ----------
  // return true kalau pembayaran ini cocok sama order script (jadi bagibagi nggak anggap donasi map)
  client.labsCekBeli = async (payment) => {
    try {
      const pesan = String(payment.message || payment.m || '');
      const amount = Math.floor(Number(payment.amount ?? payment.r) || 0);
      const d = D();
      // cari kode BELI-XXXXX di dalam pesan
      const m = normal(pesan).match(/BELI-?([A-Z0-9]{5})/);
      if (!m) return false;
      const kode = `BELI-${m[1]}`;
      const sale = (d.sales || []).find((s) => s.kode === kode);
      if (!sale) return false;
      if (sale.status === 'lunas') return true; // udah diproses, jangan dobel & jangan jadi donasi
      if (amount < sale.hargaRp) {
        // bayar kurang: catat, tetap dihitung order (biar nggak jadi donasi), tunggu pelunasan manual
        sale.bayar = { id: payment.id || payment.i || '', amount, kurang: sale.hargaRp - amount, at: now() };
        cfg.save();
        kirimLog(`⚠️ Order **${kode}** (${sale.nama}) dibayar **Rp${amount.toLocaleString('id-ID')}**, kurang Rp${(sale.hargaRp - amount).toLocaleString('id-ID')}. Ditahan.`);
        return true;
      }
      await lunasin(sale, payment);
      return true;
    } catch (e) { D().lastError = String(e.message || e); cfg.save(); return false; }
  };

  async function lunasin(sale, payment) {
    const d = D();
    sale.status = 'lunas'; sale.lunasAt = now();
    sale.bayar = { id: payment.id || payment.i || '', amount: Math.floor(Number(payment.amount ?? payment.r) || 0), nama: String(payment.name || payment.n || ''), at: now() };
    // 1) terbitkan lisensi (lewat modul lisensi)
    let key = '';
    if (client.labsTerbitLisensi) {
      const row = await client.labsTerbitLisensi({ produk: sale.kodeProduk || sale.nama, orderNo: sale.kode, buyerId: sale.buyerId, buyerName: sale.buyerName });
      key = row.key; sale.lisensiKey = key;
    }
    // 2) bikin token download (berlaku, bisa diunduh beberapa kali)
    sale.unduhToken = crypto.randomBytes(16).toString('hex');
    cfg.save();
    const link = `${baseUrl()}/labs/unduh/${sale.unduhToken}`;
    kirimLog(`✅ Order **${sale.kode}** LUNAS — ${sale.nama} · Rp${sale.hargaRp.toLocaleString('id-ID')}${sale.buyerId ? ` · <@${sale.buyerId}>` : ''} · key \`${key}\``);
    // 3) DM buyer: key + link download
    if (sale.buyerId) {
      const u = await client.users.fetch(sale.buyerId).catch(() => null);
      const produk = produkById(sale.produkId);
      if (u) await u.send({ embeds: [new EmbedBuilder().setColor(GOLD).setTitle(`✅ Pembelian ${sale.nama} berhasil!`)
        .setDescription(`Makasih udah beli di **TRO LABS** 🦉\n\n**🔑 Kunci lisensi:**\n\`\`\`${key || '(hubungi staff)'}\`\`\`\n${caraPasang(produk, key, link)}\n\nJalanin game — otomatis aktif & **terkunci ke akun/komunitas kamu**.\n✅ Bebas dipakai di **semua map** di bawah akun/komunitas yang sama.\n⚠️ Kunci ini pribadi — jangan dibagiin.`)
        .setFooter({ text: 'TRO LABS • Positive Community & Dev' })] }).catch(() => {});
    }
    return sale;
  }

  function baseUrl() {
    return (process.env.PUBLIC_URL || 'http://202.155.132.231').replace(/\/+$/, '');
  }
  function logChannel() {
    const g = client.guilds.cache.get(process.env.GUILD_ID); if (!g) return null;
    const d = D();
    if (d.logChannelId) return g.channels.cache.get(d.logChannelId) || null;
    return g.channels.cache.find((c) => c.isTextBased?.() && /toko-log|labs-log|jual|lisensi/i.test(c.name)) || null;
  }
  function kirimLog(teks) { const ch = logChannel(); if (!ch) return; ch.send({ embeds: [new EmbedBuilder().setColor(GOLD).setDescription(teks).setTimestamp()] }).catch(() => {}); }

  // ---------- BELI VIA ROBUX: dipanggil server game showcase (ProcessReceipt) ----------
  // Diamanin pakai LABS_GAME_SECRET di .env — cuma game kita yang bisa nerbitin lisensi.
  // Body: { secret, kodeProduk, robloxUserId, robloxName, receiptId, robux }
  // Return: { ok, key, link } -> game tampilin ke buyer.
  async function beliRobux(body) {
    if (!process.env.LABS_GAME_SECRET || String(body.secret || '') !== process.env.LABS_GAME_SECRET) return { ok: false, pesan: 'ditolak' };
    const kodeProduk = String(body.kodeProduk || '').slice(0, 60);
    const uid = String(body.robloxUserId || '').replace(/\D/g, '');
    const receiptId = String(body.receiptId || '').slice(0, 120);
    if (!kodeProduk || !uid) return { ok: false, pesan: 'data kurang' };
    const d = D();
    // dedupe by receiptId (Roblox bisa ngirim ulang ProcessReceipt)
    if (receiptId) { const lama = (d.sales || []).find((s) => s.bayar && s.bayar.receiptId === receiptId); if (lama) return { ok: true, key: lama.lisensiKey, link: `${baseUrl()}/labs/unduh/${lama.unduhToken}`, ulang: true }; }
    const produk = (d.produk || []).find((p) => p.kodeProduk.toLowerCase() === kodeProduk.toLowerCase()) || { id: null, nama: kodeProduk, kodeProduk };
    let key = '';
    if (client.labsTerbitLisensi) { const row = await client.labsTerbitLisensi({ produk: produk.kodeProduk, orderNo: `RBX-${receiptId.slice(-6) || rngKode(5)}`, buyerName: String(body.robloxName || `Roblox:${uid}`) }); key = row.key; }
    const token = crypto.randomBytes(16).toString('hex');
    const sale = { kode: `RBX-${rngKode(5)}`, produkId: produk.id, nama: produk.nama, hargaRp: 0, kodeProduk: produk.kodeProduk, status: 'lunas', buyerId: '', buyerName: String(body.robloxName || ''), robloxUserId: uid, buatAt: now(), bayar: { via: 'robux', robux: Math.floor(Number(body.robux) || 0), receiptId, at: now() }, lunasAt: now(), lisensiKey: key, unduhToken: token, unduhCount: 0 };
    d.sales.unshift(sale); d.sales = d.sales.slice(0, 3000); cfg.save();
    kirimLog(`✅ Beli via **Robux** — ${sale.nama} · R$${sale.bayar.robux} · Roblox \`${uid}\` (${body.robloxName || ''}) · key \`${key}\``);
    const link = `${baseUrl()}/labs/unduh/${token}`;
    // buat game showcase: kalau produk punya require-asset, kasih loader siap tempel
    const loader = produk.requireAssetId ? `require(${produk.requireAssetId})("${key}")` : '';
    return { ok: true, key, link, loader, requireAssetId: produk.requireAssetId || 0 };
  }

  // ---------- endpoint publik: download file bertoken + beli-robux ----------
  function publicRoutes(app) {
    app.post('/labs/robux-beli', async (req, res) => { res.set('Cache-Control', 'no-store'); try { res.json(await beliRobux(req.body || {})); } catch (e) { res.status(500).json({ ok: false, pesan: 'error' }); } });
    app.get('/labs/unduh/:token', (req, res) => {
      const sale = (D().sales || []).find((s) => s.unduhToken && s.unduhToken === String(req.params.token));
      if (!sale || sale.status !== 'lunas') return res.status(404).send('Link download tidak valid / sudah tidak berlaku.');
      const f = fileProduk(sale.produkId);
      if (!fs.existsSync(f)) return res.status(503).send('File produk belum tersedia. Hubungi staff TRO LABS.');
      sale.unduhCount = (sale.unduhCount || 0) + 1; cfg.save();
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${String(sale.nama).replace(/[^\w.-]/g, '_')}.lua"`);
      res.send(fs.readFileSync(f, 'utf8'));
    });
  }

  // ---------- dashboard ----------
  function routes(api) {
    api.get('/labs/toko', (req, res) => { const d = D(); res.json({ produk: d.produk, sales: (d.sales || []).slice(0, 100) }); });
  }

  // ---------- katalog (pilih produk -> kode beli) ----------
  function katalogPesan() {
    const ps = (D().produk || []).filter((p) => p.aktif !== false);
    const e = new EmbedBuilder().setColor(GOLD).setTitle('🛒 TRO LABS — Script Store').setFooter({ text: 'TRO LABS • Positive Community & Dev' })
      .setDescription(ps.length
        ? `Pilih script di menu bawah → dapat kode & link bayar → bayar lewat Bagi-Bagi → **otomatis** dikirim lisensi + link download ke DM kamu 🦉\n\n${ps.map((p) => `**${p.nama}** — Rp${Number(p.hargaRp).toLocaleString('id-ID')}${p.desc ? `\n> ${p.desc}` : ''}`).join('\n\n')}\n\n⚙️ 1 lisensi = 1 akun / komunitas, bebas dipakai di semua map kamu.`
        : 'Produk lagi disiapin, cek lagi nanti ya 🙏');
    const comp = ps.length ? [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('labstoko:pilih').setPlaceholder('🛍️ Pilih script yang mau dibeli')
      .addOptions(ps.slice(0, 25).map((p) => ({ label: p.nama.slice(0, 100), description: `Rp${Number(p.hargaRp).toLocaleString('id-ID')}`.slice(0, 100), value: p.id }))))] : [];
    return { embeds: [e], components: comp };
  }

  // ---------- slash command ----------
  const command = new SlashCommandBuilder().setName('toko').setDescription('TRO LABS — toko script otomatis')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('produk-tambah').setDescription('Tambah produk script')
      .addStringOption((o) => o.setName('nama').setDescription('Nama produk').setRequired(true))
      .addIntegerOption((o) => o.setName('harga').setDescription('Harga (Rp)').setRequired(true))
      .addStringOption((o) => o.setName('kode').setDescription('Kode produk (buat lisensi, mis. anti-afk)').setRequired(true))
      .addStringOption((o) => o.setName('desc').setDescription('Deskripsi singkat')))
    .addSubcommand((s) => s.setName('produk-file').setDescription('Upload file .lua (udah diobfuscate) buat produk')
      .addStringOption((o) => o.setName('produk').setDescription('ID / nama produk').setRequired(true).setAutocomplete(true))
      .addAttachmentOption((o) => o.setName('file').setDescription('File .lua final').setRequired(true)))
    .addSubcommand((s) => s.setName('produk-asset').setDescription('Setel Require Asset ID produk (model aman, kode ketutup)')
      .addStringOption((o) => o.setName('produk').setDescription('ID / nama produk').setRequired(true).setAutocomplete(true))
      .addStringOption((o) => o.setName('asset_id').setDescription('Asset ID ModuleScript yang di-upload').setRequired(true)))
    .addSubcommand((s) => s.setName('produk-list').setDescription('Daftar produk'))
    .addSubcommand((s) => s.setName('produk-hapus').setDescription('Hapus produk')
      .addStringOption((o) => o.setName('produk').setDescription('ID / nama produk').setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('katalog').setDescription('Kirim / update katalog di channel ini'))
    .addSubcommand((s) => s.setName('sales').setDescription('Penjualan terbaru'));

  async function handle(it) {
    const sub = it.options.getSubcommand();
    const d = D(); const E = (x) => new EmbedBuilder().setColor(GOLD).setDescription(x);
    const resolveProduk = (q) => produkById(q) || (d.produk || []).find((p) => p.nama.toLowerCase() === String(q).toLowerCase());
    if (sub === 'produk-tambah') {
      d.counter += 1; const id = `p${d.counter}`;
      const p = { id, nama: it.options.getString('nama').slice(0, 80), hargaRp: Math.max(0, it.options.getInteger('harga')), kodeProduk: it.options.getString('kode').slice(0, 60), desc: (it.options.getString('desc') || '').slice(0, 200), aktif: true, adaFile: false };
      d.produk.push(p); cfg.save();
      await it.reply({ embeds: [E(`✅ Produk **${p.nama}** (ID \`${id}\`) ditambah — Rp${p.hargaRp.toLocaleString('id-ID')}, kode lisensi \`${p.kodeProduk}\`.\nUpload file-nya: \`/toko produk-file\`.`)], flags: MessageFlags.Ephemeral });
    } else if (sub === 'produk-file') {
      const p = resolveProduk(it.options.getString('produk')); if (!p) return it.reply({ content: '❌ Produk nggak ketemu.', flags: MessageFlags.Ephemeral }), true;
      const att = it.options.getAttachment('file');
      await it.deferReply({ flags: MessageFlags.Ephemeral });
      const r = await fetch(att.url); const teks = await r.text();
      fs.writeFileSync(fileProduk(p.id), teks, 'utf8'); p.adaFile = true; cfg.save();
      await it.editReply({ embeds: [E(`✅ File buat **${p.nama}** kesimpen (${teks.length.toLocaleString('id-ID')} karakter). Siap dijual.`)] });
    } else if (sub === 'produk-asset') {
      const p = resolveProduk(it.options.getString('produk')); if (!p) return it.reply({ content: '❌ Produk nggak ketemu.', flags: MessageFlags.Ephemeral }), true;
      const aid = String(it.options.getString('asset_id')).replace(/\D/g, '');
      if (!aid) return it.reply({ content: '❌ Asset ID harus angka.', flags: MessageFlags.Ephemeral }), true;
      p.requireAssetId = aid; cfg.save();
      await it.reply({ embeds: [E(`✅ **${p.nama}** disetel ke require-asset \`${aid}\`.\nBuyer bakal dapet loader: \`require(${aid})("KUNCI")\` — kode asli ketutup di Roblox.`)], flags: MessageFlags.Ephemeral });
    } else if (sub === 'produk-list') {
      await it.reply({ embeds: [E((d.produk || []).length ? d.produk.map((p) => `\`${p.id}\` **${p.nama}** — Rp${Number(p.hargaRp).toLocaleString('id-ID')} · lisensi \`${p.kodeProduk}\` · ${p.requireAssetId ? `🔒 asset ${p.requireAssetId}` : (p.adaFile ? '📄 file' : '⚠️ belum ada asset/file')}${p.aktif === false ? ' · 🚫nonaktif' : ''}`).join('\n') : 'Belum ada produk.')], flags: MessageFlags.Ephemeral });
    } else if (sub === 'produk-hapus') {
      const p = resolveProduk(it.options.getString('produk')); if (!p) return it.reply({ content: '❌ Produk nggak ketemu.', flags: MessageFlags.Ephemeral }), true;
      d.produk = d.produk.filter((x) => x.id !== p.id); try { fs.unlinkSync(fileProduk(p.id)); } catch {} cfg.save();
      await it.reply({ embeds: [E(`🗑️ Produk **${p.nama}** dihapus.`)], flags: MessageFlags.Ephemeral });
    } else if (sub === 'katalog') {
      const msg = await it.channel.send(katalogPesan());
      d.katalogChannelId = it.channel.id; d.katalogMessageId = msg.id; cfg.save();
      await it.reply({ content: '✅ Katalog dikirim.', flags: MessageFlags.Ephemeral });
    } else if (sub === 'sales') {
      const ss = (d.sales || []).slice(0, 12);
      await it.reply({ embeds: [E(ss.length ? ss.map((s) => `\`${s.kode}\` ${s.status === 'lunas' ? '✅' : '⏳'} ${s.nama} · Rp${Number(s.hargaRp).toLocaleString('id-ID')}${s.buyerId ? ` · <@${s.buyerId}>` : ''}`).join('\n') : 'Belum ada penjualan.')], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    }
    return true;
  }

  // buyer pilih produk dari katalog -> kasih kode + link bayar
  async function handleSelect(it) {
    const p = produkById(it.values[0]);
    if (!p) return it.reply({ content: '❌ Produk nggak ada lagi.', flags: MessageFlags.Ephemeral });
    const sale = buatSale(p, it.user);
    const link = linkBayar(sale);
    await it.reply({ embeds: [new EmbedBuilder().setColor(GOLD).setTitle(`🛒 Order ${p.nama}`)
      .setDescription(`Harga: **Rp${Number(p.hargaRp).toLocaleString('id-ID')}**\nKode order kamu: **\`${sale.kode}\`**\n\n**Cara bayar (otomatis):**\n1. Klik link di bawah → nominal & kode udah keisi.\n2. Bayar lewat Bagi-Bagi.\n3. **Pastikan kode \`${sale.kode}\` tetap ada di kolom pesan.**\n\n🔗 ${link}\n\nBegitu bayar masuk, bot **otomatis** DM kamu kunci lisensi + link download. Nggak perlu nunggu admin 🦉`)
      .setFooter({ text: 'Kode ini cuma buat kamu — jangan dibagiin.' })], flags: MessageFlags.Ephemeral });
  }

  client.on('interactionCreate', (it) => {
    if (it.isChatInputCommand?.() && it.commandName === 'toko') handle(it).catch((e) => { const m = { content: '⚠️ ' + e.message, flags: MessageFlags.Ephemeral }; (it.deferred || it.replied) ? it.editReply(m).catch(() => {}) : it.reply(m).catch(() => {}); });
    else if (it.isStringSelectMenu?.() && it.customId === 'labstoko:pilih') handleSelect(it).catch(() => {});
    else if (it.isAutocomplete?.() && it.commandName === 'toko') {
      const q = String(it.options.getFocused() || '').toLowerCase();
      it.respond((D().produk || []).filter((p) => p.nama.toLowerCase().includes(q) || p.id.includes(q)).slice(0, 25).map((p) => ({ name: `${p.nama} (${p.id})`, value: p.id }))).catch(() => {});
    }
  });

  return { commands: [command], routes, publicRoutes };
}

module.exports = { setup };
