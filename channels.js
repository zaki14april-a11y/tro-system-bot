// ============================================================
//  🔒 Channel info read-only — member cuma bisa baca & klik tombol,
//  yang boleh kirim pesan hanya bot + staff
// ============================================================
const { ChannelType, PermissionFlagsBits: P } = require('discord.js');
const cfg = require('./config');

// pola nama channel info / panel yang disarankan read-only
const SUGGEST = /announce|server-update|rules|house-rules|who-we-are|welcome|goodbye|verifikasi|ambil-role|buka-tiket|struktur|events|level-up|ulang-tahun|jadwal-undangan|saran-aktivitas|price-list|trolley-guide|katalog|shop-announcement|open-ticket|review-cust|tracker|link-information/i;

function setup({ client }) {
  const guild = () => client.guilds.cache.get(process.env.GUILD_ID);
  const C = () => { const s = cfg.get(); if (!s.readonly) s.readonly = { staffRoleIds: [] }; return s.readonly; };
  const staffRoles = (g) => [...new Set([...C().staffRoleIds, ...g.roles.cache.filter((r) => !r.managed && r.id !== g.id && (r.permissions.has(P.Administrator) || r.permissions.has(P.ManageMessages))).map((r) => r.id)])];

  const isRO = (ch) => {
    const ev = ch.permissionOverwrites.cache.get(ch.guild.id);
    return !!ev?.deny.has(P.SendMessages);
  };

  async function setRO(ch, on) {
    const g = ch.guild; const staff = staffRoles(g);
    if (on) {
      await ch.permissionOverwrites.edit(g.id, { SendMessages: false, SendMessagesInThreads: false, CreatePublicThreads: false, CreatePrivateThreads: false }, { reason: 'TRO SYSTEM: channel info read-only' });
      // role non-staff yang punya izin kirim khusus di channel ini → dicabut izinnya (jadi ikut aturan read-only)
      for (const ow of ch.permissionOverwrites.cache.values()) {
        if (ow.id === g.id || ow.id === client.user.id || staff.includes(ow.id)) continue;
        if (ow.allow.has(P.SendMessages)) await ch.permissionOverwrites.edit(ow.id, { SendMessages: null, SendMessagesInThreads: null, CreatePublicThreads: null }, { reason: 'TRO SYSTEM: channel info read-only' }).catch(() => {});
      }
      await ch.permissionOverwrites.edit(client.user.id, { ViewChannel: true, SendMessages: true, EmbedLinks: true, AttachFiles: true, ReadMessageHistory: true }, { reason: 'TRO SYSTEM: bot tetap bisa posting' });
      for (const r of C().staffRoleIds) await ch.permissionOverwrites.edit(r, { SendMessages: true }, { reason: 'TRO SYSTEM: staff boleh posting' }).catch(() => {});
    } else {
      await ch.permissionOverwrites.edit(g.id, { SendMessages: null, SendMessagesInThreads: null, CreatePublicThreads: null, CreatePrivateThreads: null }, { reason: 'TRO SYSTEM: read-only dimatikan' });
    }
    cfg.addLog(on ? 'Channel read-only' : 'Channel dibuka', `#${ch.name}`);
  }

  function routes(api) {
    api.get('/channels/readonly', (req, res) => {
      const g = guild(); if (!g) return res.json({ items: [] });
      const items = g.channels.cache.filter((c) => [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(c.type)).sort((a, b) => (a.parent?.rawPosition ?? -1) - (b.parent?.rawPosition ?? -1) || a.rawPosition - b.rawPosition)
        .map((c) => ({ id: c.id, name: c.name, parent: c.parent?.name || '', readonly: isRO(c), suggest: SUGGEST.test(c.name) && !/^ticket-|hapus-|tro-database/.test(c.name), privateCh: !c.permissionsFor(g.id)?.has(P.ViewChannel) }));
      res.json({ items, staffRoleIds: C().staffRoleIds });
    });
    api.post('/channels/readonly', async (req, res) => {
      try {
        const g = guild(); const ids = (req.body.channelIds || []).map(String); const on = req.body.readonly !== false;
        if (Array.isArray(req.body.staffRoleIds)) { C().staffRoleIds = req.body.staffRoleIds.map(String); cfg.save(); }
        const done = [], fail = [];
        for (const id of ids) {
          const ch = g.channels.cache.get(id); if (!ch) continue;
          try { await setRO(ch, on); done.push(ch.name); } catch (e) { fail.push(`${ch.name}: ${e.message}`); }
          await new Promise((r) => setTimeout(r, 400));
        }
        res.json({ done, fail });
      } catch (e) { res.status(400).json({ error: e.message }); }
    });
  }

  return { commands: [], routes };
}

module.exports = { setup };
