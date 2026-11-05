// ============================================================
//  ⭐ TRO SYSTEM — Leveling & XP (chat + voice)
// ============================================================
const { Events, SlashCommandBuilder, MessageFlags } = require('discord.js');
const cfg = require('./config');

// XP yang dibutuhkan untuk naik dari level L ke L+1
const need = (l) => 5 * l * l + 50 * l + 100;
function levelFromXp(xp) {
  let l = 0;
  while (xp >= need(l)) { xp -= need(l); l++; }
  return { level: l, into: xp, next: need(l) };
}

function setup({ client, baseEmbed }) {
  const D = () => cfg.data('levelsData', { users: {} });
  const L = () => cfg.get().levels;
  const cooldown = new Map();
  const user = (id) => { const u = D().users; u[id] = u[id] || { xp: 0, msgs: 0, voiceMin: 0 }; return u[id]; };
  const blocked = (member, channelId) => {
    const l = L();
    return l.noXpChannelIds.includes(channelId) || member?.roles.cache.some((r) => l.noXpRoleIds.includes(r.id));
  };

  async function addXp(member, amount, channel) {
    const u = user(member.id);
    const before = levelFromXp(u.xp).level;
    u.xp += Math.round(amount * (client.xpMultiplier?.(member) || 1));
    u.name = member.displayName || member.user.username;
    const after = levelFromXp(u.xp).level;
    cfg.saveSoon();
    if (after > before) await levelUp(member, after, channel);
  }

  async function levelUp(member, level, channel) {
    const l = L();
    const rewards = l.rewards.filter((r) => r.roleId && Number(r.level) <= level).map((r) => r.roleId);
    if (rewards.length) await member.roles.add(rewards, `TRO SYSTEM level ${level}`).catch(() => {});
    const newReward = l.rewards.find((r) => Number(r.level) === level && r.roleId);
    const text = String(l.levelUpMessage || '').replaceAll('{user}', `<@${member.id}>`).replaceAll('{username}', member.user.username).replaceAll('{level}', level)
      + (newReward ? `\n🏅 Dapat role <@&${newReward.roleId}>!` : '');
    const ch = l.announceChannelId ? await client.channels.fetch(l.announceChannelId).catch(() => null) : channel;
    if (ch && text.trim()) ch.send({ content: text, allowedMentions: { users: [member.id] } }).catch(() => {});
  }

  client.on(Events.MessageCreate, async (m) => {
    const l = L();
    if (!l.enabled || !m.guild || m.guild.id !== process.env.GUILD_ID || m.author.bot || !m.member) return;
    if (blocked(m.member, m.channel.id)) return;
    user(m.author.id).msgs++;
    const last = cooldown.get(m.author.id) || 0;
    if (Date.now() - last < Math.max(0, Number(l.cooldown ?? 60)) * 1000) return;
    cooldown.set(m.author.id, Date.now());
    const min = Number(l.xpMin) || 15, max = Math.max(min, Number(l.xpMax) || 25);
    await addXp(m.member, Math.floor(min + Math.random() * (max - min + 1)), m.channel);
  });

  // XP voice tiap menit (minimal 2 orang, tidak deafen)
  setInterval(() => {
    const l = L();
    const g = client.guilds.cache.get(process.env.GUILD_ID);
    if (!l.enabled || !g || !(Number(l.voiceXpPerMin) > 0)) return;
    g.channels.cache.filter((c) => c.isVoiceBased() && c.id !== g.afkChannelId).forEach((c) => {
      const humans = c.members.filter((m) => !m.user.bot);
      if (humans.size < 2) return;
      humans.forEach((m) => {
        if (m.voice.selfDeaf || m.voice.serverDeaf || blocked(m, c.id)) return;
        user(m.id).voiceMin++;
        addXp(m, Number(l.voiceXpPerMin), null).catch(() => {});
      });
    });
  }, 60_000);

  function leaderboard(limit = 100) {
    return Object.entries(D().users).map(([id, u]) => ({ id, ...u, ...levelFromXp(u.xp) })).sort((a, b) => b.xp - a.xp).slice(0, limit);
  }

  const bar = (a, b) => { const n = Math.round((a / b) * 14); return '▰'.repeat(n) + '▱'.repeat(14 - n); };

  client.on(Events.InteractionCreate, async (it) => {
    if (!it.isChatInputCommand()) return;
    if (it.commandName === 'rank') {
      const target = it.options.getUser('user') || it.user;
      const u = user(target.id), lv = levelFromXp(u.xp);
      const pos = leaderboard(100000).findIndex((x) => x.id === target.id) + 1;
      return it.reply({ embeds: [baseEmbed({
        title: `⭐ Level ${lv.level} — ${target.username}`,
        description: `**Rank:** #${pos || '-'}\n**XP:** ${lv.into} / ${lv.next}\n${bar(lv.into, lv.next)}\n\n💬 ${u.msgs} pesan · 🎙️ ${u.voiceMin} menit voice · total ${u.xp} XP`,
        thumbnail: target.displayAvatarURL({ size: 256 }),
      })] });
    }
    if (it.commandName === 'leaderboard') {
      const top = leaderboard(10);
      return it.reply({ embeds: [baseEmbed({
        title: '🏆 Leaderboard TRO',
        description: top.length ? top.map((u, i) => `${['🥇', '🥈', '🥉'][i] || `**${i + 1}.**`} <@${u.id}> — Level **${u.level}** · ${u.xp} XP`).join('\n') : 'Belum ada data.',
      })], allowedMentions: { parse: [] } });
    }
  });

  const commands = [
    new SlashCommandBuilder().setName('rank').setDescription('Lihat level & XP').addUserOption((o) => o.setName('user').setDescription('User')).toJSON(),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 level TRO').toJSON(),
  ];

  function routes(api) {
    api.get('/levels', (req, res) => res.json(leaderboard(200)));
    api.post('/levels/:id/reset', (req, res) => { delete D().users[req.params.id]; cfg.save(); cfg.addLog('XP direset', `${req.params.id} oleh ${req.session.user.username}`); res.json({ ok: true }); });
    api.post('/levels/:id/give', async (req, res) => {
      try {
        const g = client.guilds.cache.get(process.env.GUILD_ID);
        const m = await g.members.fetch(req.params.id);
        await addXp(m, Number(req.body.xp) || 0, null);
        res.json({ ok: true });
      } catch (e) { res.status(400).json({ error: e.message }); }
    });
  }

  return { commands, routes, levelFromXp };
}

module.exports = { setup, levelFromXp, need };
