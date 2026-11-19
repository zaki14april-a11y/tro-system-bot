// ============================================================
//  💸 BAGI-BAGI → MAP ROBLOX — BY TRO TEAM AZAZEL
//  Webhook Bagi-Bagi (bagibagi.co/TRO_LABS) masuk ke sini, dicek signature-nya,
//  lalu masuk antrian FEED. Server map (OTR, TUNNEL) baca feed ini tiap beberapa detik
//  lewat HttpService → GET /bagibagi/feed?after=<seq>. Nggak butuh API key Roblox.
//  Format item sama dengan jembatan Saweria lama: { i, n, r, m, t } → alur Robux & #OTR/#TUNNEL di game tetap.
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
    lastError: '',
  });

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

  const kodeMap = (m) => { const k = String(m || '').match(/#(OTR|TUNNEL)\b/i); return k ? k[1].toUpperCase() : 'OTR'; };

  function logChannel() {
    const g = client.guilds.cache.get(process.env.GUILD_ID); if (!g) return null;
    const d = D();
    if (d.channelId) return g.channels.cache.get(d.channelId) || null;
    return g.channels.cache.find((c) => c.isTextBased?.() && /bagi|sawer|donasi|donate/i.test(c.name)) || null;
  }

  async function postDiscord(row) {
    const ch = logChannel(); if (!ch) return;
    const pesan = String(row.message || '').replace(/#(OTR|TUNNEL)\b\s*/i, '').trim();
    const e = new EmbedBuilder().setColor(ORANGE).setTitle(row.test ? '🧪 Tes donasi Bagi-Bagi' : '💸 Donasi baru lewat Bagi-Bagi')
      .addFields(
        { name: 'Dari', value: String(row.name || 'Anonim').slice(0, 100), inline: true },
        { name: 'Jumlah', value: `${rupiah(row.amount)}\n≈ R$${Math.floor(row.amount / (D().rate || 110)).toLocaleString('id-ID')}`, inline: true },
        { name: 'Map', value: row.map === 'TUNNEL' ? '🌀 TUNNEL' : '🎶 ON THE RUGS', inline: true },
      ).setFooter({ text: 'bagibagi.co/TRO_LABS • trolabs.github.io/donasi' }).setTimestamp();
    if (pesan) e.setDescription(`> ${pesan.slice(0, 300)}`);
    await ch.send({ embeds: [e] }).catch(() => {});
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
    app.post('/bagibagi/webhook', async (req, res) => {
      if (!validSignature(req)) {
        const d = D(); // catat buat debug (tanpa token)
        d.rejected.unshift({ time: new Date().toISOString(), tokenSet: !!process.env.BAGIBAGI_TOKEN, sig: String(req.get('X-Bagibagi-Signature') || '').slice(0, 80), body: JSON.stringify(req.body || {}).slice(0, 400) });
        d.rejected = d.rejected.slice(0, 20); cfg.save();
        return res.status(401).json({ error: 'signature salah' });
      }
      res.json({ ok: true }); // balas cepat biar Bagi-Bagi nggak timeout
      terima(req.body || {}).catch((e) => { D().lastError = String(e.message || e); cfg.save(); });
    });
  }

  // dashboard (perlu login)
  function routes(api) {
    api.get('/bagibagi', (req, res) => {
      const d = D();
      res.json({ tokenSet: !!process.env.BAGIBAGI_TOKEN, channel: logChannel()?.name || '', rate: d.rate, seq: d.seq || 0, lastError: d.lastError, donations: d.donations.slice(0, 20), rejected: (d.rejected || []).slice(0, 5) });
    });
    api.put('/bagibagi/settings', (req, res) => {
      const d = D(), b = req.body || {};
      if (b.channelId !== undefined) d.channelId = String(b.channelId || '');
      if (b.rate) d.rate = Math.max(1, Number(b.rate) || 110);
      cfg.save(); res.json({ ok: true });
    });
    api.post('/bagibagi/test', async (req, res) => {
      const b = req.body || {};
      res.json(await terima({ transaction_id: `tes-${Date.now()}`, name: b.name || 'CALLMExAZAZEL', amount: b.amount || 11000, message: b.message || '#OTR tes Bagi-Bagi' }, b.real !== true));
    });
  }

  return { commands: [], routes, publicRoutes };
}

module.exports = { setup };
