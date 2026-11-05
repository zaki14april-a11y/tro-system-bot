// ============================================================
//  Penyimpanan pengaturan TRO SYSTEM (data/config.json)
//  Semua yang diubah dari dashboard disimpan di sini.
// ============================================================
const fs = require('fs');
const path = require('path');
const defaultPosts = require('./posts');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const FILE = path.join(DATA_DIR, 'config.json');
const LEGACY = path.join(__dirname, 'data.json'); // ID postingan versi lama

const RULES_CH = '1438839725593985181';

const defaults = () => ({
  branding: {
    color: '#d4af37',
    footer: 'TRO SYSTEM • In wisdom, we endure.',
  },
  posts: JSON.parse(JSON.stringify(defaultPosts)),
  postIds: {},
  status: {
    interval: 30,
    items: [
      { type: 'Watching', text: 'THE RESILIENT ORDER 🦉' },
      { type: 'Watching', text: '{members} member TRO' },
      { type: 'Playing', text: 'In wisdom, we endure.' },
    ],
  },
  welcome: {
    enabled: false,
    channelId: '',
    title: 'Selamat datang, {username}! 🦉',
    message: `Halo {user}, selamat bergabung di **{server}**!\nKamu member ke-**{count}**. Jangan lupa baca <#${RULES_CH}> ya.`,
    image: '',
    dm: false,
  },
  goodbye: {
    enabled: false,
    channelId: '',
    title: 'Sampai jumpa, {username} 👋',
    message: '**{username}** telah meninggalkan **{server}**. Sekarang kita ada **{count}** member.',
  },
  autorole: { enabled: false, roleIds: [] },
  security: {
    logChannelId: '',
    exemptRoleIds: [],
    trustedUserIds: [],
    antiSpam: { enabled: true, messages: 6, seconds: 5, timeoutMinutes: 10 },
    antiLink: {
      enabled: true,
      blockInvites: true,
      blockAllLinks: false,
      whitelist: ['roblox.com', 'saweria.co', 'youtube.com', 'youtu.be', 'tiktok.com', 'instagram.com', 'spotify.com', 'tenor.com', 'discord.com'],
    },
    antiMention: { enabled: true, max: 5, timeoutMinutes: 10 },
    antiRaid: { enabled: true, joins: 8, seconds: 15, lockdownMinutes: 10, minAccountAgeDays: 0 },
    antiNuke: { enabled: false, limit: 3, seconds: 60 },
    antiScam: { enabled: true },
  },
  verify: {
    enabled: false,
    panelChannelId: '',
    reviewChannelId: '',
    unverifiedRoleId: '',
    guestRoleIds: [],
    memberRoleIds: [],
    dmResult: true,
    kickOnReject: false,
    panelTitle: '🦉 VERIFIKASI — THE RESILIENT ORDER',
    panelText: 'Selamat datang di **THE RESILIENT ORDER**!\n\nPilih status kamu di bawah, jawab beberapa pertanyaan singkat, lalu tunggu **ACC admin**.\n\n🎟️ **Tamu** — mampir, main bareng, ikut event.\n🦉 **Member Baru** — mau gabung jadi bagian TRO Fams.',
    guestLabel: 'Tamu',
    guestEmoji: '🎟️',
    memberLabel: 'Member Baru',
    memberEmoji: '🦉',
    questions: [
      { label: 'Username Roblox kamu?', placeholder: 'contoh: CALLMExAZAZEL', long: false, required: true },
      { label: 'Tahu TRO dari mana?', placeholder: 'teman / TikTok / map / lainnya', long: false, required: true },
      { label: 'Sudah baca & setuju rules TRO?', placeholder: 'ketik: SETUJU', long: false, required: true },
    ],
    memberQuestions: [
      { label: 'Nama', placeholder: 'contoh: Kyoo', long: false, required: true },
      { label: 'USN Roblox', placeholder: 'contoh: kyokoo74', long: false, required: true },
      { label: 'Tanggal lahir', placeholder: 'contoh: 23/03/2000 (usia dihitung otomatis)', long: false, required: true, key: 'birthdate' },
      { label: 'Domisili (kota)', placeholder: 'contoh: Semarang', long: false, required: true },
      { label: 'Alasan ingin bergabung dengan TRO', placeholder: 'ceritain singkat aja', long: true, required: true },
    ],
    memberReviewChannelId: '',
    dataChannelId: '',
    panelMessageId: '',
  },
  access: {
    superAdminIds: ['563752367305261107'], // 👑 bisa atur akses (owner server selalu termasuk)
    mode: 'custom', // 'custom' = hanya yang dipilih · 'manage' = semua yang punya izin Manage Server
    roleIds: [],
    userIds: [],
    pages: {}, // { pageKey: [roleId, ...] } kosong = semua yang punya akses dashboard
    reviewerRoleIds: [], // role yang boleh ACC/Tolak di Discord (selain admin)
  },
  tracker: { enabled: true, channelId: '1491145989426253905' },
  tickets: {
    enabled: true, panelChannelId: '', panelMessageId: '', categoryId: '', staffRoleIds: [], logChannelId: '',
    panelTitle: '🎫 TICKET — TRO SUPPORT',
    panelText: 'Butuh bantuan atau mau order? Klik tombol sesuai keperluan di bawah.\nSatu orang hanya bisa punya **1 tiket aktif**.',
    welcome: 'Halo {user}! 👋 Staff akan segera membantu.\nJelaskan keperluan kamu di sini ya.',
    types: [
      { id: 'robux', label: 'Order Robux', emoji: '💰' },
      { id: 'help', label: 'Bantuan', emoji: '🆘' },
      { id: 'report', label: 'Laporan', emoji: '🚨' },
    ],
  },
  levels: {
    enabled: true, xpMin: 15, xpMax: 25, cooldown: 60, voiceXpPerMin: 8, announceChannelId: '',
    levelUpMessage: '🎉 {user} naik ke **level {level}**! Terus aktif ya 🦉', rewards: [], noXpChannelIds: [], noXpRoleIds: [],
  },
  selfroles: { panels: [] },
  moderation: { logChannelId: '', dmUser: true, autoActions: [{ warns: 3, action: 'timeout', minutes: 60 }, { warns: 5, action: 'kick', minutes: 0 }] },
  events: { channelId: '', pingRoleId: '', reminders: [60, 10] },
  birthday: { enabled: true, channelId: '', roleId: '', hour: 8, message: '🎂 Selamat ulang tahun {user}! Semoga panjang umur & makin keren bareng TRO Fams 🦉🎉' },
  stats: { enabled: false, slots: [{ channelId: '', template: '👥 Member: {members}' }, { channelId: '', template: '🟢 Online: {online}' }, { channelId: '', template: '🤖 Bot: {bots}' }, { channelId: '', template: '🚀 Boost: {boosts}' }] },
  tempvoice: { enabled: false, hubChannelId: '', categoryId: '', nameTemplate: '🔊 {user}', defaultLimit: 0 },
  applications: [],
  invites: {
    channelId: '',
    messageId: '',
    weekdayLimit: 3,
    weekendLimit: 0,
    items: [],
  },
  logs: [],
});

// gabungkan pengaturan tersimpan dengan default (biar field baru otomatis ada)
function merge(base, saved) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return saved === undefined ? base : saved;
  const out = { ...base };
  for (const k of Object.keys(saved || {})) out[k] = k in base ? merge(base[k], saved[k]) : saved[k];
  return out;
}

let state;
function load() {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { /* pertama kali */ }
  state = merge(defaults(), saved);
  // posts disimpan utuh apa adanya (bukan di-merge per field)
  if (saved.posts) state.posts = saved.posts;
  try {
    if (!saved.postIds) Object.assign(state.postIds, JSON.parse(fs.readFileSync(LEGACY, 'utf8')));
  } catch { /* tidak ada data lama */ }
  save();
  return state;
}

let firstSave = true;
function save() {
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
  if (firstSave) { firstSave = false; return; } // simpan pertama = hasil load, tidak perlu dicadangkan
  require('./cloudsync').schedule();
}

let saveTimer;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 3000);
}

function get() { return state || load(); }

// data per modul (bukan pengaturan) — dibuat otomatis
function data(key, init) {
  const s = get();
  if (!s[key]) s[key] = init;
  return s[key];
}

function set(section, value) {
  get()[section] = value;
  save();
  return state[section];
}

function addLog(type, text) {
  const s = get();
  s.logs.unshift({ time: new Date().toISOString(), type, text });
  s.logs = s.logs.slice(0, 200);
  save();
}

module.exports = { get, set, save, saveSoon, data, addLog, load };
