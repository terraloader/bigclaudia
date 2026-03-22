const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const t = require('./i18n');
const { splitMessage } = require('./utils/splitting');

const ALLOWED_PHONE = process.env.WHATSAPP_PHONE;      // incoming: filter messages from this number
const SEND_PHONE    = process.env.WHATSAPP_SEND_PHONE; // outgoing: send heartbeat/mirror messages here

let client = null;
let messageHandler = null;
let currentQR = null;      // base64 PNG data URL, null when authenticated
let authenticated = false;

function createClient() {
  return new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  });
}

/**
 * Starts the WhatsApp client. Emits QR for scanning; resolves once authenticated.
 */
async function start() {
  if (!ALLOWED_PHONE) throw new Error(t.whatsapp.phoneMissing);

  client = createClient();

  client.on('qr', async (qr) => {
    currentQR = await qrcode.toDataURL(qr);
    authenticated = false;
    console.log(t.whatsapp.qrReady);
  });

  client.on('ready', () => {
    currentQR = null;
    authenticated = true;
    console.log(t.whatsapp.loggedIn);
  });

  client.on('message', async (message) => {
    // Ignore own messages and groups
    if (message.fromMe) return;
    if (message.from.includes('@g.us')) return;

    // Only accept messages from the allowed phone number
    const fromPhone = '+' + message.from.replace('@c.us', '');
    const normalised = ALLOWED_PHONE.replace(/\s+/g, '').replace(/^\+/, '');
    if (!message.from.startsWith(normalised)) {
      console.log(t.whatsapp.unknownPhone(fromPhone));
      return;
    }

    if (messageHandler) await messageHandler(message);
  });

  client.on('auth_failure', (msg) => {
    console.error(t.whatsapp.authFailed, msg);
  });

  client.on('disconnected', (reason) => {
    console.warn(t.whatsapp.disconnected, reason);
    authenticated = false;
  });

  await client.initialize();
}

/**
 * Registers the handler for incoming messages.
 */
function onMessage(handler) {
  messageHandler = handler;
}

/**
 * Sends a message to the configured allowed phone number.
 */
async function send(text) {
  if (!client || !authenticated) throw new Error(t.whatsapp.notReady);
  const phone = (SEND_PHONE || ALLOWED_PHONE || '').replace(/^\+/, '');
  if (!phone) throw new Error(t.whatsapp.phoneMissing);
  const chatId = phone + '@c.us';
  for (const chunk of splitMessage(text, 3900)) {
    await client.sendMessage(chatId, chunk);
  }
}

/**
 * Sends text to a specific chat (used when replying in-context).
 */
async function sendToChat(chat, text) {
  for (const chunk of splitMessage(text, 3900)) {
    await chat.sendMessage(chunk);
  }
}

/**
 * Sends an image file as a message.
 * If chat is provided, sends to that chat; otherwise sends to the configured phone.
 */
async function sendImage(imagePath, chat = null) {
  if (!client || !authenticated) throw new Error(t.whatsapp.notReady);
  const { MessageMedia } = require('whatsapp-web.js');
  const media = MessageMedia.fromFilePath(imagePath);

  if (chat) {
    await chat.sendMessage(media);
  } else {
    const phone = (SEND_PHONE || ALLOWED_PHONE || '').replace(/^\+/, '');
    if (!phone) throw new Error(t.whatsapp.phoneMissing);
    const chatId = phone + '@c.us';
    await client.sendMessage(chatId, media);
  }
}

/**
 * Sends an audio buffer as a voice message.
 * If chat is provided, sends to that chat; otherwise sends to the configured phone.
 */
async function sendAudio(audioBuffer, chat = null) {
  if (!client || !authenticated) throw new Error(t.whatsapp.notReady);
  const { MessageMedia } = require('whatsapp-web.js');
  const media = new MessageMedia('audio/mpeg', audioBuffer.toString('base64'), 'voice.mp3');

  if (chat) {
    await chat.sendMessage(media, { sendAudioAsVoice: true });
  } else {
    const phone = (SEND_PHONE || ALLOWED_PHONE || '').replace(/^\+/, '');
    if (!phone) throw new Error(t.whatsapp.phoneMissing);
    const chatId = phone + '@c.us';
    await client.sendMessage(chatId, media, { sendAudioAsVoice: true });
  }
}

/**
 * Continuously refreshes the typing indicator every 8 s until stopped.
 * Returns a stop function.
 */
function keepTyping(chat) {
  chat.sendStateTyping().catch(err => console.warn('[whatsapp] sendStateTyping failed:', err.message));
  const interval = setInterval(() => chat.sendStateTyping().catch(err => console.warn('[whatsapp] sendStateTyping failed:', err.message)), 8000);
  return () => clearInterval(interval);
}

/**
 * Returns the current QR code as a data URL, or null if already authenticated.
 */
function getQR() {
  return { qr: currentQR, authenticated };
}


function isEnabled() {
  const v = (process.env.WHATSAPP_ENABLED ?? 'false').toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function isConfigured() {
  return isEnabled() && !!process.env.WHATSAPP_PHONE;
}

async function destroy() {
  if (client) {
    await client.destroy().catch(() => {});
    client = null;
  }
}

module.exports = { start, onMessage, send, sendImage, sendAudio, sendToChat, keepTyping, getQR, isConfigured, destroy };
