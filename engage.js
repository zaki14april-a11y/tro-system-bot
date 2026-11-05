// ============================================================
//  🎉 TRO SYSTEM — Giveaway & 🎭 Self-role panel
// ============================================================
const {
  Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, SlashCommandBuilder,
  MessageFlags, PermissionFlagsBits: P, ChannelType,
} = require('discord.js');
const cfg = require('./config');

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// "30m", "2h", "1d", "1h30m", "45" (menit) → ms
function parseDuration(input) {
  const s = String(input || '').trim().toLowerCase();
  if (/^\d+$/.test(s)) return Number(s) * 60_000;
  let ms = 0, ok = false;
  for (const [, n, u] of s.matchAll(/(\d+)\s*(d|h|j|m|s|hari|jam|menit|detik)/g)) {
    ok = true;
    ms += Number(n) * ({ d: 86_400_000, hari: 86_400_000, h: 3_600_000, j: 3_600_000, jam: 3_600_000, m: 60_000, menit: 60_000, s: 1000, detik: 1000 }[u]);
  }
  return ok ? ms : null;
}

function pickWinners(entrants, n) {
  const pool = [...new Set(entrants)];
  const out = [];
  while (pool.length && out.length < n) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

function setup({ client, baseEmbed }) {
  const G = () => cfg.data('giveaways', { items: [] });
  const SR = () => cfg.get().selfroles;
  const ts = (ms) => Math.floor(ms / 1000);

  // ======================= GIVEAWAY =======================
  function gwPayload(g) {
    const ended = g.ended;
    return {
      embeds: [baseEmbed({
        title: `🎉 GIVEAWAY — ${g.prize}`,
        description: (g.description ? `${g.description}\n\n` : '') +
          (ended
            ? `**Pemenang:** ${g.winnerIds.length ? g.winnerIds.map((w) => `<@${w}>`).join(', ') : 'tidak ada peserta 😢'}\n**Berakhir:** <t:${ts(g.endsAt)}:F>`
            : `Klik **🎉 Ikut** untuk ikutan!\n\n**Berakhir:** <t:${ts(g.endsAt)}:R> (<t:${ts(g.endsAt)}:f>)\n**Pemenang:** ${g.winners} orang${g.requiredRoleId ? `\n**Syarat role:** <@&${g.requiredRoleId}>` : ''}`) +
          `\n**Host:** <@${g.hostId}>\n**Peserta:** ${g.entrants.length}`,
        color: ended ? '#7f8c8d' : undefined,
      })],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`tro-gw:join:${g.id}`).setLabel(ended ? 'Selesai' : `Ikut (${g.entrants.length})`).setEmoji('🎉').setStyle(ButtonStyle.Success).setDisabled(ended),
      )],
      allowedMentions: { parse: [] },
    };
  }

  async function gwRefresh(g) {
    const ch = await client.channels.fetch(g.channelId).catch(() => null);
    const msg = ch && await ch.messages.fetch(g.messageId).catch(() => null);
    if (msg) await msg.edit(gwPayload(g)).catch(() => {});
    return ch;
  }

  async function gwCreate({ prize, duration, winners, channelId, requiredRoleId, description }, hostId) {
    const ms = typeof duration === 'number' ? duration : parseDuration(duration);
    if (!prize) throw new Error('Hadiah wajib diisi');
    if (!ms || ms < 60_000) throw new Error('Durasi minimal 1 menit (contoh: 30m, 2h, 1d)');
    if (!channelId) throw new Error('Pilih channel');
    const g = { id: newId(), prize: String(prize).slice(0, 200), description: String(description || '').slice(0, 1000), winners: Math.min(20, Math.max(1, Number(winners) || 1)), channelId, requiredRoleId: requiredRoleId || '', hostId, endsAt: Date.now() + ms, entrants: [], ended: false, winnerIds: [] };
    const ch = await client.channels.fetch(channelId);
    const msg = await ch.send(gwPayload(g));
    g.messageId = msg.id;
    G().items.unshift(g);
    G().items = G().items.slice(0, 200);
    cfg.save();
    cfg.addLog('Giveaway dibuat', `${g.prize} — ${g.winners} pemenang`);
    return g;
  }

  async function gwEnd(id, reroll = false) {
    const g = G().items.find((x) => x.id === id);
    if (!g) throw new Error('Giveaway tidak ditemukan');
    if (g.ended && !reroll) throw new Error('Giveaway sudah selesai');
    g.ended = true;
    g.winnerIds = pickWinners(g.entrants, g.winners);
    cfg.save();
    const ch = await gwRefresh(g);
    if (ch) ch.send({ content: g.winnerIds.length ? `🎉 ${reroll ? '**REROLL!** ' : ''}Selamat ${g.winnerIds.map((w) => `<@${w}>`).join(', ')}! Kamu menang **${g.prize}**! Hubungi <@${g.hostId}> ya.` : `😢 Giveaway **${g.prize}** berakhir tanpa peserta.`, allowedMentions: { users: g.winnerIds } }).catch(() => {});
    cfg.addLog(reroll ? 'Giveaway reroll' : 'Giveaway selesai', `${g.prize} → ${g.winnerIds.join(', ') || 'tidak ada'}`);
    return g;
  }

  setInterval(() => {
    G().items.filter((g) => !g.ended && g.endsAt <= Date.now()).forEach((g) => gwEnd(g.id).catch(() => {}));
  }, 15_000);

  // ======================= SELF ROLE =======================
  function srComponents(p) {
    const roles = (p.roles || []).filter((r) => r.roleId).slice(0, 25);
    if (p.mode === 'menu') {
      const menu = new StringSelectMenuBuilder().setCustomId(`tro-sr:menu:${p.id}`).setPlaceholder(p.placeholder || 'Pilih role kamu...')
        .setMinValues(0).setMaxValues(p.multi === false ? 1 : roles.length || 1)
        .addOptions(roles.map((r) => ({ label: (r.label || 'Role').slice(0, 100), value: r.roleId, ...(r.emoji ? { emoji: r.emoji } : {}), ...(r.desc ? { description: r.desc.slice(0, 100) } : {}) })));
      return roles.length ? [new ActionRowBuilder().addComponents(menu)] : [];
    }
    const rows = [];
    for (let i = 0; i < roles.length; i += 5) {
      rows.push(new ActionRowBuilder().addComponents(roles.slice(i, i + 5).map((r) => {
        const b = new ButtonBuilder().setCustomId(`tro-sr:btn:${p.id}:${r.roleId}`).setLabel((r.label || 'Role').slice(0, 80)).setStyle(ButtonStyle.Secondary);
        if (r.emoji) b.setEmoji(r.emoji);
        return b;
      })));
    }
    return rows;
  }

  async function srSend(id) {
    const p = SR().panels.find((x) => x.id === id);
    if (!p) throw new Error('Panel tidak ditemukan');
    if (!p.channelId) throw new Error('Pilih channel panel dulu');
    const ch = await client.channels.fetch(p.channelId);
    const payload = { embeds: [baseEmbed({ title: p.title, description: p.text })], components: srComponents(p) };
    const old = p.messageId && await ch.messages.fetch(p.messageId).catch(() => null);
    if (old) { await old.edit(payload); return 'updated'; }
    const msg = await ch.send(payload);
    p.messageId = msg.id; cfg.save();
    return 'posted';
  }

  // ======================= INTERAKSI =======================
  client.on(Events.InteractionCreate, async (it) => {
    try {
      if (it.isButton() && it.customId.startsWith('tro-gw:join:')) {
        const g = G().items.find((x) => x.id === it.customId.split(':')[2]);
        if (!g || g.ended) return it.reply({ content: 'Giveaway sudah selesai.', flags: MessageFlags.Ephemeral });
        if (g.requiredRoleId && !it.member.roles.cache.has(g.requiredRoleId)) return it.reply({ content: `⛔ Butuh role <@&${g.requiredRoleId}> untuk ikut.`, flags: MessageFlags.Ephemeral });
        const i = g.entrants.indexOf(it.user.id);
        if (i >= 0) g.entrants.splice(i, 1); else g.entrants.push(it.user.id);
        cfg.saveSoon();
        await it.update(gwPayload(g));
        return it.followUp({ content: i >= 0 ? '↩️ Kamu keluar dari giveaway.' : '🎉 Kamu ikut giveaway! Semoga beruntung.', flags: MessageFlags.Ephemeral });
      }
      if (it.isButton() && it.customId.startsWith('tro-sr:btn:')) {
        const [, , pid, roleId] = it.customId.split(':');
        const p = SR().panels.find((x) => x.id === pid);
        if (!p?.roles.some((r) => r.roleId === roleId)) return it.reply({ content: 'Role ini sudah tidak tersedia.', flags: MessageFlags.Ephemeral });
        const has = it.member.roles.cache.has(roleId);
        if (!has && p.multi === false) {
          const others = p.roles.map((r) => r.roleId).filter((r) => r !== roleId && it.member.roles.cache.has(r));
          if (others.length) await it.member.roles.remove(others);
        }
        await it.member.roles[has ? 'remove' : 'add'](roleId, 'TRO SYSTEM self-role');
        return it.reply({ content: has ? `➖ Role <@&${roleId}> dilepas.` : `➕ Kamu dapat role <@&${roleId}>!`, flags: MessageFlags.Ephemeral });
      }
      if (it.isStringSelectMenu() && it.customId.startsWith('tro-sr:menu:')) {
        const p = SR().panels.find((x) => x.id === it.customId.split(':')[2]);
        if (!p) return it.reply({ content: 'Panel sudah tidak ada.', flags: MessageFlags.Ephemeral });
        const all = p.roles.map((r) => r.roleId);
        const add = it.values.filter((r) => all.includes(r) && !it.member.roles.cache.has(r));
        const remove = all.filter((r) => !it.values.includes(r) && it.member.roles.cache.has(r));
        if (add.length) await it.member.roles.add(add, 'TRO SYSTEM self-role');
        if (remove.length) await it.member.roles.remove(remove, 'TRO SYSTEM self-role');
        return it.reply({ content: `✅ Role diperbarui.${add.length ? `\n➕ ${add.map((r) => `<@&${r}>`).join(' ')}` : ''}${remove.length ? `\n➖ ${remove.map((r) => `<@&${r}>`).join(' ')}` : ''}`, flags: MessageFlags.Ephemeral });
      }
      if (it.isChatInputCommand() && it.commandName === 'giveaway') {
        const sub = it.options.getSubcommand();
        if (sub === 'mulai') {
          await it.deferReply({ flags: MessageFlags.Ephemeral });
          const g = await gwCreate({ prize: it.options.getString('hadiah'), duration: it.options.getString('durasi'), winners: it.options.getInteger('pemenang') || 1, channelId: (it.options.getChannel('channel') || it.channel).id, requiredRoleId: it.options.getRole('syarat_role')?.id }, it.user.id);
          return it.editReply(`✅ Giveaway **${g.prize}** dimulai! ID: \`${g.id}\``);
        }
        await it.deferReply({ flags: MessageFlags.Ephemeral });
        const g = await gwEnd(it.options.getString('id'), sub === 'reroll');
        return it.editReply(`✅ Selesai. Pemenang: ${g.winnerIds.map((w) => `<@${w}>`).join(', ') || 'tidak ada'}`);
      }
    } catch (err) {
      const msg = { content: `❌ ${err.message}`, flags: MessageFlags.Ephemeral };
      if (it.deferred || it.replied) it.editReply(msg).catch(() => {}); else if (it.isRepliable()) it.reply(msg).catch(() => {});
    }
  });

  const commands = [
    new SlashCommandBuilder().setName('giveaway').setDescription('Giveaway TRO').setDefaultMemberPermissions(P.ManageGuild)
      .addSubcommand((s) => s.setName('mulai').setDescription('Mulai giveaway')
        .addStringOption((o) => o.setName('hadiah').setDescription('Hadiahnya apa').setRequired(true))
        .addStringOption((o) => o.setName('durasi').setDescription('contoh: 30m, 2h, 1d').setRequired(true))
        .addIntegerOption((o) => o.setName('pemenang').setDescription('Jumlah pemenang').setMinValue(1).setMaxValue(20))
        .addChannelOption((o) => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        .addRoleOption((o) => o.setName('syarat_role').setDescription('Hanya role ini yang boleh ikut')))
      .addSubcommand((s) => s.setName('akhiri').setDescription('Akhiri sekarang').addStringOption((o) => o.setName('id').setDescription('ID giveaway').setRequired(true)))
      .addSubcommand((s) => s.setName('reroll').setDescription('Undi ulang pemenang').addStringOption((o) => o.setName('id').setDescription('ID giveaway').setRequired(true)))
      .toJSON(),
  ];

  function routes(api) {
    api.get('/giveaways', (req, res) => res.json(G().items));
    api.post('/giveaways', async (req, res) => { try { res.json(await gwCreate(req.body, req.session.user.id)); } catch (e) { res.status(400).json({ error: e.message }); } });
    api.post('/giveaways/:id/:action', async (req, res) => { try { res.json(await gwEnd(req.params.id, req.params.action === 'reroll')); } catch (e) { res.status(400).json({ error: e.message }); } });
    api.delete('/giveaways/:id', (req, res) => { G().items = G().items.filter((g) => g.id !== req.params.id); cfg.save(); res.json({ ok: true }); });
    api.post('/selfroles/:id/send', async (req, res) => { try { res.json({ result: await srSend(req.params.id) }); } catch (e) { res.status(400).json({ error: e.message }); } });
  }

  return { commands, routes };
}

module.exports = { setup, parseDuration, pickWinners };
