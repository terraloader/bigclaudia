const { spawn } = require('child_process');
const t = require('./i18n');

const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'opus';

// The currently active streaming child process (chat only, not heartbeat).
let currentProc = null;

function killCurrentProcess() {
  if (currentProc) {
    currentProc.kill();
    currentProc = null;
  }
}

// Heartbeat schema (json-schema, no streaming needed)
const HEARTBEAT_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    messages: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['messages', 'summary'],
});

// ─── Heartbeat (structured, no streaming) ────────────────────────────────────

async function askClaude(systemPrompt, userMessage) {
  const args = [
    '--print',
    '--output-format', 'json',
    '--model', CLAUDE_MODEL,
    '--system-prompt', systemPrompt,
    '--json-schema', HEARTBEAT_SCHEMA,
    '--no-session-persistence',
  ];

  const raw = await runCli(args, userMessage);
  let wrapper;
  try { wrapper = JSON.parse(raw); }
  catch { throw new Error(t.claude.invalidJson(raw)); }

  if (wrapper.type === 'error' || wrapper.subtype === 'error') {
    throw new Error(t.claude.cliError(wrapper.error || JSON.stringify(wrapper)));
  }

  const result = wrapper.structured_output ?? (() => {
    try { return JSON.parse(wrapper.result); } catch { return null; }
  })();
  if (!result) throw new Error(t.claude.noStructuredResult(raw));

  return {
    discord_messages: result.messages ?? [],
    summary: result.summary ?? String(result),
  };
}

// ─── Chat (streaming) ─────────────────────────────────────────────────────────

/**
 * Chats with Claude and streams deltas via onDelta callback.
 * Instruction updates are transmitted via an XML tag at the end of the response.
 *
 * @param {string} userMessage
 * @param {{ role: 'user'|'assistant', content: string }[]} history
 * @param {string} heartbeatInstructions
 * @param {(delta: string) => void} [onDelta] - called per text delta
 * @param {{ onThinkingStart?: () => void, onThinkingEnd?: () => void }} [callbacks] - optional thinking callbacks
 * @returns {{ reply: string, update_instructions: string }}
 */
async function chatWithClaude(userMessage, history = [], heartbeatInstructions = '', onDelta = null, callbacks = {}) {
  const historyStr = history
    .map((h) => `${h.role === 'user' ? t.claude.roleUser : t.claude.roleAssistant}: ${h.content}`)
    .join('\n');
  const prompt = historyStr ? `${historyStr}\n${t.claude.roleUser}: ${userMessage}` : userMessage;

  const systemPrompt = t.claude.chatSystemPrompt(heartbeatInstructions);

  const args = [
    '--print',
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--verbose',
    '--model', CLAUDE_MODEL,
    '--system-prompt', systemPrompt,
    '--no-session-persistence',
  ];

  let fullText = '';
  let isThinking = false;
  let hasSeenTextBlock = false;

  await streamCli(args, prompt, (obj) => {
    if (obj.type === 'stream_event') {
      const evt = obj.event;

      // Track content block transitions (thinking → text)
      if (evt?.type === 'content_block_start') {
        const blockType = evt.content_block?.type;
        if (blockType === 'thinking') {
          isThinking = true;
          if (callbacks.onThinkingStart) callbacks.onThinkingStart();
        } else if (blockType === 'text') {
          if (isThinking) {
            isThinking = false;
            if (callbacks.onThinkingEnd) callbacks.onThinkingEnd();
          }
          // Add line break between separate text blocks (e.g. before/after tool use)
          if (hasSeenTextBlock && fullText.length > 0) {
            fullText += '\n\n';
            if (onDelta) onDelta('\n\n');
          }
          hasSeenTextBlock = true;
        }
      }

      // Extract text delta
      if (
        evt?.type === 'content_block_delta' &&
        evt?.delta?.type === 'text_delta'
      ) {
        const delta = evt.delta.text;
        if (delta) {
          fullText += delta;
          // Only emit delta that is NOT part of an update_instructions block
          if (onDelta) onDelta(delta);
        }
      }
    }
    // Take full text from final result
    if (obj.type === 'result' && obj.result) {
      fullText = obj.result;
    }
  });

  // Parse update_instructions, update_crontab, and speak blocks; remove all from reply
  const updateInstrMatch = fullText.match(/<update_instructions>([\s\S]*?)<\/update_instructions>/);
  const updateCrontabMatch = fullText.match(/<update_crontab>([\s\S]*?)<\/update_crontab>/);
  const update_instructions = updateInstrMatch ? updateInstrMatch[1].trim() : '';
  const update_crontab = updateCrontabMatch ? updateCrontabMatch[1].trim() : null;

  // Extract all <speak>...</speak> blocks
  const speakBlocks = [];
  const speakRegex = /<speak>([\s\S]*?)<\/speak>/g;
  let speakMatch;
  while ((speakMatch = speakRegex.exec(fullText)) !== null) {
    const text = speakMatch[1].trim();
    if (text) speakBlocks.push(text);
  }

  const reply = fullText
    .replace(/<update_instructions>[\s\S]*?<\/update_instructions>/, '')
    .replace(/<update_crontab>[\s\S]*?<\/update_crontab>/, '')
    .replace(/<speak>[\s\S]*?<\/speak>/g, '')
    .trim();

  return { reply, update_instructions, update_crontab, speakBlocks };
}

// ─── Summarization ────────────────────────────────────────────────────────────

async function summarizeHistory(instructions, history) {
  console.log(t.claude.summarizing);
  const prompt = t.claude.summarizePrompt(history);
  const args = ['--print', '--output-format', 'text', '--model', CLAUDE_MODEL, '--no-session-persistence'];
  const result = await runCli(args, prompt);
  return result.trim() || history;
}

// ─── CLI helpers ──────────────────────────────────────────────────────────────

/**
 * Spawns the CLI, parses NDJSON lines and calls onLine per object.
 */
function streamCli(args, stdinData, onLine) {
  return new Promise((resolve, reject) => {
    const proc = spawn(CLAUDE_BIN, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    currentProc = proc;
    let buf = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop(); // keep incomplete last line
      for (const line of lines) {
        if (!line.trim()) continue;
        try { onLine(JSON.parse(line)); } catch { /* ignore invalid line */ }
      }
    });

    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => reject(new Error(t.claude.cliError(err.message))));
    proc.on('close', (code, signal) => {
      currentProc = null;
      // process last line remaining in buffer
      if (buf.trim()) {
        try { onLine(JSON.parse(buf)); } catch {}
      }
      // killed by signal (e.g. stop command) — resolve with whatever was streamed so far
      if (signal) { resolve(); return; }
      if (code !== 0) return reject(new Error(t.claude.exitCode(code, stderr)));
      resolve();
    });

    if (stdinData) proc.stdin.write(stdinData, 'utf-8');
    proc.stdin.end();
  });
}

/**
 * Simple single call (no streaming), returns stdout.
 */
function runCli(args, stdinData) {
  return new Promise((resolve, reject) => {
    const proc = spawn(CLAUDE_BIN, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => reject(new Error(t.claude.startFailed(err.message))));
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(t.claude.exitCode(code, stderr)));
      resolve(stdout);
    });
    if (stdinData) proc.stdin.write(stdinData, 'utf-8');
    proc.stdin.end();
  });
}

module.exports = { askClaude, chatWithClaude, summarizeHistory, killCurrentProcess };
