require('dotenv').config({ override: true });

const { initHeartbeat, readHeartbeat, appendToHistory, writeHeartbeat, updateInstructions, updateCrontab, needsSummarization, getFileSize, MAX_SIZE } = require('./memory');
const { askClaude, chatWithClaude, summarizeHistory, killCurrentProcess } = require('./claude');
const discord = require('./discord');
const whatsapp = require('./whatsapp');
const { createServer, recordHeartbeatRun, setMessageProcessor } = require('./webserver');
const state = require('./state');
const t = require('./i18n');

/** Processes a chat message with streaming and returns { reply, update_instructions }. */
async function processWithStreaming(text, via, extraOnDelta = null) {
  const { instructions, crontabRaw } = await readHeartbeat();
  const fullInstructions = instructions + (crontabRaw ? '\n\n' + crontabRaw : '');
  const streamId = state.streamStart(via);
  const onDelta = (delta) => {
    state.streamChunk(streamId, delta);
    if (extraOnDelta) extraOnDelta(delta);
  };

  const { reply, update_instructions, update_crontab } = await chatWithClaude(
    text, state.getHistory(), fullInstructions, onDelta
  );

  state.streamEnd(streamId, reply, via);
  return { reply, update_instructions, update_crontab };
}

const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MINS || '30', 10) * 60 * 1000;
const CRONTAB_GRACE_MINS = parseInt(process.env.CRONTAB_GRACE_MINS || '30', 10);

// ─── Message queue ────────────────────────────────────────────────────────────

let isProcessing = false;
const messageQueue = [];

async function processNext() {
  if (isProcessing || messageQueue.length === 0) return;
  isProcessing = true;
  const { msgId, handler } = messageQueue.shift();
  state.broadcastSSE({ type: 'dequeued', id: msgId });
  try {
    await handler();
  } catch (err) {
    console.error('[Queue] Handler error:', err.message);
  } finally {
    isProcessing = false;
    processNext();
  }
}

async function enqueue(msgId, handler) {
  if (isProcessing) {
    messageQueue.push({ msgId, handler });
    state.broadcastSSE({ type: 'queued', id: msgId });
    return;
  }
  isProcessing = true;
  try {
    await handler();
  } catch (err) {
    console.error('[Queue] Handler error:', err.message);
  } finally {
    isProcessing = false;
    processNext();
  }
}

// ─── Shared message processor ────────────────────────────────────────────────
// Used by both the Discord handler and the Web UI chat.

async function processMessage(text, via, extraOnDelta = null) {
  if (text.trim() === '/new') {
    killCurrentProcess();
    messageQueue.length = 0;
    state.clearSession();
    return { reply: t.chat.sessionReset };
  }

  const { reply, update_instructions, update_crontab } = await processWithStreaming(text, via, extraOnDelta);

  if (update_instructions && update_instructions.trim()) {
    await updateInstructions(update_instructions.trim());
    console.log(t.heartbeat.instructionsUpdated(via));
  }
  if (update_crontab !== null && update_crontab !== undefined) {
    await updateCrontab(update_crontab);
    console.log(t.heartbeat.instructionsUpdated(via + '/crontab'));
  }

  state.pushHistory('user', text);
  state.pushHistory('assistant', reply);

  return { reply, update_instructions };
}

// ─── Discord message handler ──────────────────────────────────────────────────

async function handleDiscordMessage(message) {
  const text = message.content
    .replace(/<@!?\d+>/g, '')
    .trim();

  if (!text) return;

  console.log(t.discord.messageFrom(message.author.tag, text.substring(0, 100)));

  const msg = state.addChatMessage('user', text, 'discord');

  await enqueue(msg.id, async () => {
    const stopTyping = discord.keepTyping(message.channel);
    const chunker = makeDiscordChunker((text) => discord.sendToChannel(message.channel, text));
    try {
      await processMessage(text, 'discord', chunker.onDelta);
    } catch (err) {
      console.error(t.discord.error, err.message);
      const errMsg = t.chat.error(err.message);
      state.addChatMessage('bot', errMsg, 'discord');
      try { await message.channel.send(errMsg); } catch {}
    } finally {
      await chunker.flush();
      stopTyping();
    }
  });
}

// ─── WhatsApp message handler ─────────────────────────────────────────────────

async function handleWhatsappMessage(message) {
  const text = message.body.trim();
  if (!text) return;

  console.log(t.whatsapp.unknownPhone(text.substring(0, 100)).replace('ignored.', '→ received'));

  const msg = state.addChatMessage('user', text, 'whatsapp');
  const chat = await message.getChat();

  await enqueue(msg.id, async () => {
    const stopTyping = whatsapp.keepTyping(chat);
    const chunker = makeDiscordChunker((chunk) => whatsapp.sendToChat(chat, chunk));
    try {
      await processMessage(text, 'whatsapp', chunker.onDelta);
    } catch (err) {
      console.error(t.whatsapp.error, err.message);
      const errMsg = t.chat.error(err.message);
      state.addChatMessage('bot', errMsg, 'whatsapp');
      try { await whatsapp.sendToChat(chat, errMsg); } catch {}
    } finally {
      await chunker.flush();
      stopTyping();
    }
  });
}

// ─── Heartbeat routine ───────────────────────────────────────────────────────

async function runHeartbeat() {
  console.log(t.heartbeat.startingAt(new Date().toISOString()));

  try {
    const { instructions, crontabRaw, history } = await readHeartbeat();

    if (!instructions) {
      console.warn(t.heartbeat.noInstructions);
      return;
    }

    const { discord_messages, summary } = await askClaude(
      t.heartbeat.systemPrompt(CRONTAB_GRACE_MINS),
      t.heartbeat.userMessage(instructions, crontabRaw, history)
    );

    console.log(t.heartbeat.claudeDone, summary.substring(0, 150));

    for (const msg of discord_messages) {
      // Show in web UI
      state.addChatMessage('bot', msg, 'heartbeat');
      // Mirror to Discord if configured
      if (discord.isConfigured()) {
        discord.send(msg).catch((err) => console.error(t.discord.sendError, err.message));
      }
      // Mirror to WhatsApp if configured
      if (whatsapp.isConfigured()) {
        whatsapp.send(msg).catch((err) => console.error(t.whatsapp.sendError, err.message));
      }
    }

    await appendToHistory(summary);
    recordHeartbeatRun();

    const fileSize = await getFileSize();
    console.log(t.heartbeat.fileSize(fileSize, MAX_SIZE));

    if (await needsSummarization()) {
      console.log(t.heartbeat.compressing);
      const { instructions: cur, crontabRaw: curCrontab, history: curHistory } = await readHeartbeat();
      const compressed = await summarizeHistory(cur, curHistory);
      await writeHeartbeat(cur, `${t.heartbeat.compressedLabel(new Date().toISOString())}\n\n${compressed}`, curCrontab);
      console.log(t.heartbeat.newSize(await getFileSize()));
    }
  } catch (err) {
    console.error(t.heartbeat.error, err.message);
  }
}

// ─── Discord stream chunker ───────────────────────────────────────────────────
// Flushes accumulated streaming text to Discord after 3 s of inactivity.
// Returns { onDelta, flush } — call flush() after streaming completes.

function makeDiscordChunker(sendFn = (text) => discord.send(text)) {
  let buffer = '';
  let timer = null;
  let chain = Promise.resolve();

  const send = (text) => {
    chain = chain.then(() =>
      sendFn(text).catch(err => console.warn(t.discord.mirrorFailed, err.message))
    );
  };

  const flush = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    const text = buffer.trim();
    buffer = '';
    if (text) send(text);
    return chain;
  };

  const onDelta = (delta) => {
    buffer += delta;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const text = buffer.trim();
      buffer = '';
      if (text) send(text);
    }, 3000);
  };

  return { onDelta, flush };
}

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(t.bot.starting);
  console.log(t.bot.heartbeatInterval(HEARTBEAT_INTERVAL_MS / 1000 / 60));

  const created = await initHeartbeat();
  if (created) console.log(t.bot.heartbeatCreated);

  // Register chat processor for Web UI
  setMessageProcessor(async (text) => {
    const msg = state.addChatMessage('user', text, 'web');

    const isCmd = text.trim() === '/new';

    // Forward user message to Discord immediately
    const forwardToDiscord = !isCmd && discord.isConfigured();
    if (forwardToDiscord) {
      try {
        await discord.send(text.split('\n').map(l => `> ${l}`).join('\n'));
      } catch (err) {
        console.warn(t.discord.mirrorFailed, err.message);
      }
    }

    // Forward user message to WhatsApp immediately
    const forwardToWhatsapp = !isCmd && whatsapp.isConfigured();
    if (forwardToWhatsapp) {
      try {
        await whatsapp.send(text.split('\n').map(l => `> ${l}`).join('\n'));
      } catch (err) {
        console.warn(t.whatsapp.mirrorFailed, err.message);
      }
    }

    await enqueue(msg.id, async () => {
      const dChunker = forwardToDiscord ? makeDiscordChunker() : null;
      const wChunker = forwardToWhatsapp ? makeDiscordChunker((t) => whatsapp.send(t)) : null;
      const onDelta = (delta) => {
        dChunker?.onDelta(delta);
        wChunker?.onDelta(delta);
      };
      await processMessage(text, 'web', onDelta);
      if (dChunker) await dChunker.flush();
      if (wChunker) await wChunker.flush();
    });
  });

  // Start web server
  createServer();

  // Start Discord bot (only if enabled)
  if (discord.isConfigured()) {
    discord.onMessage(handleDiscordMessage);
    await discord.start();
  }

  // Start WhatsApp client (only if enabled)
  if (whatsapp.isConfigured()) {
    whatsapp.onMessage(handleWhatsappMessage);
    await whatsapp.start();
  }

  // Run first heartbeat immediately, then on interval
  runHeartbeat();
  setInterval(runHeartbeat, HEARTBEAT_INTERVAL_MS);

  console.log(t.bot.running);
}

// Graceful shutdown
async function shutdown() {
  console.log(t.bot.stopping);
  await discord.destroy();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  console.error(t.bot.fatalError, err);
  process.exit(1);
});
