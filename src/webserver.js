const http = require('http');
const { readHeartbeat, getFileSize, MAX_SIZE } = require('./memory');
const { killCurrentProcess } = require('./claude');
const state = require('./state');
const t = require('./i18n');

const PORT = parseInt(process.env.WEB_PORT || '3000', 10);
const HOST = process.env.WEB_HOST || '127.0.0.1';

let lastHeartbeatRun = null;
const botStartTime = new Date().toISOString();

let _messageProcessor = null;

function recordHeartbeatRun() { lastHeartbeatRun = new Date().toISOString(); }
function setMessageProcessor(fn) { _messageProcessor = fn; }

// ─── API data ─────────────────────────────────────────────────────────────────

async function getHeartbeatApiData() {
  const { instructions, history } = await readHeartbeat();
  const fileSize = await getFileSize();
  const entries = [];
  const entryRegex = /### ([^\n]+)\n([\s\S]*?)(?=\n### |$)/g;
  let match;
  while ((match = entryRegex.exec(history)) !== null) {
    entries.push({ timestamp: match[1].trim(), content: match[2].trim() });
  }
  entries.reverse();
  return {
    instructions,
    entries,
    stats: { fileSize, maxSize: MAX_SIZE, entryCount: entries.length, lastRun: lastHeartbeatRun, botStartTime },
  };
}

// ─── Read request body ────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function getHTML(ui) {
  const clientStrings = JSON.stringify({
    notRunYet: ui.notRunYet,
    noInstructionsSet: ui.noInstructionsSet,
    noEntries: ui.noEntries,
    sessionReset: ui.sessionReset,
    sendError: ui.sendError,
    maxLabel: ui.maxLabel,
    locale: ui.locale,
  });

  return `<!DOCTYPE html>
<html lang="${ui.htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BigClaudia</title>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<style>
  :root {
    --bg: #0a0e1a; --bg2: #111827; --bg3: #1a2235; --border: #1e2d45;
    --accent: #00e5a0; --accent2: #0ea5e9; --text: #e2e8f0; --muted: #64748b;
    --danger: #f43f5e; --radius: 10px; --discord: #5865f2;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: 'Inter', system-ui, sans-serif; min-height: 100vh; line-height: 1.6; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

  /* ── Header ── */
  header {
    background: linear-gradient(135deg, #0a0e1a 0%, #0f1f3d 100%);
    border-bottom: 1px solid var(--border);
    padding: 14px 24px;
    display: flex; align-items: center; gap: 14px;
    flex-shrink: 0;
  }
  .hb-icon { width: 30px; height: 20px; flex-shrink: 0; }
  .hb-icon path { stroke: var(--accent); fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.35} }
  .hb-icon { animation: pulse 2s ease-in-out infinite; }
  header h1 { font-size: 1.3rem; font-weight: 700; }
  header h1 span { color: var(--accent); }
  .header-right { margin-left: auto; display: flex; align-items: center; gap: 16px; font-size: .8rem; color: var(--muted); }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 5px var(--accent); animation: pulse 2s ease-in-out infinite; display: inline-block; margin-right: 5px; }

  /* ── Tabs ── */
  .tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); background: var(--bg2); flex-shrink: 0; }
  .tab { padding: 10px 22px; font-size: .85rem; font-weight: 500; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; transition: all .15s; user-select: none; }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .tab-badge { background: var(--accent); color: var(--bg); font-size: .65rem; font-weight: 700; padding: 1px 6px; border-radius: 999px; margin-left: 6px; }

  /* ── Views ── */
  .view { display: none; flex: 1; overflow: hidden; }
  .view.active { display: flex; }

  /* ── Dashboard ── */
  #view-dashboard { flex-direction: row; }
  aside { border-right: 1px solid var(--border); padding: 20px; overflow-y: auto; width: 300px; flex-shrink: 0; display: flex; flex-direction: column; gap: 16px; background: var(--bg2); }
  main { padding: 20px; overflow-y: auto; flex: 1; }
  .card { background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; }
  .card-title { font-size: .68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 10px; display: flex; align-items: center; gap: 5px; }
  .card-title svg { width: 13px; height: 13px; }
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .stat { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 9px 11px; }
  .stat-value { font-size: 1.2rem; font-weight: 700; color: var(--accent); }
  .stat-label { font-size: .68rem; color: var(--muted); margin-top: 1px; }
  .storage-bar { height: 5px; background: var(--border); border-radius: 3px; margin-top: 8px; overflow: hidden; }
  .storage-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: 3px; transition: width .4s; }
  .storage-fill.warn { background: linear-gradient(90deg, #f59e0b, var(--danger)); }
  .storage-label { font-size: .68rem; color: var(--muted); margin-top: 4px; display: flex; justify-content: space-between; }
  .meta-row { display: flex; flex-direction: column; gap: 8px; font-size: .78rem; }
  .meta-row .label { color: var(--muted); margin-bottom: 1px; }
  .meta-row .val { font-family: monospace; color: var(--accent2); }
  .instructions-body { font-size: .82rem; color: #94a3b8; line-height: 1.7; }
  .instructions-body p { margin-bottom: 6px; }
  .timeline-header { font-size: .95rem; font-weight: 600; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
  .entry-count { background: var(--accent); color: var(--bg); font-size: .68rem; font-weight: 700; padding: 1px 7px; border-radius: 999px; }
  .timeline { display: flex; flex-direction: column; gap: 10px; }
  .entry { background: var(--bg2); border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: var(--radius); padding: 12px 14px; }
  .entry:hover { border-left-color: var(--accent2); }
  .entry-time { font-size: .7rem; color: var(--muted); margin-bottom: 6px; font-family: monospace; }
  .entry-body { font-size: .82rem; line-height: 1.6; }
  .entry-body p { margin-bottom: 5px; }
  .entry-body p:last-child { margin-bottom: 0; }
  .entry-body strong { color: var(--accent); }
  .entry-body ul { padding-left: 14px; }
  .empty { text-align: center; padding: 50px 20px; color: var(--muted); }

  /* ── Chat ── */
  #view-chat { flex-direction: column; }
  .chat-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; scroll-behavior: smooth; }
  .chat-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: .9rem; }

  .msg { display: flex; flex-direction: column; max-width: 70%; }
  .msg.user { align-self: flex-end; align-items: flex-end; }
  .msg.bot  { align-self: flex-start; align-items: flex-start; }

  .msg-meta { font-size: .68rem; color: var(--muted); margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
  .msg.user .msg-meta { flex-direction: row-reverse; }

  .via-badge { padding: 1px 6px; border-radius: 4px; font-size: .62rem; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; }
  .via-web { background: rgba(0,229,160,.15); color: var(--accent); }
  .via-discord { background: rgba(88,101,242,.2); color: var(--discord); }

  .msg-bubble { padding: 10px 14px; border-radius: 14px; font-size: .875rem; line-height: 1.65; word-break: break-word; }
  .msg.user .msg-bubble { background: linear-gradient(135deg, #00b37e, #0ea5e9); color: #fff; border-bottom-right-radius: 4px; }
  .msg.bot  .msg-bubble { background: var(--bg3); border: 1px solid var(--border); border-bottom-left-radius: 4px; }
  .msg-bubble p { margin-bottom: 6px; }
  .msg-bubble p:last-child { margin-bottom: 0; }
  .msg-bubble code { background: rgba(0,0,0,.35); padding: 1px 5px; border-radius: 3px; font-size: .8em; }
  .msg-bubble pre { background: rgba(0,0,0,.35); padding: 10px; border-radius: 6px; overflow-x: auto; margin: 6px 0; }
  .msg-bubble pre code { background: none; padding: 0; }
  .msg-bubble ul, .msg-bubble ol { padding-left: 18px; margin: 4px 0; }
  .msg-bubble strong { color: var(--accent); }
  .msg.user .msg-bubble strong { color: #fff; font-weight: 700; }

  /* Queued messages */
  .msg.queued .msg-bubble { opacity: 0.55; font-style: italic; }

  /* Streaming shimmer on bubble background */
  @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
  .msg-bubble.streaming { position: relative; overflow: hidden; }
  .msg-bubble.streaming::after { content:''; position:absolute; inset:0; background:linear-gradient(90deg, transparent 0%, rgba(255,255,255,.09) 50%, transparent 100%); transform:translateX(-100%); animation:shimmer 1.8s ease-in-out infinite; pointer-events:none; }

  /* Chat input */
  .chat-input-area { border-top: 1px solid var(--border); padding: 14px 20px; background: var(--bg2); flex-shrink: 0; }
  .chat-input-row { display: flex; gap: 10px; align-items: flex-end; }
  .chat-input { flex: 1; background: var(--bg3); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; color: var(--text); font-size: .9rem; resize: none; outline: none; min-height: 42px; max-height: 120px; font-family: inherit; line-height: 1.5; transition: border-color .15s; }
  .chat-input:focus { border-color: var(--accent); }
  .chat-input::placeholder { color: var(--muted); }
  .send-btn { background: var(--accent); color: var(--bg); border: none; border-radius: 10px; width: 42px; height: 42px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity .15s; }
  .send-btn:hover { opacity: .85; }
  .send-btn:disabled { opacity: .4; cursor: not-allowed; }
  .send-btn svg { width: 18px; height: 18px; }
  .stop-btn { background: var(--danger); color: #fff; border: none; border-radius: 10px; width: 42px; height: 42px; cursor: pointer; display: none; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity .15s; }
  .stop-btn:hover { opacity: .85; }
  .stop-btn svg { width: 16px; height: 16px; }
  .chat-hint { font-size: .7rem; color: var(--muted); margin-top: 6px; }

  /* Loading overlay */
  #loading { position: fixed; inset: 0; background: var(--bg); display: flex; align-items: center; justify-content: center; font-size: .9rem; color: var(--muted); z-index: 100; transition: opacity .3s; }
  .spinner { width: 18px; height: 18px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin .7s linear infinite; margin-right: 10px; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>

<div id="loading"><div class="spinner"></div> ${ui.loading}</div>

<header>
  <svg class="hb-icon" viewBox="0 0 36 24">
    <path d="M2 12 H8 L11 4 L15 20 L19 10 L22 14 H34"/>
  </svg>
  <h1><span>BigClaudia</span></h1>
  <div class="header-right">
    <span><span class="status-dot"></span>online</span>
  </div>
</header>

<div class="tabs">
  <div class="tab active" data-tab="dashboard">${ui.tabDashboard}</div>
  <div class="tab" data-tab="chat">${ui.tabChat} <span class="tab-badge" id="unread-badge" style="display:none">0</span></div>
</div>

<!-- ── Dashboard ── -->
<div id="view-dashboard" class="view active">
  <aside>
    <div class="card">
      <div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>${ui.overview}</div>
      <div class="stat-grid">
        <div class="stat"><div class="stat-value" id="stat-entries">–</div><div class="stat-label">${ui.entries}</div></div>
        <div class="stat"><div class="stat-value" id="stat-size">–</div><div class="stat-label">${ui.fileSize}</div></div>
      </div>
      <div class="storage-bar"><div class="storage-fill" id="storage-fill" style="width:0%"></div></div>
      <div class="storage-label"><span id="storage-used">–</span><span id="storage-max">–</span></div>
    </div>
    <div class="card">
      <div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>${ui.timestamps}</div>
      <div class="meta-row">
        <div><div class="label">${ui.botStarted}</div><div class="val" id="bot-start">–</div></div>
        <div><div class="label">${ui.lastHeartbeat}</div><div class="val" id="last-run">–</div></div>
      </div>
    </div>
    <div class="card" style="flex:1">
      <div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>${ui.instructions}</div>
      <div class="instructions-body" id="instructions">–</div>
    </div>
  </aside>
  <main>
    <div class="timeline-header">${ui.executionHistory} <span class="entry-count" id="entry-count">0</span></div>
    <div class="timeline" id="timeline">
      <div class="empty">${ui.noEntries}</div>
    </div>
  </main>
</div>

<!-- ── Chat ── -->
<div id="view-chat" class="view">
  <div class="chat-messages" id="chat-messages">
    <div class="chat-empty" id="chat-empty">${ui.noMessages}</div>
  </div>
  <div class="chat-input-area">
    <div class="chat-input-row">
      <textarea class="chat-input" id="chat-input" placeholder="${ui.messagePlaceholder}" rows="1"></textarea>
      <button class="stop-btn" id="stop-btn" title="${ui.stopButton}">
        <svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
      </button>
      <button class="send-btn" id="send-btn" title="${ui.sendButton}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg>
      </button>
    </div>
    <div class="chat-hint">${ui.chatHint}</div>
  </div>
</div>

<script>
const STRINGS = ${clientStrings};
marked.setOptions({ breaks: true });

// ── Tabs ────────────────────────────────────────────────────────────────────
let activeTab = localStorage.getItem('bigclaudia_tab') || 'dashboard';
let unread = 0;
let chatVisible = (activeTab === 'chat');

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelector(\`.tab[data-tab="\${name}"]\`).classList.add('active');
  document.getElementById('view-' + name).classList.add('active');
  activeTab = name;
  chatVisible = (name === 'chat');
  localStorage.setItem('bigclaudia_tab', name);
  if (chatVisible) {
    unread = 0;
    document.getElementById('unread-badge').style.display = 'none';
    scrollChat();
  }
  if (name === 'dashboard') loadDashboard();
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// Letzten Tab wiederherstellen
switchTab(activeTab);

// ── Hilfsfunktionen ────────────────────────────────────────────────────────
function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(2) + ' MB';
}
function fmtDate(iso) {
  if (!iso) return '–';
  try { return new Date(iso).toLocaleString(STRINGS.locale, { dateStyle:'short', timeStyle:'medium' }); }
  catch { return iso; }
}
function fmtTime(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString(STRINGS.locale, { hour:'2-digit', minute:'2-digit' }); }
  catch { return ''; }
}
function scrollChat() {
  const el = document.getElementById('chat-messages');
  el.scrollTop = el.scrollHeight;
}

// ── Dashboard laden ─────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const data = await fetch('/api/heartbeat').then(r => r.json());
    document.getElementById('stat-entries').textContent = data.stats.entryCount;
    document.getElementById('stat-size').textContent = fmtBytes(data.stats.fileSize);
    const pct = Math.min(100, data.stats.fileSize / data.stats.maxSize * 100).toFixed(1);
    const fill = document.getElementById('storage-fill');
    fill.style.width = pct + '%';
    fill.className = 'storage-fill' + (pct > 80 ? ' warn' : '');
    document.getElementById('storage-used').textContent = fmtBytes(data.stats.fileSize);
    document.getElementById('storage-max').textContent = STRINGS.maxLabel + ' ' + fmtBytes(data.stats.maxSize);
    document.getElementById('bot-start').textContent = fmtDate(data.stats.botStartTime);
    document.getElementById('last-run').textContent = data.stats.lastRun ? fmtDate(data.stats.lastRun) : STRINGS.notRunYet;
    document.getElementById('instructions').innerHTML = data.instructions
      ? marked.parse(data.instructions)
      : \`<span style="color:var(--muted)">\${STRINGS.noInstructionsSet}</span>\`;
    document.getElementById('entry-count').textContent = data.entries.length;
    const timeline = document.getElementById('timeline');
    if (!data.entries.length) {
      timeline.innerHTML = \`<div class="empty">\${STRINGS.noEntries}</div>\`;
    } else {
      timeline.innerHTML = data.entries.map(e => \`
        <div class="entry">
          <div class="entry-time">🕐 \${fmtDate(e.timestamp)}</div>
          <div class="entry-body">\${marked.parse(e.content)}</div>
        </div>\`).join('');
    }
    document.getElementById('loading').style.opacity = '0';
    setTimeout(() => { document.getElementById('loading').style.display = 'none'; }, 300);
  } catch(e) {
    console.error(e);
  }
}

// ── Chat-Nachrichten rendern ────────────────────────────────────────────────
function renderMessage(msg) {
  const el = document.getElementById('chat-empty');
  if (el) el.remove();

  const div = document.createElement('div');
  div.className = 'msg ' + msg.source;
  div.id = 'msg-' + msg.id;

  const viaLabel = msg.via === 'discord' ? 'Discord' : 'Web';
  const viaClass = msg.via === 'discord' ? 'via-discord' : 'via-web';

  const content = msg.source === 'bot'
    ? marked.parse(msg.content)
    : msg.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>');

  div.innerHTML = \`
    <div class="msg-meta">
      <span class="via-badge \${viaClass}">\${viaLabel}</span>
      <span>\${fmtTime(msg.timestamp)}</span>
    </div>
    <div class="msg-bubble">\${content}</div>\`;
  document.getElementById('chat-messages').appendChild(div);
}

function setWaiting(active) {
  pendingReply = active;
  document.getElementById('stop-btn').style.display = active ? 'flex' : 'none';
}

function bumpUnread() {
  unread++;
  const badge = document.getElementById('unread-badge');
  badge.textContent = unread;
  badge.style.display = '';
}

// ── Streaming-Bubble ────────────────────────────────────────────────────────
// Accumulated raw text per active stream ID (for markdown re-rendering)
const streamBuffers = {};

function createStreamBubble(id, via) {
  const el = document.getElementById('chat-empty');
  if (el) el.remove();
  streamBuffers[id] = '';

  const viaClass = via === 'discord' ? 'via-discord' : 'via-web';
  const viaLabel = via === 'discord' ? 'Discord' : 'Web';

  const div = document.createElement('div');
  div.className = 'msg bot';
  div.id = 'msg-' + id;
  div.innerHTML = \`
    <div class="msg-meta">
      <span class="via-badge \${viaClass}">\${viaLabel}</span>
      <span>\${fmtTime(new Date().toISOString())}</span>
    </div>
    <div class="msg-bubble streaming" id="bubble-\${id}">&nbsp;</div>\`;
  document.getElementById('chat-messages').appendChild(div);
}

function appendStreamChunk(id, text) {
  if (streamBuffers[id] === undefined) return;
  streamBuffers[id] += text;
  const bubble = document.getElementById('bubble-' + id);
  if (bubble) bubble.innerHTML = marked.parse(streamBuffers[id]);
}

function finalizeStreamBubble(id) {
  delete streamBuffers[id];
  const bubble = document.getElementById('bubble-' + id);
  if (bubble) bubble.classList.remove('streaming');
}

// ── SSE ─────────────────────────────────────────────────────────────────────
let pendingReply = false;

function connectSSE() {
  const es = new EventSource('/api/events');
  es.onmessage = (e) => {
    const data = JSON.parse(e.data);

    if (data.type === 'clear') {
      document.getElementById('chat-messages').innerHTML =
        \`<div class="chat-empty" id="chat-empty">\${STRINGS.sessionReset}</div>\`;
      setWaiting(false);

    } else if (data.type === 'queued') {
      const el = document.getElementById('msg-' + data.id);
      if (el) el.classList.add('queued');

    } else if (data.type === 'dequeued') {
      const el = document.getElementById('msg-' + data.id);
      if (el) el.classList.remove('queued');

    } else if (data.type === 'stream_start') {
      setWaiting(true);
      createStreamBubble(data.id, data.via);
      if (chatVisible) scrollChat();

    } else if (data.type === 'stream_chunk') {
      appendStreamChunk(data.id, data.text);
      if (chatVisible) scrollChat();

    } else if (data.type === 'stream_end') {
      finalizeStreamBubble(data.id);
      setWaiting(false);
      if (!chatVisible) bumpUnread();

    } else if (data.type === 'message') {
      // Completed messages (user side or error messages)
      if (data.msg.source === 'bot') {
        setWaiting(false);
      }
      renderMessage(data.msg);
      if (chatVisible) scrollChat();
      else if (data.msg.source === 'bot') bumpUnread();

    } else if (data.type === 'history') {
      data.messages.forEach(renderMessage);
      scrollChat();
      document.getElementById('loading').style.opacity = '0';
      setTimeout(() => { document.getElementById('loading').style.display = 'none'; }, 300);
    }
  };
  es.onerror = () => setTimeout(connectSSE, 3000);
}

// ── Stop ─────────────────────────────────────────────────────────────────────
async function stopChat() {
  // Clean up UI immediately — don't wait for stream_end via SSE
  setWaiting(false);
  document.querySelectorAll('.msg-bubble.streaming').forEach(el => el.classList.remove('streaming'));
  try {
    await fetch('/api/stop', { method: 'POST' });
  } catch(e) {
    console.error(STRINGS.sendError, e);
  }
}

// ── Send message ─────────────────────────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  // /stop is handled client-side regardless of pendingReply state
  if (text === '/stop') {
    input.value = '';
    input.style.height = 'auto';
    await stopChat();
    input.focus();
    return;
  }

  input.value = '';
  input.style.height = 'auto';

  try {
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
  } catch(e) {
    console.error(STRINGS.sendError, e);
  }

  input.focus();
}

// Input events
const input = document.getElementById('chat-input');
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
});
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('stop-btn').addEventListener('click', stopChat);

// ── Init ────────────────────────────────────────────────────────────────────
connectSSE();
</script>
</body>
</html>`;
}

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
      if (!text || !_messageProcessor) return;

      // Asynchron verarbeiten (Antwort kommt via SSE)
      _messageProcessor(text).catch((err) => {
        console.error(t.web.processingError, err.message);
        state.addChatMessage('bot', t.chat.error(err.message), 'web');
      });
      return;
    }

    // Stop current Claude process
    if (req.method === 'POST' && url === '/api/stop') {
      killCurrentProcess();
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

module.exports = { createServer, recordHeartbeatRun, setMessageProcessor };
