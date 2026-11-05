# 🦉 TRO SYSTEM v3 — Bot + Dashboard Web

## Isi folder
| File | Fungsi |
|---|---|
| `start.bat` | Double-click untuk menyalakan bot + dashboard |
| `index.js` | Penghubung bot & dashboard |
| `bot.js` | Otak bot: postingan, welcome, autorole, status, keamanan |
| `fams.js` | Verifikasi member (Tamu / Member Baru + ACC admin) & Jadwal Undangan Fams |
| `web.js` | Server dashboard + login Discord |
| `config.js` | Penyimpanan pengaturan (otomatis bikin folder `data`) |
| `dashboard.html` | Tampilan dashboard |
| `posts.js` | Isi awal postingan resmi (setelah itu diedit dari dashboard) |
| `package.json` | Daftar komponen |

## Update dari versi lama (sekali)
1. Tutup jendela hitam TRO SYSTEM yang lama.
2. Taruh semua file ini di folder bot (Downloads), pilih **Replace**.
3. Double-click **start** → dia minta **Client Secret**:
   Developer Portal → TRO SYSTEM → **OAuth2** → **Reset Secret** → **Copy** → paste → Enter.
4. Tunggu install komponen → browser otomatis buka **http://localhost:3000** → **Login dengan Discord**.

## Fitur dashboard
- **Verifikasi** — panel tombol 🎟️ Tamu / 🦉 Member Baru → pertanyaan verifikasi → masuk channel review admin. Tombol **⚡ Setup otomatis** bikin role & channel sekaligus.
- **Pengajuan Member** — daftar pengajuan, ACC / Tolak (role otomatis diberikan, user dapat DM).
- **Jadwal Undangan Fams** — kalender mingguan, maks 3 undangan/hari kerja (weekend bebas, bisa diatur), mencatat siapa yang input, jadwal otomatis diupdate di channel.
- **Postingan Resmi** — edit rules, price list, dll + preview ala Discord → Publish (postingan lama diupdate, tidak dobel). Bisa tambah postingan baru.
- **Pengumuman** — embed dengan judul, isi, warna, poster, tag role.
- **Welcome & Goodbye** — pesan otomatis + tombol tes. (Default mati karena Koya sudah kirim welcome.)
- **Auto Role** — role otomatis untuk member baru.
- **Status Bot** — teks status bergantian.
- **Tampilan Bot** — warna embed & footer.
- **Anti Hack & Raid** — anti spam, anti link/invite, anti mass mention, anti scam/phishing, anti raid + lockdown, umur akun minimal, anti nuke, channel log.
- **Log Aktivitas** — semua kejadian keamanan & perubahan.

Hanya owner & staff dengan izin **Manage Server** yang bisa login.

## Command Discord
`/tro-post` `/tro-announce` `/tro-say` `/tro-info` `/tro-bersihin` `/tro-lockdown` `/tro-verifikasi` `/undangan tambah|list|hapus`

## Online 24 jam (opsional, nanti)
Sekarang dashboard jalan di PC (localhost) selama `start` nyala. Untuk online dari HP/mana aja:
upload folder ini ke hosting Node.js (Railway / VPS), isi variabel `.env` yang sama, ganti
`BASE_URL` ke alamat hosting, dan tambahkan `https://alamat-hosting/callback` di Developer Portal → OAuth2 → Redirects.

## Keamanan
- Jangan share file `.env` (berisi token & Client Secret).
- Bot punya role Administrator → kalau token bocor, langsung **Reset Token** di Developer Portal.
