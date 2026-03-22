const { Client, GatewayIntentBits, ChannelType, Partials } = require('discord.js');
const t = require('./i18n');

const ALLOWED_USER_ID = process.env.DISCORD_ALLOWED_USER_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,   // Privileged Intent – must be enabled in the Discord Dev Portal!
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message], // required for receiving DMs
});

let messageHandler = null;

/**
 * Starts the bot and waits until it is ready.
 */
async function start() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error(t.discord.tokenMissing);
  if (!ALLOWED_USER_ID) throw new Error(t.discord.userIdMissing);

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Only messages from the authorized user ID
    if (message.author.id !== ALLOWED_USER_ID) {
      console.log(t.discord.unknownId(message.author.id));
      return;
    }

    const isDM = message.channel.type === ChannelType.DM;
    const isMention = message.mentions.has(client.user);

    // In guild channels only respond when mentioned; always respond in DMs
    if (!isDM && !isMention) return;

    if (messageHandler) {
      await messageHandler(message);
    }
  });

  client.once('ready', () => {
    console.log(t.discord.loggedInAs(client.user.tag));
  });

  await client.login(token);

  // Wait until ready
  if (!client.isReady()) {
    await new Promise((resolve) => client.once('ready', resolve));
  }
}

/**
 * Registers the handler for incoming messages.
 * @param {(message: import('discord.js').Message) => Promise<void>} handler
 */
function onMessage(handler) {
  messageHandler = handler;
}

/**
 * Sends a DM to the authorized user (DISCORD_ALLOWED_USER_ID).
 */
async function send(text) {
  if (!ALLOWED_USER_ID) throw new Error(t.discord.userIdMissing);
  const user = await client.users.fetch(ALLOWED_USER_ID);
  const dm = await user.createDM();
  for (const chunk of splitMessage(text)) {
    await dm.send(chunk);
  }
}

/**
 * Sends text to a channel, splitting at 2000-char limit.
 */
async function sendToChannel(channel, text) {
  for (const chunk of splitMessage(text)) {
    await channel.send(chunk);
  }
}

/**
 * Replies to a Discord message.
 * In DMs: plain message without quote. In guild channels: as a reply (with quote).
 */
async function reply(message, text) {
  const isDM = message.channel.type === ChannelType.DM;
  for (const chunk of splitMessage(text)) {
    if (isDM) {
      await message.channel.send(chunk);
    } else {
      await message.reply(chunk);
    }
  }
}

/**
 * Continuously refreshes the "typing..." indicator every 8 s until stopped.
 * Returns a stop function.
 */
function keepTyping(channel) {
  channel.sendTyping().catch(() => {});
  const interval = setInterval(() => channel.sendTyping().catch(() => {}), 8000);
  return () => clearInterval(interval);
}

/**
 * Splits long text into chunks of ≤ 2000 characters.
 */
function splitMessage(text, maxLength = 1990) {
  const chunks = [];
  while (text.length > maxLength) {
    let splitAt = text.lastIndexOf('\n', maxLength);
    if (splitAt < maxLength * 0.5) splitAt = maxLength;
    chunks.push(text.slice(0, splitAt));
    text = text.slice(splitAt).trimStart();
  }
  if (text) chunks.push(text);
  return chunks;
}

/**
 * Sends an image file as DM to the authorized user.
 */
async function sendImageFile(filePath) {
  if (!ALLOWED_USER_ID) throw new Error(t.discord.userIdMissing);
  const fs = require('fs');
  const path = require('path');
  const buffer = fs.readFileSync(filePath);
  const filename = path.basename(filePath);
  const user = await client.users.fetch(ALLOWED_USER_ID);
  const dm = await user.createDM();
  await dm.send({ files: [{ attachment: buffer, name: filename }] });
}

/**
 * Sends a file (Buffer) as DM to the authorized user.
 */
async function sendFile(buffer, filename) {
  if (!ALLOWED_USER_ID) throw new Error(t.discord.userIdMissing);
  const user = await client.users.fetch(ALLOWED_USER_ID);
  const dm = await user.createDM();
  await dm.send({ files: [{ attachment: buffer, name: filename }] });
}

function isEnabled() {
  const v = (process.env.DISCORD_ENABLED ?? 'false').toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function isConfigured() {
  return isEnabled() && !!(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_ALLOWED_USER_ID);
}

async function destroy() {
  if (client.isReady()) {
    client.user.setStatus('invisible');
    await new Promise((r) => setTimeout(r, 500));
  }
  client.destroy();
}

module.exports = { start, onMessage, send, sendFile, sendImageFile, sendToChannel, reply, keepTyping, isConfigured, destroy };
