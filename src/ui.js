/**
 * Generates the web UI HTML page.
 * @param {object} ui - Translation strings from i18n
 * @returns {string} - Full HTML page as a string
 */
function getHTML(ui) {
  const clientStrings = JSON.stringify({
    notRunYet: ui.notRunYet,
    noInstructionsSet: ui.noInstructionsSet,
    noEntries: ui.noEntries,
    sessionReset: ui.sessionReset,
    sendError: ui.sendError,
    maxLabel: ui.maxLabel,
    locale: ui.locale,
    settingsSaved: ui.settingsSaved,
    settingsRestarting: ui.settingsRestarting,
    settingsRestartConfirm: ui.settingsRestartConfirm,
    settingsShutdownConfirm: ui.settingsShutdownConfirm,
    settingsShuttingDown: ui.settingsShuttingDown,
    noCrontabEntries: ui.noCrontabEntries,
    compressedSummary: ui.compressedSummary,
    whatsappQrTitle: ui.whatsappQrTitle,
    whatsappQrHint: ui.whatsappQrHint,
    whatsappAuthenticated: ui.whatsappAuthenticated,
    thinking: ui.thinking,
    toolUse: ui.toolUse,
    redactedThinking: ui.redactedThinking,
  });

  return `<!DOCTYPE html>
<html lang="${ui.htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>BigClaudia</title>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<style>
  :root {
    --bg: #0a0e1a; --bg2: #111827; --bg3: #1a2235; --border: #1e2d45;
    --accent: #00e5a0; --accent2: #0ea5e9; --text: #e2e8f0; --muted: #64748b;
    --danger: #f43f5e; --radius: 10px; --discord: #5865f2; --whatsapp: #25d366;
  }
  [data-theme="light"] {
    --bg: #f0f4f8; --bg2: #e2e8f0; --bg3: #ffffff; --border: #cbd5e1;
    --accent: #00a371; --accent2: #0284c7; --text: #0f172a; --muted: #64748b;
    --danger: #e11d48; --discord: #4752c4; --whatsapp: #128c7e;
  }
  @media (prefers-color-scheme: light) {
    :root:not([data-theme="dark"]) {
      --bg: #f0f4f8; --bg2: #e2e8f0; --bg3: #ffffff; --border: #cbd5e1;
      --accent: #00a371; --accent2: #0284c7; --text: #0f172a; --muted: #64748b;
      --danger: #e11d48; --discord: #4752c4; --whatsapp: #128c7e;
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: 'Inter', system-ui, sans-serif; min-height: 100vh; line-height: 1.6; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

  /* ── Header ── */
  header {
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    padding: 14px 24px;
    display: flex; align-items: center; gap: 14px;
    flex-shrink: 0;
  }
  .hb-icon { width: 32px; height: 32px; flex-shrink: 0; border-radius: 50%; object-fit: cover; }
  @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.35} }
  header h1 { font-size: 1.3rem; font-weight: 700; }
  header h1 span { color: var(--accent); }
  .header-right { margin-left: auto; display: flex; align-items: center; gap: 16px; font-size: .8rem; color: var(--muted); }
  .theme-toggle { display: flex; }
  .theme-btn { background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; cursor: pointer; padding: 5px 8px; color: var(--muted); font-size: .85rem; display: flex; align-items: center; transition: all .15s; }
  .theme-btn:hover { color: var(--text); border-color: var(--accent); }
  .suppress-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; margin-right: 5px; transition: background .3s, box-shadow .3s; }
  .suppress-dot.active { background: #ef4444; box-shadow: 0 0 5px #ef4444; animation: pulse 2s ease-in-out infinite; }
  .suppress-dot.inactive { background: #22c55e; box-shadow: 0 0 5px #22c55e; animation: pulse 2s ease-in-out infinite; }
  .suppress-dot.hidden { display: none; }
  .suppress-indicator { display: flex; align-items: center; font-size: .75rem; color: var(--muted); cursor: default; }

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
  main { padding: 20px; flex: 1; display: flex; flex-direction: column; gap: 0; overflow: hidden; }
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
  .cron-list { display: flex; flex-direction: column; gap: 8px; }
  .cron-item { display: flex; flex-direction: column; gap: 3px; background: var(--bg2); border: 1px solid var(--border); border-left: 3px solid var(--accent2); border-radius: 6px; padding: 9px 12px; }
  .cron-schedule { font-size: .7rem; font-family: monospace; color: var(--accent2); }
  .cron-task { font-size: .82rem; color: var(--text); }
  .cron-empty { font-size: .82rem; color: var(--muted); }
  .meta-row .label { color: var(--muted); margin-bottom: 1px; }
  .meta-row .val { font-family: monospace; color: var(--accent2); }
  .instructions-body { font-size: .82rem; color: var(--muted); line-height: 1.7; }
  .instructions-body p { margin-bottom: 6px; }
  .timeline-wrapper { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
  .timeline-header { font-size: .95rem; font-weight: 600; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .entry-count { background: var(--accent); color: var(--bg); font-size: .68rem; font-weight: 700; padding: 1px 7px; border-radius: 999px; }
  .timeline { display: flex; flex-direction: column; gap: 10px; flex: 1; overflow-y: auto; min-height: 0; }
  .entry { background: var(--bg2); border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: var(--radius); padding: 12px 14px; }
  .entry:hover { border-left-color: var(--accent2); }
  .entry-time { font-size: .7rem; color: var(--muted); margin-bottom: 6px; font-family: monospace; }
  .entry-body { font-size: .82rem; line-height: 1.6; }
  .entry-body p { margin-bottom: 5px; }
  .entry-body p:last-child { margin-bottom: 0; }
  .entry-body strong { color: var(--accent); }
  .entry-body ul { padding-left: 14px; }
  .compressed-block { border-left-color: var(--accent2); opacity: .75; }
  .compressed-block .entry-time { color: var(--accent2); font-weight: 600; }
  .empty { text-align: center; padding: 50px 20px; color: var(--muted); }

  /* ── Console Panel ── */
  .console-panel { background: #0d1117; border: 1px solid var(--border); border-radius: var(--radius); margin-top: 12px; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
  [data-theme="light"] .console-panel { background: #1e1e2e; }
  @media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) .console-panel { background: #1e1e2e; } }
  .console-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,.08); flex-shrink: 0; }
  .console-header .card-title { margin-bottom: 0; color: #8b949e; }

  .console-body { overflow-y: auto; padding: 10px 14px; font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace; font-size: .72rem; line-height: 1.7; flex: 1; }
  .console-line { display: flex; gap: 10px; white-space: pre-wrap; word-break: break-all; }
  .console-line .ts { color: #484f58; flex-shrink: 0; user-select: none; }
  .console-line .txt { color: #c9d1d9; }
  .console-line.error .txt { color: #f85149; }
  .console-line.warn .txt { color: #d29922; }

  /* ── Chat ── */
  #view-chat { flex-direction: column; }
  .chat-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; scroll-behavior: smooth; }
  .chat-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: .9rem; }

  .msg { display: flex; flex-direction: column; max-width: 70%; }
  .msg.bot:has(.json-table), .msg.bot:has(.msg-bubble table) { max-width: min(92%, calc(100% - 16px)); }
  .msg.user { align-self: flex-end; align-items: flex-end; }
  .msg.bot  { align-self: flex-start; align-items: flex-start; }

  .msg-meta { font-size: .68rem; color: var(--muted); margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
  .msg.user .msg-meta { flex-direction: row-reverse; }

  .via-badge { padding: 1px 6px; border-radius: 4px; font-size: .62rem; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; }
  .via-web { background: rgba(0,229,160,.15); color: var(--accent); }
  .via-discord { background: rgba(88,101,242,.2); color: var(--discord); }
  .via-whatsapp { background: rgba(37,211,102,.15); color: var(--whatsapp); }
  .via-heartbeat { background: rgba(251,191,36,.15); color: #f59e0b; }

  .msg-bubble { padding: 10px 14px; border-radius: 14px; font-size: .875rem; line-height: 1.65; word-break: break-word; }
  .msg.user .msg-bubble { background: linear-gradient(135deg, #00b37e, #0ea5e9); color: #fff; border-bottom-right-radius: 4px; }
  .msg.bot  .msg-bubble { background: var(--bg3); border: 1px solid var(--border); border-bottom-left-radius: 4px; }
  .msg-bubble p { margin-bottom: 6px; }
  .msg-bubble p:last-child { margin-bottom: 0; }
  .msg-bubble code { background: rgba(0,0,0,.12); padding: 1px 5px; border-radius: 3px; font-size: .8em; }
  .msg-bubble pre { background: rgba(0,0,0,.12); padding: 10px; border-radius: 6px; overflow-x: auto; margin: 6px 0; }
  .msg-bubble pre code { background: none; padding: 0; }
  .msg-bubble ul, .msg-bubble ol { padding-left: 18px; margin: 4px 0; }
  .msg-bubble strong { color: var(--accent); }
  .msg.user .msg-bubble strong { color: #fff; font-weight: 700; }

  /* ── Tables ── */
  .msg-bubble table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: .82rem; }
  .msg-bubble th, .msg-bubble td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border); }
  .msg-bubble th { font-weight: 600; color: var(--accent); font-size: .75rem; text-transform: uppercase; letter-spacing: .3px; border-bottom-width: 2px; }
  .msg-bubble tr:last-child td { border-bottom: none; }
  .msg-bubble tbody tr:hover { background: rgba(255,255,255,.03); }
  [data-theme="light"] .msg-bubble tbody tr:hover { background: rgba(0,0,0,.03); }
  @media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) .msg-bubble tbody tr:hover { background: rgba(0,0,0,.03); } }

  /* ── Horizontal Rule ── */
  .msg-bubble hr { border: none; height: 1px; background: linear-gradient(90deg, transparent, var(--border), var(--accent2), var(--border), transparent); margin: 14px 0; }

  /* ── Links ── */
  .msg-bubble a { color: #22d3c4; text-decoration: none; border-bottom: 1px solid rgba(34,211,196,.3); transition: border-color .15s, color .15s; }
  .msg-bubble a:hover { color: #5eead4; border-bottom-color: #5eead4; }
  [data-theme="light"] .msg-bubble a { color: #0d9488; border-bottom-color: rgba(13,148,136,.3); }
  [data-theme="light"] .msg-bubble a:hover { color: #0f766e; border-bottom-color: #0f766e; }
  @media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) .msg-bubble a { color: #0d9488; border-bottom-color: rgba(13,148,136,.3); } }
  @media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) .msg-bubble a:hover { color: #0f766e; border-bottom-color: #0f766e; } }
  .msg.user .msg-bubble a { color: #cffafe; border-bottom-color: rgba(207,250,254,.4); }
  .msg.user .msg-bubble a:hover { color: #fff; border-bottom-color: #fff; }

  /* Queued messages */
  .msg.queued .msg-bubble { opacity: 0.55; font-style: italic; }

  /* Typing dots animation */
  @keyframes typingDot { 0%,80%,100%{opacity:.25} 40%{opacity:1} }
  .typing-dots { display:inline-flex; gap:4px; align-items:center; height:1.2em; }
  .typing-dots span { width:7px; height:7px; border-radius:50%; background:var(--muted); animation:typingDot 1.4s ease-in-out infinite; }
  .typing-dots span:nth-child(2) { animation-delay:.2s; }
  .typing-dots span:nth-child(3) { animation-delay:.4s; }

  /* Thinking indicator */
  @keyframes thinkingPulse { 0%,100%{opacity:.6} 50%{opacity:1} }
  .thinking-indicator {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 0.85em; color: var(--muted); padding: 4px 0;
    animation: thinkingPulse 2s ease-in-out infinite;
  }
  .thinking-indicator .brain { font-size: 1.1em; }

  /* Thinking block (collapsible, inline in message flow) */
  .thinking-block {
    margin: 4px 0;
    overflow: hidden;
    font-size: 0.85em;
  }
  .thinking-block .thinking-summary {
    cursor: pointer;
    padding: 4px 6px;
    color: var(--muted);
    font-size: 0.9em;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .thinking-block .thinking-summary:hover {
    color: var(--fg);
  }
  .thinking-block .thinking-summary .chevron {
    display: inline-block;
    transition: transform 0.3s ease;
    font-size: 0.8em;
    line-height: 1;
  }
  .thinking-block:not(.collapsed) .thinking-summary .chevron {
    transform: rotate(90deg);
  }
  .thinking-block .thinking-summary .brain { font-size: 1.1em; }
  .thinking-block .thinking-content-wrapper {
    overflow: hidden;
  }
  .thinking-block.collapsed .thinking-content-wrapper {
    max-height: 0;
  }
  .thinking-block .thinking-content {
    padding: 4px 6px;
    color: var(--muted);
    font-size: 0.9em;
    font-style: italic;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 300px;
    overflow-y: auto;
  }
  .thinking-block.streaming-thinking .thinking-summary::after {
    content: '…';
    animation: thinkingPulse 1.5s ease-in-out infinite;
  }

  /* Tool-use block (collapsible, inline in message flow) */
  .tool-use-block {
    margin: 2px 0;
    overflow: hidden;
    font-size: 0.85em;
  }
  .tool-use-block .tool-use-summary {
    cursor: pointer;
    padding: 2px 6px;
    color: var(--muted);
    font-size: 0.9em;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tool-use-block .tool-use-summary:hover { color: var(--fg); }
  .tool-use-block .tool-use-summary .chevron {
    display: inline-block;
    transition: transform 0.3s ease;
    font-size: 0.8em;
    line-height: 1;
  }
  .tool-use-block:not(.collapsed) .tool-use-summary .chevron {
    transform: rotate(90deg);
  }
  .tool-use-block .tool-use-content-wrapper { overflow: hidden; }
  .tool-use-block.collapsed .tool-use-content-wrapper { max-height: 0; }
  .tool-use-block .tool-use-content {
    padding: 2px 6px;
    color: var(--muted);
    font-family: monospace;
    font-size: 0.9em;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 300px;
    overflow-y: auto;
  }
  .tool-use-block .tool-use-content.has-table {
    font-family: inherit;
    white-space: normal;
    overflow-x: auto;
  }
  .tool-use-block .tool-use-content table { font-size: inherit; }
  .json-table {
    border-collapse: collapse;
    width: 100%;
    font-size: .875rem;
    margin: 2px 0;
  }
  .json-table td {
    padding: 3px 8px;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid var(--border);
    word-break: break-word;
  }
  .json-table tr:last-child td { border-bottom: none; }
  .json-table tbody tr:hover { background: rgba(255,255,255,.03); }
  [data-theme="light"] .json-table tbody tr:hover { background: rgba(0,0,0,.03); }
  .json-table td:first-child {
    color: var(--accent);
    font-size: 0.9em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .3px;
    white-space: nowrap;
    padding-right: 14px;
  }
  .tool-use-block .tool-use-thumbnail {
    display: block;
    max-width: 240px;
    max-height: 180px;
    border-radius: 6px;
    margin: 6px 6px 4px;
    cursor: pointer;
    border: 1px solid var(--border, #333);
    transition: transform 0.2s ease;
    object-fit: contain;
  }
  .tool-use-block .tool-use-thumbnail:hover {
    transform: scale(1.05);
  }
  /* Fullscreen overlay for image preview */
  .img-overlay {
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.85); z-index: 10000;
    display: flex; align-items: center; justify-content: center;
    cursor: zoom-out;
  }
  .img-overlay img {
    max-width: 95vw; max-height: 95vh; border-radius: 8px;
    object-fit: contain;
  }
  .tool-use-block.streaming-tool-use .tool-use-summary::after {
    content: '…';
    animation: thinkingPulse 1.5s ease-in-out infinite;
  }

  /* Redacted thinking block */
  .redacted-thinking-block {
    margin: 4px 0;
    overflow: hidden;
    font-size: 0.85em;
  }
  .redacted-thinking-block .redacted-thinking-summary {
    padding: 4px 6px;
    color: var(--muted);
    font-size: 0.9em;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Streaming shimmer on bubble background */
  /* Use background-position animation instead of transform/translate3d to avoid
     iOS Safari compositor layer caching: Safari freezes GPU-promoted layers at
     their initial size, so a growing .msg-bubble would leave the shimmer stuck at
     the original small dimensions. background-position forces per-frame painting
     (no composited layer), so Safari recalculates correctly as the bubble grows. */
  @keyframes shimmer { 0%{background-position:250% 0} 100%{background-position:50% 0} }
  .msg-bubble.streaming { position: relative; overflow: hidden; }
  .msg-bubble.streaming::after { content:''; position:absolute; inset:0; background:linear-gradient(90deg, transparent 0%, rgba(255,255,255,.09) 10%, transparent 20%); background-size:200% 100%; background-position:250% 0; animation:shimmer 2.4s ease-in-out infinite; pointer-events:none; }
  [data-theme="light"] .msg-bubble.streaming::after { background:linear-gradient(90deg, transparent 0%, rgba(0,0,0,.08) 10%, transparent 20%); background-size:200% 100%; }
  @media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) .msg-bubble.streaming::after { background:linear-gradient(90deg, transparent 0%, rgba(0,0,0,.08) 10%, transparent 20%); background-size:200% 100%; } }

  /* Chat input */
  .chat-input-area { border-top: 1px solid var(--border); padding: 14px 20px; background: var(--bg2); flex-shrink: 0; }
  .chat-input-row { display: flex; gap: 10px; align-items: flex-end; }
  .chat-input { flex: 1; background: var(--bg3); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; color: var(--text); font-size: .9rem; resize: none; outline: none; min-height: 42px; max-height: 120px; font-family: inherit; line-height: 1.5; transition: border-color .15s; overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none; }
  .chat-input::-webkit-scrollbar { display: none; }
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

  /* Image attach button */
  .attach-btn { background: transparent; color: var(--muted); border: 1px solid var(--border); border-radius: 10px; width: 42px; height: 42px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .15s; }
  .attach-btn:hover { color: var(--accent); border-color: var(--accent); }
  .attach-btn svg { width: 18px; height: 18px; }

  /* Image preview area */
  .image-preview-area { display: flex; gap: 8px; flex-wrap: wrap; padding: 0; margin: 0 0 8px 0; }
  .image-preview-area:empty { display: none; }
  .image-preview-item { position: relative; width: 64px; height: 64px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
  .image-preview-item img { width: 100%; height: 100%; object-fit: cover; }
  .image-preview-item .remove-btn { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,.7); color: #fff; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; }
  .image-preview-item .remove-btn:hover { background: var(--danger); }

  /* Chat message images */
  .msg-images { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
  .msg-images img { max-width: 200px; max-height: 150px; border-radius: 6px; cursor: pointer; border: 1px solid var(--border); }
  .msg-images img:hover { opacity: .85; }
  .msg-documents { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
  .msg-document { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 6px; background: rgba(255,255,255,0.06); border: 1px solid var(--border); color: var(--text-secondary); text-decoration: none; font-size: 13px; transition: background .15s; }
  .msg-document:hover { background: rgba(255,255,255,0.12); color: var(--text-primary); }
  .msg-document .doc-icon { width: 16px; height: 16px; flex-shrink: 0; }
  .msg-document span { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .doc-preview-item .doc-preview { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 8px; }

  /* Drag & drop overlay */
  .drop-overlay { display: none; position: absolute; inset: 0; background: rgba(99,102,241,.15); border: 2px dashed var(--accent); border-radius: 12px; z-index: 100; align-items: center; justify-content: center; font-size: 1.1rem; color: var(--accent); font-weight: 600; pointer-events: none; }
  .drop-overlay.active { display: flex; }

  /* Settings */
  #view-settings { flex-direction: column; }
  .settings-wrap { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
  .settings-body { flex: 1; overflow-y: auto; padding: 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; align-content: start; }
  .settings-footer { border-top: 1px solid var(--border); padding: 12px 24px; background: var(--bg2); display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .settings-status { flex: 1; font-size: .82rem; color: var(--accent); }
  .settings-group { display: flex; flex-direction: column; gap: 16px; }
  .settings-group-title { font-size: .68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 2px; }
  .setting-item { background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius); padding: 13px 15px; }
  .setting-label { font-size: .85rem; font-weight: 600; margin-bottom: 3px; }
  .setting-desc { font-size: .73rem; color: var(--muted); margin-bottom: 9px; line-height: 1.5; }
  .setting-input { width: 100%; background: var(--bg2); border: 1px solid var(--border); border-radius: 6px; padding: 7px 10px; color: var(--text); font-size: .85rem; font-family: monospace; outline: none; transition: border-color .15s; box-sizing: border-box; }
  .setting-input:focus { border-color: var(--accent); }

  /* Toggle Switch */
  .setting-toggle-wrap { display: flex; align-items: center; gap: 10px; }
  .setting-toggle { position: relative; width: 44px; height: 24px; flex-shrink: 0; }
  .setting-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
  .setting-toggle .toggle-track { position: absolute; inset: 0; background: var(--border); border-radius: 12px; cursor: pointer; transition: background .2s; }
  .setting-toggle .toggle-track::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; background: var(--text); border-radius: 50%; transition: transform .2s; }
  .setting-toggle input:checked + .toggle-track { background: var(--accent); }
  .setting-toggle input:checked + .toggle-track::after { transform: translateX(20px); background: var(--bg); }
  .setting-toggle-label { font-size: .78rem; color: var(--muted); user-select: none; }

  /* Dependent settings hidden when parent toggle is off */
  .setting-item.setting-hidden { display: none; }
  .btn-save { background: var(--accent); color: var(--bg); border: none; border-radius: 8px; padding: 8px 22px; font-size: .85rem; font-weight: 600; cursor: pointer; transition: opacity .15s; }
  .btn-save:hover { opacity: .85; }
  .whatsapp-qr-panel { border-top: 1px solid var(--border); padding: 16px 24px; background: var(--bg2); display: none; align-items: center; gap: 20px; flex-shrink: 0; }
  .whatsapp-qr-panel.visible { display: flex; }
  .whatsapp-qr-panel img { width: 160px; height: 160px; border-radius: 8px; border: 2px solid var(--border); background: #fff; }
  .whatsapp-qr-info { display: flex; flex-direction: column; gap: 6px; }
  .whatsapp-qr-title { font-size: .85rem; font-weight: 600; color: var(--text); }
  .whatsapp-qr-hint { font-size: .75rem; color: var(--muted); line-height: 1.5; }
  .whatsapp-qr-ok { font-size: .82rem; color: var(--accent); font-weight: 600; }
  .btn-restart { background: transparent; color: var(--muted); border: 1px solid var(--border); border-radius: 8px; padding: 8px 22px; font-size: .85rem; font-weight: 600; cursor: pointer; transition: all .15s; display: inline-flex; align-items: center; gap: 7px; }
  .btn-restart:hover { border-color: #f59e0b; color: #f59e0b; }
  .btn-restart.restarting { border-color: #f59e0b; color: #f59e0b; pointer-events: none; }
  .btn-shutdown { background: transparent; color: var(--muted); border: 1px solid var(--border); border-radius: 8px; padding: 8px 22px; font-size: .85rem; font-weight: 600; cursor: pointer; transition: all .15s; }
  .btn-shutdown:hover { border-color: var(--danger); color: var(--danger); }
  @keyframes spin { to { transform: rotate(360deg); } }
  .btn-restart .spin-icon { width: 13px; height: 13px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; display: none; }
  .btn-restart.restarting .spin-icon { display: block; }

  /* Loading overlay */
  #loading { position: fixed; inset: 0; background: var(--bg); display: flex; align-items: center; justify-content: center; font-size: .9rem; color: var(--muted); z-index: 100; transition: opacity .3s; }
  .spinner { width: 18px; height: 18px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin .7s linear infinite; margin-right: 10px; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>

<div id="loading"><div class="spinner"></div> ${ui.loading}</div>

<header>
  <img class="hb-icon" src="data:image/webp;base64,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" alt="Logo" />
  <h1><span>BigClaudia</span></h1>
  <div class="header-right">
    <span class="suppress-indicator" id="suppress-indicator" title="Channel suppression"><span class="suppress-dot hidden" id="suppress-dot"></span><span id="suppress-label"></span></span>
    <div class="theme-toggle">
      <button class="theme-btn" id="theme-cycle-btn" title="Toggle theme">☀️</button>
    </div>
  </div>
</header>

<div class="tabs">
  <div class="tab active" data-tab="chat">${ui.tabChat} <span class="tab-badge" id="unread-badge" style="display:none">0</span></div>
  <div class="tab" data-tab="dashboard">${ui.tabInsights}</div>
  <div class="tab" data-tab="settings">${ui.tabSettings}</div>
</div>

<!-- ── Dashboard ── -->
<div id="view-dashboard" class="view">
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
    <div class="card">
      <div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>${ui.instructions}</div>
      <div class="instructions-body" id="instructions">–</div>
    </div>
    <div class="card">
      <div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/><path d="M16 2l2 2M8 2L6 4"/></svg>${ui.tabCrontab}</div>
      <div class="cron-list" id="cron-list"><span class="cron-empty">${ui.noCrontabEntries}</span></div>
    </div>
  </aside>
  <main>
    <div class="timeline-wrapper">
      <div class="timeline-header">${ui.executionHistory} <span class="entry-count" id="entry-count">0</span></div>
      <div class="timeline" id="timeline">
        <div class="empty">${ui.noEntries}</div>
      </div>
    </div>
    <div class="console-panel">
      <div class="console-header">
        <div class="card-title" style="margin-bottom:0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>${ui.consoleOutput}</div>
      </div>
      <div class="console-body" id="console-body"></div>
    </div>
  </main>
</div>

<!-- ── Chat ── -->
<div id="view-chat" class="view active">
  <div class="chat-messages" id="chat-messages">
    <div class="chat-empty" id="chat-empty">${ui.noMessages}</div>
  </div>
  <div class="chat-input-area" style="position:relative;">
    <div class="drop-overlay" id="drop-overlay">Dateien hier ablegen</div>
    <div class="image-preview-area" id="image-preview"></div>
    <div class="chat-input-row">
      <button class="attach-btn" id="attach-btn" title="Datei anhängen">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
      </button>
      <input type="file" id="file-input" multiple style="display:none;">
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

<!-- ── Settings ── -->
<div id="view-settings" class="view">
  <div class="settings-wrap">
    <div class="settings-body" id="settings-body"></div>
    <div class="whatsapp-qr-panel" id="whatsapp-qr-panel">
      <img id="whatsapp-qr-img" src="" alt="WhatsApp QR">
      <div class="whatsapp-qr-info">
        <div class="whatsapp-qr-title">${ui.whatsappQrTitle}</div>
        <div class="whatsapp-qr-hint">${ui.whatsappQrHint}</div>
      </div>
    </div>
    <div class="settings-footer">
      <div class="settings-status" id="settings-status"></div>
      <button class="btn-shutdown" id="settings-shutdown-btn">${ui.settingsShutdownBtn}</button>
      <button class="btn-restart" id="settings-restart-btn"><span class="spin-icon"></span>${ui.settingsRestartBtn}</button>
      <button class="btn-save" id="settings-save-btn">${ui.settingsSaveBtn}</button>
    </div>
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
  if (name === 'settings') loadSettings();
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
    const cronList = document.getElementById('cron-list');
    if (!data.crontabEntries || !data.crontabEntries.length) {
      cronList.innerHTML = \`<span class="cron-empty">\${STRINGS.noCrontabEntries}</span>\`;
    } else {
      cronList.innerHTML = data.crontabEntries.map(e => \`
        <div class="cron-item">
          \${e.schedule ? \`<div class="cron-schedule">\${e.schedule}</div>\` : ''}
          <div class="cron-task">\${e.task}</div>
        </div>\`).join('');
    }
    document.getElementById('entry-count').textContent = data.entries.length;
    const timeline = document.getElementById('timeline');
    if (!data.entries.length) {
      timeline.innerHTML = \`<div class="empty">\${STRINGS.noEntries}</div>\`;
    } else {
      // Separate valid-date entries from invalid-date entries (compression results)
      const validEntries = [];
      const compressedParts = [];
      data.entries.forEach(e => {
        const d = new Date(e.timestamp);
        if (!isNaN(d.getTime())) {
          validEntries.push(e);
        } else {
          // Compressed summary fragment – collect content
          if (e.timestamp === '__compressed_preamble__') {
            compressedParts.unshift(e.content);
          } else {
            compressedParts.push('### ' + e.timestamp + '\\n' + e.content);
          }
        }
      });
      // Sort valid entries chronologically: oldest first, newest at bottom
      validEntries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      // Build HTML: compressed block first (top), then dated entries
      let html = '';
      if (compressedParts.length) {
        html += \`<div class="entry compressed-block">
          <div class="entry-time">📦 \${STRINGS.compressedSummary || 'Compressed Summary'}</div>
          <div class="entry-body">\${marked.parse(compressedParts.join('\\n\\n'))}</div>
        </div>\`;
      }
      html += validEntries.map(e => \`
        <div class="entry">
          <div class="entry-time">🕐 \${fmtDate(e.timestamp)}</div>
          <div class="entry-body">\${marked.parse(e.content)}</div>
        </div>\`).join('');
      timeline.innerHTML = html;
      // Auto-scroll to bottom (newest)
      timeline.scrollTop = timeline.scrollHeight;
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

  const viaLabel = msg.via === 'discord' ? 'Discord' : msg.via === 'whatsapp' ? 'WhatsApp' : msg.via === 'heartbeat' ? 'Heartbeat' : 'Web';
  const viaClass = msg.via === 'discord' ? 'via-discord' : msg.via === 'whatsapp' ? 'via-whatsapp' : msg.via === 'heartbeat' ? 'via-heartbeat' : 'via-web';

  const content = msg.source === 'bot'
    ? marked.parse(msg.content)
    : msg.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>');

  // Render image thumbnails if present
  let imagesHtml = '';
  if (msg.images && msg.images.length > 0) {
    imagesHtml = '<div class="msg-images">' + msg.images.map(p => {
      const src = '/api/file?path=' + encodeURIComponent(p);
      const name = p.split('/').pop();
      return '<img src="' + src + '" alt="' + name + '" title="' + name + '" onclick="openImageOverlay(this.src)">';
    }).join('') + '</div>';
  }

  // Render document attachments with paperclip icon
  let docsHtml = '';
  if (msg.documents && msg.documents.length > 0) {
    docsHtml = '<div class="msg-documents">' + msg.documents.map(d => {
      const href = '/api/file?path=' + encodeURIComponent(d.path) + '&download=1';
      const displayName = d.name || d.path.split('/').pop();
      return '<a class="msg-document" href="' + href + '" download="' + displayName + '" title="' + displayName + '"><svg class="doc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg><span>' + displayName + '</span></a>';
    }).join('') + '</div>';
  }

  div.innerHTML = \`
    <div class="msg-meta">
      <span class="via-badge \${viaClass}">\${viaLabel}</span>
      <span>\${fmtTime(msg.timestamp)}</span>
    </div>
    <div class="msg-bubble">\${content}\${imagesHtml}\${docsHtml}</div>\`;
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
// Per-stream state for inline thinking blocks
const streamData = {};

function createStreamBubble(id, via) {
  const el = document.getElementById('chat-empty');
  if (el) el.remove();
  streamData[id] = {
    thinkingCounter: 0,
    currentTextDiv: null,
    currentTextContent: '',
    currentThinkingIndex: -1,
    thinkingBuffers: {},
    pendingCollapseBlock: null
  };

  const viaClass = via === 'discord' ? 'via-discord' : via === 'whatsapp' ? 'via-whatsapp' : 'via-web';
  const viaLabel = via === 'discord' ? 'Discord' : via === 'whatsapp' ? 'WhatsApp' : 'Web';

  const div = document.createElement('div');
  div.className = 'msg bot';
  div.id = 'msg-' + id;
  div.innerHTML = \`
    <div class="msg-meta">
      <span class="via-badge \${viaClass}">\${viaLabel}</span>
      <span>\${fmtTime(new Date().toISOString())}</span>
    </div>
    <div class="msg-bubble streaming" id="bubble-\${id}"><span class="typing-dots"><span></span><span></span><span></span></span></div>\`;
  document.getElementById('chat-messages').appendChild(div);
}

// ── Pending-collapse helper ──────────────────────────────────────────────────
// Non-text blocks (thinking, tool-use) are NOT collapsed immediately when they
// end.  Instead, we store them as "pending" and collapse only when the next
// real content chunk (text or another non-text block) arrives.

function flushPendingCollapse(id) {
  const data = streamData[id];
  if (!data || !data.pendingCollapseBlock) return;
  const block = data.pendingCollapseBlock;
  data.pendingCollapseBlock = null;
  if (block.classList.contains('thinking-block')) {
    collapseThinkingBlock(block);
  } else if (block.classList.contains('tool-use-block')) {
    collapseToolUseBlock(block);
  }
}

// ── Partial-JSON helpers ─────────────────────────────────────────────────────

function tryParsePartialJson(text) {
  if (!text || !text.trim().startsWith('{')) return null;
  // 1. Try verbatim
  try { return JSON.parse(text); } catch(e) {}
  // 2. Try capping with closing brace(s) for nearly-complete objects
  try { return JSON.parse(text + '}'); } catch(e) {}
  try { return JSON.parse(text + '"}'); } catch(e) {}
  try { return JSON.parse(text + '"}}'); } catch(e) {}
  // 3. Extract already-completed key-value pairs via regex
  const result = {};
  // Matches "key": "string value" or "key": number/bool/null
  const reStr = /"([^"\\\\]+)"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"/g;
  const reVal = /"([^"\\\\]+)"\\s*:\\s*(true|false|null|-?\\d+(?:\\.\\d+)?)/g;
  let m;
  while ((m = reStr.exec(text)) !== null) result[m[1]] = m[2];
  while ((m = reVal.exec(text)) !== null) {
    try { result[m[1]] = JSON.parse(m[2]); } catch(e) { result[m[1]] = m[2]; }
  }
  return Object.keys(result).length > 0 ? result : null;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderJsonAsTable(obj) {
  const entries = Object.entries(obj).filter(([k]) => k !== 'description');
  if (entries.length === 0) return '';
  const rows = entries.map(([k, v]) => {
    const valStr = typeof v === 'string' ? escapeHtml(v) : escapeHtml(JSON.stringify(v));
    return '<tr><td>' + escapeHtml(k) + '</td><td>' + valStr + '</td></tr>';
  }).join('');
  return '<table class="json-table"><tbody>' + rows + '</tbody></table>';
}

function updateToolUseContentEl(el, jsonText) {
  const parsed = tryParsePartialJson(jsonText);
  if (parsed) {
    const tableHtml = renderJsonAsTable(parsed);
    if (tableHtml) {
      el.innerHTML = tableHtml;
      el.classList.add('has-table');
      return;
    }
  }
  el.classList.remove('has-table');
  el.textContent = jsonText;
}

function showThinkingIndicator(id) {
  const bubble = document.getElementById('bubble-' + id);
  if (!bubble) return;
  const data = streamData[id];
  if (!data) return;
  // Collapse any previously pending block before starting the new one
  flushPendingCollapse(id);
  // Remove typing dots
  const dots = bubble.querySelector('.typing-dots');
  if (dots) dots.remove();
  // Close current text segment (next text will create a new one after this thinking block)
  data.currentTextDiv = null;
  data.currentTextContent = '';
  // Create new thinking block with unique index
  const idx = data.thinkingCounter++;
  data.currentThinkingIndex = idx;
  data.thinkingBuffers[idx] = '';
  const block = document.createElement('div');
  block.className = 'thinking-block streaming-thinking';
  block.dataset.index = idx;
  block.innerHTML = '<div class="thinking-summary" onclick="toggleThinking(this)"><span class="chevron">›</span> <span class="brain">🧠</span> ' + STRINGS.thinking + '</div><div class="thinking-content-wrapper"><div class="thinking-content" id="thinking-content-' + id + '-' + idx + '"></div></div>';
  bubble.appendChild(block);
}

function appendThinkingChunk(id, text) {
  const data = streamData[id];
  if (!data) return;
  const idx = data.currentThinkingIndex;
  data.thinkingBuffers[idx] += text;
  const el = document.getElementById('thinking-content-' + id + '-' + idx);
  if (el) {
    el.textContent = data.thinkingBuffers[idx];
    el.scrollTop = el.scrollHeight;
  }
}

function hideThinkingIndicator(id, summary) {
  const bubble = document.getElementById('bubble-' + id);
  if (!bubble) return;
  const data = streamData[id];
  if (!data) return;
  const idx = data.currentThinkingIndex;
  const block = bubble.querySelector('.thinking-block[data-index="' + idx + '"]');
  if (block) {
    block.classList.remove('streaming-thinking');
    const content = data.thinkingBuffers[idx];
    if (!content || !content.trim()) {
      block.remove();
    } else {
      // Update title with summary
      if (summary) {
        const summaryEl = block.querySelector('.thinking-summary');
        if (summaryEl) {
          summaryEl.innerHTML = '<span class="chevron">›</span> <span class="brain">🧠</span> ' + summary;
        }
      }
      // Don't collapse yet — wait until the next content chunk arrives
      data.pendingCollapseBlock = block;
    }
  }
  // Reset text segment so next text creates a new div after this thinking block
  data.currentTextDiv = null;
  data.currentTextContent = '';
}

function collapseThinkingBlock(block) {
  const wrapper = block.querySelector('.thinking-content-wrapper');
  if (!wrapper) { block.classList.add('collapsed'); return; }
  // Set explicit height so transition can animate from it
  wrapper.style.maxHeight = wrapper.scrollHeight + 'px';
  wrapper.style.transition = 'max-height 0.3s ease';
  requestAnimationFrame(() => {
    wrapper.style.maxHeight = '0px';
  });
  wrapper.addEventListener('transitionend', () => {
    block.classList.add('collapsed');
    wrapper.style.transition = '';
    wrapper.style.maxHeight = '';
  }, { once: true });
}

function expandThinkingBlock(block) {
  block.classList.remove('collapsed');
  const wrapper = block.querySelector('.thinking-content-wrapper');
  if (!wrapper) return;
  const content = wrapper.querySelector('.thinking-content');
  // Temporarily make visible to measure
  wrapper.style.maxHeight = '0px';
  wrapper.style.transition = 'max-height 0.3s ease';
  const targetHeight = content ? content.scrollHeight : wrapper.scrollHeight;
  requestAnimationFrame(() => {
    wrapper.style.maxHeight = targetHeight + 'px';
  });
  wrapper.addEventListener('transitionend', () => {
    wrapper.style.transition = '';
    wrapper.style.maxHeight = '';
  }, { once: true });
}

function toggleThinking(summaryEl) {
  const block = summaryEl.closest('.thinking-block');
  if (!block) return;
  if (block.classList.contains('collapsed')) {
    expandThinkingBlock(block);
  } else {
    collapseThinkingBlock(block);
  }
}

// ── Tool-use block ──────────────────────────────────────────────────────────

function showToolUseIndicator(id, toolName) {
  const bubble = document.getElementById('bubble-' + id);
  if (!bubble) return;
  const data = streamData[id];
  if (!data) return;
  // Collapse any previously pending block before starting the new one
  flushPendingCollapse(id);
  const dots = bubble.querySelector('.typing-dots');
  if (dots) dots.remove();
  data.currentTextDiv = null;
  data.currentTextContent = '';
  const idx = data.thinkingCounter++;
  data.currentThinkingIndex = idx;
  data.thinkingBuffers[idx] = '';
  const block = document.createElement('div');
  block.className = 'tool-use-block streaming-tool-use';
  block.dataset.index = idx;
  block.dataset.toolName = toolName || '';
  const label = toolName ? STRINGS.toolUse + ': ' + toolName : STRINGS.toolUse;
  block.innerHTML = '<div class="tool-use-summary" onclick="toggleToolUse(this)"><span class="chevron">›</span> <span>🔧</span> ' + label + '</div><div class="tool-use-content-wrapper"><div class="tool-use-content" id="tool-use-content-' + id + '-' + idx + '"></div></div>';
  bubble.appendChild(block);
}

function appendToolUseChunk(id, text) {
  const data = streamData[id];
  if (!data) return;
  const idx = data.currentThinkingIndex;
  data.thinkingBuffers[idx] += text;
  const el = document.getElementById('tool-use-content-' + id + '-' + idx);
  if (el) {
    updateToolUseContentEl(el, data.thinkingBuffers[idx]);
    el.scrollTop = el.scrollHeight;
  }
}

function extractImagePaths(text) {
  const IMAGE_EXTS = /\\.(png|jpe?g|gif|webp|bmp|svg|ico)$/i;
  const paths = [];
  // Try JSON parse for file_path
  try {
    const obj = JSON.parse(text);
    if (obj.file_path && IMAGE_EXTS.test(obj.file_path)) paths.push(obj.file_path);
  } catch(e) {}
  // Also scan for absolute paths in raw text
  const regex = /(\\/[^\\s"',}]+?\\.(png|jpe?g|gif|webp|bmp|svg|ico))/gi;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (!paths.includes(m[1])) paths.push(m[1]);
  }
  return paths;
}

function openImageOverlay(src) {
  const overlay = document.createElement('div');
  overlay.className = 'img-overlay';
  overlay.innerHTML = '<img src="' + src + '">';
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
}

function hideToolUseIndicator(id, summary) {
  const bubble = document.getElementById('bubble-' + id);
  if (!bubble) return;
  const data = streamData[id];
  if (!data) return;
  const idx = data.currentThinkingIndex;
  const block = bubble.querySelector('.tool-use-block[data-index="' + idx + '"]');
  if (block) {
    block.classList.remove('streaming-tool-use');
    const content = data.thinkingBuffers[idx];
    if (!content || !content.trim()) {
      block.remove();
    } else {
      // Update title with summary
      if (summary) {
        const summaryEl = block.querySelector('.tool-use-summary');
        if (summaryEl) {
          summaryEl.innerHTML = '<span class="chevron">›</span> <span>🔧</span> ' + summary;
        }
      }
      // Finalize JSON display (complete parse now that streaming is done)
      const contentEl = block.querySelector('.tool-use-content');
      if (contentEl) updateToolUseContentEl(contentEl, content);
      // Detect image paths and add thumbnails only for Read tool (outside wrapper so visible when collapsed)
      const isReadTool = block.dataset.toolName === 'Read';
      const imgPaths = isReadTool ? extractImagePaths(content) : [];
      if (imgPaths.length > 0) {
        imgPaths.forEach(p => {
          const img = document.createElement('img');
          img.className = 'tool-use-thumbnail';
          img.src = '/api/file?path=' + encodeURIComponent(p);
          img.alt = p.split('/').pop();
          img.title = p;
          img.onclick = (e) => { e.stopPropagation(); openImageOverlay(img.src); };
          block.appendChild(img);
        });
      }
      // Don't collapse yet — wait until the next content chunk arrives
      data.pendingCollapseBlock = block;
    }
  }
  data.currentTextDiv = null;
  data.currentTextContent = '';
}

function collapseToolUseBlock(block) {
  const wrapper = block.querySelector('.tool-use-content-wrapper');
  if (!wrapper) { block.classList.add('collapsed'); return; }
  wrapper.style.maxHeight = wrapper.scrollHeight + 'px';
  wrapper.style.transition = 'max-height 0.3s ease';
  requestAnimationFrame(() => { wrapper.style.maxHeight = '0px'; });
  wrapper.addEventListener('transitionend', () => {
    block.classList.add('collapsed');
    wrapper.style.transition = '';
    wrapper.style.maxHeight = '';
  }, { once: true });
}

function expandToolUseBlock(block) {
  block.classList.remove('collapsed');
  const wrapper = block.querySelector('.tool-use-content-wrapper');
  if (!wrapper) return;
  const content = wrapper.querySelector('.tool-use-content');
  wrapper.style.maxHeight = '0px';
  wrapper.style.transition = 'max-height 0.3s ease';
  const targetHeight = content ? content.scrollHeight : wrapper.scrollHeight;
  requestAnimationFrame(() => { wrapper.style.maxHeight = targetHeight + 'px'; });
  wrapper.addEventListener('transitionend', () => {
    wrapper.style.transition = '';
    wrapper.style.maxHeight = '';
  }, { once: true });
}

function toggleToolUse(summaryEl) {
  const block = summaryEl.closest('.tool-use-block');
  if (!block) return;
  if (block.classList.contains('collapsed')) {
    expandToolUseBlock(block);
  } else {
    collapseToolUseBlock(block);
  }
}

// ── Redacted thinking block ─────────────────────────────────────────────────

function showRedactedThinking(id, summary) {
  const bubble = document.getElementById('bubble-' + id);
  if (!bubble) return;
  const data = streamData[id];
  if (!data) return;
  const dots = bubble.querySelector('.typing-dots');
  if (dots) dots.remove();
  data.currentTextDiv = null;
  data.currentTextContent = '';
  const label = summary || STRINGS.redactedThinking;
  const block = document.createElement('div');
  block.className = 'redacted-thinking-block';
  block.innerHTML = '<div class="redacted-thinking-summary"><span>🔒</span> ' + label + '</div>';
  bubble.appendChild(block);
}

function appendStreamChunk(id, text) {
  const data = streamData[id];
  if (!data) return;
  const bubble = document.getElementById('bubble-' + id);
  if (!bubble) return;
  // Collapse any previously pending non-text block now that real text is arriving
  flushPendingCollapse(id);
  // Remove typing dots once real content arrives
  const dots = bubble.querySelector('.typing-dots');
  if (dots) dots.remove();
  // Create a new text segment div if needed
  if (!data.currentTextDiv) {
    const div = document.createElement('div');
    div.className = 'text-segment';
    bubble.appendChild(div);
    data.currentTextDiv = div;
    data.currentTextContent = '';
  }
  data.currentTextContent += text;
  data.currentTextDiv.innerHTML = marked.parse(data.currentTextContent);
}

function finalizeStreamBubble(id, cleanContent) {
  // Collapse any still-pending non-text block before tearing down stream state
  flushPendingCollapse(id);
  delete streamData[id];
  const bubble = document.getElementById('bubble-' + id);
  if (bubble) {
    bubble.classList.remove('streaming');
    // Re-render with clean content (strips any custom tags that leaked during streaming)
    // Skip if empty (e.g. when /stop kills the process mid-stream)
    if (cleanContent) {
      const textSegs = bubble.querySelectorAll('.text-segment');
      if (textSegs.length) {
        // Replace content of last text segment (or all if only one)
        const lastSeg = textSegs[textSegs.length - 1];
        lastSeg.innerHTML = marked.parse(cleanContent);
      }
    }
  }
}

// ── Focus tracking (SUPPRESS_CHANNELS_ON_FOCUS) ────────────────────────────
let _lastFocusState = null;
let _suppressEnabled = false;
const _suppressDot = document.getElementById('suppress-dot');
const _suppressLabel = document.getElementById('suppress-label');

function updateSuppressDot() {
  if (!_suppressEnabled) {
    _suppressDot.className = 'suppress-dot hidden';
    _suppressLabel.textContent = '';
    return;
  }
  const focused = document.hasFocus();
  _suppressDot.classList.remove('hidden');
  if (focused) {
    _suppressDot.className = 'suppress-dot active';
    _suppressLabel.textContent = '${ui.channels}';
  } else {
    _suppressDot.className = 'suppress-dot inactive';
    _suppressLabel.textContent = '${ui.channels}';
  }
}

function reportFocus() {
  const focused = document.hasFocus();
  if (focused !== _lastFocusState) {
    _lastFocusState = focused;
    fetch('/api/focus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ focused }),
    }).then(r => r.json()).then(data => {
      if (typeof data.suppressEnabled === 'boolean') {
        _suppressEnabled = data.suppressEnabled;
      }
      updateSuppressDot();
    }).catch(() => {});
  }
  updateSuppressDot();
}

// Initial check of suppress feature status
fetch('/api/focus', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ focused: document.hasFocus() }),
}).then(r => r.json()).then(data => {
  _lastFocusState = document.hasFocus();
  if (typeof data.suppressEnabled === 'boolean') {
    _suppressEnabled = data.suppressEnabled;
  }
  updateSuppressDot();
}).catch(() => {});

setInterval(reportFocus, 2000);
window.addEventListener('focus', reportFocus);
window.addEventListener('blur', reportFocus);
reportFocus();

// ── SSE ─────────────────────────────────────────────────────────────────────
let pendingReply = false;

let _currentSSE = null;

function connectSSE() {
  // Close any existing EventSource to prevent duplicates
  if (_currentSSE) {
    _currentSSE.onmessage = null;
    _currentSSE.onerror = null;
    _currentSSE.close();
    _currentSSE = null;
  }

  const es = new EventSource('/api/events');
  _currentSSE = es;
  es.onmessage = (e) => {
    // Ignore events from stale connections
    if (es !== _currentSSE) { es.close(); return; }

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

    } else if (data.type === 'stream_thinking_start') {
      showThinkingIndicator(data.id);
      if (chatVisible) scrollChat();

    } else if (data.type === 'stream_thinking_chunk') {
      appendThinkingChunk(data.id, data.text);
      if (chatVisible) scrollChat();

    } else if (data.type === 'stream_thinking_end') {
      hideThinkingIndicator(data.id, data.summary);

    } else if (data.type === 'stream_tool_use_start') {
      showToolUseIndicator(data.id, data.toolName);
      if (chatVisible) scrollChat();

    } else if (data.type === 'stream_tool_use_chunk') {
      appendToolUseChunk(data.id, data.text);
      if (chatVisible) scrollChat();

    } else if (data.type === 'stream_tool_use_end') {
      hideToolUseIndicator(data.id, data.summary);

    } else if (data.type === 'stream_redacted_thinking') {
      showRedactedThinking(data.id, data.summary);
      if (chatVisible) scrollChat();

    } else if (data.type === 'stream_chunk') {
      appendStreamChunk(data.id, data.text);
      if (chatVisible) scrollChat();

    } else if (data.type === 'stream_end') {
      finalizeStreamBubble(data.id, data.content);
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

    } else if (data.type === 'audio') {
      // Play audio in the Web UI
      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))],
        { type: 'audio/mpeg' }
      );
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create audio message bubble
      const el = document.getElementById('chat-empty');
      if (el) el.remove();
      const div = document.createElement('div');
      div.className = 'msg bot';
      const viaClass = data.via === 'discord' ? 'via-discord' : data.via === 'whatsapp' ? 'via-whatsapp' : data.via === 'heartbeat' ? 'via-heartbeat' : 'via-web';
      const viaLabel = data.via === 'discord' ? 'Discord' : data.via === 'whatsapp' ? 'WhatsApp' : data.via === 'heartbeat' ? 'Heartbeat' : 'Web';
      div.innerHTML = \`
        <div class="msg-meta">
          <span class="via-badge \${viaClass}">\${viaLabel}</span>
          <span>🔊</span>
          <span>\${fmtTime(new Date().toISOString())}</span>
        </div>
        <div class="msg-bubble">
          <div style="font-style:italic;color:var(--muted);margin-bottom:4px;">\${data.text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
          <audio controls \${(!_suppressEnabled || document.hasFocus()) ? 'autoplay' : ''} style="width:100%;max-width:300px;"><source src="\${audioUrl}" type="audio/mpeg"></audio>
        </div>\`;
      document.getElementById('chat-messages').appendChild(div);
      if (chatVisible) scrollChat();
      else bumpUnread();

    } else if (data.type === 'console_log') {
      appendConsoleLine(data.entry);

    } else if (data.type === 'console_history') {
      data.entries.forEach(appendConsoleLine);
      const cb = document.getElementById('console-body');
      if (cb) cb.scrollTop = cb.scrollHeight;

    } else if (data.type === 'history') {
      // Clean up any stuck streaming bubbles from a dropped connection.
      // The server will replay the active stream events right after this
      // history event, so the streaming bubble will be recreated correctly.
      for (const id of Object.keys(streamData)) {
        const bubble = document.getElementById('msg-' + id);
        if (bubble) bubble.remove();
        delete streamData[id];
      }
      setWaiting(false);
      document.getElementById('chat-messages').innerHTML = '';
      data.messages.forEach(renderMessage);
      scrollChat();
      document.getElementById('loading').style.opacity = '0';
      setTimeout(() => { document.getElementById('loading').style.display = 'none'; }, 300);
    }
  };
  es.onerror = () => {
    // Close this EventSource to prevent its built-in auto-reconnection
    es.close();
    // Only reconnect if this is still the active connection
    if (es === _currentSSE) {
      _currentSSE = null;
      setTimeout(connectSSE, 3000);
    }
  };
}

// ── Console output ──────────────────────────────────────────────────────────
function appendConsoleLine(entry) {
  const container = document.getElementById('console-body');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'console-line' + (entry.level === 'error' ? ' error' : entry.level === 'warn' ? ' warn' : '');
  const ts = new Date(entry.timestamp);
  const timeStr = ts.toLocaleTimeString(STRINGS.locale, { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const escaped = entry.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  div.innerHTML = \`<span class="ts">\${timeStr}</span><span class="txt">\${escaped}</span>\`;
  container.appendChild(div);
  // Auto-scroll to newest entry
  container.scrollTop = container.scrollHeight;
  // Limit DOM nodes
  while (container.children.length > 500) container.removeChild(container.firstChild);
}

// ── Stop ─────────────────────────────────────────────────────────────────────
async function stopChat() {
  // Clean up UI immediately — don't wait for stream_end via SSE
  setWaiting(false);
  document.querySelectorAll('.msg-bubble.streaming').forEach(el => {
    el.classList.remove('streaming');
    // Remove typing dots if still present (no content arrived yet)
    const dots = el.querySelector('.typing-dots');
    if (dots) dots.remove();
    // Clean up streamData for this bubble
    const bubbleId = el.id.replace('bubble-', '');
    delete streamData[bubbleId];
  });
  try {
    await fetch('/api/stop', { method: 'POST' });
  } catch(e) {
    console.error(STRINGS.sendError, e);
  }
}

// ── File handling (images + documents) ────────────────────────────────────────
const pendingImages = []; // { file: File, dataUrl: string, base64: string }
const pendingDocuments = []; // { file: File, base64: string }

function addFiles(files) {
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      if (pendingImages.length >= 10) continue;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const base64 = dataUrl.split(',')[1];
        pendingImages.push({ file, dataUrl, base64 });
        renderFilePreviews();
      };
      reader.readAsDataURL(file);
    } else {
      // Treat as document
      if (pendingDocuments.length >= 10) continue;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const base64 = dataUrl.split(',')[1];
        pendingDocuments.push({ file, base64 });
        renderFilePreviews();
      };
      reader.readAsDataURL(file);
    }
  }
}

function removeImage(index) {
  pendingImages.splice(index, 1);
  renderFilePreviews();
}

function removeDocument(index) {
  pendingDocuments.splice(index, 1);
  renderFilePreviews();
}

function clearImages() {
  pendingImages.length = 0;
  pendingDocuments.length = 0;
  renderFilePreviews();
}

function renderFilePreviews() {
  const container = document.getElementById('image-preview');
  container.innerHTML = '';
  pendingImages.forEach((img, i) => {
    const item = document.createElement('div');
    item.className = 'image-preview-item';
    item.innerHTML = '<img src="' + img.dataUrl + '" alt="' + img.file.name + '"><button class="remove-btn" title="Entfernen">&times;</button>';
    item.querySelector('.remove-btn').addEventListener('click', () => removeImage(i));
    container.appendChild(item);
  });
  pendingDocuments.forEach((doc, i) => {
    const item = document.createElement('div');
    item.className = 'image-preview-item doc-preview-item';
    item.innerHTML = '<div class="doc-preview"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg><span style="font-size:11px;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + doc.file.name + '</span></div><button class="remove-btn" title="Entfernen">&times;</button>';
    item.querySelector('.remove-btn').addEventListener('click', () => removeDocument(i));
    container.appendChild(item);
  });
}

// Attach button & file input
document.getElementById('attach-btn').addEventListener('click', () => {
  document.getElementById('file-input').click();
});
document.getElementById('file-input').addEventListener('change', (e) => {
  addFiles(e.target.files);
  e.target.value = ''; // reset so same file can be re-selected
});

// Drag & drop on chat input area
const inputArea = document.querySelector('.chat-input-area');
let dragCounter = 0;
inputArea.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  document.getElementById('drop-overlay').classList.add('active');
});
inputArea.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    document.getElementById('drop-overlay').classList.remove('active');
  }
});
inputArea.addEventListener('dragover', (e) => e.preventDefault());
inputArea.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  document.getElementById('drop-overlay').classList.remove('active');
  if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
});

// Paste files from clipboard
document.getElementById('chat-input').addEventListener('paste', (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  const pastedFiles = [];
  for (const item of items) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) pastedFiles.push(file);
    }
  }
  if (pastedFiles.length > 0) {
    e.preventDefault();
    addFiles(pastedFiles);
  }
});

// ── Send message ─────────────────────────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text && pendingImages.length === 0 && pendingDocuments.length === 0) return;

  // /stop is handled client-side regardless of pendingReply state
  if (text === '/stop') {
    input.value = '';
    input.style.height = 'auto';
    clearImages();
    await stopChat();
    input.focus();
    return;
  }

  // Prepare file payloads
  const images = pendingImages.map(img => ({
    name: img.file.name,
    data: img.base64,
  }));
  const documents = pendingDocuments.map(doc => ({
    name: doc.file.name,
    data: doc.base64,
  }));

  input.value = '';
  input.style.height = 'auto';
  clearImages();

  try {
    const payload = { message: text };
    if (images.length > 0) payload.images = images;
    if (documents.length > 0) payload.documents = documents;
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch(e) {
    console.error(STRINGS.sendError, e);
  }

  input.focus();
}

// Input events
const input = document.getElementById('chat-input');
const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// Mobile: Shift+Enter = senden, Enter = Zeilenumbruch
// Desktop: Enter = senden, Shift+Enter = Zeilenumbruch
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (isMobile) {
      if (e.shiftKey) { e.preventDefault(); sendMessage(); }
    } else {
      if (!e.shiftKey) { e.preventDefault(); sendMessage(); }
    }
  }
});

// Hint je nach Gerät aktualisieren
if (isMobile && STRINGS.chatHintMobile) {
  const hintEl = document.querySelector('.chat-hint');
  if (hintEl) hintEl.innerHTML = STRINGS.chatHintMobile;
}
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
});
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('stop-btn').addEventListener('click', stopChat);

// ── Settings ─────────────────────────────────────────────────────────────────
async function loadSettings() {
  const [{ defs, values }, voiceData] = await Promise.all([
    fetch('/api/settings').then(r => r.json()),
    fetch('/api/elevenlabs/voices').then(r => r.json()).catch(() => ({ voices: [], selected: '' })),
  ]);
  const groups = {};
  for (const d of defs) { if (!groups[d.group]) groups[d.group] = []; groups[d.group].push(d); }

  document.getElementById('settings-body').innerHTML = Object.entries(groups).map(([group, items]) => \`
    <div class="settings-group">
      <div class="settings-group-title">\${group}</div>
      \${items.map(d => {
        const val = (values[d.key] ?? '').replace(/"/g, '&quot;');
        let input;
        if (d.type === 'voice-select') {
          const voices = voiceData.voices || [];
          const selected = values[d.key] || voiceData.selected || '';
          if (voices.length) {
            // Group voices by category, show language prefix before name
            const byCategory = {};
            voices.forEach(v => { const cat = v.category || 'other'; if (!byCategory[cat]) byCategory[cat] = []; byCategory[cat].push(v); });
            const optGroups = Object.entries(byCategory).map(([cat, vs]) =>
              \`<optgroup label="\${cat}">\${vs.map(v => {
                const langs = v.languages && v.languages.length
                  ? [...new Set(v.languages.map(l => (l.name || l.language || l.language_id || l).toString().toUpperCase()))].join(', ')
                  : ((v.labels && v.labels.language) || 'Unknown').toUpperCase();
                const ml = v.multilingual ? ', multilingual' : '';
                return \`<option value="\${v.voice_id}"\${v.voice_id === selected ? ' selected' : ''}>\${v.name} (\${langs}\${ml})</option>\`;
              }).join('')}</optgroup>\`
            ).join('');
            input = \`<select class="setting-input" id="elevenlabs-voice-select" name="\${d.key}">\${optGroups}</select>\`;
          } else {
            input = \`<input class="setting-input" type="text" name="\${d.key}" value="\${val}" placeholder="Enable ElevenLabs to load voices">\`;
          }
        } else if (d.type === 'toggle') {
          const checked = (values[d.key] || d.placeholder) === 'true';
          input = \`<div class="setting-toggle-wrap">
            <label class="setting-toggle">
              <input type="checkbox" class="setting-input" name="\${d.key}" data-toggle="\${d.key}" \${checked ? 'checked' : ''}>
              <span class="toggle-track"></span>
            </label>
            <span class="setting-toggle-label">\${checked ? 'On' : 'Off'}</span>
          </div>\`;
        } else if (d.type === 'select') {
          input = \`<select class="setting-input" name="\${d.key}">\${d.options.map(o => \`<option value="\${o}"\${(values[d.key] || d.placeholder) === o ? ' selected' : ''}>\${o}</option>\`).join('')}</select>\`;
        } else {
          input = \`<input class="setting-input" type="\${d.type === 'password' ? 'password' : d.type === 'number' ? 'number' : 'text'}" name="\${d.key}" value="\${val}" placeholder="\${d.placeholder}">\`;
        }
        const depAttr = d.dependsOn ? \` data-depends-on="\${d.dependsOn}"\` : '';
        return \`<div class="setting-item\${d.dependsOn ? ' setting-dep' : ''}"\${depAttr}><div class="setting-label">\${d.label}</div><div class="setting-desc">\${d.description}</div>\${input}</div>\`;
      }).join('')}
    </div>\`).join('');

  // Toggle switch: update label & show/hide dependent settings
  function updateToggleDeps(toggleKey, isOn) {
    document.querySelectorAll(\`[data-depends-on="\${toggleKey}"]\`).forEach(el => {
      el.classList.toggle('setting-hidden', !isOn);
    });
  }
  document.querySelectorAll('#settings-body [data-toggle]').forEach(cb => {
    const toggleKey = cb.dataset.toggle;
    // Set initial visibility
    updateToggleDeps(toggleKey, cb.checked);
    // Listen for changes
    cb.addEventListener('change', () => {
      const label = cb.closest('.setting-toggle-wrap').querySelector('.setting-toggle-label');
      if (label) label.textContent = cb.checked ? 'On' : 'Off';
      updateToggleDeps(toggleKey, cb.checked);
    });
  });
}

async function saveSettings() {
  const updates = {};
  document.querySelectorAll('#settings-body .setting-input').forEach(el => {
    if (!el.name) return;
    // Toggle checkboxes: save as 'true'/'false' string (even when hidden)
    if (el.type === 'checkbox') { updates[el.name] = el.checked ? 'true' : 'false'; }
    else { updates[el.name] = el.value; }
  });
  await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
  const st = document.getElementById('settings-status');
  st.textContent = STRINGS.settingsSaved;
  setTimeout(() => { st.textContent = ''; }, 3000);
}

async function restartServer() {
  if (!confirm(STRINGS.settingsRestartConfirm)) return;
  const btn = document.getElementById('settings-restart-btn');
  const status = document.getElementById('settings-status');
  btn.classList.add('restarting');
  status.textContent = STRINGS.settingsRestarting;
  await fetch('/api/restart', { method: 'POST' }).catch(() => {});
  // Poll until server is back, then reload
  const poll = async () => {
    try { await fetch('/api/heartbeat'); location.reload(); }
    catch { setTimeout(poll, 800); }
  };
  setTimeout(poll, 1500);
}

async function shutdownServer() {
  if (!confirm(STRINGS.settingsShutdownConfirm)) return;
  document.getElementById('settings-status').textContent = STRINGS.settingsShuttingDown;
  document.getElementById('settings-shutdown-btn').disabled = true;
  await fetch('/api/shutdown', { method: 'POST' }).catch(() => {});
}

document.getElementById('settings-save-btn').addEventListener('click', saveSettings);
document.getElementById('settings-restart-btn').addEventListener('click', restartServer);
document.getElementById('settings-shutdown-btn').addEventListener('click', shutdownServer);

// ── WhatsApp QR ──────────────────────────────────────────────────────────────
let qrPollTimer = null;
async function pollWhatsappQR() {
  try {
    const { qr, authenticated } = await fetch('/api/whatsapp/qr').then(r => r.json());
    const panel = document.getElementById('whatsapp-qr-panel');
    const img   = document.getElementById('whatsapp-qr-img');
    const info  = panel.querySelector('.whatsapp-qr-info');
    if (authenticated) {
      panel.classList.add('visible');
      img.style.display = 'none';
      info.innerHTML = \`<div class="whatsapp-qr-ok">\${STRINGS.whatsappAuthenticated}</div>\`;
      clearInterval(qrPollTimer);
    } else if (qr) {
      panel.classList.add('visible');
      img.style.display = '';
      img.src = qr;
      info.innerHTML = \`<div class="whatsapp-qr-title">\${STRINGS.whatsappQrTitle}</div><div class="whatsapp-qr-hint">\${STRINGS.whatsappQrHint}</div>\`;
    } else {
      panel.classList.remove('visible');
    }
  } catch {}
}
function startQRPolling() {
  pollWhatsappQR();
  if (qrPollTimer) clearInterval(qrPollTimer);
  qrPollTimer = setInterval(pollWhatsappQR, 3000);
}
// Only poll when settings tab is visible
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.dataset.tab === 'settings') startQRPolling();
    else { clearInterval(qrPollTimer); qrPollTimer = null; }
  });
});

// ── Theme ────────────────────────────────────────────────────────────────────
const _themeIcons = { light: '☀️', auto: '⚙️', dark: '🌙' };
const _themeCycle = ['light', 'auto', 'dark'];
const _themeCycleBtn = document.getElementById('theme-cycle-btn');

function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'dark')  root.setAttribute('data-theme', 'dark');
  else if (mode === 'light') root.setAttribute('data-theme', 'light');
  else root.removeAttribute('data-theme');
  _themeCycleBtn.textContent = _themeIcons[mode] || _themeIcons.auto;
}
(function () {
  const saved = localStorage.getItem('theme') || 'auto';
  applyTheme(saved);
  _themeCycleBtn.addEventListener('click', () => {
    const current = localStorage.getItem('theme') || 'auto';
    const idx = _themeCycle.indexOf(current);
    const next = _themeCycle[(idx + 1) % _themeCycle.length];
    localStorage.setItem('theme', next);
    applyTheme(next);
  });
})();

// ── Init ────────────────────────────────────────────────────────────────────
connectSSE();
</script>
</body>
</html>`;
}

module.exports = { getHTML };
