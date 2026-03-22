/**
 * Shared state: conversation history, chat log, and SSE clients.
 * Used jointly by index.js (Discord) and webserver.js (Web UI).
 */

const conversationHistory = [];  // { role: 'user'|'assistant', content: string }
const chatLog = [];               // { id, source: 'user'|'bot', via: 'web'|'discord', content, timestamp }
const sseClients = new Set();     // active SSE connections (http.ServerResponse)
const consoleBuffer = [];         // ring buffer for captured console output
const MAX_CONSOLE = 500;          // max lines to keep

const MAX_HISTORY = 20;

// ─── SSE ─────────────────────────────────────────────────────────────────────

function broadcastSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch { sseClients.delete(res); }
  }
}

// ─── Chat log ─────────────────────────────────────────────────────────────────

function addChatMessage(source, content, via) {
  const msg = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    source,   // 'user' | 'bot'
    content,
    via,      // 'web' | 'discord'
    timestamp: new Date().toISOString(),
  };
  chatLog.push(msg);
  broadcastSSE({ type: 'message', msg });
  return msg;
}

// ─── Conversation history ─────────────────────────────────────────────────────

function getHistory() {
  return conversationHistory.slice(-MAX_HISTORY);
}

function pushHistory(role, content) {
  conversationHistory.push({ role, content });
}

// ─── Session ─────────────────────────────────────────────────────────────────

function clearSession() {
  conversationHistory.length = 0;
  chatLog.length = 0;
  broadcastSSE({ type: 'clear' });
}

// ─── Streaming ───────────────────────────────────────────────────────────────

/**
 * Starts a new streaming message. Returns the ID.
 */
function streamStart(via) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  broadcastSSE({ type: 'stream_start', id, via });
  return id;
}

/**
 * Sends a text delta for an ongoing streaming message.
 */
function streamChunk(id, text) {
  broadcastSSE({ type: 'stream_chunk', id, text });
}

/**
 * Signals that thinking has started for a streaming message.
 */
function streamThinkingStart(id) {
  broadcastSSE({ type: 'stream_thinking_start', id });
}

/**
 * Sends a thinking text chunk for a streaming message (web UI only).
 */
function streamThinkingChunk(id, text) {
  broadcastSSE({ type: 'stream_thinking_chunk', id, text });
}

/**
 * Signals that thinking has ended for a streaming message.
 */
function streamThinkingEnd(id) {
  broadcastSSE({ type: 'stream_thinking_end', id });
}

/**
 * Finalizes a streaming message and stores it in the chat log.
 */
function streamEnd(id, fullText, via) {
  const msg = {
    id,
    source: 'bot',
    content: fullText,
    via,
    timestamp: new Date().toISOString(),
  };
  chatLog.push(msg);
  broadcastSSE({ type: 'stream_end', id, content: fullText });
}

// ─── Console capture ─────────────────────────────────────────────────────────

const _origLog = console.log.bind(console);
const _origError = console.error.bind(console);
const _origWarn = console.warn.bind(console);

function captureConsole(level, args) {
  const text = args.map(a => typeof a === 'string' ? a : (a instanceof Error ? a.stack || a.message : JSON.stringify(a))).join(' ');
  const entry = { timestamp: new Date().toISOString(), level, text };
  consoleBuffer.push(entry);
  if (consoleBuffer.length > MAX_CONSOLE) consoleBuffer.shift();
  broadcastSSE({ type: 'console_log', entry });
}

console.log = (...args) => { _origLog(...args); captureConsole('log', args); };
console.error = (...args) => { _origError(...args); captureConsole('error', args); };
console.warn = (...args) => { _origWarn(...args); captureConsole('warn', args); };

module.exports = {
  chatLog,
  consoleBuffer,
  sseClients,
  addChatMessage,
  broadcastSSE,
  getHistory,
  pushHistory,
  clearSession,
  streamStart,
  streamChunk,
  streamThinkingStart,
  streamThinkingChunk,
  streamThinkingEnd,
  streamEnd,
};
