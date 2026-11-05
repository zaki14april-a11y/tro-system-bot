# 🦉 TRO SYSTEM v5 — All-in-one Bot + Dashboard

## File (taruh semua di 1 folder, Replace yang lama)
| File | Isi |
|---|---|
| `start.bat` | Double-click untuk nyalakan bot + dashboard |
| `index.js` · `bot.js` · `web.js` · `config.js` | Inti bot, dashboard, penyimpanan |
| `dashboard.html` | Tampilan dashboard |
| `posts.js` | Isi awal postingan resmi |
| `fams.js` | Verifikasi Tamu/Member + ACC admin · Jadwal Undangan Fams |
| `tracker.js` | Invite Tracker (diundang siapa, lewat link apa, kapan) |
| `tickets.js` | Ticket system + transcript |
| `levels.js` | Level & XP chat + voice, role hadiah |
| `engage.js` | Giveaway · Self-role panel |
| `moderation.js` | Warn, mute, kick, ban, purge + kasus & auto-sanksi |
| `community.js` | Jadwal event & reminder · Ulang tahun · Statistik · Custom voice |
| `guide.js` | Tutorial & Command Center + `/bantuan` |

## Cara pasang (dari versi lama)
1. Tutup jendela hitam TRO SYSTEM.
2. Di folder bot (Downloads), **hapus dulu** semua file `.js`, `dashboard.html`, `README`, dan semua file ber-akhiran `_1`, `_2`, `_3`.
   **Jangan hapus:** `.env`, folder `data`, folder `node_modules`, `data.json`.
3. Download semua file paket ini ke folder yang sama.
4. Double-click `start` → buka `localhost:3000` → menu **📖 Tutorial & Command Center** → ikuti *Mulai pertama kali*.

## Command Discord
**Admin/staff:** `/tro-post` `/tro-announce` `/tro-say` `/tro-bersihin` `/tro-lockdown` `/tro-verifikasi` `/undangan` `/tiket panel|tambah|keluarkan|tutup` `/giveaway mulai|akhiri|reroll` `/event tambah|list|hapus` `/warn` `/warnings` `/unwarn` `/mute` `/unmute` `/kick` `/ban` `/unban` `/purge`
**Semua member:** `/tro-info` `/rank` `/leaderboard` `/invites` `/ultah set|lihat|hapus` `/voice kunci|buka|limit|nama|kick|izinkan|klaim`

## Bot lama yang bisa di-kick (biar nggak dobel)
Invite Tracker · Ticket Tool · TempVoice — fungsinya sudah ada di TRO SYSTEM.
Kalau Koya masih dipakai untuk welcome/level, matikan salah satu (di Koya atau di TRO SYSTEM).

## Keamanan
Jangan share `.env`. Bot punya role Administrator → kalau token bocor, Reset Token di Developer Portal.
