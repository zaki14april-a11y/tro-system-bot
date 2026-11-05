// ============================================================
//  🦉 TRO SYSTEM — logika bot Discord
// ============================================================
const {
  Client, GatewayIntentBits, Partials, ActivityType, Events, EmbedBuilder,
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType, AuditLogEvent,
} = require('discord.js');
const cfg = require('./config');

const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.GuildMember],
});

// ---------------- util ----------------
const hexToInt = (hex) => parseInt(String(hex || '#d4af37').replace('#', ''), 16) || 0xd4af37;
const guild = () => client.guilds.cache.get(GUILD_ID);

function fill(text, member) {
  const g = member?.guild || guild();
  return String(text || '')
    .replaceAll('{user}', member ? `<@${member.id}>` : '@user')
    .replaceAll('{username}', member?.user?.username || 'user')
    .replaceAll('{server}', g?.name || 'TRO')
    .replaceAll('{count}', String(g?.memberCount ?? ''))
    .replaceAll('{members}', String(g?.memberCount ?? ''));
}

function baseEmbed({ title, description, color, image, thumbnail, fields } = {}) {
  const { branding } = cfg.get();
  const e = new EmbedBuilder()
    .setColor(color ? hexToInt(color) : hexToInt(branding.color))
    .setFooter({ text: branding.footer || 'TRO SYSTEM', iconURL: client.user?.displayAvatarURL() })
    .setTimestamp();
  if (title) e.setTitle(String(title).slice(0, 256));
  if (description) e.setDescription(String(description).slice(0, 4096));
  if (fields?.length) e.addFields(fields.filter((f) => f.name && f.value).slice(0, 25).map((f) => ({ name: String(f.name).slice(0, 256), value: String(f.value).slice(0, 1024), inline: !!f.inline })));
  if (image) e.setImage(image);
  const thumb = thumbnail === undefined ? guild()?.iconURL({ size: 256 }) : thumbnail;
  if (thumb) e.setThumbnail(thumb);
  return e;
}

async function securityLog(type, text, color = '#e74c3c') {
  cfg.addLog(type, text);
  const id = cfg.get().security.logChannelId;
  if (!id) return;
  const ch = await client.channels.fetch(id).catch(() => null);
  if (ch) ch.send({ embeds: [baseEmbed({ title: `🛡️ ${type}`, description: text, color, thumbnail: null })], allowedMentions: { parse: [] } }).catch(() => {});
  if (/🚨|Lockdown|ANTI-NUKE/i.test(type)) client.notifySecurity?.(type, text);
}

client.setMaxListeners(40);

// ---------------- verifikasi & undangan fams ----------------
const fams = require('./fams').setup({ client, baseEmbed, securityLog });
const tracker = require('./tracker').setup({ client, baseEmbed });
const modules = ['notify', 'tickets', 'levels', 'engage', 'moderation', 'community', 'guide', 'members', 'shop', 'divisions']
  .map((name) => ({ name, ...require(`./${name}`).setup({ client, baseEmbed, securityLog }) }));

// ---------------- postingan resmi ----------------
async function publishPost(key, forceNew = false) {
  const s = cfg.get();
  const section = s.posts[key];
  if (!section) throw new Error('Bagian tidak ditemukan');
  const channel = await client.channels.fetch(section.channelId);
  const embeds = section.embeds.map((d) => baseEmbed(d));
  if (!forceNew && s.postIds[key]) {
    try {
      const msg = await channel.messages.fetch(s.postIds[key]);
      await msg.edit({ embeds });
      return { key, label: section.label, action: 'updated', channelId: section.channelId };
    } catch { /* pesan lama hilang → kirim baru */ }
  }
  const msg = await channel.send({ embeds, allowedMentions: { parse: [] } });
  s.postIds[key] = msg.id;
  cfg.save();
  return { key, label: section.label, action: 'posted', channelId: section.channelId };
}

async function publishAll(forceNew = false) {
  const out = [];
  for (const key of Object.keys(cfg.get().posts)) {
    try { out.push(await publishPost(key, forceNew)); }
    catch (err) { out.push({ key, label: cfg.get().posts[key].label, action: 'error', error: err.message }); }
  }
  return out;
}

async function announce({ channelId, title, description, color, image, roleId, plain }) {
  const ch = await client.channels.fetch(channelId);
  const payload = {
    content: roleId ? `<@&${roleId}>` : undefined,
    allowedMentions: { roles: roleId ? [roleId] : [], parse: [] },
  };
  if (plain) payload.content = [payload.content, description].filter(Boolean).join('\n');
  else payload.embeds = [baseEmbed({ title, description, color, image })];
  const msg = await ch.send(payload);
  cfg.addLog('Pengumuman', `Dikirim ke <#${channelId}>: ${title || description?.slice(0, 60)}`);
  return msg.id;
}

// ---------------- welcome / goodbye ----------------
function welcomeEmbed(member, w) {
  return baseEmbed({
    title: fill(w.title, member),
    description: fill(w.message, member),
    image: w.image || undefined,
    thumbnail: member.user.displayAvatarURL({ size: 256 }),
  });
}

const cards = require('./cards');
async function cardFor(kind, member) {
  if (cfg.get()[kind].card === false || !cards.available()) return null;
  const g = member.guild;
  const buf = await cards.makeCard(kind, { username: member.displayName || member.user.username, avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 256 }), guildName: g.name, memberCount: g.memberCount, iconUrl: g.iconURL({ extension: 'png', size: 128 }) }).catch(() => null);
  return buf ? { attachment: buf, name: `${kind}.png` } : null;
}

async function sendWelcome(member, test = false) {
  const w = cfg.get().welcome;
  if (!w.enabled && !test) return;
  if (w.channelId) {
    const ch = await client.channels.fetch(w.channelId).catch(() => null);
    const file = ch && await cardFor('welcome', member);
    const e = welcomeEmbed(member, w); if (file && !w.image) e.setImage('attachment://welcome.png');
    if (ch) await ch.send({ content: test ? '🧪 *Tes pesan welcome*' : `<@${member.id}>`, embeds: [e], files: file ? [file] : [], allowedMentions: { users: test ? [] : [member.id] } });
  }
  if (w.dm && !test) member.send({ embeds: [welcomeEmbed(member, w)] }).catch(() => {});
}

async function sendGoodbye(member, test = false) {
  const gb = cfg.get().goodbye;
  if ((!gb.enabled && !test) || !gb.channelId) return;
  const ch = await client.channels.fetch(gb.channelId).catch(() => null);
  const file = ch && await cardFor('goodbye', member);
  const e = baseEmbed({ title: fill(gb.title, member), description: fill(gb.message, member), thumbnail: member.user.displayAvatarURL({ size: 256 }), color: '#7f8c8d' }); if (file) e.setImage('attachment://goodbye.png');
  if (ch) await ch.send({ content: test ? '🧪 *Tes pesan goodbye*' : undefined, embeds: [e], files: file ? [file] : [], allowedMentions: { parse: [] } });
}

// ---------------- status ----------------
let statusTimer;
const TYPES = { Playing: ActivityType.Playing, Watching: ActivityType.Watching, Listening: ActivityType.Listening, Competing: ActivityType.Competing };
function applyStatus() {
  clearInterval(statusTimer);
  const { items, interval } = cfg.get().status;
  const list = (items || []).filter((i) => i.text);
  if (!list.length) return;
  let i = 0;
  const tick = () => {
    const it = list[i % list.length];
    client.user.setPresence({ activities: [{ name: fill(it.text), type: TYPES[it.type] ?? ActivityType.Watching }], status: 'online' });
    i++;
  };
  tick();
  statusTimer = setInterval(tick, Math.max(10, Number(interval) || 30) * 1000);
}

// ---------------- keamanan ----------------
const isExempt = (member) => {
  if (!member) return true;
  const sec = cfg.get().security;
  return member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    sec.trustedUserIds.includes(member.id) ||
    member.roles.cache.some((r) => sec.exemptRoleIds.includes(r.id));
};

const INVITE_RE = /(discord\.gg|discord(?:app)?\.com\/invite|dsc\.gg)\/[\w-]+/i;
const LINK_RE = /https?:\/\/([^\s/]+)[^\s]*/gi;
const SCAM_RE = /(free\s*nitro|nitro\s*gratis|steam\s*gift|discord\s*gift|robux\s*gratis|free\s*robux|@everyone.*(gift|nitro|airdrop)|claim\s*(your)?\s*(nitro|reward))/i;
const SCAM_DOMAINS = /(dlscord|discorcl|disocrd|discrod|dicsord|steamcommunlty|steamcommnuity|nitro-gift|free-nitro|discordgift\.|gift-discord)/i;

const spamMap = new Map();

async function punish(message, reason, minutes) {
  await message.delete().catch(() => {});
  if (minutes > 0) await message.member.timeout(minutes * 60_000, `TRO SYSTEM: ${reason}`).catch(() => {});
  const warn = await message.channel.send({ content: `⚠️ <@${message.author.id}> ${reason}${minutes > 0 ? ` — timeout ${minutes} menit.` : '.'}`, allowedMentions: { users: [message.author.id] } }).catch(() => null);
  if (warn) setTimeout(() => warn.delete().catch(() => {}), 8000);
  securityLog(reason, `**User:** <@${message.author.id}> (${message.author.tag})\n**Channel:** <#${message.channel.id}>\n**Pesan:** ${message.content.slice(0, 300) || '(kosong)'}`, '#e67e22');
}

client.on(Events.MessageCreate, async (message) => {
  if (!message.guild || message.guild.id !== GUILD_ID || message.author.bot || !message.member) return;
  if (isExempt(message.member)) return;
  const sec = cfg.get().security;
  const content = message.content || '';

  // anti scam / phishing
  if (sec.antiScam.enabled && (SCAM_RE.test(content) || SCAM_DOMAINS.test(content))) {
    return punish(message, 'Pesan terindikasi scam/phishing dihapus', 60);
  }
  // anti link
  if (sec.antiLink.enabled) {
    if (sec.antiLink.blockInvites && INVITE_RE.test(content)) return punish(message, 'Dilarang share invite server lain', 0);
    if (sec.antiLink.blockAllLinks) {
      const hosts = [...content.matchAll(LINK_RE)].map((m) => m[1].toLowerCase());
      const bad = hosts.find((h) => !sec.antiLink.whitelist.some((w) => h === w || h.endsWith(`.${w}`)));
      if (bad) return punish(message, `Link ${bad} tidak diizinkan`, 0);
    }
  }
  // anti mass mention
  if (sec.antiMention.enabled) {
    const count = message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 5 : 0);
    if (count >= sec.antiMention.max) return punish(message, 'Mass mention terdeteksi', sec.antiMention.timeoutMinutes);
  }
  // anti spam
  if (sec.antiSpam.enabled) {
    const now = Date.now();
    const list = (spamMap.get(message.author.id) || []).filter((t) => now - t < sec.antiSpam.seconds * 1000);
    list.push(now);
    spamMap.set(message.author.id, list);
    if (list.length >= sec.antiSpam.messages) {
      spamMap.delete(message.author.id);
      const recent = await message.channel.messages.fetch({ limit: 30 }).catch(() => null);
      if (recent) await message.channel.bulkDelete(recent.filter((m) => m.author.id === message.author.id), true).catch(() => {});
      return punish(message, 'Spam terdeteksi', sec.antiSpam.timeoutMinutes);
    }
  }
});

// anti raid + umur akun + autorole + welcome
const joinTimes = [];
let lockdownUntil = 0;

client.on(Events.GuildMemberAdd, async (member) => {
  if (member.guild.id !== GUILD_ID) return;
  const s = cfg.get();
  const raid = s.security.antiRaid;
  if (raid.enabled && !member.user.bot) {
    const now = Date.now();
    joinTimes.push(now);
    while (joinTimes.length && now - joinTimes[0] > raid.seconds * 1000) joinTimes.shift();
    if (joinTimes.length >= raid.joins && now > lockdownUntil) {
      lockdownUntil = now + raid.lockdownMinutes * 60_000;
      securityLog('🚨 RAID TERDETEKSI', `${joinTimes.length} akun join dalam ${raid.seconds} detik.\nLockdown aktif ${raid.lockdownMinutes} menit — member baru otomatis di-kick.`);
    }
    if (now < lockdownUntil) {
      await member.send(`🔒 **${member.guild.name}** sedang lockdown anti-raid. Coba join lagi beberapa menit lagi ya.`).catch(() => {});
      await member.kick('TRO SYSTEM: lockdown anti-raid').catch(() => {});
      return securityLog('Kick (lockdown)', `${member.user.tag} (${member.id})`, '#e67e22');
    }
    const ageDays = (now - member.user.createdTimestamp) / 86_400_000;
    if (raid.minAccountAgeDays > 0 && ageDays < raid.minAccountAgeDays) {
      await member.send(`⚠️ Akun kamu terlalu baru untuk join **${member.guild.name}** (minimal ${raid.minAccountAgeDays} hari).`).catch(() => {});
      await member.kick('TRO SYSTEM: akun terlalu baru').catch(() => {});
      return securityLog('Kick (akun baru)', `${member.user.tag} — umur akun ${ageDays.toFixed(1)} hari`, '#e67e22');
    }
  }
  if (s.autorole.enabled && !member.user.bot && s.autorole.roleIds.length) {
    await member.roles.add(s.autorole.roleIds, 'TRO SYSTEM autorole').catch((e) => securityLog('Autorole gagal', e.message, '#95a5a6'));
  }
  sendWelcome(member).catch(() => {});
});

client.on(Events.GuildMemberRemove, (member) => {
  if (member.guild.id === GUILD_ID) sendGoodbye(member).catch(() => {});
});

// anti nuke (hapus channel/role & ban massal)
const nukeMap = new Map();
async function nukeCheck(g, auditType, what) {
  const nk = cfg.get().security.antiNuke;
  if (!nk.enabled || g.id !== GUILD_ID) return;
  const logs = await g.fetchAuditLogs({ type: auditType, limit: 1 }).catch(() => null);
  const entry = logs?.entries.first();
  if (!entry || Date.now() - entry.createdTimestamp > 10_000) return;
  const ex = entry.executor;
  if (!ex || ex.id === client.user.id || ex.id === g.ownerId || cfg.get().security.trustedUserIds.includes(ex.id)) return;
  const now = Date.now();
  const list = (nukeMap.get(ex.id) || []).filter((t) => now - t < nk.seconds * 1000);
  list.push(now);
  nukeMap.set(ex.id, list);
  if (list.length >= nk.limit) {
    nukeMap.delete(ex.id);
    const m = await g.members.fetch(ex.id).catch(() => null);
    if (m) await m.roles.set([], 'TRO SYSTEM anti-nuke').catch(() => {});
    securityLog('🚨 ANTI-NUKE', `<@${ex.id}> melakukan ${list.length}x ${what} dalam ${nk.seconds} detik.\nSemua role-nya sudah dicabut otomatis.`);
  }
}
client.on(Events.ChannelDelete, (ch) => ch.guild && nukeCheck(ch.guild, AuditLogEvent.ChannelDelete, 'hapus channel'));
client.on(Events.GuildRoleDelete, (r) => nukeCheck(r.guild, AuditLogEvent.RoleDelete, 'hapus role'));
client.on(Events.GuildBanAdd, (b) => nukeCheck(b.guild, AuditLogEvent.MemberBanAdd, 'ban member'));

// ---------------- slash commands ----------------
const buildCommands = () => {
  const choices = [{ name: '⭐ Semua', value: 'semua' }, ...Object.entries(cfg.get().posts).slice(0, 24).map(([k, p]) => ({ name: p.label, value: k }))];
  return [
    new SlashCommandBuilder().setName('tro-post').setDescription('Posting / update info resmi TRO SYSTEM')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((o) => o.setName('bagian').setDescription('Bagian yang diposting').setRequired(true).addChoices(...choices))
      .addBooleanOption((o) => o.setName('posting_baru').setDescription('True = kirim pesan baru (default: update pesan lama)')),
    new SlashCommandBuilder().setName('tro-announce').setDescription('Pengumuman embed atas nama TRO SYSTEM')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((o) => o.setName('judul').setDescription('Judul').setRequired(true))
      .addStringOption((o) => o.setName('isi').setDescription('Isi (pakai \\n untuk baris baru)').setRequired(true))
      .addChannelOption((o) => o.setName('channel').setDescription('Channel tujuan').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addRoleOption((o) => o.setName('tag').setDescription('Role yang di-tag'))
      .addAttachmentOption((o) => o.setName('gambar').setDescription('Gambar/poster')),
    new SlashCommandBuilder().setName('tro-say').setDescription('Kirim pesan biasa atas nama TRO SYSTEM')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((o) => o.setName('pesan').setDescription('Isi pesan').setRequired(true)),
    new SlashCommandBuilder().setName('tro-bersihin').setDescription('Hapus pesan lama (Oned & kamu) di channel info resmi')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addBooleanOption((o) => o.setName('yakin').setDescription('False = cek dulu (default), True = hapus beneran')),
    new SlashCommandBuilder().setName('tro-lockdown').setDescription('Kunci / buka lockdown anti-raid manual')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addIntegerOption((o) => o.setName('menit').setDescription('Lama lockdown (0 = buka)').setRequired(true)),
    new SlashCommandBuilder().setName('tro-verifikasi').setDescription('Kirim / update panel verifikasi')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('undangan').setDescription('Jadwal undangan fams TRO')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addSubcommand((sc) => sc.setName('tambah').setDescription('Catat undangan fams baru')
        .addStringOption((o) => o.setName('fams').setDescription('Nama fams / komunitas').setRequired(true))
        .addStringOption((o) => o.setName('tanggal').setDescription('Contoh: 08/11/2026, besok').setRequired(true))
        .addStringOption((o) => o.setName('jam').setDescription('Contoh: 20:00 WIB'))
        .addStringOption((o) => o.setName('tempat').setDescription('Map / lokasi'))
        .addStringOption((o) => o.setName('link').setDescription('Link map / event'))
        .addStringOption((o) => o.setName('catatan').setDescription('Catatan tambahan')))
      .addSubcommand((sc) => sc.setName('list').setDescription('Lihat jadwal undangan'))
      .addSubcommand((sc) => sc.setName('hapus').setDescription('Hapus undangan')
        .addStringOption((o) => o.setName('id').setDescription('ID dari /undangan list').setRequired(true))),
    new SlashCommandBuilder().setName('tro-info').setDescription('Info & statistik server TRO'),
  ].map((c) => c.toJSON()).concat([tracker.command], fams.commands, ...modules.map((m) => m.commands || []));
};

async function registerCommands() {
  const g = await client.guilds.fetch(GUILD_ID);
  await g.commands.set(buildCommands());
}

client.on(Events.InteractionCreate, async (it) => {
  if (!it.isChatInputCommand()) return;
  try {
    if (it.commandName === 'tro-post') {
      await it.deferReply({ flags: MessageFlags.Ephemeral });
      const pilihan = it.options.getString('bagian');
      const forceNew = it.options.getBoolean('posting_baru') ?? false;
      const res = pilihan === 'semua' ? await publishAll(forceNew) : [await publishPost(pilihan, forceNew).catch((e) => ({ label: pilihan, action: 'error', error: e.message }))];
      return it.editReply(res.map((r) => r.action === 'error' ? `❌ ${r.label}: ${r.error}` : `${r.action === 'updated' ? '🔄' : '✅'} ${r.label} → <#${r.channelId}>`).join('\n'));
    }
    if (it.commandName === 'tro-announce') {
      const ch = it.options.getChannel('channel') ?? it.channel;
      await announce({ channelId: ch.id, title: `📢 ${it.options.getString('judul')}`, description: it.options.getString('isi').replace(/\\n/g, '\n'), image: it.options.getAttachment('gambar')?.url, roleId: it.options.getRole('tag')?.id });
      return it.reply({ content: `✅ Terkirim ke ${ch}`, flags: MessageFlags.Ephemeral });
    }
    if (it.commandName === 'tro-say') {
      await it.channel.send({ content: it.options.getString('pesan').replace(/\\n/g, '\n'), allowedMentions: { parse: [] } });
      return it.reply({ content: '✅ Terkirim', flags: MessageFlags.Ephemeral });
    }
    if (it.commandName === 'tro-verifikasi') {
      await it.deferReply({ flags: MessageFlags.Ephemeral });
      const r = await fams.sendPanel();
      return it.editReply(r === 'updated' ? '🔄 Panel verifikasi diupdate.' : '✅ Panel verifikasi dikirim.');
    }
    if (it.commandName === 'tro-lockdown') {
      const menit = it.options.getInteger('menit');
      lockdownUntil = menit > 0 ? Date.now() + menit * 60_000 : 0;
      securityLog(menit > 0 ? '🔒 Lockdown manual' : '🔓 Lockdown dibuka', `Oleh <@${it.user.id}>${menit > 0 ? ` selama ${menit} menit` : ''}`, '#3498db');
      return it.reply({ content: menit > 0 ? `🔒 Lockdown aktif ${menit} menit.` : '🔓 Lockdown dibuka.', flags: MessageFlags.Ephemeral });
    }
    if (it.commandName === 'tro-bersihin') {
      await it.deferReply({ flags: MessageFlags.Ephemeral });
      const yakin = it.options.getBoolean('yakin') ?? false;
      const ids = [...new Set([...Object.values(cfg.get().posts).map((p) => p.channelId), '1463503528453472421', '1462845647039238296'])];
      const target = (m) => m.author.id !== client.user.id && (m.author.id === it.user.id || /^oned$/i.test(m.author.username) || /^oned$/i.test(m.member?.displayName ?? '') || /^oned$/i.test(m.author.globalName ?? ''));
      let total = 0; const out = [];
      for (const id of ids) {
        try {
          const ch = await client.channels.fetch(id);
          const list = [...(await ch.messages.fetch({ limit: 100 })).values()].filter(target);
          if (yakin) for (const m of list) await m.delete().catch(() => {});
          total += list.length; out.push(`${yakin ? '🗑️' : '🔍'} <#${id}> — ${list.length} pesan`);
        } catch (e) { out.push(`❌ <#${id}> — ${e.message}`); }
      }
      return it.editReply(`${yakin ? `✅ **${total} pesan lama dihapus.**` : `🔍 **Cek dulu:** ${total} pesan akan dihapus. Jalankan \`/tro-bersihin yakin:True\`.`}\n\n${out.join('\n')}`);
    }
    if (it.commandName === 'tro-info') {
      const g = it.guild;
      return it.reply({ embeds: [baseEmbed({ title: `🦉 ${g.name}`, description: '*In wisdom, we endure.*', fields: [
        { name: '👥 Member', value: `${g.memberCount}`, inline: true },
        { name: '📅 Berdiri', value: '13/11/2025', inline: true },
        { name: '🚀 Boost', value: `${g.premiumSubscriptionCount ?? 0}`, inline: true },
      ] })] });
    }
  } catch (err) {
    console.error(err);
    const msg = { content: `❌ Error: ${err.message}`, flags: MessageFlags.Ephemeral };
    if (it.deferred || it.replied) it.editReply(msg).catch(() => {}); else it.reply(msg).catch(() => {});
  }
});

client.once(Events.ClientReady, async (c) => {
  cfg.load();
  await registerCommands().catch((e) => console.error('Gagal daftar command:', e.message));
  const g = await c.guilds.fetch(GUILD_ID);
  await g.members.fetch().catch(() => {});
  applyStatus();
  // 🦉 logo TRO: kalau bot masih pakai avatar default, pakai logo server TRO
  if (!c.user.avatar && g.iconURL()) {
    await c.user.setAvatar(g.iconURL({ extension: 'png', size: 1024 }))
      .then(() => console.log('  🦉 Foto profil bot diganti ke logo TRO'))
      .catch((e) => console.log('  (avatar belum bisa diganti:', e.message, ')'));
  }
  console.log(`\n  🦉 ${c.user.tag} ONLINE di "${g.name}"`);
});

module.exports = {
  fams,
  tracker,
  modules,
  client, guild, publishPost, publishAll, announce, sendWelcome, sendGoodbye, applyStatus, registerCommands,
  buildCommands,
  lockdown: { get: () => lockdownUntil, set: (ms) => { lockdownUntil = ms; } },
};
