// ============================================================
//  💸 BAGI-BAGI → MAP ROBLOX — BY TRO TEAM AZAZEL
//  Webhook Bagi-Bagi (bagibagi.co/TRO_LABS) masuk ke sini, dicek signature-nya,
//  lalu diteruskan ke semua map (OTR, TUNNEL) lewat Roblox Open Cloud MessagingService.
//  Format pesan sama persis dengan jembatan Saweria lama: { i, n, r, m, t } → game nggak perlu diubah.
//  Pilih map lewat kode di pesan: #OTR / #TUNNEL (diatur di game).
//  Rahasia diambil dari .env (BUKAN disimpan di data):
//    BAGIBAGI_TOKEN  = Webhook Token dari Bagi-Bagi (Stream Overlay → Integrasi)
//    ROBLOX_OC_KEY   = Open Cloud API key (izin messaging-service:publish ke universe map)
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
    targets: [
      { name: 'OTR', universeId: '9102889671', topic: 'OTR_Saweria' },
      { name: 'TUNNEL', universeId: '10772957242', topic: 'TUNNEL_Saweria' },
    ],
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

  async function publish(info) {
    const key = process.env.ROBLOX_OC_KEY;
    if (!key) throw new Error('ROBLOX_OC_KEY belum diisi di .env');
    const message = JSON.stringify(info);
    const hasil = [];
    for (const t of D().targets || []) {
      try {
        const r = await fetch(`https://apis.roblox.com/messaging-service/v1/universes/${t.universeId}/topics/${encodeURIComponent(t.topic)}`, {
          method: 'POST', headers: { 'x-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify({ message }),
        });
        hasil.push({ map: t.name, ok: r.ok, status: r.status, err: r.ok ? '' : (await r.text()).slice(0, 160) });
      } catch (e) { hasil.push({ map: t.name, ok: false, status: 0, err: String(e.message || e).slice(0, 160) }); }
    }
    return hasil;
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
    const hasil = await publish(info).catch((e) => [{ map: '-', ok: false, status: 0, err: e.message }]);
    const row = { id: info.i, name: info.n, amount: info.r, message: info.m, map: kodeMap(info.m), test, time: new Date().toISOString(), hasil };
    d.donations.unshift(row); d.donations = d.donations.slice(0, 100);
    d.lastError = hasil.filter((h) => !h.ok).map((h) => `${h.map}: ${h.status} ${h.err}`).join(' | ');
    cfg.save();
    cfg.addLog?.('bagibagi', `${row.name} ${rupiah(row.amount)} → ${row.map}${d.lastError ? ' (gagal: ' + d.lastError + ')' : ''}`);
    postDiscord(row);
    return { ok: true, hasil };
  }

  // webhook publik (tanpa login dashboard)
  function publicRoutes(app) {
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
      res.json({ tokenSet: !!process.env.BAGIBAGI_TOKEN, keySet: !!process.env.ROBLOX_OC_KEY, channel: logChannel()?.name || '', rate: d.rate, targets: d.targets, lastError: d.lastError, donations: d.donations.slice(0, 20), rejected: (d.rejected || []).slice(0, 5) });
    });
    api.put('/bagibagi/settings', (req, res) => {
      const d = D(), b = req.body || {};
      if (b.channelId !== undefined) d.channelId = String(b.channelId || '');
      if (b.rate) d.rate = Math.max(1, Number(b.rate) || 110);
      if (Array.isArray(b.targets)) d.targets = b.targets.map((t) => ({ name: String(t.name || ''), universeId: String(t.universeId || ''), topic: String(t.topic || '') })).filter((t) => t.universeId && t.topic);
      cfg.save(); res.json({ ok: true, targets: d.targets });
    });
    api.post('/bagibagi/test', async (req, res) => {
      const b = req.body || {};
      res.json(await terima({ transaction_id: `tes-${Date.now()}`, name: b.name || 'CALLMExAZAZEL', amount: b.amount || 11000, message: b.message || '#OTR tes Bagi-Bagi' }, b.real !== true));
    });
  }

  return { commands: [], routes, publicRoutes };
}

module.exports = { setup };
