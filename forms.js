// ============================================================
//  📮 Formulir — ganti "format manual" jadi tombol + form isian
//  (laporan member, request, pengajuan apa pun) → masuk channel staff
// ============================================================
const {
  Events, SlashCommandBuilder, MessageFlags, PermissionFlagsBits: P, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType,
} = require('discord.js');
const cfg = require('./config');

const newId = () => Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 4);
const ST = { baru: { t: '🆕 Baru', c: '#5b8def' }, proses: { t: '⚙️ Ditangani', c: '#f5a524' }, selesai: { t: '✅ Selesai', c: '#30a46c' }, tolak: { t: '✖️ Ditolak', c: '#8b95a5' } };

const PRESET_LAPORAN = () => ({
  id: newId(), name: 'Laporan Member', emoji: '⚠️',
  description: 'Laporkan **pelanggaran, masalah internal, atau konflik antar member** ke staff TRO. Laporan kamu hanya bisa dilihat staff dan akan ditindaklanjuti.\n\n**Cara:** klik jenis laporan di bawah → isi form → kirim. Setelah itu kamu bisa **balas DM dari bot dengan screenshot/video** sebagai bukti.',
  types: ['Pelanggaran', 'Masalah Internal', 'Konflik'],
  questions: [
    { label: 'Pihak terlapor (username & role)', placeholder: 'contoh: @budi — TRO MEMBER', long: false, required: true },
    { label: 'Kronologi kejadian', placeholder: 'Jelaskan apa yang terjadi secara singkat & jelas', long: true, required: true },
    { label: 'Waktu & tempat', placeholder: 'contoh: 5 Nov 2026, 21.00 — #yapping / event karaoke', long: false, required: true },
    { label: 'Link bukti (opsional)', placeholder: 'link screenshot/video — atau kirim lewat DM setelah ini', long: false, required: false },
  ],
  panelChannelId: '', panelMessageId: '', targetChannelId: '', staffRoleIds: [], anonymous: false, enabled: true,
});

function setup({ client, baseEmbed }) {
  const C = () => { const s = cfg.get(); if (!s.forms) s.forms = { items: [] }; return s.forms; };
  const D = () => cfg.data('formsData', { subs: [], counter: 0 });
  const guild = () => client.guilds.cache.get(process.env.GUILD_ID);
  const form = (id) => C().items.find((f) => f.id === id);
  const isStaff = (m, f) => m && (m.permissions.has(P.ManageGuild) || (f?.staffRoleIds || []).some((r) => m.roles.cache.has(r)));
  const awaitingProof = new Map(); // userId → { subId, until }

  function panelPayload(f) {
    const btns = (f.types?.length ? f.types : ['Isi form']).slice(0, 5).map((t, i) => new ButtonBuilder().setCustomId(`tro-form:${f.id}:${i}`).setLabel(String(t).slice(0, 80)).setStyle(i === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary));
    return { embeds: [baseEmbed({ title: `${f.emoji || '📮'} ${f.name.toUpperCase()}`, description: f.description || '', color: '#c9a24b' })], components: [new ActionRowBuilder().addComponents(btns)] };
  }
  async function postPanel(f) {
    if (!f.panelChannelId) throw new Error('Pilih channel panel dulu');
    const ch = await client.channels.fetch(f.panelChannelId);
    const old = f.panelMessageId && await ch.messages.fetch(f.panelMessageId).catch(() => null);
    if (old) { await old.edit(panelPayload(f)); return 'updated'; }
    const m = await ch.send(panelPayload(f)); f.panelMessageId = m.id; cfg.save(); return 'posted';
  }

  function subEmbed(f, s) {
    const st = ST[s.status] || ST.baru;
    return baseEmbed({
      title: `${f.emoji || '📮'} ${f.name} #${s.no}${s.type ? ` — ${s.type}` : ''}`,
      description: `**Pengirim:** ${f.anonymous ? '_(anonim — hanya owner yang bisa cek di dashboard)_' : `<@${s.userId}> (${s.username})${s.role ? ` · ${s.role}` : ''}`}\n**Status:** ${st.t}${s.handler ? ` · oleh **${s.handler}**` : ''}${s.result ? `\n**Hasil / keputusan:** ${s.result}` : ''}`,
      fields: [...s.answers.map((a) => ({ name: a.q, value: a.a || '-', inline: false })), ...(s.proofs?.length ? [{ name: `📎 Bukti (${s.proofs.length})`, value: s.proofs.slice(0, 8).map((u, i) => `[file ${i + 1}](${u})`).join(' · ') }] : [])],
      image: s.proofs?.find((u) => /\.(png|jpe?g|gif|webp)(\?|$)/i.test(u)), color: st.c, thumbnail: null,
    });
  }
  const subRow = (s) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tro-fsub:proses:${s.id}`).setLabel('Tangani').setEmoji('⚙️').setStyle(ButtonStyle.Primary).setDisabled(s.status !== 'baru'),
    new ButtonBuilder().setCustomId(`tro-fsub:selesai:${s.id}`).setLabel('Selesai').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(['selesai', 'tolak'].includes(s.status)),
    new ButtonBuilder().setCustomId(`tro-fsub:tolak:${s.id}`).setLabel('Tolak').setEmoji('✖️').setStyle(ButtonStyle.Secondary).setDisabled(['selesai', 'tolak'].includes(s.status)),
  );
  async function refreshSub(s) {
    const f = form(s.formId); if (!f || !s.channelId) return;
    const ch = await client.channels.fetch(s.channelId).catch(() => null);
    const m = ch && await ch.messages.fetch(s.messageId).catch(() => null);
    if (m) await m.edit({ embeds: [subEmbed(f, s)], components: [subRow(s)] }).catch(() => {});
  }

  client.on(Events.InteractionCreate, async (it) => {
    try {
      if (it.isButton() && it.customId.startsWith('tro-form:')) {
        const [, fid, ti] = it.customId.split(':'); const f = form(fid);
        if (!f || !f.enabled) return it.reply({ content: '⛔ Form ini sedang ditutup.', flags: MessageFlags.Ephemeral });
        const modal = new ModalBuilder().setCustomId(`tro-formm:${fid}:${ti}`).setTitle(`${f.name}${f.types?.[ti] ? ` — ${f.types[ti]}` : ''}`.slice(0, 45));
        f.questions.slice(0, 5).forEach((q, i) => modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(`q${i}`).setLabel(q.label.slice(0, 45)).setPlaceholder((q.placeholder || '').slice(0, 100)).setStyle(q.long ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(q.required !== false).setMaxLength(q.long ? 1500 : 300))));
        return it.showModal(modal);
      }
      if (it.isModalSubmit() && it.customId.startsWith('tro-formm:')) {
        const [, fid, ti] = it.customId.split(':'); const f = form(fid); if (!f) return;
        await it.deferReply({ flags: MessageFlags.Ephemeral });
        const d = D(); d.counter += 1;
        const top = it.member?.roles?.cache?.filter((r) => r.id !== it.guildId).sort((a, b) => b.position - a.position).first();
        const s = { id: newId(), formId: f.id, no: d.counter, userId: it.user.id, username: it.user.username, role: top?.name || '', type: f.types?.[ti] || '', status: 'baru', proofs: [], createdAt: new Date().toISOString(),
          answers: f.questions.slice(0, 5).map((q, i) => ({ q: q.label, a: it.fields.getTextInputValue(`q${i}`) })) };
        const link = s.answers.map((a) => a.a).join(' ').match(/https?:\/\/\S+/g); if (link) s.proofs.push(...link.slice(0, 5));
        const ch = f.targetChannelId && await client.channels.fetch(f.targetChannelId).catch(() => null);
        if (!ch) return it.editReply('⚠️ Channel tujuan form belum diatur admin.');
        const m = await ch.send({ content: f.staffRoleIds?.length ? f.staffRoleIds.map((r) => `<@&${r}>`).join(' ') : undefined, embeds: [subEmbed(f, s)], components: [subRow(s)], allowedMentions: { roles: f.staffRoleIds || [] } });
        s.channelId = ch.id; s.messageId = m.id; d.subs.unshift(s); d.subs = d.subs.slice(0, 1000); cfg.save();
        client.notifyStaff?.('app', { title: `${f.name} #${s.no}${s.type ? ` — ${s.type}` : ''}`, description: `${f.anonymous ? 'Pengirim anonim' : `Dari <@${s.userId}>`}\n\n${s.answers.slice(0, 2).map((a) => `**${a.q}:** ${a.a.slice(0, 200)}`).join('\n')}`, url: `https://discord.com/channels/${ch.guildId}/${ch.id}/${m.id}` });
        cfg.addLog('Form masuk', `${f.name} #${s.no} dari ${s.username}`);
        awaitingProof.set(it.user.id, { subId: s.id, until: Date.now() + 15 * 60_000 });
        it.user.send({ embeds: [baseEmbed({ title: `📮 ${f.name} #${s.no} terkirim`, description: `Makasih, sudah diterima staff TRO 🦉\n\n**Punya bukti screenshot/video?** Balas DM ini dengan file-nya dalam **15 menit**, otomatis ditempel ke laporan kamu.\n\nKamu akan dapat kabar di sini kalau statusnya berubah.`, color: '#30a46c' })] }).catch(() => {});
        return it.editReply(`✅ **${f.name} #${s.no}** terkirim ke staff. Cek DM dari bot untuk kirim bukti.`);
      }
      if (it.isButton() && it.customId.startsWith('tro-fsub:')) {
        const [, act, sid] = it.customId.split(':'); const s = D().subs.find((x) => x.id === sid); const f = s && form(s.formId);
        if (!s || !f) return it.reply({ content: '❌ Data tidak ditemukan', flags: MessageFlags.Ephemeral });
        if (!isStaff(it.member, f)) return it.reply({ content: '❌ Khusus staff.', flags: MessageFlags.Ephemeral });
        if (act === 'proses') {
          Object.assign(s, { status: 'proses', handler: it.user.username }); cfg.save();
          await it.update({ embeds: [subEmbed(f, s)], components: [subRow(s)] });
          client.users.fetch(s.userId).then((u) => u.send({ embeds: [baseEmbed({ title: `⚙️ ${f.name} #${s.no} sedang ditangani`, description: `Laporan kamu sedang ditangani oleh **${it.user.username}**. Ditunggu ya 🦉` })] })).catch(() => {});
          return;
        }
        const modal = new ModalBuilder().setCustomId(`tro-fres:${act}:${sid}`).setTitle(act === 'selesai' ? 'Selesaikan' : 'Tolak');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('r').setLabel(act === 'selesai' ? 'Hasil / keputusan (dikirim ke pengirim)' : 'Alasan ditolak (dikirim ke pengirim)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(800)));
        return it.showModal(modal);
      }
      if (it.isModalSubmit() && it.customId.startsWith('tro-fres:')) {
        const [, act, sid] = it.customId.split(':'); const s = D().subs.find((x) => x.id === sid); const f = s && form(s.formId); if (!s || !f) return;
        Object.assign(s, { status: act, handler: it.user.username, result: it.fields.getTextInputValue('r') || '', doneAt: new Date().toISOString() }); cfg.save();
        await refreshSub(s);
        client.users.fetch(s.userId).then((u) => u.send({ embeds: [baseEmbed({ title: `${ST[act].t} — ${f.name} #${s.no}`, description: `${s.result ? `**${act === 'selesai' ? 'Hasil' : 'Alasan'}:** ${s.result}\n\n` : ''}Makasih udah lapor ke staff TRO 🦉`, color: ST[act].c })] })).catch(() => {});
        cfg.addLog('Form diproses', `${f.name} #${s.no} → ${ST[act].t} oleh ${it.user.username}`);
        return it.reply({ content: `✅ ${f.name} #${s.no} → ${ST[act].t}`, flags: MessageFlags.Ephemeral });
      }
      if (it.isChatInputCommand() && it.commandName === 'lapor') {
        const f = C().items.find((x) => x.enabled && /lapor/i.test(x.name)) || C().items.find((x) => x.enabled);
        if (!f) return it.reply({ content: 'Belum ada form laporan.', flags: MessageFlags.Ephemeral });
        return it.reply({ ...panelPayload(f), flags: MessageFlags.Ephemeral });
      }
    } catch (e) { const r = { content: '⚠️ ' + e.message, flags: MessageFlags.Ephemeral }; (it.deferred || it.replied ? it.editReply(r) : it.reply(r)).catch(() => {}); }
  });

  // bukti lewat DM (screenshot/video) → ditempel ke laporan
  client.on(Events.MessageCreate, async (m) => {
    if (m.guild || m.author.bot) return;
    const w = awaitingProof.get(m.author.id); if (!w || Date.now() > w.until) return;
    const files = [...m.attachments.values()].map((a) => a.url); const links = (m.content.match(/https?:\/\/\S+/g) || []);
    if (!files.length && !links.length) return;
    const s = D().subs.find((x) => x.id === w.subId); const f = s && form(s.formId); if (!s || !f) return;
    const ch = await client.channels.fetch(s.channelId).catch(() => null);
    const msg = ch && await ch.messages.fetch(s.messageId).catch(() => null);
    if (msg && files.length) {
      const re = await msg.reply({ content: `📎 Bukti dari pengirim ${f.name} #${s.no}`, files: files.slice(0, 10), allowedMentions: { parse: [] } }).catch(() => null);
      if (re) s.proofs.push(...re.attachments.map((a) => a.url));
    }
    s.proofs.push(...links.slice(0, 5)); cfg.save(); refreshSub(s).catch(() => {});
    m.react('✅').catch(() => {});
  });

  // 🔎 cari channel yang masih pakai "format manual" (template diketik orang)
  async function scanTemplates() {
    const g = guild(); if (!g) return [];
    const out = [];
    const chans = g.channels.cache.filter((c) => c.type === ChannelType.GuildText && c.viewable);
    for (const ch of chans.values()) {
      const msgs = await ch.messages.fetch({ limit: 30 }).catch(() => null); if (!msgs) continue;
      for (const m of msgs.values()) {
        if (m.author.bot) continue;
        const t = m.content || '';
        const fieldish = (t.match(/^[\w ()/&.-]{3,40}:\s*$/gm) || []).length + (t.match(/^[\w ()/&.-]{3,40}:\s*\(/gm) || []).length;
        if (/format|template|isi (data|form)|cara (lapor|daftar|order)/i.test(t) && fieldish >= 2 || fieldish >= 4) {
          out.push({ channelId: ch.id, channel: ch.name, messageId: m.id, author: m.author.username, at: m.createdTimestamp, preview: t.slice(0, 300),
            fields: [...t.matchAll(/^([\w ()/&.-]{3,40}):/gm)].map((x) => x[1].trim()).slice(0, 8) });
          break;
        }
      }
    }
    return out;
  }

  client.once('ready', () => {
    // pertama kali: siapkan form Laporan Member untuk channel member-issues
    const F = C(), g = guild();
    if (g && !F.items.length && !F.seeded) {
      const f = PRESET_LAPORAN();
      const target = g.channels.cache.find((c) => /member-issues/i.test(c.name)); if (target) f.targetChannelId = target.id;
      const panel = g.channels.cache.find((c) => /buka-tiket/i.test(c.name)); if (panel) f.panelChannelId = panel.id;
      f.staffRoleIds = g.roles.cache.filter((r) => /^(admin|owner)$/i.test(r.name)).map((r) => r.id);
      F.items.push(f); F.seeded = true; cfg.save();
    }
  });

  const commands = [new SlashCommandBuilder().setName('lapor').setDescription('Laporkan pelanggaran / masalah / konflik ke staff TRO').toJSON()];

  function routes(api) {
    api.get('/forms', (req, res) => res.json({ items: C().items, subs: D().subs.slice(0, 200), statuses: Object.fromEntries(Object.entries(ST).map(([k, v]) => [k, v.t])) }));
    api.put('/forms', (req, res) => {
      const items = (req.body.items || []).map((f) => ({
        id: f.id || newId(), name: String(f.name || 'Form').slice(0, 40), emoji: String(f.emoji || '📮').slice(0, 8), description: String(f.description || '').slice(0, 2000),
        types: (f.types || []).map((t) => String(t).slice(0, 60)).filter(Boolean).slice(0, 5),
        questions: (f.questions || []).slice(0, 5).map((q) => ({ label: String(q.label || 'Pertanyaan').slice(0, 45), placeholder: String(q.placeholder || '').slice(0, 100), long: !!q.long, required: q.required !== false })),
        panelChannelId: String(f.panelChannelId || ''), panelMessageId: String(f.panelMessageId || ''), targetChannelId: String(f.targetChannelId || ''),
        staffRoleIds: (f.staffRoleIds || []).map(String), anonymous: !!f.anonymous, enabled: f.enabled !== false,
      })).filter((f) => f.questions.length);
      C().items = items; cfg.save(); res.json({ ok: true, items });
    });
    api.post('/forms/:id/panel', async (req, res) => { try { const f = form(req.params.id); if (!f) throw new Error('Form tidak ada'); res.json({ result: await postPanel(f) }); } catch (e) { res.status(400).json({ error: e.message }); } });
    api.get('/forms/scan', async (req, res) => { try { res.json(await scanTemplates()); } catch (e) { res.status(400).json({ error: e.message }); } });
  }

  return { commands, routes, presetLaporan: PRESET_LAPORAN };
}

module.exports = { setup };
