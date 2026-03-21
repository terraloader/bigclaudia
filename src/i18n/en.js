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
    systemPrompt: `You are an autonomous agent that runs regularly. You have access to a Discord channel.

Your tasks are in the instructions. Execute them and return structured:
- "discord_messages": Array with messages to Discord (empty = none)
- "summary": brief summary of what you did

Rules:
- Write in English, unless otherwise instructed
- Discord messages: friendly, max. 2000 characters per message

Crontab:
If the instructions contain a ## Crontab section, process it as follows:
- Each entry has the format: every [day|weekday] at HH:MM [am|pm]: task description
- For each entry, calculate the most recent past scheduled time relative to the current timestamp
- Search the ## History section for an execution of that task after the most recent scheduled time
- If no such history entry exists, the task is due — execute it now as part of this run
- Include any executed crontab tasks in your summary`,

    userMessage: (instructions, history) =>
      `## Instructions\n${instructions}\n\n## Previous History\n${history || '(none)'}

---
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
- If the user wants to change the heartbeat, combine existing and new instructions and add exactly this block at the absolute end of your response (after a blank line):

<update_instructions>
[complete new instructions]
</update_instructions>

This block is not shown to the user.
- Confirm heartbeat changes in the normal response text.
- Respond in English, unless the user writes in another language.`,
  },
  web: {
    serverRunning: (host, port) => `[Web] BigClaudia running at http://${host}:${port}`,
    processingError: '[Web] Processing error:',
  },
  chat: {
    sessionReset: 'Session reset. ✓',
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
    noMessages: 'No messages yet. Write something!',
    messagePlaceholder: 'Write a message\u2026 (Enter to send, Shift+Enter = new line)',
    sendButton: 'Send',
    stopButton: 'Stop',
    chatHint: '/new \u2192 Reset session &nbsp;\u00b7&nbsp; Shift+Enter \u2192 new line',
    sessionReset: 'Session reset.',
    notRunYet: 'not run yet',
    noInstructionsSet: 'No instructions set.',
    sendError: 'Send error:',
    maxLabel: 'Max:',
    tabDashboard: 'Dashboard',
    tabChat: 'Chat',
  },
};
