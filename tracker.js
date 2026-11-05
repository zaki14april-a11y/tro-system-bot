// ============================================================
//  🦉 TRO SYSTEM — Invite Tracker
//  Siapa yang ngundang, lewat link apa, kapan.
// ============================================================
const { Events, PermissionFlagsBits, SlashCommandBuilder, MessageFlags } = require('discord.js');
const cfg = require('./config');

function setup({ client, baseEmbed }) {
  const cache = new Map(); // code -> { uses, inviterId, deleted }
  let vanityUses = null;
  const data = () => {
    const s = cfg.get();
    s.trackerData = s.trackerData || { joins: [], counts: {} };
    return s.trackerData;
  };

  async function cacheInvites(g) {
    const inv = await g.invites.fetch().catch(() => null);
    if (inv) {
      for (const [code, c] of cache) if (!c.deleted) cache.delete(code);
      inv.forEach((i) => cache.set(i.code, { uses: i.uses ?? 0, inviterId: i.inviter?.id || null }));
    }
    if (g.vanityURLCode) {
      const v = await g.fetchVanityData().catch(() => null);
      if (v) vanityUses = v.uses;
    }
  }

  client.once(Events.ClientReady, async () => {
    const g = client.guilds.cache.get(process.env.GUILD_ID);
    if (g) await cacheInvites(g);
  });
  client.on(Events.InviteCreate, (i) => cache.set(i.code, { uses: i.uses ?? 0, inviterId: i.inviter?.id || null }));
  // invite sekali pakai langsung terhapus saat dipakai → tandai, jangan buang dulu
  client.on(Events.InviteDelete, (i) => { const c = cache.get(i.code); if (c) c.deleted = Date.now(); });

  async function detect(g) {
    const before = new Map([...cache].map(([k, v]) => [k, { ...v }]));
    const inv = await g.invites.fetch().catch(() => null);
    let used = null;
    if (inv && before.size) {
      for (const i of inv.values()) {
        const b = before.get(i.code);
        if ((b && (i.uses ?? 0) > b.uses) || (!b && (i.uses ?? 0) > 0)) { used = { code: i.code, inviterId: i.inviter?.id || null }; break; }
      }
      if (!used) {
        for (const [code, b] of before) {
          if (!inv.has(code) && (b.deleted ? Date.now() - b.deleted < 60_000 : true)) { used = { code, inviterId: b.inviterId }; break; }
        }
      }
    }
    if (!used && g.vanityURLCode) {
      const v = await g.fetchVanityData().catch(() => null);
      if (v && vanityUses !== null && v.uses > vanityUses) used = { code: g.vanityURLCode, vanity: true };
    }
    await cacheInvites(g);
    for (const [code, c] of cache) if (c.deleted && Date.now() - c.deleted > 60_000) cache.delete(code);
    return used;
  }

  async function send(embed) {
    const t = cfg.get().tracker;
    if (!t?.channelId) return;
    const ch = await client.channels.fetch(t.channelId).catch(() => null);
    if (ch) ch.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
  }

  client.on(Events.GuildMemberAdd, async (member) => {
    const t = cfg.get().tracker;
    if (member.guild.id !== process.env.GUILD_ID || !t?.enabled) return;
    const used = await detect(member.guild);
    const d = data();
    if (used?.inviterId) d.counts[used.inviterId] = (d.counts[used.inviterId] || 0) + 1;
    d.joins.unshift({
      userId: member.id, username: member.user.username, inviterId: used?.inviterId || null,
      code: used?.code || null, vanity: !!used?.vanity, time: new Date().toISOString(),
      accountCreated: member.user.createdTimestamp, bot: member.user.bot,
    });
    d.joins = d.joins.slice(0, 1000);
    cfg.save();
    const via = used?.vanity ? `🔗 Vanity URL \`discord.gg/${used.code}\``
      : used?.code ? `🔗 \`discord.gg/${used.code}\`` : '❔ Tidak terdeteksi (link sementara / widget / bot)';
    const by = used?.inviterId ? `<@${used.inviterId}> — total **${d.counts[used.inviterId]}** undangan` : used?.vanity ? 'Vanity URL server' : '—';
    const ageDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000);
    send(baseEmbed({
      title: `📥 ${member.user.bot ? 'Bot' : 'Member'} baru join`,
      description: `<@${member.id}> (${member.user.username})\nMember ke-**${member.guild.memberCount}**`,
      fields: [
        { name: '👤 Diundang oleh', value: by, inline: true },
        { name: '🔗 Lewat', value: via, inline: true },
        { name: '🕒 Waktu', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
        { name: '📅 Umur akun', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>${ageDays < 7 ? ' ⚠️ akun baru' : ''}`, inline: true },
      ],
      thumbnail: member.user.displayAvatarURL({ size: 256 }),
      color: '#30a46c',
    }));
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    const t = cfg.get().tracker;
    if (member.guild.id !== process.env.GUILD_ID || !t?.enabled) return;
    const d = data();
    const j = d.joins.find((x) => x.userId === member.id && !x.leftAt);
    if (j) { j.leftAt = new Date().toISOString(); cfg.save(); }
    send(baseEmbed({
      title: '📤 Member keluar',
      description: `<@${member.id}> (${member.user.username})${j?.inviterId ? `\nDulu diundang oleh <@${j.inviterId}>` : ''}${j ? `\nJoin <t:${Math.floor(Date.parse(j.time) / 1000)}:R>` : ''}`,
      thumbnail: member.user.displayAvatarURL({ size: 256 }),
      color: '#e5484d',
    }));
  });

  // /invites [user]
  client.on(Events.InteractionCreate, async (it) => {
    if (!it.isChatInputCommand() || it.commandName !== 'invites') return;
    const u = it.options.getUser('user') || it.user;
    const d = data();
    const list = d.joins.filter((j) => j.inviterId === u.id);
    const stay = list.filter((j) => !j.leftAt).length;
    return it.reply({
      embeds: [baseEmbed({
        title: `📨 Undangan ${u.username}`,
        description: `Total **${list.length}** orang · masih di server **${stay}** · keluar **${list.length - stay}**`,
        fields: list.length ? [{ name: 'Terakhir', value: list.slice(0, 10).map((j) => `<@${j.userId}> · <t:${Math.floor(Date.parse(j.time) / 1000)}:R>${j.leftAt ? ' (keluar)' : ''}`).join('\n') }] : [],
        thumbnail: u.displayAvatarURL({ size: 256 }),
      })],
      flags: MessageFlags.Ephemeral,
    });
  });

  return {
    command: new SlashCommandBuilder().setName('invites').setDescription('Cek berapa orang yang kamu / seseorang undang')
      .addUserOption((o) => o.setName('user').setDescription('User yang dicek')).toJSON(),
    stats() {
      const d = data();
      const board = {};
      d.joins.forEach((j) => { if (!j.inviterId) return; board[j.inviterId] = board[j.inviterId] || { total: 0, stay: 0 }; board[j.inviterId].total++; if (!j.leftAt) board[j.inviterId].stay++; });
      return { joins: d.joins.slice(0, 200), board: Object.entries(board).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total).slice(0, 50) };
    },
  };
}

module.exports = { setup, PermissionFlagsBits };
