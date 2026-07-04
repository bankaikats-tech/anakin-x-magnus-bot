const fs = require('fs');
const path = require('path');

const APPSTATE_PATH = path.join(__dirname, 'data', 'appstate.json');
const ADMIN_PATH    = path.join(__dirname, 'data', 'admin.json');

class BotManager {
  constructor() {
    this.bot        = null;
    this.startTime  = null;
    this.status     = 'offline';
    this.error      = null;
    this.botId      = null;
    this._saveTimer = null;
    this._starting  = false;
  }

  // ─── Admin helpers ──────────────────────────────────────────────────────────

  _readAdmins() {
    try {
      return JSON.parse(fs.readFileSync(ADMIN_PATH, 'utf8'));
    } catch {
      return { owner: '', admins: [] };
    }
  }

  _writeAdmins(data) {
    fs.writeFileSync(ADMIN_PATH, JSON.stringify(data, null, 2));
  }

  isAdmin(userId) {
    if (!userId) return false;
    const uid = String(userId);
    const { owner, admins } = this._readAdmins();
    return uid === String(owner) || admins.map(String).includes(uid);
  }

  addAdmin(userId) {
    const data = this._readAdmins();
    const uid  = String(userId);
    if (!data.admins.map(String).includes(uid)) {
      data.admins.push(uid);
      this._writeAdmins(data);
    }
  }

  removeAdmin(userId) {
    const data = this._readAdmins();
    data.admins = data.admins.filter(id => String(id) !== String(userId));
    this._writeAdmins(data);
  }

  setOwner(userId) {
    const data = this._readAdmins();
    data.owner = String(userId);
    this._writeAdmins(data);
  }

  getAdminsData() {
    return this._readAdmins();
  }

  // ─── Appstate helpers ────────────────────────────────────────────────────────

  _loadAppState() {
    try {
      const raw = fs.readFileSync(APPSTATE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  }

  saveAppState() {
    if (!this.bot) return;
    try {
      const appState = this.bot.api.getAppState();
      if (Array.isArray(appState) && appState.length > 0) {
        fs.writeFileSync(APPSTATE_PATH, JSON.stringify(appState, null, 2));
      }
    } catch (err) {
      console.error('[Bot] Failed to save appstate:', err.message);
    }
  }

  async updateAppState(newAppState) {
    fs.writeFileSync(APPSTATE_PATH, JSON.stringify(newAppState, null, 2));
    await this.restart();
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  async start() {
    if (this._starting) return;
    this._starting = true;

    const appState = this._loadAppState();
    if (!appState) {
      this.status = 'no_appstate';
      this._starting = false;
      console.log('[Bot] No valid appstate found. Please upload via dashboard.');
      return;
    }

    try {
      this.status = 'connecting';
      console.log('[Bot] Connecting to Facebook...');

      const { createMessengerBot } = require('./dist/cjs.cjs');

      this.bot = await createMessengerBot(
        { appState },
        {
          autoListen:    true,
          listenEvents:  true,
          selfListen:    false,
          autoMarkRead:  false,
          autoReconnect: true,
          commandPrefix: '/'
        }
      );

      this.startTime = Date.now();
      this.status    = 'online';
      this.error     = null;

      try {
        this.botId = String(this.bot.api.getCurrentUserID());
      } catch {}

      console.log('[Bot] Online! ID:', this.botId);

      this._saveTimer = setInterval(() => this.saveAppState(), 30 * 60 * 1000);

      this._registerCommands();
    } catch (err) {
      this.status = 'error';
      this.error  = err.message;
      console.error('[Bot] Connection failed:', err.message);
    } finally {
      this._starting = false;
    }
  }

  _registerCommands() {
    const bot = this.bot;

    // Guard: only admins can trigger any command
    const adminGuard = (handler) => async (ctx) => {
      if (!this.isAdmin(ctx.senderID)) return;
      await handler(ctx);
    };

    bot.command('help', adminGuard(async (ctx) => {
      await require('./commands/help')(ctx, this);
    }));

    bot.command('uptime', adminGuard(async (ctx) => {
      await require('./commands/uptime')(ctx, this);
    }));

    bot.command('ping', adminGuard(async (ctx) => {
      await ctx.replyAsync('🏓 Pong! البوت يعمل بشكل طبيعي ✅');
    }));

    bot.command('id', adminGuard(async (ctx) => {
      await ctx.replyAsync(
        `📌 معرفك: ${ctx.senderID}\n📌 معرف المحادثة: ${ctx.threadID}`
      );
    }));

    bot.command('addadmin', adminGuard(async (ctx) => {
      const parts = ctx.text.trim().split(/\s+/);
      const targetId = parts[1];
      if (!targetId) {
        await ctx.replyAsync('❌ الاستخدام: /addadmin [user_id]');
        return;
      }
      this.addAdmin(targetId);
      await ctx.replyAsync(`✅ تم إضافة الأدمن: ${targetId}`);
    }));

    bot.command('removeadmin', adminGuard(async (ctx) => {
      const parts = ctx.text.trim().split(/\s+/);
      const targetId = parts[1];
      if (!targetId) {
        await ctx.replyAsync('❌ الاستخدام: /removeadmin [user_id]');
        return;
      }
      this.removeAdmin(targetId);
      await ctx.replyAsync(`✅ تم إزالة الأدمن: ${targetId}`);
    }));

    bot.command('admins', adminGuard(async (ctx) => {
      const { owner, admins } = this.getAdminsData();
      const list = admins.length
        ? admins.map((id, i) => `${i + 1}. ${id}`).join('\n')
        : 'لا يوجد أدمنز مضافون';
      await ctx.replyAsync(
        `👑 المالك: ${owner || 'غير محدد'}\n\n📋 قائمة الأدمنز:\n${list}`
      );
    }));

    bot.catch((err) => {
      console.error('[Bot] Command error:', err?.message || err);
    });

    console.log('[Bot] Commands registered.');
  }

  async stop() {
    if (this._saveTimer) {
      clearInterval(this._saveTimer);
      this._saveTimer = null;
    }
    if (this.bot) {
      this.saveAppState();
      try { await this.bot.stop(); } catch {}
      this.bot = null;
    }
    this.status    = 'offline';
    this.startTime = null;
    this.botId     = null;
    this._starting = false;
  }

  async restart() {
    console.log('[Bot] Restarting...');
    await this.stop();
    await new Promise(r => setTimeout(r, 3000));
    await this.start();
  }

  getStatus() {
    const uptime = this.startTime ? Date.now() - this.startTime : 0;
    return {
      status:    this.status,
      online:    this.status === 'online',
      botId:     this.botId,
      uptime,
      uptimeStr: _formatUptime(uptime),
      error:     this.error,
      admins:    this._readAdmins()
    };
  }
}

function _formatUptime(ms) {
  const s    = Math.floor(ms / 1000);
  const d    = Math.floor(s / 86400);
  const h    = Math.floor((s % 86400) / 3600);
  const m    = Math.floor((s % 3600) / 60);
  const sec  = s % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(' ');
}

module.exports = { BotManager };
