const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const { readHeartbeat, getFileSize, MAX_SIZE } = require('./memory');
const { saveBase64Image } = require('./images');
const whatsapp = require('./whatsapp');
const elevenlabs = require('./elevenlabs');
const { killCurrentProcess } = require('./claude');
const state = require('./state');
const t = require('./i18n');

const ENV_FILE = path.join(__dirname, '..', '.env');

const SETTINGS_DEFS = [
  { group: 'general',    key: 'LANGUAGE',                type: 'select', options: ['en', 'de'], placeholder: 'en' },
  { group: 'claude',     key: 'CLAUDE_MODEL',            type: 'text',     placeholder: 'opus' },
  { group: 'claude',     key: 'CLAUDE_BIN',              type: 'text',     placeholder: 'claude' },
  { group: 'discord',    key: 'DISCORD_ENABLED',         type: 'toggle', placeholder: 'false' },
  { group: 'discord',    key: 'DISCORD_BOT_TOKEN',       type: 'password', placeholder: '', dependsOn: 'DISCORD_ENABLED' },
  { group: 'discord',    key: 'DISCORD_ALLOWED_USER_ID', type: 'text',     placeholder: '', dependsOn: 'DISCORD_ENABLED' },
  { group: 'heartbeat',  key: 'HEARTBEAT_INTERVAL_MINS', type: 'number',   placeholder: '30' },
  { group: 'heartbeat',  key: 'HEARTBEAT_MAX_SIZE',      type: 'number',   placeholder: '50000' },
  { group: 'heartbeat',  key: 'CRONTAB_GRACE_MINS',      type: 'number',   placeholder: '30' },
  { group: 'webServer',  key: 'WEB_PORT',                type: 'number',   placeholder: '3000' },
  { group: 'webServer',  key: 'WEB_HOST',                type: 'text',     placeholder: '127.0.0.1' },
  { group: 'webServer',  key: 'SUPPRESS_CHANNELS_ON_FOCUS', type: 'toggle', placeholder: 'false' },
  { group: 'whisper',    key: 'WHISPER_LOCAL_ENABLED',     type: 'toggle', placeholder: 'false' },
  { group: 'whisper',    key: 'WHISPER_URL',              type: 'text',     placeholder: 'http://localhost:9000', dependsOn: 'WHISPER_LOCAL_ENABLED' },
  { group: 'whisper',    key: 'WHISPER_LANGUAGE',         type: 'text',     placeholder: 'de', dependsOn: 'WHISPER_LOCAL_ENABLED' },
  { group: 'whatsapp',   key: 'WHATSAPP_ENABLED',        type: 'toggle', placeholder: 'false' },
  { group: 'whatsapp',   key: 'WHATSAPP_PHONE',          type: 'text',     placeholder: '+491234567890', dependsOn: 'WHATSAPP_ENABLED' },
  { group: 'whatsapp',   key: 'WHATSAPP_SEND_PHONE',     type: 'text',     placeholder: '+491234567890', dependsOn: 'WHATSAPP_ENABLED' },
  { group: 'elevenlabs', key: 'ELEVENLABS_ENABLED',      type: 'toggle', placeholder: 'false' },
  { group: 'elevenlabs', key: 'ELEVENLABS_API_KEY',      type: 'password', placeholder: '', dependsOn: 'ELEVENLABS_ENABLED' },
  { group: 'elevenlabs', key: 'ELEVENLABS_VOICE',        type: 'voice-select', placeholder: '', dependsOn: 'ELEVENLABS_ENABLED' },
];

async function readEnvFile() {
  try {
    const values = {};
    for (const line of (await fs.readFile(ENV_FILE, 'utf-8')).split('\n')) {
      const raw = line.trim();
      if (!raw || raw.startsWith('#')) continue;
      const eq = raw.indexOf('=');
      if (eq < 0) continue;
      values[raw.slice(0, eq).trim()] = raw.slice(eq + 1).trim();
    }
    return values;
  } catch { return {}; }
}

async function writeEnvFile(updates) {
  let content = '';
  try { content = await fs.readFile(ENV_FILE, 'utf-8'); } catch {}
  const touched = new Set();
  const newLines = (content ? content.split('\n') : []).map(line => {
    const raw = line.trim();
    if (!raw || raw.startsWith('#')) return line;
    const eq = raw.indexOf('=');
    if (eq < 0) return line;
    const key = raw.slice(0, eq).trim();
    if (key in updates) { touched.add(key); return `${key}=${updates[key]}`; }
    return line;
  });
  for (const [key, val] of Object.entries(updates)) {
    if (!touched.has(key)) newLines.push(`${key}=${val}`);
  }
  await fs.writeFile(ENV_FILE, newLines.join('\n'), 'utf-8');
}

function restartSelf() {
  const args = process.argv.slice(1).join(' ');
  spawn('sh', ['-c', `sleep 1 && node ${args}`], { detached: true, stdio: 'ignore' }).unref();
  process.exit(0);
}

const PORT = parseInt(process.env.WEB_PORT || '3000', 10);
const HOST = process.env.WEB_HOST || '127.0.0.1';

let lastHeartbeatRun = null;
const botStartTime = new Date().toISOString();

let _messageProcessor = null;
let _onStop = null;

function recordHeartbeatRun() { lastHeartbeatRun = new Date().toISOString(); }
function setMessageProcessor(fn) { _messageProcessor = fn; }
function setOnStop(fn) { _onStop = fn; }

// ─── API data ─────────────────────────────────────────────────────────────────

async function getHeartbeatApiData() {
  const { instructions, history, raw } = await readHeartbeat();
  const fileSize = await getFileSize();
  const entries = [];
  // Capture any preamble text before the first ### (e.g. compressed label)
  const preambleMatch = history.match(/^([\s\S]*?)(?=\n### |$)/);
  const preamble = preambleMatch ? preambleMatch[1].trim() : '';
  const entryRegex = /### ([^\n]+)\n([\s\S]*?)(?=\n### |$)/g;
  let match;
  while ((match = entryRegex.exec(history)) !== null) {
    entries.push({ timestamp: match[1].trim(), content: match[2].trim() });
  }
  // If there's preamble text (compressed label etc.), add as entry with marker timestamp
  if (preamble) {
    entries.push({ timestamp: '__compressed_preamble__', content: preamble });
  }
  entries.reverse();

  // Parse ## Crontab section
  const crontabMatch = raw.match(/## Crontab\s*(?:<!--[^>]*-->\s*)?([\s\S]*?)(?=\n## |$)/);
  const crontabText = crontabMatch ? crontabMatch[1].trim() : '';
  const crontabEntries = crontabText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('<!--'))
    .map(l => {
      const m = l.match(/^every\s+([\w]+)\s+at\s+(\d{1,2}:\d{2}(?:\s*[ap]m)?)\s*:\s*(.+)$/i);
      return m ? { schedule: `every ${m[1]} at ${m[2]}`, task: m[3].trim(), raw: l } : { schedule: null, task: l, raw: l };
    });

  return {
    instructions,
    entries,
    crontabEntries,
    stats: { fileSize, maxSize: MAX_SIZE, entryCount: entries.length, lastRun: lastHeartbeatRun, botStartTime },
  };
}

// ─── Read request body ────────────────────────────────────────────────────────

function readBody(req, maxSize = 50 * 1024 * 1024) { // 50 MB default limit (for base64 images)
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxSize) { req.destroy(); reject(new Error('Body too large')); return; }
      body += chunk.toString();
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

const { getHTML } = require('./ui');


// ─── Server ───────────────────────────────────────────────────────────────────

function createServer() {
  const HTML = getHTML(t.ui);

  const server = http.createServer(async (req, res) => {
    const url = req.url.split('?')[0];

    // SSE: browser receives live updates
    if (req.method === 'GET' && url === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write('\n');

      // Bestehende Chat-Historie sofort senden
      res.write(`data: ${JSON.stringify({ type: 'history', messages: state.chatLog })}\n\n`);
      // Console-Buffer senden
      res.write(`data: ${JSON.stringify({ type: 'console_history', entries: state.consoleBuffer })}\n\n`);
      // Wenn gerade ein Stream läuft: alle bisherigen Events replay senden,
      // damit reconnectende Clients die laufende Antwort sehen und weiterverfolgen können
      const activeStream = state.getActiveStream();
      if (activeStream) {
        for (const event of activeStream.events) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      }

      state.sseClients.add(res);
      req.on('close', () => state.sseClients.delete(res));
      return;
    }

    // Chat: Nachricht empfangen und verarbeiten
    if (req.method === 'POST' && url === '/api/chat') {
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));

      const body = await readBody(req).catch(() => ({}));
      const text = (body.message || '').trim();

      // Save uploaded images (base64) to temp folder
      const imagePaths = [];
      if (body.images && Array.isArray(body.images)) {
        for (const img of body.images) {
          if (img.data && img.name) {
            try {
              const savedPath = saveBase64Image(img.data, img.name);
              imagePaths.push(savedPath);
              console.log(`[Web] Image saved: ${savedPath}`);
            } catch (err) {
              console.error(`[Web] Failed to save image: ${err.message}`);
            }
          }
        }
      }

      // Save uploaded documents (base64) to temp folder
      const documentPaths = [];
      if (body.documents && Array.isArray(body.documents)) {
        for (const doc of body.documents) {
          if (doc.data && doc.name) {
            try {
              const savedPath = saveBase64Image(doc.data, doc.name); // reuse same save fn
              documentPaths.push({ path: savedPath, name: doc.name });
              console.log(`[Web] Document saved: ${savedPath}`);
            } catch (err) {
              console.error(`[Web] Failed to save document: ${err.message}`);
            }
          }
        }
      }

      if ((!text && imagePaths.length === 0 && documentPaths.length === 0) || !_messageProcessor) return;
      const finalText = text || (imagePaths.length > 0 ? 'Hier ist ein Bild.' : documentPaths.length > 0 ? 'Hier ist ein Dokument.' : '');

      // Asynchron verarbeiten (Antwort kommt via SSE)
      _messageProcessor(finalText, imagePaths, documentPaths).catch((err) => {
        console.error(t.web.processingError, err.message);
        state.addChatMessage('bot', t.chat.error(err.message), 'web');
      });
      return;
    }

    // Settings
    if (req.method === 'GET' && url === '/api/settings') {
      const values = await readEnvFile();
      const defs = SETTINGS_DEFS.map(d => ({
        ...d,
        group: t.settings.groups[d.group] || d.group,
        label: (t.settings.fields[d.key] || {}).label || d.key,
        description: (t.settings.fields[d.key] || {}).description || '',
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ defs, values }));
      return;
    }

    if (req.method === 'POST' && url === '/api/settings') {
      const body = await readBody(req).catch(() => ({}));
      await writeEnvFile(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'POST' && url === '/api/restart') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      setTimeout(restartSelf, 300);
      return;
    }

    if (req.method === 'POST' && url === '/api/shutdown') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      setTimeout(() => process.exit(0), 300);
      return;
    }

    if (req.method === 'GET' && url === '/api/whatsapp/qr') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(whatsapp.getQR()));
      return;
    }

    // ElevenLabs: fetch available voices
    if (req.method === 'GET' && url === '/api/elevenlabs/voices') {
      try {
        if (!elevenlabs.isConfigured()) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ voices: [], selected: '' }));
          return;
        }
        const voices = await elevenlabs.getVoices();
        const selected = await elevenlabs.getSelectedVoice().catch(() => '');
        const lang = (process.env.LANGUAGE || 'en').toLowerCase();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ voices, selected, language: lang }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message, voices: [], selected: '' }));
      }
      return;
    }

    // Web UI focus tracking (for SUPPRESS_CHANNELS_ON_FOCUS)
    if (req.method === 'POST' && url === '/api/focus') {
      const body = await readBody(req).catch(() => ({}));
      state.setWebUiFocused(!!body.focused);
      const env = await readEnvFile();
      const suppressEnabled = (env.SUPPRESS_CHANNELS_ON_FOCUS || 'false').toLowerCase() === 'true';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, suppressEnabled }));
      return;
    }

    // Stop current Claude process and clear message queue
    if (req.method === 'POST' && url === '/api/stop') {
      killCurrentProcess();
      if (_onStop) _onStop();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // Dashboard-API
    if (req.method === 'GET' && url === '/api/heartbeat') {
      try {
        const data = await getHeartbeatApiData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // Serve local files (images & documents) from temp folder
    if (req.method === 'GET' && url === '/api/file') {
      const qs = req.url.split('?')[1] || '';
      const params = new URLSearchParams(qs);
      const filePath = params.get('path');
      const isDownload = params.get('download') === '1';
      if (!filePath) { res.writeHead(400); res.end(); return; }
      // Security: only serve files from the temp directory
      const tempDir = path.join(__dirname, '..', 'temp');
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(tempDir)) { res.writeHead(403); res.end('Access denied'); return; }
      try {
        const data = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const MIME_MAP = {
          '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
          '.webp': 'image/webp', '.bmp': 'image/bmp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
          '.pdf': 'application/pdf', '.txt': 'text/plain', '.csv': 'text/csv',
          '.json': 'application/json', '.xml': 'application/xml',
          '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          '.zip': 'application/zip', '.gz': 'application/gzip', '.tar': 'application/x-tar',
          '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4',
          '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
          '.md': 'text/markdown', '.yaml': 'text/yaml', '.yml': 'text/yaml',
        };
        const mime = MIME_MAP[ext] || 'application/octet-stream';
        const headers = { 'Content-Type': mime, 'Cache-Control': 'public, max-age=3600' };
        if (isDownload) {
          const fileName = filePath.split('/').pop();
          headers['Content-Disposition'] = 'attachment; filename="' + fileName + '"';
        }
        res.writeHead(200, headers);
        res.end(data);
      } catch (err) {
        res.writeHead(404); res.end('File not found');
      }
      return;
    }

    // HTML
    if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(HTML);
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(PORT, HOST, () => {
    console.log(t.web.serverRunning(HOST, PORT));
  });

  return server;
}

module.exports = { createServer, recordHeartbeatRun, setMessageProcessor, setOnStop, restartSelf };
