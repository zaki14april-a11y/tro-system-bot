# 🦉 TRO SYSTEM online 24 jam (gratis, tanpa PC)

Hosting: **Render (paket Free)** + data dicadangkan otomatis ke channel Discord **#tro-database**.

## 1. Update file di PC (sekali)
1. Ganti/tambah file ini di folder bot: `index.js`, `config.js`, `web.js`, `cloudsync.js`, `dashboard.html`, `render.yaml`, `.gitignore`.
2. Jalankan `start.bat` sekali, tunggu ±30 detik.
   Bot otomatis bikin channel privat **#tro-database** dan mengirim cadangan data kamu ke sana.
3. Tutup jendela `start.bat`.

## 2. Taruh kode di GitHub
1. Daftar / login di https://github.com
2. Klik **New repository** → nama `tro-system-bot` → pilih **Private** → Create.
3. Klik **uploading an existing file** → drag semua file bot.
   ❌ JANGAN upload: `.env`, folder `node_modules`, folder `data`.
4. Klik **Commit changes**.

## 3. Nyalakan di Render
1. Daftar di https://render.com pakai akun GitHub.
2. Klik **New +** → **Blueprint** → pilih repo `tro-system-bot` → Connect.
3. Render minta isi 2 kolom: **DISCORD_TOKEN** dan **CLIENT_SECRET** → paste sendiri (ambil yang baru dari Developer Portal).
4. Klik **Apply**. Tunggu build ±3 menit sampai status **Live**.
5. Salin link web-nya, contoh `https://tro-system.onrender.com`

## 4. Sambungkan login Discord
Discord Developer Portal → aplikasi TRO SYSTEM → **OAuth2** → **Redirects** → **Add Redirect**:
```
https://tro-system.onrender.com/callback
```
(ganti dengan link kamu) → **Save Changes**.

Selesai. Buka link itu dari HP / PC mana pun.

## Catatan
- Jangan jalankan `start.bat` di PC lagi selama bot hidup di Render (nanti bot dobel).
- Bot mengetuk dirinya sendiri tiap 10 menit supaya Render tidak menidurkannya.
- Kalau mau lebih aman lagi: daftar gratis di https://uptimerobot.com → monitor HTTP ke `https://link-kamu/health` tiap 5 menit.
- Jangan hapus channel **#tro-database** dan jangan chat di sana — itu tempat data bot.
- Update kode nanti: upload file baru ke GitHub → Render otomatis deploy ulang, data aman.
