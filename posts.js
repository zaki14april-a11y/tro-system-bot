// ============================================================
//  ISI POSTINGAN RESMI TRO SYSTEM
//  Mau ubah rules / harga? Edit teks di sini, restart bot,
//  lalu ketik /tro-post — postingan lama otomatis DIUPDATE
//  (bukan posting ulang), jadi channel tetap rapi.
// ============================================================

const SAWERIA = 'https://saweria.co/trofamily';
const COMMUNITY = 'https://www.roblox.com/share/g/901582211';
const VARSITY = 'https://www.roblox.com/id/catalog/109129268100447/TRO-VARSITY';
const NEW_JACKET = 'https://www.roblox.com/id/catalog/107963076693736/New-Jacket-TRO-Family';
const TICKET = '<#1448737202539335894>';
const PRICELIST = '<#1448746386395758715>';

module.exports = {
  rules: {
    label: 'Rules',
    channelId: '1438839725593985181',
    embeds: [
      {
        title: '📜 TRO HOUSE RULES',
        description:
`Dengan bergabung di TRO, kamu dianggap **sudah membaca, memahami, dan menyetujui** seluruh aturan ini. Alasan "nggak tau aturan" tidak berlaku.

**I. PRINSIP DASAR**
> TRO berdiri di atas **ketertiban, saling menghormati, dan profesionalisme**.
- Aturan berlaku untuk **semua**: member, staff, DJ, partner, sampai founder.
- Keputusan Owner & Management bersifat **final**.

**II. ATURAN MEMBER**
❌ Toxic, harassment, hate speech
❌ Spam & menyebar info palsu
❌ Bawa masalah pribadi ke dalam Fams
✅ Sopan ke semua orang & ikuti arahan staff saat event

**III. ATURAN STAFF / ADMIN**
Staff adalah **wajah resmi TRO** — wajib netral & profesional.
❌ Menyalahgunakan wewenang / command
❌ Bias atau bertindak pakai emosi
❌ Membocorkan data internal
> Pelanggaran staff dikenai sanksi **berat**.

**IV. ROLE KHUSUS**
Streamer, DJ, Content Creator, Designer, Accountant, dll adalah role **tidak permanen**. Owner berhak menangguhkan, menurunkan, atau mencabut role kapan saja tanpa kompensasi. Melanggar = role langsung dicabut.

**V. ZERO TOLERANCE → 🔨 PERMANENT BAN**
- Scam / penipuan
- Hack, cheat, exploit
- Ancaman & doxxing
- Sengaja merusak nama baik TRO
- Membentuk / mendukung grup tandingan
- Member grup kompetitor dilarang bergabung

**VI. SANKSI**
\`⚠️ Teguran\` → \`🔇 Mute / Timeout\` → \`🔨 Permanent Ban\`
Untuk pelanggaran berat, staff boleh langsung ke sanksi tertinggi.

**VII. BANDING**
- Tiap kasus hanya bisa banding **1x**, lewat ticket.
- Wajib sopan & tenang — banding berisi drama/provokasi **langsung ditolak**.
- Banding tidak menjamin sanksi dicabut.

**VIII. OTORITAS OWNER**
3 Owner TRO memegang keputusan akhir atas sanksi, banding, dan konflik. Keputusan bersifat mengikat.

**IX. PENUTUP**
Aturan dapat berubah sewaktu-waktu. Tetap berada di server = setuju dengan perubahan tersebut.`,
      },
    ],
  },

  'who-we-are': {
    label: 'Who We Are',
    channelId: '1438551021906563122',
    embeds: [
      {
        title: '🦉 WHO WE ARE',
        description:
`*The Resilient Order • Est. 13/11/2025*

**The Resilient Order (TRO)** adalah komunitas yang dibangun di atas nilai **ketahanan, kebijaksanaan, kehormatan, dan persatuan**.
- **Resilient** — tetap teguh dan bangkit di tengah tantangan.
- **Order** — sebuah tatanan dan persaudaraan dengan tujuan yang jelas.

> *"Sebuah ordo keteguhan yang menjunjung kebijaksanaan, melindungi kebenaran, dan saling menguatkan dalam persatuan."*`,
        fields: [
          { name: '🦉 Burung Hantu', value: 'Kebijaksanaan & kejernihan berpikir. Melihat jalan bahkan dalam gelap.' },
          { name: '⚔️ Pedang', value: 'Keberanian, keadilan, dan disiplin sebagai fondasi kekuatan.' },
          { name: '🛡️ Tameng', value: 'Perlindungan & persatuan. Kekuatan terbesar lahir dari kebersamaan.' },
          { name: '🎨 Warna & Bentuk', value: 'Emas: kemuliaan & kebijaksanaan. Perak: kekuatan yang tenang. Simetris: harmoni pikiran, hati, dan tindakan.' },
          { name: '⚜️ Makna Utama', value: 'Menjadi pribadi yang **bijaksana, kuat, dan tetap teguh** — memimpin dengan keadilan dan keberanian tanpa kehilangan kebijaksanaan, seperti King Baldwin IV.' },
        ],
      },
    ],
  },

  'link-information': {
    label: 'Link Information',
    channelId: '1437895001576046834',
    embeds: [
      {
        title: '🔗 LINK INFORMATION',
        description: 'Hanya link di channel ini yang **resmi**. Hati-hati link palsu yang mengatasnamakan TRO.',
        fields: [
          { name: '🎮 Roblox Community TRO', value: COMMUNITY },
          { name: '💳 Pembayaran resmi', value: 'Hanya via **DANA** — nomor resmi diberikan di ticket order. Selain itu = **palsu**.' },
        ],
      },
    ],
  },

  seragam: {
    label: 'Seragam',
    channelId: '1437895361707638856',
    embeds: [
      {
        title: '🧥 SERAGAM RESMI TRO',
        description: 'Pakai seragam resmi di setiap event biar kompak sebagai satu Fams! 🦉',
        fields: [
          { name: '🧥 TRO-VARSITY', value: `[Beli di Roblox](${VARSITY})`, inline: true },
          { name: '🧥 New Jacket TRO Family', value: `[Beli di Roblox](${NEW_JACKET})`, inline: true },
        ],
      },
    ],
  },

  'price-list': {
    label: 'Price List Robux',
    channelId: '1448746386395758715',
    embeds: [
      {
        title: '💰 PRICE LIST ROBUX',
        description:
`**Harga Robux: Rp157.000 / 1.000 RBX** (Rp157 per Robux)
**Via Username (USN)** — tanpa login akun & tanpa gamepass, Robux masuk utuh.

\`\`\`
  100 RBX  →  Rp15.700
  200 RBX  →  Rp31.400
  300 RBX  →  Rp47.100
  400 RBX  →  Rp62.800
  500 RBX  →  Rp78.500
  600 RBX  →  Rp94.200
  700 RBX  →  Rp109.900
  800 RBX  →  Rp125.600
  900 RBX  →  Rp141.300
1.000 RBX  →  Rp157.000
1.500 RBX  →  Rp235.500
2.000 RBX  →  Rp314.000
2.500 RBX  →  Rp392.500
3.000 RBX  →  Rp471.000
\`\`\`
Nominal lain? Tulis aja jumlahnya di form order, total keluar otomatis.

✅ Proses cepat setelah pembayaran dikonfirmasi
✅ Tanpa login akun
💳 Pembayaran **hanya via DANA** — nomor DANA resmi muncul di tiket setelah kamu isi form order
📸 Kirim **screenshot bukti TF** di tiket, bot otomatis catat

📌 **Cara order:** buka ticket di ${TICKET}
⚠️ Khusus member yang sudah stay **min. 14 hari** di komunitas.

*S&K berlaku. Setiap perubahan harga diumumkan di channel ini.*`,
      },
    ],
  },

  'shop-announcement': {
    label: 'Shop Announcement',
    channelId: '1451475306329280512',
    embeds: [
      {
        title: '📢 INFO HARGA ROBUX GC',
        description:
`Robux yang kami jual adalah **Robux Give Community (GC)**, bukan Robux official Roblox:
⚡ Masuk **instan**
💯 **Tanpa potongan**
⏱️ **Tanpa pending**

Karena itu harganya beda dan nggak bisa dibandingkan langsung dengan Robux official — ibarat transfer cash vs cicilan, atau kirim same-day vs reguler.

**Kenapa harga pernah naik?**
- Stok GC terbatas & tidak selalu stabil
- Permintaan dari komunitas naik signifikan
- Harga lama terlalu murah dan tidak sustainable

Mulai sekarang, perubahan harga **hanya diumumkan setelah final**, biar nggak bikin bingung.

📋 Harga terbaru: ${PRICELIST}
❓ Ada pertanyaan? Buka ticket di ${TICKET}
Terima kasih atas dukungannya, TRO Family! 🦉`,
      },
    ],
  },

  'trolley-guide': {
    label: 'TROlley Guide',
    channelId: '1448746591044374568',
    embeds: [
      {
        title: '🛒 TROlley GUIDE — CARA ORDER',
        description:
`> ⚠️ **Semua order WAJIB via ticket.** Order di chat umum tidak dilayani.

**1️⃣** Klik **Open Ticket** di ${TICKET}
**2️⃣** Pilih kategori:
- Fish It
- Gift Robux via Gamepass
- Robux Gift Komunitas → [join community dulu](${COMMUNITY})

**3️⃣** Klik **Isi form order** di ticket → isi jumlah Robux, username Roblox (USN) & nama akun DANA kamu → **total keluar otomatis**
**4️⃣** Transfer via **DANA** ke nomor yang muncul di ticket (DANA only)
**5️⃣** Kirim **screenshot bukti TF** di ticket → bot catat, admin cek & konfirmasi
**6️⃣** Tunggu admin proses ⏱️ **1–10 menit** — kamu dapat DM tiap status berubah

📋 Lihat harga di ${PRICELIST}`,
      },
    ],
  },
};
