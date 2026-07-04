const axios = require('axios');

const HELP_GIF_URL = 'https://media.giphy.com/media/xT9IgG50Lg7rusytDu/giphy.gif';

const HELP_TEXT = `╔══════════════════════════╗
║   🤖 Anakin x Magnus Bot   ║
╚══════════════════════════╝

📋 الأوامر المتاحة:
─────────────────────────
/help      ➤ قائمة الأوامر
/uptime    ➤ وقت تشغيل البوت
/ping      ➤ التحقق من حالة البوت
/id        ➤ معرفة الـ ID الخاص بك
/addadmin  ➤ إضافة أدمن جديد
/removeadmin ➤ إزالة أدمن
/admins    ➤ عرض قائمة الأدمنز
─────────────────────────
⚡ Powered by Anakin x Magnus`;

module.exports = async function helpCommand(ctx) {
  let sent = false;
  try {
    const gifRes = await axios.get(HELP_GIF_URL, {
      responseType: 'stream',
      timeout: 10000
    });
    await ctx.replyAsync({
      body: HELP_TEXT,
      attachment: gifRes.data
    });
    sent = true;
  } catch (_) {}

  if (!sent) {
    await ctx.replyAsync(HELP_TEXT);
  }
};
