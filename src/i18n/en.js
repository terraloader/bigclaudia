module.exports = {
  bot: {
    starting: '[Bot] Starting...',
    heartbeatInterval: (mins) => `[Bot] Heartbeat interval: ${mins} minutes`,
    heartbeatCreated: '[Bot] heartbeat.md not found — created from heartbeat.md.example.',
    running: '[Bot] Running.',
    stopping: '\n[Bot] Stopping...',
    fatalError: '[Bot] Fatal error:',
  },
  heartbeat: {
    startingAt: (ts) => `[Heartbeat] Starting routine at ${ts}`,
    noInstructions: '[Heartbeat] No instructions found, skipping.',
    claudeDone: '[Heartbeat] Claude done:',
    fileSize: (size, max) => `[Heartbeat] heartbeat.md: ${size} / ${max} Bytes`,
    compressing: '[Heartbeat] Compressing heartbeat.md...',
    newSize: (size) => `[Heartbeat] New size: ${size} Bytes`,
    error: '[Heartbeat] Error:',
    instructionsUpdated: (via) => `[Heartbeat] Instructions updated via ${via}.`,
    compressedLabel: (date) => `**[Compressed on ${date}]**`,
    systemPrompt: (graceMins) => `You are an autonomous agent that runs regularly. You can send messages to the user.

Your tasks are in the instructions. Execute them and return structured:
- "messages": Array of messages to deliver to the user (empty = none)
- "summary": brief summary of what you did

Rules:
- Write in English, unless otherwise instructed
- Messages: friendly, max. 2000 characters per message
- To send a voice message, include a <speak>text</speak> block in any message. The text inside will be converted to speech via ElevenLabs and sent as an audio message alongside the text.

## Crontab execution rules
If a ## Crontab section is present, process each entry as follows:
- Entry format: every [day|weekday] at HH:MM [am|pm]: task description
- The current timestamp is provided at the bottom of the user message.
- For each entry:
  1. Calculate the most recent past scheduled time relative to the current timestamp.
  2. Check if (current time − scheduled time) ≤ ${graceMins} minutes. If the grace window has passed, skip this entry.
  3. Search the ## History section for a line containing [CRON] that matches this exact schedule entry AND has an executed_at timestamp after the calculated scheduled time. If found, the task already ran — skip it.
  4. If not found and within the grace window: execute the task now.
  5. For every executed cron task, include this exact line in your summary (one per task):
     [CRON] schedule="<full entry text>" scheduled_at="<ISO timestamp>" executed_at="<current ISO timestamp>" task="<task description>"`,

    userMessage: (instructions, crontabRaw, history) =>
      `## Instructions\n${instructions}${crontabRaw ? '\n\n' + crontabRaw : ''}\n\n## Previous History\n${history || '(none)'}

---
Current timestamp: ${new Date().toString()}
Execute the instructions and return the JSON result.`,
  },
  discord: {
    messageFrom: (tag, text) => `[Discord] Message from ${tag}: ${text}`,
    error: '[Discord] Error:',
    sendError: '[Discord] Send error:',
    mirrorFailed: '[Discord] Mirroring failed:',
    loggedInAs: (tag) => `[Discord] Bot logged in as ${tag}`,
    unknownId: (id) => `[Discord] Message from unknown ID ${id} ignored.`,
    tokenMissing: 'DISCORD_BOT_TOKEN not set',
    userIdMissing: 'DISCORD_ALLOWED_USER_ID not set',
  },
  claude: {
    summarizing: '[Claude] Summarizing history...',
    invalidJson: (raw) => `Claude CLI output is not valid JSON:\n${raw}`,
    cliError: (msg) => `Claude CLI error: ${msg}`,
    noStructuredResult: (raw) => `No structured result:\n${raw}`,
    startFailed: (msg) => `Claude CLI could not be started: ${msg}`,
    exitCode: (code, stderr) => `Claude CLI code ${code}:\n${stderr}`,
    roleUser: 'User',
    roleAssistant: 'Assistant',
    summarizePrompt: (history) =>
      `Summarize the following execution history of an autonomous agent concisely. Keep important facts, decisions and patterns. Write in English. Return only the summarized markdown text, without introduction.\n\n## Previous History\n${history}`,
    chatSystemPrompt: (instructions) =>
      `You are a helpful, friendly assistant with access to an autonomous heartbeat agent.

## Current Heartbeat Instructions
${instructions || '(no instructions set)'}

## Tasks
- Answer questions and hold conversations
- If the user wants to change the heartbeat **instructions**, add exactly this block at the absolute end of your response (after a blank line):

<update_instructions>
[complete new instructions text only — no ## Crontab section]
</update_instructions>

- If the user wants to change the **crontab / scheduled tasks**, add exactly this block at the absolute end of your response (after a blank line):

<update_crontab>
every day at 09:00 am: example task
every weekday at 06:00 pm: another task
</update_crontab>

The content inside <update_crontab> must be only the task lines (no ## heading, no comments). To clear all tasks, send an empty block.
These blocks are not shown to the user.
- Confirm all changes in the normal response text.
- Respond in English, unless the user writes in another language.

## Crontab / Scheduling
- If the user mentions "cron", "crontab", "schedule", or "scheduler", they always mean scheduled tasks for the heartbeat agent — use the <update_crontab> block.
- Only if the user explicitly says "system-cron" or "system-crontab" do they mean something outside the heartbeat (e.g. the operating system cron daemon).

## Voice Output (Text-to-Speech)
- If ElevenLabs is enabled and you want to send a voice message, wrap the spoken text in a <speak> tag:

<speak>Hello! This text will be converted to speech and sent as a voice message.</speak>

- The <speak> block is NOT shown to the user as text — it is only used for audio generation.
- You can use multiple <speak> blocks in one response for separate voice messages.
- Use <speak> when the user asks for voice output, or when a voice message feels natural (e.g. greetings, short announcements, emotional messages).
- Keep spoken text concise and natural — write it as you would speak it, not as written text.
- Do NOT use <speak> for long or complex answers — only for short, spoken-style messages.`,
  },
  whatsapp: {
    qrReady: '[WhatsApp] QR code ready — scan with WhatsApp mobile.',
    loggedIn: '[WhatsApp] Logged in.',
    authFailed: '[WhatsApp] Auth failed:',
    disconnected: '[WhatsApp] Disconnected:',
    phoneMissing: 'WHATSAPP_PHONE not set',
    notReady: '[WhatsApp] Client not ready.',
    unknownPhone: (phone) => `[WhatsApp] Message from unknown number ${phone} ignored.`,
    error: '[WhatsApp] Error:',
    sendError: '[WhatsApp] Send error:',
    mirrorFailed: '[WhatsApp] Mirroring failed:',
  },
  whisper: {
    sending: (file, bytes) => `[Whisper] Sending ${file} (${bytes} bytes) for transcription...`,
    httpError: (status, body) => `Whisper API HTTP ${status}: ${body}`,
    emptyResult: 'Whisper returned no text.',
    success: (text) => `[Whisper] Transcribed: ${text}`,
    transcribing: '[Discord] Voice message detected – transcribing...',
    transcribeError: (msg) => `Could not transcribe voice message: ${msg}`,
    alreadyRunning: '[Whisper] Local container already running.',
    starting: (port) => `[Whisper] Starting local Docker container on port ${port}...`,
    started: '[Whisper] Local container started.',
    stopped: '[Whisper] Local container stopped.',
    startError: (msg) => `[Whisper] Failed to start local container: ${msg}`,
  },
  elevenlabs: {
    noApiKey: 'ELEVENLABS_API_KEY not set.',
    httpError: (status, body) => `ElevenLabs API HTTP ${status}: ${body}`,
    voicesLoaded: (n) => `[ElevenLabs] ${n} voices loaded.`,
    noVoices: 'No ElevenLabs voices available.',
    synthesizing: (text, voice) => `[ElevenLabs] Synthesizing "${text}…" with voice ${voice}`,
    synthesized: (bytes) => `[ElevenLabs] Audio generated: ${bytes} bytes`,
    sendError: (msg) => `[ElevenLabs] Send error: ${msg}`,
    speakError: (msg) => `[ElevenLabs] TTS error: ${msg}`,
  },
  settings: {
    groups: {
      general:   'General',
      claude:    'Claude',
      discord:   'Discord',
      heartbeat: 'Heartbeat',
      webServer: 'Web Server',
      whisper:   'Whisper (Speech-to-Text)',
      whatsapp:   'WhatsApp',
      elevenlabs: 'ElevenLabs (Text-to-Speech)',
    },
    fields: {
      LANGUAGE:                { label: 'Language',             description: 'UI and log language.' },
      CLAUDE_MODEL:            { label: 'Model',                description: 'Model alias: opus, sonnet, haiku — or a full model ID.' },
      CLAUDE_BIN:              { label: 'CLI Binary Path',      description: 'Path to the Claude CLI binary. Leave empty to use "claude" from PATH.' },
      DISCORD_ENABLED:         { label: 'Enable Discord',        description: 'Enable or disable the Discord bot integration entirely.' },
      DISCORD_BOT_TOKEN:       { label: 'Bot Token',            description: 'Discord bot token from the Discord Developer Portal.' },
      DISCORD_ALLOWED_USER_ID: { label: 'Allowed User ID',      description: 'Discord user ID that is allowed to interact with the bot.' },
      HEARTBEAT_INTERVAL_MINS: { label: 'Interval (minutes)',      description: 'How often the heartbeat runs in minutes. Default: 30.' },
      HEARTBEAT_MAX_SIZE:      { label: 'Max File Size (bytes)',   description: 'Maximum size of heartbeat.md before history is summarized. Default: 50000.' },
      CRONTAB_GRACE_MINS:      { label: 'Cron Grace Window (min)', description: 'How many minutes after the scheduled time a cron task may still be executed. Default: 30.' },
      WEB_PORT:                { label: 'Port',                 description: 'Port for the web UI. Default: 3000.' },
      WEB_HOST:                { label: 'Host',                 description: 'Bind address. 127.0.0.1 = local only, 0.0.0.0 = all interfaces.' },
      WHATSAPP_ENABLED:        { label: 'Enable WhatsApp',      description: 'Enable the WhatsApp integration. Requires a QR scan on first start.' },
      WHATSAPP_PHONE:          { label: 'Allowed Phone',        description: 'Phone number allowed to interact with the bot (e.g. +491234567890). Note: this is sometimes not your real number — check terminal logging after first connect.' },
      WHISPER_LOCAL_ENABLED:   { label: 'Start Local Whisper',  description: 'Automatically start the Whisper Docker container on app startup.' },
      WHISPER_URL:             { label: 'Whisper URL',          description: 'URL of the local Whisper ASR API. Default: http://localhost:9000' },
      WHATSAPP_SEND_PHONE:     { label: 'Send-To Phone',        description: 'Phone number to send heartbeat and web UI messages to. Defaults to Allowed Phone if not set.' },
      ELEVENLABS_ENABLED:      { label: 'Enable ElevenLabs',    description: 'Enable or disable text-to-speech output via ElevenLabs.' },
      ELEVENLABS_API_KEY:      { label: 'API Key',              description: 'ElevenLabs API key from the ElevenLabs dashboard.' },
      ELEVENLABS_VOICE:        { label: 'Voice',                description: 'Select the language and voice for text-to-speech output.' },
    },
  },
  web: {
    serverRunning: (host, port) => `[Web] BigClaudia running at http://${host}:${port}`,
    processingError: '[Web] Processing error:',
  },
  chat: {
    sessionReset: 'Session reset. ✓',
    restarting: 'Restarting server… ⟳',
    error: (msg) => `Error: ${msg}`,
  },
  ui: {
    htmlLang: 'en',
    locale: 'en-US',
    loading: 'Loading\u2026',
    overview: 'Overview',
    entries: 'Entries',
    fileSize: 'File size',
    timestamps: 'Timestamps',
    botStarted: 'Bot started',
    lastHeartbeat: 'Last heartbeat',
    instructions: 'Instructions',
    executionHistory: 'Execution History',
    noEntries: 'No entries yet.',
    compressedSummary: 'Compressed Summary',
    noMessages: 'No messages yet. Write something!',
    messagePlaceholder: 'Write a message\u2026 (Enter to send, Shift+Enter = new line)',
    sendButton: 'Send',
    stopButton: 'Stop',
    chatHint: '/new \u2192 Reset session &nbsp;\u00b7&nbsp; /restart \u2192 Restart server &nbsp;\u00b7&nbsp; Shift+Enter \u2192 new line',
    sessionReset: 'Session reset.',
    notRunYet: 'not run yet',
    noInstructionsSet: 'No instructions set.',
    sendError: 'Send error:',
    maxLabel: 'Max:',
    tabInsights: 'Insights',
    consoleOutput: 'Console',
    tabCrontab: 'Crontab',
    noCrontabEntries: 'No scheduled tasks.',
    tabChat: 'Chat',
    tabSettings: 'Settings',
    settingsSaveBtn: 'Save',
    settingsRestartBtn: 'Restart',
    settingsSaved: 'Settings saved.',
    settingsRestarting: 'Restarting…',
    settingsRestartConfirm: 'Restart the server now to apply new settings?',
    settingsShutdownBtn: 'Shutdown',
    settingsShutdownConfirm: 'Shut down the server? You will need to restart it manually.',
    settingsShuttingDown: 'Shutting down…',
    whatsappQrTitle: 'Scan with WhatsApp',
    whatsappQrHint: 'Open WhatsApp → Linked Devices → Link a Device\nand scan this QR code.',
    whatsappAuthenticated: 'WhatsApp connected ✓',
  },
};
