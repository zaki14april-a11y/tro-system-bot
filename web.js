// ============================================================
//  🌐 Dashboard web TRO SYSTEM — login Discord + API
// ============================================================
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const { PermissionFlagsBits, ChannelType } = require('discord.js');
const cfg = require('./config');
const bot = require('./bot');

const { CLIENT_ID, CLIENT_SECRET, GUILD_ID } = process.env;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
const REDIRECT = `${BASE_URL}/callback`;

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: BASE_URL.startsWith('https'), maxAge: 7 * 86_400_000 },
}));

// ---------------- login Discord ----------------
app.get('/login', (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).send('<body style="background:#0f0f12;color:#eee;font-family:sans-serif;display:grid;place-items:center;height:100vh;text-align:center"><div><h1>🦉 Dashboard belum aktif</h1><p>Client Secret belum diisi. Tutup jendela TRO SYSTEM, hapus file <b>.env</b>, lalu jalankan <b>start</b> lagi &mdash; dia akan minta token &amp; Client Secret.</p></div></body>');
  }
  req.session.state = crypto.randomBytes(16).toString('hex');
  const url = new URL('https://discord.com/oauth2/authorize');
  url.search = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT, response_type: 'code', scope: 'identify', state: req.session.state, prompt: 'none' });
  res.redirect(url.toString());
});

app.get('/callback', async (req, res) => {
  try {
    if (!req.query.code || req.query.state !== req.session.state) return res.redirect('/?error=state');
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code', code: req.query.code, redirect_uri: REDIRECT }),
    });
    const token = await tokenRes.json();
    if (!token.access_token) return res.redirect('/?error=token');
    const user = await (await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${token.access_token}` } })).json();
    const g = bot.guild();
    const member = g && await g.members.fetch(user.id).catch(() => null);
    const allowed = !!member && (g.ownerId === user.id || member.permissions.has(PermissionFlagsBits.ManageGuild));
    req.session.user = { id: user.id, username: user.global_name || user.username, avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : 'https://cdn.discordapp.com/embed/avatars/0.png' };
    req.session.allowed = allowed;
    cfg.addLog('Login dashboard', `${user.username} (${user.id}) — ${allowed ? 'diizinkan' : 'DITOLAK'}`);
    res.redirect(allowed ? '/' : '/?error=noaccess');
  } catch (err) {
    console.error(err);
    res.redirect('/?error=login');
  }
});

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

// ---------------- API ----------------
const api = express.Router();
api.get('/me', (req, res) => res.json({ user: req.session.user || null, allowed: !!req.session.allowed }));
api.use((req, res, next) => (req.session.allowed ? next() : res.status(401).json({ error: 'Belum login / tidak punya akses' })));

api.get('/guild', (req, res) => {
  const g = bot.guild();
  if (!g) return res.json({ online: false });
  const channels = g.channels.cache
    .filter((c) => [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(c.type))
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map((c) => ({ id: c.id, name: c.name, parent: c.parent?.name || '' }));
  const roles = g.roles.cache.filter((r) => r.id !== g.id && !r.managed).sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }));
  res.json({
    online: bot.client.isReady(),
    bot: { tag: bot.client.user?.tag, avatar: bot.client.user?.displayAvatarURL({ size: 128 }) },
    name: g.name, icon: g.iconURL({ size: 256 }), memberCount: g.memberCount,
    online_members: g.members.cache.filter((m) => m.presence && m.presence.status !== 'offline').size,
    boosts: g.premiumSubscriptionCount, channels, roles,
    lockdownUntil: bot.lockdown.get(),
  });
});

const SECTIONS = ['branding', 'posts', 'status', 'welcome', 'goodbye', 'autorole', 'security', 'verify'];
api.get('/config', (req, res) => {
  const s = cfg.get();
  res.json(Object.fromEntries(SECTIONS.map((k) => [k, s[k]])));
});
api.put('/config/:section', async (req, res) => {
  const { section } = req.params;
  if (!SECTIONS.includes(section)) return res.status(400).json({ error: 'Section tidak dikenal' });
  cfg.set(section, req.body);
  cfg.addLog('Pengaturan diubah', `${section} oleh ${req.session.user.username}`);
  if (section === 'status') bot.applyStatus();
  if (section === 'posts') await bot.registerCommands().catch(() => {});
  res.json({ ok: true });
});

api.post('/posts/:key/publish', async (req, res) => {
  try { res.json(await bot.publishPost(req.params.key, !!req.body.forceNew)); }
  catch (err) { res.status(400).json({ error: err.message }); }
});
api.post('/posts/publish-all', async (req, res) => res.json(await bot.publishAll(!!req.body.forceNew)));

api.post('/announce', async (req, res) => {
  try {
    if (!req.body.channelId) throw new Error('Pilih channel dulu');
    const id = await bot.announce(req.body);
    res.json({ ok: true, id });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

api.post('/test/:kind', async (req, res) => {
  try {
    const member = await bot.guild().members.fetch(req.session.user.id);
    if (req.params.kind === 'welcome') await bot.sendWelcome(member, true);
    else await bot.sendGoodbye(member, true);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

api.post('/lockdown', (req, res) => {
  const menit = Number(req.body.minutes) || 0;
  bot.lockdown.set(menit > 0 ? Date.now() + menit * 60_000 : 0);
  cfg.addLog(menit > 0 ? 'Lockdown manual' : 'Lockdown dibuka', `oleh ${req.session.user.username}${menit > 0 ? ` (${menit} menit)` : ''}`);
  res.json({ ok: true, lockdownUntil: bot.lockdown.get() });
});

api.get('/logs', (req, res) => res.json(cfg.get().logs));

// ---------- verifikasi ----------
api.post('/verify/panel', async (req, res) => {
  try { res.json({ ok: true, result: await bot.fams.sendPanel() }); }
  catch (err) { res.status(400).json({ error: err.message }); }
});
api.post('/verify/autosetup', async (req, res) => {
  try { res.json({ ok: true, done: await bot.fams.autoSetup() }); }
  catch (err) { res.status(400).json({ error: err.message }); }
});
api.get('/applications', (req, res) => res.json(cfg.get().applications));
api.post('/applications/:id/:action', async (req, res) => {
  try {
    const by = req.session.user.username;
    const app = req.params.action === 'accept'
      ? await bot.fams.acceptApp(req.params.id, by)
      : await bot.fams.rejectApp(req.params.id, by, String(req.body.reason || ''));
    res.json(app);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ---------- undangan fams ----------
api.get('/invites', (req, res) => {
  const inv = cfg.get().invites;
  res.json({ ...inv, today: bot.fams.todayWIB() });
});
api.post('/invites', (req, res) => {
  try { res.json(bot.fams.addInvite(req.body, req.session.user.username)); }
  catch (err) { res.status(400).json({ error: err.message }); }
});
api.delete('/invites/:id', (req, res) => {
  try { bot.fams.removeInvite(req.params.id, req.session.user.username); res.json({ ok: true }); }
  catch (err) { res.status(400).json({ error: err.message }); }
});
api.put('/invites-settings', async (req, res) => {
  const inv = cfg.get().invites;
  inv.channelId = String(req.body.channelId || '');
  inv.weekdayLimit = Math.max(0, Number(req.body.weekdayLimit) || 0);
  inv.weekendLimit = Math.max(0, Number(req.body.weekendLimit) || 0);
  if (req.body.channelId !== undefined && inv.channelId !== req.body.prevChannelId) inv.messageId = '';
  cfg.save();
  res.json({ ok: true });
});
api.post('/invites/post', async (req, res) => {
  try { res.json({ ok: true, result: await bot.fams.postSchedule() }); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.use('/api', api);

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

function start() {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`  🌐 Dashboard: ${BASE_URL}  (redirect login: ${REDIRECT})\n`));
}

module.exports = { start };
