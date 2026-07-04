const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function startDashboard(port, botManager) {
  return new Promise((resolve, reject) => {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(path.join(__dirname, 'public')));

    // ── Bot Status ──────────────────────────────────────────────────────────
    app.get('/api/status', (req, res) => {
      res.json(botManager.getStatus());
    });

    // ── Restart bot ─────────────────────────────────────────────────────────
    app.post('/api/restart', async (req, res) => {
      res.json({ ok: true, message: 'Restarting bot...' });
      setImmediate(() => botManager.restart().catch(console.error));
    });

    // ── Stop bot ────────────────────────────────────────────────────────────
    app.post('/api/stop', async (req, res) => {
      await botManager.stop();
      res.json({ ok: true, message: 'Bot stopped.' });
    });

    // ── Start bot ───────────────────────────────────────────────────────────
    app.post('/api/start', async (req, res) => {
      res.json({ ok: true, message: 'Starting bot...' });
      setImmediate(() => botManager.start().catch(console.error));
    });

    // ── Upload appstate ─────────────────────────────────────────────────────
    app.post('/api/upload-appstate', upload.single('appstate'), async (req, res) => {
      try {
        let appState = null;

        if (req.file) {
          appState = JSON.parse(req.file.buffer.toString('utf8'));
        } else if (req.body && req.body.appstate) {
          appState = JSON.parse(req.body.appstate);
        }

        if (!Array.isArray(appState) || appState.length === 0) {
          return res.status(400).json({ ok: false, message: 'Invalid appstate format.' });
        }

        res.json({ ok: true, message: 'Appstate uploaded. Bot is restarting...' });
        setImmediate(() => botManager.updateAppState(appState).catch(console.error));
      } catch (err) {
        res.status(400).json({ ok: false, message: 'Parse error: ' + err.message });
      }
    });

    // ── Get current appstate ────────────────────────────────────────────────
    app.get('/api/appstate', (req, res) => {
      try {
        botManager.saveAppState();
        const raw = fs.readFileSync(path.join(__dirname, 'data', 'appstate.json'), 'utf8');
        res.json({ ok: true, appstate: JSON.parse(raw) });
      } catch (err) {
        res.json({ ok: false, message: err.message });
      }
    });

    // ── Admins ──────────────────────────────────────────────────────────────
    app.get('/api/admins', (req, res) => {
      res.json({ ok: true, data: botManager.getAdminsData() });
    });

    app.post('/api/admins/add', (req, res) => {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ ok: false, message: 'userId required' });
      botManager.addAdmin(String(userId).trim());
      res.json({ ok: true, message: `Added admin: ${userId}` });
    });

    app.post('/api/admins/remove', (req, res) => {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ ok: false, message: 'userId required' });
      botManager.removeAdmin(String(userId).trim());
      res.json({ ok: true, message: `Removed admin: ${userId}` });
    });

    app.post('/api/admins/set-owner', (req, res) => {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ ok: false, message: 'userId required' });
      botManager.setOwner(String(userId).trim());
      res.json({ ok: true, message: `Owner set to: ${userId}` });
    });

    // ── Get thread list ─────────────────────────────────────────────────────
    app.get('/api/threads', async (req, res) => {
      if (!botManager.bot || botManager.status !== 'online') {
        return res.json({ ok: false, message: 'Bot is offline', threads: [] });
      }
      try {
        const threads = await new Promise((resolve, reject) => {
          botManager.bot.api.getThreadList(20, null, ['INBOX'], (err, list) => {
            if (err) reject(err);
            else resolve(list || []);
          });
        });
        res.json({ ok: true, threads });
      } catch (err) {
        res.json({ ok: false, message: err.message, threads: [] });
      }
    });

    // ── Send message to thread ──────────────────────────────────────────────
    app.post('/api/send-message', async (req, res) => {
      const { threadId, message } = req.body;
      if (!threadId || !message) {
        return res.status(400).json({ ok: false, message: 'threadId and message required' });
      }
      if (!botManager.bot || botManager.status !== 'online') {
        return res.status(503).json({ ok: false, message: 'Bot is offline' });
      }
      try {
        await new Promise((resolve, reject) => {
          botManager.bot.api.sendMessage(message, threadId, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        res.json({ ok: true, message: 'Message sent!' });
      } catch (err) {
        res.status(500).json({ ok: false, message: err.message });
      }
    });

    // ── Health check ────────────────────────────────────────────────────────
    app.get('/health', (req, res) => res.json({ ok: true }));

    // ── Catch-all → index.html ──────────────────────────────────────────────
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`[Dashboard] Listening on 0.0.0.0:${port}`);
      resolve(server);
    });

    server.on('error', reject);
  });
}

module.exports = { startDashboard };
