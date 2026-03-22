/**
 * Central configuration — reads and parses all environment variables once.
 * Call validate() at startup to catch missing required variables early.
 */

function bool(key, defaultValue = false) {
  const v = (process.env[key] ?? String(defaultValue)).toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function num(key, defaultValue) {
  return parseInt(process.env[key] || String(defaultValue), 10);
}

const config = {
  // General
  language:                process.env.LANGUAGE || 'en',

  // Claude
  claudeBin:               process.env.CLAUDE_BIN || 'claude',
  claudeModel:             process.env.CLAUDE_MODEL || 'opus',

  // Web server
  webPort:                 num('WEB_PORT', 3000),
  webHost:                 process.env.WEB_HOST || '127.0.0.1',
  suppressChannelsOnFocus: bool('SUPPRESS_CHANNELS_ON_FOCUS', false),

  // Heartbeat
  heartbeatIntervalMs:     num('HEARTBEAT_INTERVAL_MINS', 30) * 60 * 1000,
  heartbeatMaxSize:        num('HEARTBEAT_MAX_SIZE', 50000),
  crontabGraceMins:        num('CRONTAB_GRACE_MINS', 30),

  // Discord
  discordEnabled:          bool('DISCORD_ENABLED', false),
  discordBotToken:         process.env.DISCORD_BOT_TOKEN || '',
  discordAllowedUserId:    process.env.DISCORD_ALLOWED_USER_ID || '',

  // WhatsApp
  whatsappEnabled:         bool('WHATSAPP_ENABLED', false),
  whatsappPhone:           process.env.WHATSAPP_PHONE || '',
  whatsappSendPhone:       process.env.WHATSAPP_SEND_PHONE || '',

  // ElevenLabs
  elevenLabsEnabled:       bool('ELEVENLABS_ENABLED', false),
  elevenLabsApiKey:        process.env.ELEVENLABS_API_KEY || '',
  elevenLabsVoice:         process.env.ELEVENLABS_VOICE || '',

  // Whisper
  whisperLocalEnabled:     bool('WHISPER_LOCAL_ENABLED', false),
  whisperUrl:              process.env.WHISPER_URL || 'http://localhost:9000',
  whisperLanguage:         process.env.WHISPER_LANGUAGE || null,
};

/**
 * Validates that required variables are set for enabled features.
 * Exits the process with a clear error message if any are missing.
 */
function validate() {
  const errors = [];

  if (config.discordEnabled) {
    if (!config.discordBotToken)    errors.push('DISCORD_BOT_TOKEN is required when DISCORD_ENABLED=true');
    if (!config.discordAllowedUserId) errors.push('DISCORD_ALLOWED_USER_ID is required when DISCORD_ENABLED=true');
  }

  if (config.whatsappEnabled) {
    if (!config.whatsappPhone)      errors.push('WHATSAPP_PHONE is required when WHATSAPP_ENABLED=true');
  }

  if (config.elevenLabsEnabled) {
    if (!config.elevenLabsApiKey)   errors.push('ELEVENLABS_API_KEY is required when ELEVENLABS_ENABLED=true');
  }

  if (errors.length > 0) {
    console.error('[config] Missing required environment variables:');
    errors.forEach(e => console.error(`  • ${e}`));
    process.exit(1);
  }
}

module.exports = { config, validate };
