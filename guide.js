// ============================================================
//  📖 TRO SYSTEM — Tutorial & Command Center (satu sumber data
//  untuk dashboard, /bantuan, dan panduan di channel admin)
// ============================================================
const { Events, SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');

const A = 'Admin', S = 'Staff', M = 'Semua member';
const COMMANDS = [
  // Postingan & pesan
  { cat: '📜 Postingan & Pesan', name: '/tro-post bagian:Semua', who: A, desc: 'Posting / update info resmi (rules, price list, dll). Postingan lama diedit, tidak dobel.', ex: '/tro-post bagian:Price List Robux' },
  { cat: '📜 Postingan & Pesan', name: '/tro-announce', who: A, desc: 'Kirim pengumuman embed — judul, isi, channel, tag role, poster.', ex: '/tro-announce judul:Event Malam Ini isi:Kumpul jam 20.00 tag:@TRO MEMBER' },
  { cat: '📜 Postingan & Pesan', name: '/tro-say', who: A, desc: 'Bot kirim pesan biasa di channel ini.', ex: '/tro-say pesan:Halo semua!\\nSelamat malam' },
  { cat: '📜 Postingan & Pesan', name: '/tro-bersihin', who: A, desc: 'Hapus pesan lama (Oned & kamu) di channel info. Tanpa "yakin" = cek dulu.', ex: '/tro-bersihin yakin:True' },
  { cat: '📜 Postingan & Pesan', name: '/tro-info', who: M, desc: 'Kartu info server TRO.', ex: '/tro-info' },
  // Member baru
  { cat: '🪪 Member Baru & Data', name: '/tro-verifikasi', who: A, desc: 'Kirim / update panel verifikasi (tombol Tamu & Member Baru).', ex: '/tro-verifikasi' },
  { cat: '🪪 Member Baru & Data', name: '/daftar', who: M, desc: 'Buka form pengajuan Member Baru / Tamu.', ex: '/daftar sebagai:🦉 Member Baru' },
  { cat: '🪪 Member Baru & Data', name: '/anggota tambah', who: S, desc: 'Isi data anggota lama secara manual (langsung dianggap ACC + role).', ex: '/anggota tambah user:@Kyoo' },
  { cat: '🪪 Member Baru & Data', name: '/anggota cek', who: S, desc: 'Lihat data anggota (nama, USN, usia, domisili, dll).', ex: '/anggota cek user:@Kyoo' },
  { cat: '🪪 Member Baru & Data', name: '/anggota belum-isi', who: S, desc: 'Daftar member lama yang belum isi data terbaru.', ex: '/anggota belum-isi' },
  { cat: '🪪 Member Baru & Data', name: '/anggota minta-data', who: S, desc: 'DM semua member yang belum isi data, tombol "Isi data sekarang".', ex: '/anggota minta-data channel:#chat-member' },
  { cat: '🪪 Member Baru & Data', name: '/invites', who: M, desc: 'Cek berapa orang yang diundang seseorang.', ex: '/invites user:@Debby' },
  // Komunitas
  { cat: '🗓️ Komunitas & Event', name: '/undangan tambah', who: S, desc: 'Catat undangan fams (maks 3/hari kerja, weekend bebas).', ex: '/undangan tambah fams:LATE NIGHT tanggal:08/11/2026 jam:21:00' },
  { cat: '🗓️ Komunitas & Event', name: '/undangan list · hapus', who: S, desc: 'Lihat jadwal undangan + ID, hapus undangan.', ex: '/undangan hapus id:abc123' },
  { cat: '🗓️ Komunitas & Event', name: '/event tambah', who: S, desc: 'Jadwalkan event/DJ/party — diumumkan + reminder otomatis + ping saat mulai.', ex: '/event tambah judul:Friday Night tanggal:07/11/2026 jam:20:00 host:DJ TAN' },
  { cat: '🗓️ Komunitas & Event', name: '/event list · hapus', who: S, desc: 'Lihat / hapus jadwal event.', ex: '/event list' },
  { cat: '🗓️ Komunitas & Event', name: '/ultah set · lihat · hapus', who: M, desc: 'Catat ulang tahun → ucapan otomatis + role ultah 1 hari.', ex: '/ultah set tanggal:13/11' },
  { cat: '🗓️ Komunitas & Event', name: '/voice kunci · buka · limit · nama · kick · izinkan · klaim', who: M, desc: 'Atur voice pribadi (Custom Voice).', ex: '/voice limit jumlah:5' },
  // Engagement
  { cat: '⭐ Engagement', name: '/rank', who: M, desc: 'Lihat level, XP, dan peringkat.', ex: '/rank user:@Kenzo' },
  { cat: '⭐ Engagement', name: '/leaderboard', who: M, desc: 'Top 10 level TRO.', ex: '/leaderboard' },
  { cat: '⭐ Engagement', name: '/giveaway mulai', who: A, desc: 'Mulai giveaway dengan tombol 🎉 Ikut, undi otomatis.', ex: '/giveaway mulai hadiah:1000 Robux durasi:1d pemenang:2' },
  { cat: '⭐ Engagement', name: '/giveaway akhiri · reroll', who: A, desc: 'Akhiri sekarang / undi ulang pemenang.', ex: '/giveaway reroll id:abc123' },
  // Support
  { cat: '🎫 Ticket', name: '/tiket panel', who: A, desc: 'Kirim / update panel tiket.', ex: '/tiket panel' },
  { cat: '🎫 Ticket', name: '/tiket tambah · keluarkan · tutup', who: S, desc: 'Kelola orang di tiket & tutup tiket (transcript otomatis).', ex: '/tiket tambah user:@Angie' },
  // Moderasi
  { cat: '⚖️ Moderasi & Keamanan', name: '/warn', who: S, desc: 'Beri peringatan. Warn menumpuk → sanksi otomatis.', ex: '/warn user:@troll alasan:Spam di global-chat' },
  { cat: '⚖️ Moderasi & Keamanan', name: '/warnings · /unwarn', who: S, desc: 'Riwayat pelanggaran user / cabut warn.', ex: '/unwarn kasus:12' },
  { cat: '⚖️ Moderasi & Keamanan', name: '/mute · /unmute', who: S, desc: 'Timeout user (10m, 2h, 1d — maks 28 hari).', ex: '/mute user:@troll durasi:1h alasan:Toxic' },
  { cat: '⚖️ Moderasi & Keamanan', name: '/kick · /ban · /unban', who: S, desc: 'Kick / ban / unban dengan alasan, tercatat jadi kasus.', ex: '/ban user:@scammer alasan:Scam hapus_pesan_hari:1' },
  { cat: '⚖️ Moderasi & Keamanan', name: '/purge', who: S, desc: 'Hapus 1–100 pesan sekaligus (opsional hanya dari 1 user).', ex: '/purge jumlah:50 user:@spammer' },
  { cat: '⚖️ Moderasi & Keamanan', name: '/tro-lockdown', who: A, desc: 'Kunci server saat raid (member baru auto-kick). 0 = buka.', ex: '/tro-lockdown menit:30' },
  { cat: '📖 Bantuan', name: '/bantuan', who: M, desc: 'Daftar command (admin lihat semua, member lihat command member).', ex: '/bantuan' },
];

const TUTORIALS = [
  { icon: '🚀', title: 'Mulai pertama kali (setup awal)', steps: [
    'Buka dashboard → **Verifikasi** → klik **⚡ Setup sekarang** (role & channel verifikasi dibuat otomatis).',
    'Di **Verifikasi**, set *Channel review Member Baru* = member-application dan *Channel data anggota* = data-member.',
    '**Ticket** → pilih channel panel, kategori, role staff, channel log → **Simpan & kirim panel**.',
    '**Jadwal Event**, **Undangan Fams**, **Ultah & Statistik** → pilih channel masing-masing.',
    '**Anti Hack & Raid** → pilih *Channel log keamanan* → Simpan.',
    'Kick bot lama yang fungsinya sudah ada di TRO SYSTEM (Invite Tracker, Ticket Tool, TempVoice).',
  ] },
  { icon: '🪪', title: 'ACC member baru', steps: [
    'Member baru klik **🦉 Member Baru** di 「🪪」verifikasi atau ketik `/daftar` → isi form.',
    'Kartu **📋 PENGAJUAN MASUK ANGGOTA TRO** muncul di member-application (+ badge merah di dashboard).',
    'Klik **✅ ACC** (role otomatis + kartu data anggota + ulang tahun tercatat) atau **❌ Tolak** (isi alasan, dikirim ke DM).',
    'Bisa juga dari dashboard → **Pengajuan Member**.',
  ] },
  { icon: '📨', title: 'Minta data member lama', steps: [
    'Dashboard → **Pengajuan Member** → panel **Minta data member lama** (atau `/anggota minta-data`).',
    'Pilih role member & channel cadangan untuk yang DM-nya tertutup → **Kirim ke yang belum isi**.',
    'Hasil masuk sebagai **🔄 Update data** → ACC seperti biasa. Kirim ulang kapan saja; yang sudah isi otomatis dilewati.',
  ] },
  { icon: '🗓️', title: 'Catat undangan fams', steps: [
    'Dashboard → **Undangan Fams** → isi nama fams, tanggal, jam, tempat → **Catat** (atau `/undangan tambah`).',
    'Kalender menunjukkan kuota per hari — Senin–Jumat maks 3, weekend bebas. Undangan ke-4 otomatis ditolak.',
    'Jadwal di channel terpilih ter-update otomatis, tercatat siapa yang input.',
  ] },
  { icon: '📅', title: 'Jadwalkan event / DJ', steps: [
    'Dashboard → **Jadwal Event** → isi judul, tanggal, jam (WIB), tempat, host, poster → **Jadwalkan**.',
    'Bot langsung umumkan + ping role, lalu reminder 60 & 10 menit sebelum mulai, dan "🔴 DIMULAI" saat waktunya.',
  ] },
  { icon: '🎫', title: 'Menangani tiket', steps: [
    'Member klik tombol di panel tiket → channel privat `🎫-jenis-0001` dibuat.',
    'Staff klik **🙋 Klaim** → bantu → **🔒 Tutup tiket**. Transcript masuk channel log + DM pembuat.',
    'Tambah orang ke tiket: `/tiket tambah user:@...`.',
  ] },
  { icon: '⚖️', title: 'Menindak pelanggaran', steps: [
    '`/warn` untuk peringatan. 3 warn → timeout 60 menit, 5 warn → kick (atur di **Moderasi & Warn**).',
    '`/mute`, `/kick`, `/ban` untuk pelanggaran berat. Semua tercatat jadi kasus + DM ke user.',
    'Cek riwayat: `/warnings user:@...` atau dashboard → **Moderasi & Warn**.',
    'Ada raid? `/tro-lockdown menit:30` atau tombol **Lockdown sekarang** di **Anti Hack & Raid**.',
  ] },
  { icon: '🎉', title: 'Giveaway & self-role', steps: [
    'Dashboard → **Giveaway** → hadiah, durasi (30m / 2h / 1d), jumlah pemenang, channel → **Mulai**.',
    'Pemenang diundi otomatis saat waktu habis. Reroll kapan saja.',
    'Dashboard → **Self-Role Panel** → **+ Panel baru** → tambah role + emoji → **Kirim**. Member klik untuk ambil / lepas role.',
  ] },
  { icon: '👑', title: 'Atur siapa yang boleh akses', steps: [
    'Dashboard → **👑 Akses Dashboard** (hanya Super Admin).',
    'Default: yang boleh login = role **ADMIN** & **OWNER**. Ganti dengan klik role lain, atau tambah orang tertentu lewat kolom cari nama.',
    '**Akses per halaman**: pilih role di halaman tertentu untuk membatasi (contoh: Keamanan & Moderasi hanya ADMIN).',
    '**Yang boleh ACC / Tolak di Discord**: pilih role reviewer (contoh: Comdiv).',
    'Klik **Simpan akses** — langsung berlaku, termasuk untuk yang sedang login.',
  ] },
  { icon: '📜', title: 'Ubah rules / harga', steps: [
    'Dashboard → **Postingan Resmi** → pilih bagian → edit (preview langsung terlihat).',
    'Klik **🚀 Simpan & publish** → postingan lama di Discord diedit, tidak dobel.',
  ] },
];

function setup({ client, baseEmbed }) {
  function helpEmbeds(isAdmin) {
    const list = COMMANDS.filter((c) => isAdmin || c.who === M);
    const cats = [...new Set(list.map((c) => c.cat))];
    const embeds = [baseEmbed({
      title: isAdmin ? '📖 TRO SYSTEM — Command Center (Admin)' : '📖 TRO SYSTEM — Bantuan',
      description: isAdmin ? 'Semua command TRO SYSTEM. Dashboard lengkap: buka **localhost:3000** di PC bot.\n👑 Admin · 🛡️ Staff · 👥 Semua member' : 'Command yang bisa kamu pakai di THE RESILIENT ORDER 🦉',
    })];
    const icon = { [A]: '👑', [S]: '🛡️', [M]: '👥' };
    cats.forEach((cat) => {
      const value = list.filter((c) => c.cat === cat).map((c) => `${isAdmin ? icon[c.who] + ' ' : ''}\`${c.name}\` — ${c.desc}`).join('\n');
      embeds[embeds.length - 1].addFields({ name: cat, value: value.slice(0, 1024) });
    });
    return embeds;
  }

  function tutorialEmbeds() {
    return TUTORIALS.map((t) => baseEmbed({ title: `${t.icon} ${t.title}`, description: t.steps.map((s, i) => `**${i + 1}.** ${s}`).join('\n'), thumbnail: null }));
  }

  client.on(Events.InteractionCreate, async (it) => {
    if (!it.isChatInputCommand() || it.commandName !== 'bantuan') return;
    const isAdmin = it.memberPermissions?.has(PermissionFlagsBits.ManageRoles);
    return it.reply({ embeds: helpEmbeds(isAdmin), flags: MessageFlags.Ephemeral });
  });

  function routes(api) {
    api.get('/guide', (req, res) => res.json({ commands: COMMANDS, tutorials: TUTORIALS }));
    api.post('/guide/post', async (req, res) => {
      try {
        const ch = await client.channels.fetch(req.body.channelId);
        await ch.send({ embeds: helpEmbeds(true) });
        const tut = tutorialEmbeds();
        for (let i = 0; i < tut.length; i += 10) await ch.send({ embeds: tut.slice(i, i + 10) });
        res.json({ ok: true });
      } catch (e) { res.status(400).json({ error: e.message }); }
    });
  }

  return {
    commands: [new SlashCommandBuilder().setName('bantuan').setDescription('Daftar command TRO SYSTEM').toJSON()],
    routes,
  };
}

module.exports = { setup, COMMANDS, TUTORIALS };
