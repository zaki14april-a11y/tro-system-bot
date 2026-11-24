// ============================================================
//  💸 BAGI-BAGI → MAP ROBLOX — BY TRO TEAM AZAZEL
//  Webhook Bagi-Bagi (bagibagi.co/TRO_LABS) masuk ke sini, dicek signature-nya,
//  lalu masuk antrian FEED. Server map (OTR, TUNNEL) baca feed ini tiap beberapa detik
//  lewat HttpService → GET /bagibagi/feed?after=<seq>. Nggak butuh API key Roblox.
//  Format item sama dengan jembatan donasi lama: { i, n, r, m, t } → alur Robux & #OTR/#TUNNEL di game tetap.
//  Rahasia diambil dari .env (BUKAN disimpan di data):
//    BAGIBAGI_TOKEN  = Webhook Token dari Bagi-Bagi (Integrasi Overlay → Custom Webhook)
//  Data di cfg.data('bagibagi') — tidak menyentuh data lain.
// ============================================================
const crypto = require('crypto');
const { EmbedBuilder } = require('discord.js');
const cfg = require('./config');

const ORANGE = 0xff8a3d;
const rupiah = (n) => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');

function setup({ client }) {
  const D = () => cfg.data('bagibagi', {
    channelId: '',
    rate: 110, // Rp per 1 Robux (sama dengan RP_PER_ROBUX di game)
    seq: 0,
    feed: [],
    seen: [],
    donations: [],
    rejected: [],
    recent: [],
    lastError: '',
  });

  // donasi tes dari tombol "Send Webhook Test" Bagi-Bagi jangan masuk leaderboard map
  const TES_LAMA = ['bagibagi-965b3d64-1f5e-4361-a01b-5b58df37190c'];
  (() => { const d = D(); let ubah = false;
    for (const x of d.feed || []) if (TES_LAMA.includes(x.i) && !x.t) { x.t = 1; ubah = true; }
    for (const x of d.donations || []) if (TES_LAMA.includes(x.id) && !x.test) { x.test = true; ubah = true; }
    if (ubah) cfg.save(); })();
  const tandaTes = (b) => Object.entries(b || {}).some(([k, v]) => /test|sandbox|dummy/i.test(k) && v && v !== 'false' && v !== '0')
    || /test|sandbox|dummy/i.test(String(b?.transaction_id || '') + String(b?.status || '') + String(b?.type || ''));

  const sign = (token, data) => crypto.createHmac('sha256', token).update(data).digest('hex');
  const same = (a, b) => { try { const x = Buffer.from(String(a), 'hex'), y = Buffer.from(String(b), 'hex'); return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y); } catch { return false; } };
  function validSignature(req) {
    const token = process.env.BAGIBAGI_TOKEN;
    if (!token) return false;
    const got = req.get('X-Bagibagi-Signature') || '';
    const cands = [];
    if (req.rawBody) cands.push(sign(token, req.rawBody));
    cands.push(sign(token, JSON.stringify(req.body || {})));
    return cands.some((c) => same(c, got));
  }

  // masuk antrian feed (dibaca server map)
  function antre(info) {
    const d = D(); d.feed ||= []; d.seq = (d.seq || 0) + 1;
    d.feed.push({ s: d.seq, at: Date.now(), ...info });
    const batas = Date.now() - 7 * 86_400_000;
    d.feed = d.feed.filter((x) => x.at > batas).slice(-300);
    return d.seq;
  }

  const kodeMap = (m) => { const k = String(m || '').match(/#(OTR|TUNNEL)\b/i); return k ? k[1].toUpperCase() : 'AUTO'; };

  function logChannel() {
    const g = client.guilds.cache.get(process.env.GUILD_ID); if (!g) return null;
    const d = D();
    if (d.channelId) return g.channels.cache.get(d.channelId) || null;
    return g.channels.cache.find((c) => c.isTextBased?.() && /bagi|sawer|donasi|donate/i.test(c.name)) || null;
  }

  const MIN_RP = 1000; // sama dengan minimal donasi di map
  const teksMap = (row, map) => {
    if (row.test) return '🧪 Tes (semua map)';
    if (row.amount < MIN_RP) return '⚠️ Di bawah Rp1.000, nggak masuk map';
    const m = map || (row.map !== 'AUTO' ? row.map : null);
    if (m === 'TUNNEL') return '🌀 TUNNEL';
    if (m === 'OTR') return '🎶 ON THE RUGS';
    if (row.mapStatus === 'nunggu') return '⏸️ Belum ada server online, masuk pas map nyala';
    return '⏳ Ngecek map tempat donatur online…';
  };
  // menu Donasi Robux di website -> pesan diawali "R$<jumlah>" ; selain itu = Donasi Cash (GOLD)
  const AWAL_RBX = /^\s*R\$\s*[\d.,]+\s*[^\w\s]*\s*/i;
  function buatEmbed(row, map) {
    const robux = AWAL_RBX.test(String(row.message || ''));
    const pesan = String(row.message || '').replace(AWAL_RBX, '').replace(/#(OTR|TUNNEL)\b\s*/i, '').trim();
    const judul = row.test ? '🧪 Tes donasi Bagi-Bagi' : robux ? '💎 Donasi Robux lewat Bagi-Bagi' : '🪙 Donasi Cash (GOLD) lewat Bagi-Bagi';
    const e = new EmbedBuilder().setColor(robux ? 0x00b06f : ORANGE).setTitle(judul)
      .addFields(
        { name: 'Dari', value: String(row.name || 'Anonim').slice(0, 100), inline: true },
        { name: 'Jumlah', value: robux ? `${rupiah(row.amount)}\n= R$${Math.floor(row.amount / (D().rate || 110)).toLocaleString('id-ID')}` : `${rupiah(row.amount)}\n= ${Math.floor(row.amount).toLocaleString('id-ID')} GOLD`, inline: true },
        { name: 'Map', value: teksMap(row, map), inline: true },
      ).setFooter({ text: `Total bulan ini ${rupiah(totalBulanIni())} • trolabs.github.io/#donasi` }).setTimestamp(new Date(row.time || Date.now()));
    if (pesan) e.setDescription(`> ${pesan.slice(0, 300)}`);
    return e;
  }

  // total donasi asli (bukan tes) bulan berjalan, buat footer kartu
  function totalBulanIni() {
    const now = new Date(); const awal = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return (D().donations || []).filter((x) => !x.test && new Date(x.time).getTime() >= awal).reduce((a, x) => a + (Number(x.amount) || 0), 0);
  }
  // BAGIBAGI_DC_AMAN_V1: kirim kartu ke Discord, gagal -> dicoba lagi otomatis sampai masuk
  const lagiKirim = new Set();
  async function postDiscord(row) {
    if (!row || row.dc || lagiKirim.has(row.id)) return;
    lagiKirim.add(row.id);
    try {
      for (let coba = 0; coba < 4 && !row.dc; coba++) {
        if (coba) await new Promise((r) => setTimeout(r, 5000 * coba));
        const ch = logChannel(); if (!ch) { row.dcErr = 'channel log Bagi-Bagi nggak ketemu'; continue; }
        const msg = await ch.send({ embeds: [buatEmbed(row)] }).catch((e) => { row.dcErr = String(e.message || e).slice(0, 120); return null; });
        if (msg) { row.dc = { c: ch.id, m: msg.id }; delete row.dcErr; }
      }
      cfg.save();
    } finally { lagiKirim.delete(row.id); }
    if (!row.dc) return; // sisanya diulang sama penyapu tiap 2 menit
    // donasi tanpa kode map: kalau 90 detik belum ada map yang ngeklaim -> tandain nunggu server
    if (!row.test && row.amount >= MIN_RP && row.map === 'AUTO' && !row.mapStatus) {
      setTimeout(() => { if (!(D().klaim || {})[row.id]) { row.mapStatus = 'nunggu'; cfg.save(); editDiscord(row); } }, 90_000);
    }
  }
  // penyapu: donasi 7 hari terakhir yang kartunya belum masuk Discord (bot restart / Discord down) -> kirim ulang
  function sapuDiscord() {
    const batas = Date.now() - 7 * 86_400_000;
    for (const row of (D().donations || []).slice().reverse()) {
      if (!row.dc && !row.test && !row.dcLama && new Date(row.time).getTime() > batas) postDiscord(row);
    }
  }
  // donasi lama sebelum fitur ini: jangan dikirim ulang (biar nggak dobel di Discord)
  (() => { const d = D(); if (d.dcMigrasi) return; for (const x of d.donations || []) if (!x.dc) x.dcLama = true; d.dcMigrasi = 1; cfg.save(); })();
  client.once?.('ready', () => setTimeout(sapuDiscord, 15_000));
  setInterval(sapuDiscord, 120_000);

  // map yang ngeklaim donasi -> kartu Discord ikut diupdate
  async function editDiscord(row, map) {
    if (!row?.dc) return;
    try {
      const ch = client.channels.cache.get(row.dc.c) || await client.channels.fetch(row.dc.c);
      const msg = await ch.messages.fetch(row.dc.m);
      await msg.edit({ embeds: [buatEmbed(row, map)] });
    } catch { /* pesan kehapus / bot nggak punya akses: biarin */ }
  }

  async function terima(body, test = false) {
    const d = D();
    const id = String(body.transaction_id || '');
    if (id && d.seen.includes(id)) return { duplicate: true };
    const info = { i: id || `bb-${Date.now()}`, n: String(body.name || '').slice(0, 40), r: Math.floor(Number(body.amount) || 0), m: String(body.message || '').slice(0, 200), t: test ? 1 : 0 };
    if (id) { d.seen.unshift(id); d.seen = d.seen.slice(0, 500); }
    const seq = antre(info);
    const row = { seq, id: info.i, name: info.n, amount: info.r, message: info.m, map: kodeMap(info.m), test, time: new Date().toISOString() };
    d.donations.unshift(row); d.donations = d.donations.slice(0, 100);
    cfg.save();
    cfg.addLog?.('bagibagi', `${row.name} ${rupiah(row.amount)} → ${row.map}${test ? ' (tes)' : ''}`);
    postDiscord(row);
    return { ok: true, seq };
  }

  // webhook & feed publik (tanpa login dashboard)
  function publicRoutes(app) {
    // dibaca server Roblox: item sesudah seq tertentu
    app.get('/bagibagi/feed', (req, res) => {
      const d = D(), after = Number(req.query.after) || 0;
      res.set('Cache-Control', 'no-store');
      res.json({ latest: d.seq || 0, now: Date.now(), items: (d.feed || []).filter((x) => x.s > after).slice(0, 50) });
    });
    // donasi tanpa kode map: server map yang ada donaturnya klaim duluan, sisanya ikut (biar nggak dobel OTR + TUNNEL)
    app.post('/bagibagi/klaim', (req, res) => {
      const d = D(), i = String(req.body?.i || '').slice(0, 80), map = String(req.body?.map || '').toUpperCase();
      if (!i || !/^(OTR|TUNNEL)$/.test(map)) return res.status(400).json({ error: 'data kurang' });
      d.klaim ||= {};
      if (!d.klaim[i]) {
        d.klaim[i] = { map, at: Date.now() };
        const keys = Object.keys(d.klaim); if (keys.length > 500) keys.sort((x, y) => d.klaim[x].at - d.klaim[y].at).slice(0, keys.length - 500).forEach((k) => delete d.klaim[k]);
        cfg.save();
        const row = (d.donations || []).find((x) => x.id === i);
        if (row && row.amount >= MIN_RP) { row.map = map; row.mapStatus = 'masuk'; cfg.save(); editDiscord(row, map); }
      }
      res.json({ map: d.klaim[i].map });
    });
    app.get('/bagibagi/klaim', (req, res) => {
      const k = (D().klaim || {})[String(req.query.i || '')];
      res.set('Cache-Control', 'no-store'); res.json({ map: k ? k.map : null });
    });
    app.post('/bagibagi/webhook', async (req, res) => {
      if (!validSignature(req)) {
        const d = D(); // catat buat debug (tanpa token)
        d.rejected.unshift({ time: new Date().toISOString(), tokenSet: !!process.env.BAGIBAGI_TOKEN, sig: String(req.get('X-Bagibagi-Signature') || '').slice(0, 80), body: JSON.stringify(req.body || {}).slice(0, 400) });
        d.rejected = d.rejected.slice(0, 20); cfg.save();
        return res.status(401).json({ error: 'signature salah' });
      }
      res.json({ ok: true }); // balas cepat biar Bagi-Bagi nggak timeout
      { const d = D(); d.recent ||= []; d.recent.unshift({ time: new Date().toISOString(), body: JSON.stringify(req.body || {}).slice(0, 600) }); d.recent = d.recent.slice(0, 5); }
      terima(req.body || {}, tandaTes(req.body)).catch((e) => { D().lastError = String(e.message || e); cfg.save(); });
    });
  }

  // ============ SAWERIA_KE_BAGIBAGI_V1: semua Discord pindah dari Saweria ke Bagi-Bagi ============
  const LINK_DONASI = 'https://trolabs.github.io/#donasi';
  const adaSaweria = (t) => /saweria/i.test(String(t || ''));
  // kalimat "Saweria sudah tidak dipakai" jangan jadi "Bagi-Bagi sudah tidak dipakai" (artinya kebalik)
  const KALIMAT_SALAH = /(\**)\s*(?:Saweria|Bagi-Bagi)(\**)\s+(sudah|udah)\s+(\**)\s*(tidak|nggak|ga|gak)/gi;
  const benerinKalimat = (t) => String(t).replace(KALIMAT_SALAH, (m, a, b, c, d, e) => `${a}Metode bayar lama${b} ${c} ${d}${e}`);
  const gantiSaweria = (t) => benerinKalimat(t)
    .replace(/https?:\/\/(?:www\.)?saweria\.co(?:\/[\w\-]*)?/gi, LINK_DONASI)
    .replace(/(?:www\.)?saweria\.co(?:\/[\w\-]*)?/gi, 'trolabs.github.io/#donasi')
    .replace(/SAWERIA/g, 'BAGI-BAGI').replace(/Saweria/g, 'Bagi-Bagi').replace(/saweria/gi, 'bagi-bagi');
  // ganti di semua teks dalam objek (postingan tersimpan, pengaturan) tanpa ngubah struktur data
  function gantiDalam(obj, jejak = new WeakSet()) {
    let n = 0;
    if (!obj || typeof obj !== 'object' || jejak.has(obj)) return 0;
    jejak.add(obj);
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === 'string' && adaSaweria(v)) { obj[k] = gantiSaweria(v); n++; }
      else if (v && typeof v === 'object') n += gantiDalam(v, jejak);
    }
    return n;
  }
  async function bersihSaweria() {
    const lap = { waktu: new Date().toISOString(), data: 0, whitelist: false, channel: [], pesanBot: [], pesanOrang: [], gagal: [] };
    // 1) data/pengaturan bot (postingan, teks tiket, shop, dll) — bagian bagibagi & log nggak disentuh
    const st = cfg.get();
    const al = st.security?.antiLink;
    if (al && Array.isArray(al.whitelist)) {
      al.whitelist = al.whitelist.filter((h) => !adaSaweria(h));
      for (const h of ['bagibagi.co', 'trolabs.github.io']) if (!al.whitelist.includes(h)) { al.whitelist.push(h); lap.whitelist = true; }
    }
    for (const k of Object.keys(st)) if (!['bagibagi', 'logs', 'log'].includes(k)) lap.data += gantiDalam(st[k]);
    cfg.save();
    // 2) Discord: nama webhook, nama channel, topik, pesan bot yang masih nyebut Saweria
    for (const g of client.guilds.cache.values()) {
      try {
        const hooks = await g.fetchWebhooks();
        for (const h of hooks.values()) if (adaSaweria(h.name)) { const lama = h.name; await h.edit({ name: gantiSaweria(h.name) }); lap.channel.push(`${g.name}: webhook ${lama} → ${h.name}`); }
      } catch (e) { lap.gagal.push(`webhook ${g.name}: ${String(e.message || e).slice(0, 80)}`); }
      const chs = await g.channels.fetch().catch(() => null); if (!chs) continue;
      for (const ch of chs.values()) {
        if (!ch) continue;
        try {
          if (adaSaweria(ch.name)) { const lama = ch.name; await ch.setName(gantiSaweria(ch.name)); lap.channel.push(`${g.name}: #${lama} → #${ch.name}`); }
          if (adaSaweria(ch.topic)) { await ch.setTopic(gantiSaweria(ch.topic)); lap.channel.push(`${g.name}: topik #${ch.name}`); }
        } catch (e) { lap.gagal.push(`#${ch.name}: ${String(e.message || e).slice(0, 80)}`); }
        if (!ch.isTextBased?.() || !ch.messages) continue;
        let pesan; try { pesan = await ch.messages.fetch({ limit: 100 }); } catch { continue; }
        // postingan resmi bot (bisa lebih lama dari 100 pesan terakhir)
        for (const [key, mid] of Object.entries(st.postIds || {})) {
          if (st.posts?.[key]?.channelId !== ch.id || !mid || pesan.has(mid)) continue;
          try { const m = await ch.messages.fetch(mid); pesan.set(m.id, m); } catch { /* */ }
        }
        try { const pin = await ch.messages.fetchPinned(); for (const m of pin.values()) pesan.set(m.id, m); } catch { /* */ }
        for (const m of pesan.values()) {
          const json = { content: m.content || '', embeds: m.embeds.map((e) => e.toJSON()), components: m.components.map((c) => c.toJSON()) };
          const teks = JSON.stringify(json);
          if (!adaSaweria(teks) && !(KALIMAT_SALAH.test(teks) && m.author?.id === client.user.id)) continue;
          KALIMAT_SALAH.lastIndex = 0;
          const url = `https://discord.com/channels/${g.id}/${ch.id}/${m.id}`;
          if (m.author?.id !== client.user.id) { lap.pesanOrang.push(`${g.name} #${ch.name} (${m.author?.username}) ${url}`); continue; }
          try {
            const baru = JSON.parse(gantiSaweria(teks));
            await m.edit({ content: baru.content || null, embeds: baru.embeds, components: baru.components });
            lap.pesanBot.push(`${g.name} #${ch.name} ${url}`);
          } catch (e) { lap.gagal.push(`${url}: ${String(e.message || e).slice(0, 80)}`); }
        }
      }
    }
    const d = D(); d.sawLapor = lap; d.sawSelesai = 2; cfg.save();
    cfg.addLog?.('bagibagi', `Saweria → Bagi-Bagi: data ${lap.data}, channel ${lap.channel.length}, pesan bot ${lap.pesanBot.length}, pesan orang ${lap.pesanOrang.length}`);
    // lapor ke channel log Bagi-Bagi biar keliatan
    const ch = logChannel();
    if (ch) {
      const baris = [
        `✅ Data & postingan bot diganti: **${lap.data}** teks`,
        `✅ Channel/topik diganti: **${lap.channel.length}**`,
        `✅ Pesan bot diedit: **${lap.pesanBot.length}**`,
        lap.pesanOrang.length ? `⚠️ Pesan member/admin yang masih nyebut Saweria (bot nggak bisa edit, hapus/edit manual):\n${lap.pesanOrang.slice(0, 15).join('\n')}` : '✅ Nggak ada pesan member yang nyebut Saweria',
        lap.gagal.length ? `❌ Gagal: ${lap.gagal.slice(0, 8).join('\n')}` : '',
      ].filter(Boolean).join('\n');
      ch.send({ embeds: [new EmbedBuilder().setColor(ORANGE).setTitle('🔁 Saweria → Bagi-Bagi').setDescription(baris.slice(0, 4000)).setFooter({ text: LINK_DONASI })] }).catch(() => {});
    }
    return lap;
  }
  const jalanBersih = () => { if ((D().sawSelesai || 0) < 2) bersihSaweria().catch((e) => { D().lastError = 'bersihSaweria: ' + String(e.message || e); cfg.save(); }); };
  if (client.isReady?.()) setTimeout(jalanBersih, 20_000); else client.once?.('ready', () => setTimeout(jalanBersih, 20_000));

  // dashboard (perlu login)
  function routes(api) {
    api.get('/bagibagi', (req, res) => {
      const d = D();
      res.json({ tokenSet: !!process.env.BAGIBAGI_TOKEN, channel: logChannel()?.name || '', rate: d.rate, seq: d.seq || 0, lastError: d.lastError, donations: d.donations.slice(0, 20), rejected: (d.rejected || []).slice(0, 5), recent: (d.recent || []).slice(0, 5) });
    });
    api.put('/bagibagi/settings', (req, res) => {
      const d = D(), b = req.body || {};
      if (b.channelId !== undefined) d.channelId = String(b.channelId || '');
      if (b.rate) d.rate = Math.max(1, Number(b.rate) || 110);
      cfg.save(); res.json({ ok: true });
    });
    api.get('/bagibagi/saweria', (req, res) => res.json(D().sawLapor || null));
    api.post('/bagibagi/saweria', async (req, res) => res.json(await bersihSaweria()));
    api.post('/bagibagi/test', async (req, res) => {
      const b = req.body || {};
      res.json(await terima({ transaction_id: `tes-${Date.now()}`, name: b.name || 'CALLMExAZAZEL', amount: b.amount || 11000, message: b.message || '#OTR tes Bagi-Bagi' }, b.real !== true));
    });
  }

  return { commands: [], routes, publicRoutes };
}

module.exports = { setup };
