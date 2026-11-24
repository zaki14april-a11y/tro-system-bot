// ============================================================
//  🔒 TRO LABS — LISENSI / PROTEKSI SCRIPT JUALAN — BY TRO TEAM AZAZEL
//  Tiap script yang dijual TRO LABS bawa "guard" kecil yang lapor ke sini pas jalan.
//  Server ngecek: kunci lisensi aktif & PlaceId game-nya cocok. Kalau nggak -> script mati.
//  Kunci diterbitkan otomatis pas order script LUNAS (status selesai), atau manual /lisensi buat.
//  Alur anti jual-ulang:
//    1) buyer dapat kunci unik (TRO-XXXX-XXXX-XXXX)
//    2) pas script jalan pertama kali -> kunci "dikunci" ke PlaceId game buyer
//    3) script bocor ke game lain -> PlaceId beda -> ditolak
//  Data di cfg.data('labslisensi') — nggak nyentuh data modul lain.
// ============================================================
const crypto = require('crypto');
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const cfg = require('./config');

const GOLD = 0xf5c542;
const now = () => new Date().toISOString();

function setup({ client }) {
  const D = () => cfg.data('labslisensi', {
    keys: [],        // { key, produk, orderNo, buyerId, buyerName, boundOwnerType, boundOwnerId, boundAt, boundGame, places[], aktif, dibuat, terakhirCek, cekCount, cabutAlasan }
    logChannelId: '', // channel log lisensi (opsional)
  });
  // lisensi dikunci ke PEMILIK game (akun USN / komunitas), bukan ke 1 map.
  // semua map di bawah akun/grup yang sama -> jalan. Akun/grup beda -> harus beli key baru.
  const labelOwner = (t, id) => `${String(t || '').toLowerCase() === 'group' ? 'Komunitas' : 'Akun'} ${id}`;

  // kunci acak TRO-XXXX-XXXX-XXXX (tanpa huruf yang gampang ketuker: 0/O, 1/I)
  const HURUF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const blok = () => Array.from({ length: 4 }, () => HURUF[crypto.randomInt(HURUF.length)]).join('');
  function kunciBaru() {
    const d = D();
    let k;
    do { k = `TRO-${blok()}-${blok()}-${blok()}`; } while ((d.keys || []).some((x) => x.key === k));
    return k;
  }
  const cari = (key) => (D().keys || []).find((x) => x.key === String(key || '').trim().toUpperCase());

  // terbitkan 1 kunci buat 1 produk (dipanggil otomatis dari shop atau manual)
  function terbit({ produk, orderNo, buyerId, buyerName }) {
    const d = D();
    const row = {
      key: kunciBaru(), produk: String(produk || 'script').slice(0, 60),
      orderNo: orderNo || '', buyerId: buyerId || '', buyerName: String(buyerName || '').slice(0, 80),
      boundOwnerType: null, boundOwnerId: null, boundAt: null, boundGame: '', places: [],
      aktif: true, dibuat: now(), terakhirCek: null, cekCount: 0, cabutAlasan: '',
    };
    d.keys.unshift(row); d.keys = d.keys.slice(0, 2000);
    cfg.save();
    cfg.addLog?.('labslisensi', `Terbit kunci ${row.key} buat ${row.produk}${orderNo ? ` (order #${orderNo})` : ''}`);
    return row;
  }
  // dipakai shop.js pas order script lunas (lihat hook di shop.js)
  client.labsTerbitLisensi = async (opts) => {
    const row = terbit(opts);
    // DM buyer kuncinya
    if (opts.buyerId) {
      const u = await client.users.fetch(opts.buyerId).catch(() => null);
      if (u) await u.send({ embeds: [new EmbedBuilder().setColor(GOLD).setTitle('🔑 Kunci Lisensi Script TRO LABS')
        .setDescription(`Makasih udah beli **${row.produk}** 🦉\n\n**Kunci lisensi kamu:**\n\`\`\`${row.key}\`\`\`\nTempel kunci ini di baris \`KUNCI\` paling atas script, lalu jalanin game kamu **sekali**. Kunci bakal terkunci ke **akun / komunitas** kamu.\n\n✅ Setelah itu kunci ini bisa dipakai di **semua map** di bawah akun / komunitas yang sama — bebas.\n⚠️ Beda akun / komunitas = harus beli lisensi baru. Jangan dibagiin ke orang lain.\nMau pindah akun / komunitas? Minta reset ke staff.`)
        .setFooter({ text: 'TRO LABS • Positive Community & Dev' })] }).catch(() => {});
    }
    kirimLog(`🔑 Kunci **${row.key}** terbit buat **${row.produk}**${opts.orderNo ? ` · order #${opts.orderNo}` : ''}${opts.buyerId ? ` · <@${opts.buyerId}>` : ''}`);
    return row;
  };

  function logChannel() {
    const g = client.guilds.cache.get(process.env.GUILD_ID); if (!g) return null;
    const d = D();
    if (d.logChannelId) return g.channels.cache.get(d.logChannelId) || null;
    return g.channels.cache.find((c) => c.isTextBased?.() && /lisensi|labs-log|script-log/i.test(c.name)) || null;
  }
  function kirimLog(teks) {
    const ch = logChannel(); if (!ch) return;
    ch.send({ embeds: [new EmbedBuilder().setColor(GOLD).setDescription(teks).setTimestamp()] }).catch(() => {});
  }

  // ---------- endpoint publik: dipanggil GAME buyer pas script jalan ----------
  function publicRoutes(app) {
    const aktifkan = (body) => {
      const key = String(body.key || '').trim().toUpperCase();
      const produk = String(body.produk || '').trim();
      const ownerType = String(body.ownerType || '').trim().toLowerCase(); // 'user' / 'group'
      const ownerId = String(body.ownerId || '').replace(/\D/g, '');
      const placeId = String(body.placeId || '').replace(/\D/g, '');
      const row = cari(key);
      if (!row) return { ok: false, pesan: 'Lisensi tidak ditemukan' };
      if (!row.aktif) return { ok: false, pesan: 'Lisensi dicabut. Hubungi TRO LABS' };
      if (row.produk && produk && row.produk.toLowerCase() !== produk.toLowerCase()) return { ok: false, pesan: 'Lisensi ini bukan buat produk ini' };
      if (!ownerId || !ownerType) return { ok: false, pesan: 'Data pemilik game kosong' };
      if (!row.boundOwnerId) {
        // aktivasi pertama: kunci ke PEMILIK (akun/komunitas) game ini
        row.boundOwnerType = ownerType; row.boundOwnerId = ownerId; row.boundAt = now();
        row.boundGame = String(body.game || '').slice(0, 80);
        kirimLog(`✅ Lisensi **${row.key}** diaktifkan ke **${labelOwner(ownerType, ownerId)}**${row.boundGame ? ` (${row.boundGame})` : ''}${row.buyerId ? ` · <@${row.buyerId}>` : ''}`);
      } else if (row.boundOwnerType !== ownerType || row.boundOwnerId !== ownerId) {
        row.terakhirCek = now(); cfg.save();
        kirimLog(`⛔ Lisensi **${row.key}** DITOLAK — dipakai di **${labelOwner(ownerType, ownerId)}** (harusnya **${labelOwner(row.boundOwnerType, row.boundOwnerId)}**)${row.buyerId ? ` · <@${row.buyerId}>` : ''}`);
        return { ok: false, pesan: 'Lisensi ini terkunci ke akun/komunitas lain. Beli lisensi baru di TRO LABS' };
      }
      // catat map-map yang pakai (info aja, nggak ngebatesin)
      if (placeId) { row.places = row.places || []; if (!row.places.includes(placeId)) { row.places.push(placeId); row.places = row.places.slice(-50); } }
      row.terakhirCek = now(); row.cekCount = (row.cekCount || 0) + 1; cfg.save();
      return { ok: true, pesan: 'Lisensi aktif', produk: row.produk };
    };
    app.post('/labs/lisensi/aktif', (req, res) => {
      res.set('Cache-Control', 'no-store');
      try { res.json(aktifkan(req.body || {})); }
      catch (e) { res.status(500).json({ ok: false, pesan: 'error server' }); D().lastError = String(e.message || e); cfg.save(); }
    });
    // buat tes cepat lewat browser
    app.get('/labs/lisensi/aktif', (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(aktifkan({ key: req.query.key, produk: req.query.produk, ownerType: req.query.ownerType, ownerId: req.query.ownerId, placeId: req.query.placeId, game: req.query.game }));
    });
  }

  // ---------- dashboard (perlu login) ----------
  function routes(api) {
    api.get('/labs/lisensi', (req, res) => {
      const d = D();
      res.json({ total: d.keys.length, aktif: d.keys.filter((k) => k.aktif).length, terpakai: d.keys.filter((k) => k.boundOwnerId).length, keys: d.keys.slice(0, 200) });
    });
    api.post('/labs/lisensi', (req, res) => {
      const b = req.body || {};
      res.json(terbit({ produk: b.produk, orderNo: b.orderNo, buyerId: b.buyerId, buyerName: b.buyerName }));
    });
    api.put('/labs/lisensi', (req, res) => {
      const b = req.body || {}, row = cari(b.key);
      if (!row) return res.status(404).json({ error: 'kunci nggak ketemu' });
      if (b.cabut !== undefined) { row.aktif = !b.cabut; row.cabutAlasan = b.cabut ? String(b.alasan || '').slice(0, 120) : ''; }
      if (b.reset) { row.boundOwnerType = null; row.boundOwnerId = null; row.boundAt = null; row.boundGame = ''; row.places = []; } // biar bisa pindah akun/komunitas
      cfg.save();
      kirimLog(`${b.reset ? '🔄 Reset' : (b.cabut ? '🚫 Cabut' : '♻️ Aktifkan')} lisensi **${row.key}**`);
      res.json(row);
    });
    api.put('/labs/lisensi/settings', (req, res) => { const d = D(); if (req.body?.logChannelId !== undefined) d.logChannelId = String(req.body.logChannelId || ''); cfg.save(); res.json({ ok: true }); });
  }

  // ---------- slash command /lisensi (admin) ----------
  const command = new SlashCommandBuilder().setName('lisensi').setDescription('Kelola lisensi script TRO LABS')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('buat').setDescription('Terbitkan kunci lisensi baru')
      .addStringOption((o) => o.setName('produk').setDescription('Nama produk / script').setRequired(true))
      .addUserOption((o) => o.setName('buyer').setDescription('Pembeli (buat di-DM kuncinya)'))
      .addStringOption((o) => o.setName('order').setDescription('Nomor order (opsional)')))
    .addSubcommand((s) => s.setName('cek').setDescription('Lihat detail 1 kunci')
      .addStringOption((o) => o.setName('kunci').setDescription('TRO-XXXX-XXXX-XXXX').setRequired(true)))
    .addSubcommand((s) => s.setName('list').setDescription('Daftar lisensi terbaru'))
    .addSubcommand((s) => s.setName('cabut').setDescription('Cabut / nonaktifkan kunci')
      .addStringOption((o) => o.setName('kunci').setDescription('TRO-XXXX-XXXX-XXXX').setRequired(true))
      .addStringOption((o) => o.setName('alasan').setDescription('Alasan (opsional)')))
    .addSubcommand((s) => s.setName('reset').setDescription('Lepas ikatan game (buyer bisa pindah game)')
      .addStringOption((o) => o.setName('kunci').setDescription('TRO-XXXX-XXXX-XXXX').setRequired(true)));

  async function handle(it) {
    if (it.commandName !== 'lisensi') return false;
    const sub = it.options.getSubcommand();
    const E = (d) => new EmbedBuilder().setColor(GOLD).setDescription(d);
    if (sub === 'buat') {
      const buyer = it.options.getUser('buyer');
      const row = await client.labsTerbitLisensi({ produk: it.options.getString('produk'), orderNo: it.options.getString('order') || '', buyerId: buyer?.id, buyerName: buyer?.username });
      await it.reply({ embeds: [E(`🔑 Kunci terbit: \`${row.key}\`\nProduk: **${row.produk}**${buyer ? `\nUdah di-DM ke ${buyer}` : ''}`)], flags: MessageFlags.Ephemeral });
    } else if (sub === 'cek') {
      const row = cari(it.options.getString('kunci'));
      if (!row) return it.reply({ content: '❌ Kunci nggak ketemu.', flags: MessageFlags.Ephemeral }), true;
      await it.reply({ embeds: [E(`**${row.key}** — ${row.aktif ? '✅ aktif' : '🚫 dicabut'}\nProduk: **${row.produk}**\nPembeli: ${row.buyerId ? `<@${row.buyerId}>` : (row.buyerName || '-')}\nTerkunci ke: ${row.boundOwnerId ? `**${labelOwner(row.boundOwnerType, row.boundOwnerId)}**${row.boundGame ? ` (${row.boundGame})` : ''}` : '— belum diaktifkan'}\nMap kepakai: ${(row.places || []).length}\nDicek: ${row.cekCount || 0}×${row.terakhirCek ? ` · terakhir ${row.terakhirCek.slice(0, 16).replace('T', ' ')}` : ''}`)], flags: MessageFlags.Ephemeral });
    } else if (sub === 'list') {
      const ks = (D().keys || []).slice(0, 15);
      await it.reply({ embeds: [E(ks.length ? ks.map((k) => `\`${k.key}\` ${k.aktif ? '✅' : '🚫'} · ${k.produk} · ${k.boundOwnerId ? labelOwner(k.boundOwnerType, k.boundOwnerId) : 'belum aktif'}${k.buyerId ? ` · <@${k.buyerId}>` : ''}`).join('\n') : 'Belum ada lisensi.')], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    } else if (sub === 'cabut' || sub === 'reset') {
      const row = cari(it.options.getString('kunci'));
      if (!row) return it.reply({ content: '❌ Kunci nggak ketemu.', flags: MessageFlags.Ephemeral }), true;
      if (sub === 'cabut') { row.aktif = false; row.cabutAlasan = it.options.getString('alasan') || ''; }
      else { row.boundOwnerType = null; row.boundOwnerId = null; row.boundAt = null; row.boundGame = ''; row.places = []; }
      cfg.save();
      kirimLog(`${sub === 'reset' ? '🔄 Reset' : '🚫 Cabut'} lisensi **${row.key}** oleh ${it.user.username}`);
      await it.reply({ embeds: [E(`${sub === 'reset' ? '🔄 Ikatan akun/komunitas dilepas' : '🚫 Lisensi dicabut'}: \`${row.key}\`${sub === 'reset' ? '\nBuyer bisa aktifin ulang di akun/komunitas baru.' : '\nScript bakal mati di game buyer.'}`)], flags: MessageFlags.Ephemeral });
    }
    return true;
  }
  client.on('interactionCreate', (it) => { if (it.isChatInputCommand?.() && it.commandName === 'lisensi') handle(it).catch((e) => { try { it.reply({ content: '⚠️ ' + e.message, flags: MessageFlags.Ephemeral }); } catch {} }); });

  return { commands: [command], routes, publicRoutes };
}

module.exports = { setup };
