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
const BASE_URL = (process.env.BASE_URL || (process.env.RENDER_EXTERNAL_URL || (process.env.KOYEB_PUBLIC_DOMAIN && `https://${process.env.KOYEB_PUBLIC_DOMAIN}`) || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${process.env.PORT || 3000}`))).replace(/\/$/, '');
const REDIRECT = `${BASE_URL}/callback`;

// ---------------- akses dashboard ----------------
const PAGE_OF = [
  [/^\/config\/(verify)$|^\/verify\//, 'verify'], [/^\/applications|^\/data-requests/, 'applications'], [/^\/config\/tracker$|^\/tracker/, 'tracker'],
  [/^\/config\/(welcome|goodbye)$|^\/test\//, 'welcome'], [/^\/config\/autorole$/, 'autorole'], [/^\/invites/, 'invites'],
  [/^\/config\/events$|^\/events/, 'events'], [/^\/config\/(birthday|stats)$|^\/birthdays|^\/stats/, 'birthday'], [/^\/config\/tempvoice$|^\/tempvoice/, 'tempvoice'],
  [/^\/config\/levels$|^\/levels/, 'levels'], [/^\/giveaways/, 'giveaway'], [/^\/config\/selfroles$|^\/selfroles/, 'selfroles'],
  [/^\/config\/posts$|^\/posts/, 'posts'], [/^\/announce/, 'announce'], [/^\/config\/tickets$|^\/tickets/, 'tickets'],
  [/^\/config\/security$|^\/lockdown/, 'security'], [/^\/config\/moderation$|^\/modcases|^\/moderate/, 'moderation'], [/^\/logs/, 'logs'],
  [/^\/config\/branding$/, 'branding'], [/^\/config\/status$/, 'status'], [/^\/guide\/post/, 'guide'], [/^\/config\/access$|^\/access/, 'access'],
  [/^\/members\/broadcast/, 'broadcast'], [/^\/members\/activity/, 'activity'], [/^\/members\/directory/, 'directory'], [/^\/shop/, 'shop'], [/^\/divisions/, 'divisions'], [/^\/suggest/, 'suggest'], [/^\/notify|^\/meetings/, 'notify'], [/^\/boost/, 'boost'], [/^\/archive/, 'archive'], [/^\/forms/, 'forms'],
];
const ALL_PAGES = ['home', 'guide', 'branding', 'status', 'verify', 'applications', 'tracker', 'welcome', 'autorole', 'invites', 'events', 'birthday', 'tempvoice', 'levels', 'giveaway', 'selfroles', 'posts', 'announce', 'tickets', 'security', 'moderation', 'logs', 'broadcast', 'activity', 'directory', 'shop', 'divisions', 'suggest', 'notify', 'boost', 'archive', 'forms'];

// default: role bernama ADMIN & OWNER
const defaultAdminRoles = (g) => [...(g?.roles.cache.filter((r) => /^(admin|owner)$/i.test(r.name.replace(/[^a-z]/gi, ''))).keys() || [])];

function computeAccess(userId) {
  const g = bot.guild();
  const a = cfg.get().access;
  const member = g?.members.cache.get(userId);
  const superAdmin = !!g && (g.ownerId === userId || a.superAdminIds.includes(userId));
  if (superAdmin) return { allowed: true, superAdmin: true, pages: [...ALL_PAGES, 'access'] };
  if (!member) return { allowed: false, superAdmin: false, pages: [] };
  const hasRole = (ids) => ids.some((r) => member.roles.cache.has(r));
  const roleIds = a.roleIds.length ? a.roleIds : defaultAdminRoles(g);
  const allowed = a.mode === 'manage'
    ? member.permissions.has(PermissionFlagsBits.ManageGuild)
    : a.userIds.includes(userId) || hasRole(roleIds);
  if (!allowed) return { allowed: false, superAdmin: false, pages: [] };
  const pages = ALL_PAGES.filter((p) => !(a.pages[p]?.length) || hasRole(a.pages[p]));
  return { allowed: true, superAdmin: false, pages };
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: BASE_URL.startsWith('https'), maxAge: 7 * 86_400_000 },
}));

app.get('/health', (req, res) => res.send('ok'));

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
    if (g) await g.members.fetch(user.id).catch(() => null);
    const { allowed } = computeAccess(user.id);
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
api.get('/me', (req, res) => {
  if (!req.session.user) return res.json({ user: null, allowed: false });
  res.json({ user: req.session.user, ...computeAccess(req.session.user.id) });
});
api.use((req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Belum login' });
  const acc = computeAccess(req.session.user.id);
  if (!acc.allowed) return res.status(401).json({ error: 'Akses dashboard kamu sudah dicabut' });
  const hit = PAGE_OF.find(([re]) => re.test(req.path));
  if (hit && !acc.pages.includes(hit[1])) return res.status(403).json({ error: '⛔ Kamu tidak punya akses ke halaman ini' });
  req.access = acc;
  next();
});

api.get('/guild', (req, res) => {
  const g = bot.guild();
  if (!g) return res.json({ online: false });
  const channels = g.channels.cache
    .filter((c) => [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(c.type))
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map((c) => ({ id: c.id, name: c.name, parent: c.parent?.name || '' }));
  const categories = g.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).sort((a, b) => a.rawPosition - b.rawPosition).map((c) => ({ id: c.id, name: c.name }));
  const voices = g.channels.cache.filter((c) => c.isVoiceBased()).sort((a, b) => a.rawPosition - b.rawPosition).map((c) => ({ id: c.id, name: c.name, parent: c.parent?.name || '' }));
  const roles = g.roles.cache.filter((r) => r.id !== g.id && !r.managed).sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }));
  res.json({
    online: bot.client.isReady(),
    bot: { tag: bot.client.user?.tag, avatar: bot.client.user?.displayAvatarURL({ size: 128 }) },
    name: g.name, icon: g.iconURL({ size: 256 }), memberCount: g.memberCount,
    online_members: g.members.cache.filter((m) => m.presence && m.presence.status !== 'offline').size,
    boosts: g.premiumSubscriptionCount, channels, roles, categories, voices,
    lockdownUntil: bot.lockdown.get(),
  });
});

const SECTIONS = ['branding', 'posts', 'status', 'welcome', 'goodbye', 'autorole', 'security', 'verify', 'tracker', 'tickets', 'levels', 'selfroles', 'moderation', 'events', 'birthday', 'stats', 'tempvoice', 'access'];
api.get('/config', (req, res) => {
  const s = cfg.get();
  res.json(Object.fromEntries(SECTIONS.map((k) => [k, s[k]])));
});
api.put('/config/:section', async (req, res) => {
  const { section } = req.params;
  if (!SECTIONS.includes(section)) return res.status(400).json({ error: 'Section tidak dikenal' });
  if (section === 'access') {
    const ids = [...new Set((req.body.superAdminIds || []).filter((x) => /^\d{15,}$/.test(x)))];
    if (!ids.includes(req.session.user.id) && bot.guild()?.ownerId !== req.session.user.id) ids.push(req.session.user.id); // jangan kunci diri sendiri
    req.body.superAdminIds = ids;
  }
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

// ---------- akses (khusus super admin) ----------
api.get('/access/users', async (req, res) => {
  const g = bot.guild();
  const ids = [...new Set([...cfg.get().access.superAdminIds, ...cfg.get().access.userIds, ...String(req.query.ids || '').split(',').filter(Boolean)])];
  const out = [];
  for (const id of ids) {
    const m = g.members.cache.get(id) || await g.members.fetch(id).catch(() => null);
    out.push({ id, name: m ? (m.displayName || m.user.username) : null, avatar: m?.user.displayAvatarURL({ size: 64 }) || '' });
  }
  res.json({ users: out, ownerId: g.ownerId, defaultRoleIds: defaultAdminRoles(g) });
});
api.get('/access/search', async (req, res) => {
  const g = bot.guild();
  const q = String(req.query.q || '').toLowerCase();
  if (q.length < 2) return res.json([]);
  res.json([...g.members.cache.filter((m) => !m.user.bot && (m.user.username.toLowerCase().includes(q) || (m.displayName || '').toLowerCase().includes(q))).values()]
    .slice(0, 10).map((m) => ({ id: m.id, name: m.displayName || m.user.username, username: m.user.username, avatar: m.user.displayAvatarURL({ size: 64 }) })));
});

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
api.get('/tracker', (req, res) => {
  const g = bot.guild();
  const name = (id) => { const m = id && g?.members.cache.get(id); return m ? (m.displayName || m.user.username) : null; };
  const st = bot.tracker.stats();
  res.json({
    joins: st.joins.map((j) => ({ ...j, inviterName: name(j.inviterId) })),
    board: st.board.map((b) => ({ ...b, name: name(b.id) || b.id, avatar: g?.members.cache.get(b.id)?.displayAvatarURL({ size: 64 }) || '' })),
  });
});
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

bot.modules.forEach((m) => m.routes?.(api));
bot.fams.routes(api);
app.use('/api', api);

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

function start() {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`  🌐 Dashboard: ${BASE_URL}  (redirect login: ${REDIRECT})\n`));
  // hosting gratis (Render) tidur kalau 15 menit tanpa pengunjung → ketuk diri sendiri tiap 10 menit
  if (/^https:/.test(BASE_URL)) setInterval(() => fetch(`${BASE_URL}/health`).catch(() => {}), 10 * 60_000);
}

module.exports = { start, computeAccess };
