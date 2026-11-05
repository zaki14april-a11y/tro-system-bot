// ============================================================
//  🦉 TRO SYSTEM — bot + dashboard web THE RESILIENT ORDER
// ============================================================
require('dotenv').config();

const missing = ['DISCORD_TOKEN', 'GUILD_ID'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`❌ ${missing.join(', ')} belum diisi. Jalankan start.bat atau isi file .env`);
  process.exit(1);
}

(async () => {
await require('./cloudsync').restore();
const bot = require('./bot');
const web = require('./web');
require('./autoroles').setup(bot);

process.on('unhandledRejection', (e) => console.error('⚠️', e?.message || e));

bot.client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error('❌ Gagal login bot:', err.message);
  if (/disallowed intents/i.test(err.message)) {
    console.error('   → Nyalakan "Server Members Intent" & "Message Content Intent" di Developer Portal > Bot.');
  }
  process.exit(1);
});
web.start();
require('./cloudsync').ensureFirst();

// simpan cadangan terakhir sebelum server mati (Render/Railway kirim SIGTERM)
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, async () => { await require('./cloudsync').flush().catch(() => {}); process.exit(0); });
})();
