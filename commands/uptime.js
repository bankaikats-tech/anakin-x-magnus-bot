const axios = require('axios');

const UPTIME_GIF_URL = 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif';

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days    = Math.floor(totalSeconds / 86400);
  const hours   = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days > 0)    parts.push(`${days} يوم`);
  if (hours > 0)   parts.push(`${hours} ساعة`);
  if (minutes > 0) parts.push(`${minutes} دقيقة`);
  parts.push(`${seconds} ثانية`);
  return parts.join(' و ');
}

module.exports = async function uptimeCommand(ctx, botManager) {
  const uptime = botManager.startTime ? Date.now() - botManager.startTime : 0;
  const formattedUptime = formatUptime(uptime);

  const uptimeText = `╔══════════════════════════╗
║   ⏱️ وقت تشغيل البوت       ║
╚══════════════════════════╝

🟢 الحالة: متصل
⏰ وقت التشغيل: ${formattedUptime}
🤖 البوت: Anakin x Magnus Bot
─────────────────────────
⚡ يعمل بشكل مستمر وجاهز للخدمة!`;

  let sent = false;
  try {
    const gifRes = await axios.get(UPTIME_GIF_URL, {
      responseType: 'stream',
      timeout: 10000
    });
    await ctx.replyAsync({
      body: uptimeText,
      attachment: gifRes.data
    });
    sent = true;
  } catch (_) {}

  if (!sent) {
    await ctx.replyAsync(uptimeText);
  }
};
