const { startDashboard } = require('./dashboard');
const { BotManager }     = require('./bot');

const PORT = parseInt(process.env.PORT || '5000', 10);

async function main() {
  const botManager = new BotManager();

  await startDashboard(PORT, botManager);

  await botManager.start();

  process.on('SIGINT',  () => shutdown(botManager));
  process.on('SIGTERM', () => shutdown(botManager));
}

async function shutdown(botManager) {
  console.log('\n[App] Shutting down...');
  await botManager.stop().catch(() => {});
  process.exit(0);
}

main().catch(err => {
  console.error('[App] Fatal error:', err);
  process.exit(1);
});
