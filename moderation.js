// ============================================================
//  ⚖️ TRO SYSTEM — Warn & moderasi
// ============================================================
const { Events, SlashCommandBuilder, PermissionFlagsBits: P, MessageFlags } = require('discord.js');
const cfg = require('./config');
const { parseDuration } = require('./engage');

const LABEL = { warn: '⚠️ Warn', timeout: '🔇 Timeout', untimeout: '🔊 Buka timeout', kick: '👢 Kick', ban: '🔨 Ban', unban: '♻️ Unban', purge: '🧹 Purge' };
const COLOR = { warn: '#f1c40f', timeout: '#e67e22', untimeout: '#3498db', kick: '#e67e22', ban: '#e5484d', unban: '#30a46c', purge: '#7f8c8d' };

function setup({ client, baseEmbed }) {
  const D = () => cfg.data('modData', { counter: 0, cases: [] });
  const M = () => cfg.get().moderation;
  const guild = () => client.guilds.cache.get(process.env.GUILD_ID);

  async function record({ action, user, mod, reason, duration }) {
    const d = D();
    d.counter += 1;
    const c = { id: d.counter, action, userId: user.id, username: user.username, modId: mod.id, modName: mod.username, reason: reason || '-', duration: duration || 0, time: new Date().toISOString(), active: true };
    d.cases.unshift(c);
    d.cases = d.cases.slice(0, 3000);
    cfg.save();
    const log = M().logChannelId && await client.channels.fetch(M().logChannelId).catch(() => null);
    if (log) log.send({ embeds: [baseEmbed({
      title: `${LABEL[action]} · Kasus #${c.id}`,
      description: `**User:** <@${user.id}> (${user.username})\n**Moderator:** <@${mod.id}>\n**Alasan:** ${c.reason}${duration ? `\n**Durasi:** ${Math.round(duration / 60_000)} menit` : ''}`,
      color: COLOR[action], thumbnail: user.displayAvatarURL?.({ size: 128 }) || null,
    })], allowedMentions: { parse: [] } }).catch(() => {});
    cfg.addLog(`Moderasi: ${LABEL[action]}`, `${user.username} oleh ${mod.username} — ${c.reason}`);
    return c;
  }

  async function dm(user, action, reason, extra = '') {
    if (!M().dmUser) return;
    await user.send({ embeds: [baseEmbed({
      title: `${LABEL[action]} — ${guild()?.name}`,
      description: `**Alasan:** ${reason || '-'}${extra}`, color: COLOR[action],
    })] }).catch(() => {});
  }

  const activeWarns = (id) => D().cases.filter((c) => c.userId === id && c.action === 'warn' && c.active).length;

  async function doAction(action, { user, member, mod, reason, durationMs, deleteDays, amount, channel }) {
    switch (action) {
      case 'warn': {
        await dm(user, 'warn', reason);
        const c = await record({ action, user, mod, reason });
        const n = activeWarns(user.id);
        const auto = [...M().autoActions].sort((a, b) => b.warns - a.warns).find((a) => Number(a.warns) === n);
        let autoText = '';
        if (auto && member) {
          if (auto.action === 'timeout') { await member.timeout(auto.minutes * 60_000, `Auto: ${n} warn`).catch(() => {}); autoText = ` → otomatis timeout ${auto.minutes} menit`; await record({ action: 'timeout', user, mod: client.user, reason: `Otomatis: ${n} warn`, duration: auto.minutes * 60_000 }); }
          if (auto.action === 'kick') { await dm(user, 'kick', `Otomatis: ${n} warn`); await member.kick(`Auto: ${n} warn`).catch(() => {}); autoText = ' → otomatis di-kick'; await record({ action: 'kick', user, mod: client.user, reason: `Otomatis: ${n} warn` }); }
          if (auto.action === 'ban') { await dm(user, 'ban', `Otomatis: ${n} warn`); await member.ban({ reason: `Auto: ${n} warn` }).catch(() => {}); autoText = ' → otomatis di-ban'; await record({ action: 'ban', user, mod: client.user, reason: `Otomatis: ${n} warn` }); }
        }
        return `⚠️ <@${user.id}> di-warn (kasus #${c.id}) — total **${n}** warn aktif${autoText}.`;
      }
      case 'timeout': {
        if (!member) throw new Error('User tidak ada di server');
        await member.timeout(durationMs, reason);
        await dm(user, 'timeout', reason, `\n**Durasi:** ${Math.round(durationMs / 60_000)} menit`);
        const c = await record({ action, user, mod, reason, duration: durationMs });
        return `🔇 <@${user.id}> di-timeout ${Math.round(durationMs / 60_000)} menit (kasus #${c.id}).`;
      }
      case 'untimeout': {
        if (!member) throw new Error('User tidak ada di server');
        await member.timeout(null, reason);
        const c = await record({ action, user, mod, reason });
        return `🔊 Timeout <@${user.id}> dibuka (kasus #${c.id}).`;
      }
      case 'kick': {
        if (!member) throw new Error('User tidak ada di server');
        await dm(user, 'kick', reason);
        await member.kick(reason);
        const c = await record({ action, user, mod, reason });
        return `👢 ${user.username} di-kick (kasus #${c.id}).`;
      }
      case 'ban': {
        await dm(user, 'ban', reason);
        await guild().members.ban(user.id, { reason, deleteMessageSeconds: Math.min(7, deleteDays || 0) * 86400 });
        const c = await record({ action, user, mod, reason });
        return `🔨 ${user.username} di-ban (kasus #${c.id}).`;
      }
      case 'unban': {
        await guild().members.unban(user.id, reason);
        const c = await record({ action, user, mod, reason });
        return `♻️ ${user.username} di-unban (kasus #${c.id}).`;
      }
      case 'purge': {
        let msgs = await channel.messages.fetch({ limit: 100 });
        if (user) msgs = msgs.filter((m) => m.author.id === user.id);
        const del = await channel.bulkDelete([...msgs.values()].slice(0, Math.min(100, amount || 10)), true);
        await record({ action, user: user || mod, mod, reason: `${del.size} pesan di #${channel.name}` });
        return `🧹 ${del.size} pesan dihapus.`;
      }
      default: throw new Error('Aksi tidak dikenal');
    }
  }

  client.on(Events.InteractionCreate, async (it) => {
    if (!it.isChatInputCommand()) return;
    const names = ['warn', 'warnings', 'unwarn', 'mute', 'unmute', 'kick', 'ban', 'unban', 'purge'];
    if (!names.includes(it.commandName)) return;
    try {
      await it.deferReply({ flags: MessageFlags.Ephemeral });
      const user = it.options.getUser('user');
      const member = user ? await it.guild.members.fetch(user.id).catch(() => null) : null;
      const reason = it.options.getString('alasan') || '-';
      if (member && it.commandName !== 'warnings' && member.roles.highest.position >= it.member.roles.highest.position && it.guild.ownerId !== it.user.id) {
        return it.editReply('⛔ Role orang ini setara / lebih tinggi dari kamu.');
      }
      if (it.commandName === 'warnings') {
        const list = D().cases.filter((c) => c.userId === user.id);
        return it.editReply({ embeds: [baseEmbed({
          title: `📋 Riwayat ${user.username}`,
          description: list.length ? list.slice(0, 20).map((c) => `\`#${c.id}\` ${LABEL[c.action]}${c.action === 'warn' && !c.active ? ' ~~(dicabut)~~' : ''} · ${c.reason} · <t:${Math.floor(Date.parse(c.time) / 1000)}:R> · oleh ${c.modName}`).join('\n') : 'Bersih ✨ belum ada catatan.',
          thumbnail: user.displayAvatarURL({ size: 128 }),
        })] });
      }
      if (it.commandName === 'unwarn') {
        const c = D().cases.find((x) => x.id === it.options.getInteger('kasus') && x.action === 'warn');
        if (!c) return it.editReply('Kasus warn tidak ditemukan.');
        c.active = false; cfg.save();
        return it.editReply(`✅ Warn #${c.id} untuk ${c.username} dicabut.`);
      }
      const map = { mute: 'timeout', unmute: 'untimeout' };
      const action = map[it.commandName] || it.commandName;
      const durationMs = action === 'timeout' ? parseDuration(it.options.getString('durasi')) : 0;
      if (action === 'timeout' && (!durationMs || durationMs > 28 * 86_400_000)) return it.editReply('Durasi salah (contoh: 10m, 2h, 1d — maks 28 hari).');
      const msg = await doAction(action, { user, member, mod: it.user, reason, durationMs, deleteDays: it.options.getInteger('hapus_pesan_hari') || 0, amount: it.options.getInteger('jumlah'), channel: it.channel });
      return it.editReply(msg);
    } catch (err) { it.editReply(`❌ ${err.message}`).catch(() => {}); }
  });

  const u = (o) => o.setName('user').setDescription('User').setRequired(true);
  const r = (o) => o.setName('alasan').setDescription('Alasan');
  const commands = [
    new SlashCommandBuilder().setName('warn').setDescription('Beri peringatan').setDefaultMemberPermissions(P.ModerateMembers).addUserOption(u).addStringOption((o) => r(o).setRequired(true)),
    new SlashCommandBuilder().setName('warnings').setDescription('Riwayat pelanggaran user').setDefaultMemberPermissions(P.ModerateMembers).addUserOption(u),
    new SlashCommandBuilder().setName('unwarn').setDescription('Cabut warn').setDefaultMemberPermissions(P.ModerateMembers).addIntegerOption((o) => o.setName('kasus').setDescription('Nomor kasus').setRequired(true)),
    new SlashCommandBuilder().setName('mute').setDescription('Timeout user').setDefaultMemberPermissions(P.ModerateMembers).addUserOption(u).addStringOption((o) => o.setName('durasi').setDescription('10m, 2h, 1d').setRequired(true)).addStringOption(r),
    new SlashCommandBuilder().setName('unmute').setDescription('Buka timeout').setDefaultMemberPermissions(P.ModerateMembers).addUserOption(u).addStringOption(r),
    new SlashCommandBuilder().setName('kick').setDescription('Kick user').setDefaultMemberPermissions(P.KickMembers).addUserOption(u).addStringOption(r),
    new SlashCommandBuilder().setName('ban').setDescription('Ban user').setDefaultMemberPermissions(P.BanMembers).addUserOption(u).addStringOption(r).addIntegerOption((o) => o.setName('hapus_pesan_hari').setDescription('Hapus pesan X hari terakhir (0-7)').setMinValue(0).setMaxValue(7)),
    new SlashCommandBuilder().setName('unban').setDescription('Unban user').setDefaultMemberPermissions(P.BanMembers).addUserOption(u).addStringOption(r),
    new SlashCommandBuilder().setName('purge').setDescription('Hapus banyak pesan sekaligus').setDefaultMemberPermissions(P.ManageMessages).addIntegerOption((o) => o.setName('jumlah').setDescription('1-100').setRequired(true).setMinValue(1).setMaxValue(100)).addUserOption((o) => o.setName('user').setDescription('Hanya pesan user ini')),
  ].map((c) => c.toJSON());

  function routes(api) {
    api.get('/modcases', (req, res) => res.json(D().cases.slice(0, 500)));
    api.post('/modcases/:id/revoke', (req, res) => { const c = D().cases.find((x) => x.id === Number(req.params.id)); if (c) { c.active = false; cfg.save(); } res.json({ ok: !!c }); });
    api.post('/moderate', async (req, res) => {
      try {
        const { action, userId, reason, minutes } = req.body;
        const user = await client.users.fetch(userId);
        const member = await guild().members.fetch(userId).catch(() => null);
        const mod = await client.users.fetch(req.session.user.id);
        res.json({ message: await doAction(action, { user, member, mod, reason: reason || `via dashboard (${mod.username})`, durationMs: (Number(minutes) || 10) * 60_000 }) });
      } catch (e) { res.status(400).json({ error: e.message }); }
    });
  }

  return { commands, routes };
}

module.exports = { setup };
