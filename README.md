# BigClaudia

<p align="center">
  <img src="profile-small.webp" width="120" style="border-radius:50%" />
</p>

Inspired by [OpenClaw](https://github.com/OpenClaw/OpenClaw) — but built directly for Claude (Claude CLI)⁄. That makes it smarter, more direct, and by far less complicated. No plugin system, no elaborate config files, no abstraction layers. Just a lean Node.js process that connects Claude to your Discord and runs autonomously in the background.

---

> [!WARNING]
> **BigClaudia is not safe in any way.** It has full access to the system — but that is exactly what makes it smart. Keep in mind that BigClaudia can also modify herself while running (a Node.js restart is required for code changes to take effect).

---

## What it does

BigClaudia is an autonomous Claude agent with three modes of interaction:

- **Chat** — Talk to Claude in real time via Discord or the built-in web UI. Responses stream token by token.
- **Heartbeat** — A scheduled routine (default: every 30 minutes) where Claude reads its instructions and acts on them autonomously — posting to Discord, taking notes, or anything else you tell it to do.
- **Instruction updates** — Tell Claude in chat to change what it does in the heartbeat, and it will update its own instructions on the fly.

---

## Installation

**Requirements:**
- Node.js 18+
- [Claude CLI](https://github.com/anthropics/claude-code) installed and logged in (`claude` in PATH)

```bash
git clone <this-repo>
cd bigclaudia
npm install
cp .env.example .env
```

Edit `.env` with your settings (see Configuration below), then run:

```bash
npm start
```

On first start, `heartbeat.md` is automatically created from `heartbeat.md.example` if it does not exist.

---

## Configuration

Copy `.env.example` to `.env` and fill in the values:

| Variable | Default | Description |
|---|---|---|
| `CLAUDE_MODEL` | `opus` | Claude model alias (`opus`, `sonnet`, `haiku`) or full model ID |
| `CLAUDE_BIN` | `claude` | Path to the Claude CLI binary |
| `DISCORD_BOT_TOKEN` | — | Your Discord bot token (required for Discord features) |
| `DISCORD_ALLOWED_USER_ID` | — | The Discord user ID allowed to interact with the bot |
| `HEARTBEAT_INTERVAL_MS` | `1800000` | Heartbeat interval in milliseconds (default: 30 min) |
| `HEARTBEAT_MAX_SIZE` | `50000` | Max size of `heartbeat.md` in bytes before history is summarized (~50 KB) |
| `WEB_PORT` | `3000` | Port for the web UI |
| `WEB_HOST` | `127.0.0.1` | Host to bind to (`0.0.0.0` to expose on all interfaces) |
| `LANGUAGE` | `en` | UI and log language: `en` or `de` |

Discord integration is optional — if `DISCORD_BOT_TOKEN` is not set, the bot runs in web-only mode.

---

## Setting up a Discord bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**.
2. Give it a name (e.g. "BigClaudia"), then open the **Bot** tab on the left.
3. Click **Reset Token** and copy the token — paste it as `DISCORD_BOT_TOKEN` in your `.env`.
4. Under **Privileged Gateway Intents**, enable:
   - **Message Content Intent** — required to read message text
   - **Server Members Intent** — needed for DM resolution in some setups
5. Go to **OAuth2 → URL Generator**, select the `bot` scope and the following permissions:
   - Send Messages
   - Read Messages / View Channels
   - Read Message History
6. Open the generated URL in your browser and invite the bot to your server.

**Finding your user ID:**
In Discord, go to **Settings → Advanced** and enable **Developer Mode**. Then right-click your own name anywhere and choose **Copy ID**. Paste this as `DISCORD_ALLOWED_USER_ID`.

**Important things to know:**
- BigClaudia only responds to one user (the ID you set). All other messages are silently ignored.
- In guild (server) channels, the bot only responds when directly **@mentioned**. In DMs it always responds.
- The bot sends proactive messages (heartbeat, response chunks) as **DMs** to the allowed user, regardless of where the conversation started.
- Discord shows a live **typing...** indicator while Claude is generating, refreshed automatically so it never disappears mid-response.
- Long Claude responses are forwarded to Discord in chunks using a **3-second inactivity window** — a chunk is sent whenever the stream goes quiet for 3 seconds, to avoid rate limits and make long replies readable as they arrive.

---

## Components

### `src/index.js` — Orchestrator

The entry point. Wires everything together:
- Registers the web UI message processor
- Handles incoming Discord messages
- Runs the heartbeat on a configurable interval
- Manages the **message queue** — incoming messages (web or Discord) while Claude is busy are queued and processed in order
- Handles `/new` (reset session) and `/stop` (kill current Claude process)
- Streams Claude responses to Discord in real time using the chunker

### `src/claude.js` — Claude CLI bridge

Wraps the Claude CLI (`claude --print`) via `child_process.spawn`:
- **`askClaude`** — structured JSON output for the heartbeat (uses `--json-schema`)
- **`chatWithClaude`** — streaming NDJSON output for chat, calls `onDelta` per token
- **`summarizeHistory`** — condenses the heartbeat history when it gets too large
- **`killCurrentProcess`** — terminates the active Claude process (used by the stop button and `/stop`)

### `src/webserver.js` — Web UI + API

A minimal HTTP server (no framework) serving:
- **`GET /`** — Single-page web UI with Dashboard and Chat tabs
- **`GET /api/events`** — Server-Sent Events stream for real-time updates (chat messages, streaming chunks, session clears)
- **`POST /api/chat`** — Accepts a message, hands it to the processor asynchronously; response arrives via SSE
- **`POST /api/stop`** — Kills the current Claude process
- **`GET /api/heartbeat`** — JSON data for the dashboard (stats, instructions, history entries)

The chat UI features:
- Token-by-token streaming with a **skeleton shimmer** animation while Claude is thinking
- A **stop button** (red square) visible during generation
- **Queued messages** shown in italic until they are processed
- Markdown rendering via `marked.js`

### `src/discord.js` — Discord bot

Built on discord.js v14:
- Listens for DMs and @mentions from the allowed user
- **`send(text)`** — sends a DM to the allowed user; handles Discord's 2000-character limit automatically
- **`reply(message, text)`** — replies in the channel/DM where the message originated
- **`keepTyping(channel)`** — starts a repeating typing indicator (refreshes every 8 s) and returns a stop function; used to show "typing..." for the full duration of Claude's response

### `src/memory.js` — Heartbeat file

Manages `heartbeat.md`, a plain Markdown file with two sections:

```
## Instructions
Your tasks go here. Edit freely.

## History
Automatically appended after each heartbeat run.
```

- Reads/writes instructions and history separately
- Appends timestamped entries after each heartbeat
- Triggers automatic summarization when the file exceeds `HEARTBEAT_MAX_SIZE`
- Auto-creates `heartbeat.md` from `heartbeat.md.example` on first run

### `src/state.js` — Shared state

In-memory store shared between the web server and the Discord handler:
- `chatLog` — all messages in the current session
- `conversationHistory` — last 20 turns sent to Claude as context
- `sseClients` — active SSE connections
- `broadcastSSE(data)` — sends an event to all connected browsers
- `streamStart / streamChunk / streamEnd` — SSE events for token-by-token streaming

### `src/i18n/` — Internationalisation

All user-facing strings live in `en.js` and `de.js`. Select the language with `LANGUAGE=de` in `.env`. Defaults to English. Both the server-side logs and the client-side web UI are translated.

### `heartbeat.md`

Your live agent instructions file. Not committed to git (listed in `.gitignore`). Edit the `## Instructions` section to change what the agent does. The `## History` section is written by the agent itself. You can also change instructions by chatting with BigClaudia — it will update the file automatically.

---

## Web UI

Open `http://localhost:3000` in your browser.

**Dashboard tab** — shows current instructions, heartbeat history entries, file size, and timestamps.

**Chat tab** — live chat with Claude. Keyboard shortcuts:
- `Enter` — send message
- `Shift+Enter` — new line
- `/new` — reset the conversation session
- `/stop` — stop the current Claude response

Messages sent via the web UI are mirrored to Discord (user message immediately, Claude's response in streamed chunks). Messages sent via Discord are visible in the web UI chat in real time.
