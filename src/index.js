require('dotenv').config({ override: true });

const { validate: validateConfig } = require('./config');
validateConfig();

const { initHeartbeat, readHeartbeat, appendToHistory, writeHeartbeat, updateInstructions, updateCrontab, needsSummarization, getFileSize, MAX_SIZE } = require('./memory');
const { askClaude, chatWithClaude, summarizeHistory, killCurrentProcess } = require('./claude');
const discord = require('./discord');
const whatsapp = require('./whatsapp');
const elevenlabs = require('./elevenlabs');
const { transcribe } = require('./whisper');
const { createServer, recordHeartbeatRun, setMessageProcessor, setOnStop, restartSelf } = require('./webserver');
const state = require('./state');
const t = require('./i18n');

const fs = require('fs');
const { saveImage, downloadAndSave, formatImageRefs, formatDocumentRefs, cleanupOldFiles } = require('./images');
const { stripCustomTags } = require('./utils/tags');

const WHISPER_LOCAL_ENABLED = (process.env.WHISPER_LOCAL_ENABLED || 'false').toLowerCase() === 'true';
const SUPPRESS_CHANNELS_ON_FOCUS = (process.env.SUPPRESS_CHANNELS_ON_FOCUS || 'false').toLowerCase() === 'true';

const IMAGE_EXTS = /\.(png|jpe?g|gif|webp|bmp|svg|ico)$/i;

/**
 * Extracts image file paths from tool use input JSON.
 * Mirrors the logic from the Web UI's extractImagePaths().
 */
function extractImagePaths(text) {
  const paths = [];
  // Try JSON parse for file_path
  try {
    const obj = JSON.parse(text);
    if (obj.file_path && IMAGE_EXTS.test(obj.file_path)) paths.push(obj.file_path);
  } catch (e) {}
  // Also scan for absolute paths in raw text
  const regex = /(\/[^\s"',}]+?\.(png|jpe?g|gif|webp|bmp|svg|ico))/gi;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (!paths.includes(m[1])) paths.push(m[1]);
  }
  return paths;
}

/**
 * Sends image files to Discord and WhatsApp channels (non-blocking).
 */
function sendImagesToChannels(imagePaths) {
  if (shouldSuppressChannels()) return;
  for (const imgPath of imagePaths) {
    if (!fs.existsSync(imgPath)) continue;
    if (discord.isConfigured()) {
      discord.sendImageFile(imgPath).catch((err) =>
        console.error('[Image→Discord]', err.message)
      );
    }
    if (whatsapp.isConfigured()) {
      whatsapp.sendImage(imgPath).catch((err) =>
        console.error('[Image→WhatsApp]', err.message)
      );
    }
  }
}

/** Returns true when channel output (Discord/WhatsApp) should be suppressed. */
function shouldSuppressChannels() {
  return SUPPRESS_CHANNELS_ON_FOCUS && state.isWebUiFocused();
}

/** Processes a chat message with streaming and returns { reply, update_instructions }. */
async function processWithStreaming(text, via, extraOnDelta = null, imagePaths = null, documentPaths = null) {
  const { instructions, crontabRaw } = await readHeartbeat();
  const fullInstructions = instructions + (crontabRaw ? '\n\n' + crontabRaw : '');
  const streamId = state.streamStart(via);

  // Append image and document references to the message for Claude CLI
  const messageForClaude = text + formatImageRefs(imagePaths) + formatDocumentRefs(documentPaths);

  // Track timing/length for channel summaries
  let blockStartTime = null;
  let thinkingChars = 0;
  let toolUseChars = 0;
  let currentToolName = '';
  let toolUseInputBuffer = '';  // accumulates tool use input JSON for image detection
  const ui = t.ui;

  const onDelta = (delta) => {
    state.streamChunk(streamId, delta);
    if (extraOnDelta) extraOnDelta(delta);
  };
  const callbacks = {
    onThinkingStart: () => {
      blockStartTime = Date.now();
      thinkingChars = 0;
      state.streamThinkingStart(streamId);
    },
    onThinkingDelta: (delta) => {
      thinkingChars += delta.length;
      state.streamThinkingChunk(streamId, delta);
    },
    onThinkingEnd: () => {
      const secs = Math.round((Date.now() - blockStartTime) / 1000);
      const summary = ui.thinkingSummary(secs, thinkingChars);
      state.streamThinkingEnd(streamId, summary);
      // Emit summary for channels
      if (extraOnDelta) extraOnDelta('\n' + summary + '\n');
    },
    onToolUseStart: (name) => {
      blockStartTime = Date.now();
      toolUseChars = 0;
      currentToolName = name;
      toolUseInputBuffer = '';
      state.streamToolUseStart(streamId, name);
    },
    onToolUseInput: (json) => {
      toolUseChars += json.length;
      toolUseInputBuffer += json;
      state.streamToolUseChunk(streamId, json);
    },
    onToolUseEnd: () => {
      const secs = Math.round((Date.now() - blockStartTime) / 1000);
      const summary = ui.toolUseSummary(secs, toolUseChars, currentToolName);
      state.streamToolUseEnd(streamId, summary);
      // Emit summary for channels
      if (extraOnDelta) extraOnDelta('\n' + summary + '\n');
      // Send images from Read tool results to Discord/WhatsApp
      if (currentToolName === 'Read') {
        const imgPaths = extractImagePaths(toolUseInputBuffer);
        if (imgPaths.length > 0) {
          sendImagesToChannels(imgPaths);
        }
      }
    },
    onRedactedThinking: () => {
      const summary = ui.redactedThinkingSummary(0);
      state.streamRedactedThinking(streamId, summary);
      // Emit summary for channels
      if (extraOnDelta) extraOnDelta('\n' + summary + '\n');
    },
  };

  try {
    const { reply, update_instructions, update_crontab, speakBlocks } = await chatWithClaude(
      messageForClaude, state.getHistory(), fullInstructions, onDelta, callbacks
    );

    state.streamEnd(streamId, reply, via);
    return { reply, update_instructions, update_crontab, speakBlocks };
  } catch (err) {
    // Ensure stream_end is always sent (e.g. when /stop kills the process)
    state.streamEnd(streamId, '', via);
    throw err;
  }
}

const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MINS || '30', 10) * 60 * 1000;
const CRONTAB_GRACE_MINS = parseInt(process.env.CRONTAB_GRACE_MINS || '30', 10);

// ─── Message queue ────────────────────────────────────────────────────────────

let isProcessing = false;
const messageQueue = [];

function processNext() {
  if (isProcessing || messageQueue.length === 0) return;
  isProcessing = true;
  const { msgId, handler } = messageQueue.shift();
  state.broadcastSSE({ type: 'dequeued', id: msgId });
  handler().catch(err => console.error('[Queue] Handler error:', err.message)).finally(() => {
    isProcessing = false;
    processNext();
  });
}

function enqueue(msgId, handler) {
  messageQueue.push({ msgId, handler });
  state.broadcastSSE({ type: 'queued', id: msgId });
  processNext();
}

// ─── ElevenLabs TTS helper ───────────────────────────────────────────────────
// Synthesizes speak blocks and sends audio to all channels.

async function processSpeakBlocks(speakBlocks, via, discordChannel = null, whatsappChat = null) {
  if (!speakBlocks || !speakBlocks.length || !elevenlabs.isConfigured()) return;

  for (const text of speakBlocks) {
    try {
      const audioBuffer = await elevenlabs.synthesize(text);

      // Send to Discord: italic text + audio file (unless suppressed by focus)
      if (discord.isConfigured() && !shouldSuppressChannels()) {
        try {
          const italicText = `*${text}*`;
          if (discordChannel) {
            await discordChannel.send(italicText);
            await discordChannel.send({ files: [{ attachment: audioBuffer, name: 'voice.mp3' }] });
          } else {
            await discord.send(italicText);
            await discord.sendFile(audioBuffer, 'voice.mp3');
          }
        } catch (err) {
          console.error(t.elevenlabs.sendError(err.message));
        }
      }

      // Send to WhatsApp: italic text + voice message (unless suppressed by focus)
      if (whatsapp.isConfigured() && !shouldSuppressChannels()) {
        try {
          const italicText = `_${text}_`;
          if (whatsappChat) {
            await whatsapp.sendToChat(whatsappChat, italicText);
            await whatsapp.sendAudio(audioBuffer, whatsappChat);
          } else {
            await whatsapp.send(italicText);
            await whatsapp.sendAudio(audioBuffer);
          }
        } catch (err) {
          console.error(t.elevenlabs.sendError(err.message));
        }
      }

      // Broadcast audio to Web UI via SSE (base64 encoded)
      state.broadcastSSE({
        type: 'audio',
        audio: audioBuffer.toString('base64'),
        text,
        via,
      });

    } catch (err) {
      console.error(t.elevenlabs.speakError(err.message));
    }
  }
}

// ─── Shared message processor ────────────────────────────────────────────────
// Used by both the Discord handler and the Web UI chat.

async function processMessage(text, via, extraOnDelta = null, context = {}) {
  if (text.trim() === '/new') {
    killCurrentProcess();
    messageQueue.length = 0;
    state.clearSession();
    return { reply: t.chat.sessionReset };
  }

  if (text.trim() === '/stop') {
    killCurrentProcess();
    messageQueue.length = 0;
    return { reply: t.chat.stopped };
  }

  if (text.trim() === '/restart') {
    killCurrentProcess();
    messageQueue.length = 0;
    setTimeout(restartSelf, 300);
    return { reply: t.chat.restarting };
  }

  const { reply, update_instructions, update_crontab, speakBlocks } = await processWithStreaming(text, via, extraOnDelta, context.imagePaths || null, context.documentPaths || null);

  if (update_instructions && update_instructions.trim()) {
    await updateInstructions(update_instructions.trim());
    console.log(t.heartbeat.instructionsUpdated(via));
  }
  if (update_crontab !== null && update_crontab !== undefined) {
    await updateCrontab(update_crontab);
    console.log(t.heartbeat.instructionsUpdated(via + '/crontab'));
  }

  // Process TTS speak blocks (async, don't block the response)
  if (speakBlocks && speakBlocks.length) {
    processSpeakBlocks(speakBlocks, via, context.discordChannel, context.whatsappChat)
      .catch((err) => console.error(t.elevenlabs.speakError(err.message)));
  }

  state.pushHistory('user', text);
  state.pushHistory('assistant', reply);

  return { reply, update_instructions };
}

// ─── Discord message handler ──────────────────────────────────────────────────

async function handleDiscordMessage(message) {
  let text = message.content
    .replace(/<@!?\d+>/g, '')
    .trim();

  // ── Voice message handling ──────────────────────────────────────────────────
  const voiceAttachment = message.attachments.find(
    (a) => a.contentType?.startsWith('audio/') || a.name?.endsWith('.ogg')
  );

  if (voiceAttachment) {
    console.log(t.whisper.transcribing);
    try {
      const res = await fetch(voiceAttachment.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const transcribed = await transcribe(buf, voiceAttachment.name || 'voice.ogg', process.env.WHISPER_LANGUAGE || null);
      // Prepend transcription as a quote; keep any existing text below
      const quote = transcribed.split('\n').map((l) => `> ${l}`).join('\n');
      text = text
        ? `${quote}\n\n${text}`
        : quote;
    } catch (err) {
      console.error(t.whisper.transcribeError(err.message));
      await message.channel.send(t.whisper.transcribeError(err.message));
      return;
    }
  }

  // ── Image attachment handling ───────────────────────────────────────────────
  const imageAttachments = message.attachments.filter(
    (a) => a.contentType?.startsWith('image/') || IMAGE_EXTS.test(a.name || '')
  );
  const imagePaths = [];
  for (const att of imageAttachments.values()) {
    try {
      const savedPath = await downloadAndSave(att.url, att.name || 'image.png');
      imagePaths.push(savedPath);
      console.log(`[Discord] Image saved: ${savedPath}`);
    } catch (err) {
      console.error(`[Discord] Failed to download image: ${err.message}`);
    }
  }

  // ── Document attachment handling (non-image, non-audio) ───────────────────
  const docAttachments = message.attachments.filter(
    (a) => !a.contentType?.startsWith('audio/') && !a.name?.endsWith('.ogg') &&
           !a.contentType?.startsWith('image/') && !IMAGE_EXTS.test(a.name || '')
  );
  const documentPaths = [];
  for (const att of docAttachments.values()) {
    try {
      const savedPath = await downloadAndSave(att.url, att.name || 'document');
      documentPaths.push({ path: savedPath, name: att.name || 'document' });
      console.log(`[Discord] Document saved: ${savedPath}`);
    } catch (err) {
      console.error(`[Discord] Failed to download document: ${err.message}`);
    }
  }

  if (!text && imagePaths.length === 0 && documentPaths.length === 0) return;
  if (!text && imagePaths.length > 0) text = 'Hier ist ein Bild.';
  if (!text && documentPaths.length > 0) text = 'Hier ist ein Dokument.';

  // /stop bypasses the queue for instant execution
  if (text.trim() === '/stop') {
    killCurrentProcess();
    messageQueue.length = 0;
    state.addChatMessage('user', text, 'discord');
    state.addChatMessage('bot', t.chat.stopped, 'discord');
    try { await message.channel.send(t.chat.stopped); } catch {}
    return;
  }

  console.log(t.discord.messageFrom(message.author.tag, text.substring(0, 100)));

  const msg = state.addChatMessage('user', text, 'discord', imagePaths.length > 0 ? imagePaths : null, documentPaths.length > 0 ? documentPaths : null);

  enqueue(msg.id, async () => {
    const stopTyping = discord.keepTyping(message.channel);
    const chunker = makeDiscordChunker((text) => discord.sendToChannel(message.channel, text));
    try {
      await processMessage(text, 'discord', chunker.onDelta, { discordChannel: message.channel, imagePaths, documentPaths: documentPaths.map(d => d.path) });
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
  let text = message.body.trim();

  // ── Voice message handling ─────────────────────────────────────────────────
  if (message.hasMedia && (message.type === 'ptt' || message.type === 'audio')) {
    try {
      const media = await message.downloadMedia();
      if (media && media.mimetype && media.mimetype.startsWith('audio/')) {
        console.log(t.whisper.transcribing);
        const buf = Buffer.from(media.data, 'base64');
        const ext = media.mimetype.includes('ogg') ? 'ogg' : (media.mimetype.split('/')[1] || 'ogg');
        const transcribed = await transcribe(buf, `whatsapp-voice.${ext}`, process.env.WHISPER_LANGUAGE || null);
        const quote = transcribed.split('\n').map((l) => `> ${l}`).join('\n');
        text = text ? `${quote}\n\n${text}` : quote;
        console.log(`[WhatsApp] Voice message transcribed: ${transcribed.substring(0, 100)}`);
      }
    } catch (err) {
      console.error(`[WhatsApp] Failed to transcribe voice message: ${err.message}`);
      const chat = await message.getChat();
      try { await whatsapp.sendToChat(chat, `⚠️ Sprachnachricht konnte nicht transkribiert werden: ${err.message}`); } catch {}
      return;
    }
  }

  // ── Image & document handling ───────────────────────────────────────────────
  const imagePaths = [];
  const documentPaths = [];
  if (message.hasMedia && message.type !== 'ptt' && message.type !== 'audio') {
    try {
      const media = await message.downloadMedia();
      if (media && media.mimetype && media.mimetype.startsWith('image/')) {
        const ext = media.mimetype.split('/')[1] || 'png';
        const filename = `whatsapp-${Date.now()}.${ext.replace('jpeg', 'jpg')}`;
        const savedPath = saveImage(Buffer.from(media.data, 'base64'), filename);
        imagePaths.push(savedPath);
        console.log(`[WhatsApp] Image saved: ${savedPath}`);
      } else if (media && media.data) {
        // Non-image, non-audio file → treat as document
        const ext = (media.mimetype || 'application/octet-stream').split('/')[1] || 'bin';
        const origName = media.filename || `whatsapp-doc-${Date.now()}.${ext}`;
        const savedPath = saveImage(Buffer.from(media.data, 'base64'), origName);
        documentPaths.push({ path: savedPath, name: origName });
        console.log(`[WhatsApp] Document saved: ${savedPath}`);
      }
    } catch (err) {
      console.error(`[WhatsApp] Failed to download media: ${err.message}`);
    }
  }

  if (!text && imagePaths.length === 0 && documentPaths.length === 0) return;
  if (!text && imagePaths.length > 0) text = 'Hier ist ein Bild.';
  if (!text && documentPaths.length > 0) text = 'Hier ist ein Dokument.';

  // /stop bypasses the queue for instant execution
  if (text === '/stop') {
    killCurrentProcess();
    messageQueue.length = 0;
    const chat = await message.getChat();
    state.addChatMessage('user', text, 'whatsapp');
    state.addChatMessage('bot', t.chat.stopped, 'whatsapp');
    try { await whatsapp.sendToChat(chat, t.chat.stopped); } catch {}
    return;
  }

  console.log(t.whatsapp.unknownPhone(text.substring(0, 100)).replace('ignored.', '→ received'));

  const msg = state.addChatMessage('user', text, 'whatsapp', imagePaths.length > 0 ? imagePaths : null, documentPaths.length > 0 ? documentPaths : null);
  const chat = await message.getChat();

  enqueue(msg.id, async () => {
    const stopTyping = whatsapp.keepTyping(chat);
    const chunker = makeDiscordChunker((chunk) => whatsapp.sendToChat(chat, chunk));
    try {
      await processMessage(text, 'whatsapp', chunker.onDelta, { whatsappChat: chat, imagePaths, documentPaths: documentPaths.map(d => d.path) });
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
      // Extract <speak> blocks from heartbeat messages
      const speakRegex = /<speak>([\s\S]*?)<\/speak>/g;
      const heartbeatSpeakBlocks = [];
      let sm;
      while ((sm = speakRegex.exec(msg)) !== null) {
        const txt = sm[1].trim();
        if (txt) heartbeatSpeakBlocks.push(txt);
      }
      const cleanMsg = stripCustomTags(msg);

      // Show in web UI
      if (cleanMsg) state.addChatMessage('bot', cleanMsg, 'heartbeat');
      // Mirror to Discord if configured (unless suppressed by focus)
      if (cleanMsg && discord.isConfigured() && !shouldSuppressChannels()) {
        discord.send(cleanMsg).catch((err) => console.error(t.discord.sendError, err.message));
      }
      // Mirror to WhatsApp if configured (unless suppressed by focus)
      if (cleanMsg && whatsapp.isConfigured() && !shouldSuppressChannels()) {
        whatsapp.send(cleanMsg).catch((err) => console.error(t.whatsapp.sendError, err.message));
      }
      // Process TTS for heartbeat messages
      if (heartbeatSpeakBlocks.length) {
        processSpeakBlocks(heartbeatSpeakBlocks, 'heartbeat')
          .catch((err) => console.error(t.elevenlabs.speakError(err.message)));
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
    const text = stripCustomTags(buffer).trim();
    buffer = '';
    if (text) send(text);
    return chain;
  };

  const onDelta = (delta) => {
    buffer += delta;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const text = stripCustomTags(buffer).trim();
      buffer = '';
      if (text) send(text);
    }, 3000);
  };

  return { onDelta, flush };
}

// ─── Whisper local Docker container ──────────────────────────────────────────

const WHISPER_CONTAINER_NAME = 'bigclaudia-whisper';

async function startWhisperLocal() {
  const { execSync, spawn: sp } = require('child_process');

  // Check if already running
  try {
    const running = execSync(
      `docker inspect -f '{{.State.Running}}' ${WHISPER_CONTAINER_NAME} 2>/dev/null`,
      { encoding: 'utf8' }
    ).trim();
    if (running === 'true') {
      console.log(t.whisper.alreadyRunning);
      return;
    }
    // Container exists but is stopped – remove it first
    execSync(`docker rm -f ${WHISPER_CONTAINER_NAME}`, { stdio: 'ignore' });
  } catch {
    // Container doesn't exist – that's fine
  }

  const whisperUrl = process.env.WHISPER_URL || 'http://localhost:9000';
  const port = new URL(whisperUrl).port || '9000';

  console.log(t.whisper.starting(port));
  const proc = sp('docker', [
    'run', '-d',
    '--name', WHISPER_CONTAINER_NAME,
    '-p', `${port}:9000`,
    '-e', 'ASR_MODEL=base',
    '-e', 'ASR_ENGINE=faster_whisper',
    'onerahmet/openai-whisper-asr-webservice',
  ], { stdio: 'ignore' });

  await new Promise((resolve, reject) => {
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`docker run exited with code ${code}`)));
    proc.on('error', reject);
  });
  console.log(t.whisper.started);
}

async function stopWhisperLocal() {
  try {
    const { execSync } = require('child_process');
    execSync(`docker stop ${WHISPER_CONTAINER_NAME}`, { stdio: 'ignore' });
    execSync(`docker rm ${WHISPER_CONTAINER_NAME}`, { stdio: 'ignore' });
    console.log(t.whisper.stopped);
  } catch {
    // Container may not exist
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(t.bot.starting);
  console.log(t.bot.heartbeatInterval(HEARTBEAT_INTERVAL_MS / 1000 / 60));

  // Clean up old temp images on startup and periodically (every 6 hours)
  cleanupOldFiles();
  setInterval(cleanupOldFiles, 6 * 60 * 60 * 1000);

  // Start local Whisper container if enabled
  if (WHISPER_LOCAL_ENABLED) {
    try {
      await startWhisperLocal();
    } catch (err) {
      console.error(t.whisper.startError(err.message));
    }
  }

  const created = await initHeartbeat();
  if (created) console.log(t.bot.heartbeatCreated);

  // Register chat processor for Web UI
  setMessageProcessor(async (text, imagePaths = [], documentPaths = []) => {
    // /stop bypasses the queue for instant execution
    if (text.trim() === '/stop') {
      killCurrentProcess();
      messageQueue.length = 0;
      state.addChatMessage('user', text, 'web');
      state.addChatMessage('bot', t.chat.stopped, 'web');
      return;
    }

    const msg = state.addChatMessage('user', text, 'web', imagePaths.length > 0 ? imagePaths : null, documentPaths.length > 0 ? documentPaths : null);

    const isCmd = text.trim() === '/new' || text.trim() === '/stop' || text.trim() === '/restart';

    // Forward user message to Discord immediately (unless suppressed)
    const forwardToDiscord = !isCmd && discord.isConfigured() && !shouldSuppressChannels();
    if (forwardToDiscord) {
      try {
        await discord.send(text.split('\n').map(l => `> ${l}`).join('\n'));
      } catch (err) {
        console.warn(t.discord.mirrorFailed, err.message);
      }
    }

    // Forward user message to WhatsApp immediately (unless suppressed)
    const forwardToWhatsapp = !isCmd && whatsapp.isConfigured() && !shouldSuppressChannels();
    if (forwardToWhatsapp) {
      try {
        await whatsapp.send(text.split('\n').map(l => `> ${l}`).join('\n'));
      } catch (err) {
        console.warn(t.whatsapp.mirrorFailed, err.message);
      }
    }

    enqueue(msg.id, async () => {
      // Re-check suppression at response time (focus may have changed)
      const suppressNow = shouldSuppressChannels();
      const dChunker = (!suppressNow && discord.isConfigured()) ? makeDiscordChunker() : null;
      const wChunker = (!suppressNow && whatsapp.isConfigured()) ? makeDiscordChunker((t) => whatsapp.send(t)) : null;
      const onDelta = (delta) => {
        dChunker?.onDelta(delta);
        wChunker?.onDelta(delta);
      };
      await processMessage(text, 'web', onDelta, { imagePaths, documentPaths: documentPaths.map(d => d.path) });
      if (dChunker) await dChunker.flush();
      if (wChunker) await wChunker.flush();
    });
  });

  // Register stop handler for /api/stop endpoint (clears the message queue)
  setOnStop(() => { messageQueue.length = 0; });

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
  if (WHISPER_LOCAL_ENABLED) await stopWhisperLocal();
  await discord.destroy();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  console.error(t.bot.fatalError, err);
  process.exit(1);
});
