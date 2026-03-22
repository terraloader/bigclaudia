/**
 * ElevenLabs Text-to-Speech integration.
 *
 * Provides voice synthesis via the ElevenLabs API.
 * Audio is returned as an MP3 buffer that can be sent as a voice message
 * to Discord, WhatsApp, and the Web UI.
 */

const t = require('./i18n');

const API_BASE = 'https://api.elevenlabs.io/v1';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getApiKey() {
  return process.env.ELEVENLABS_API_KEY || '';
}

function isEnabled() {
  const v = (process.env.ELEVENLABS_ENABLED ?? 'false').toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function isConfigured() {
  return isEnabled() && !!getApiKey();
}

/**
 * Merges verified_languages and languages arrays by language_id,
 * so we get all supported languages while keeping verified status info.
 */
function mergeLanguages(verified = [], all = []) {
  const map = new Map();
  for (const lang of all) {
    if (lang && lang.language_id) map.set(lang.language_id, { ...lang });
  }
  for (const lang of verified) {
    if (lang && lang.language_id) {
      map.set(lang.language_id, { ...map.get(lang.language_id), ...lang, verified: true });
    }
  }
  if (map.size === 0) return all.length ? all : verified;
  return Array.from(map.values());
}

// ─── Voices ─────────────────────────────────────────────────────────────────

/** Cached voice list – refreshed on demand via fetchVoices(). */
let cachedVoices = null;

/**
 * Fetches all available voices from ElevenLabs.
 * Returns an array of { voice_id, name, category, labels }.
 */
async function fetchVoices() {
  const key = getApiKey();
  if (!key) throw new Error(t.elevenlabs.noApiKey);

  const res = await fetch(`${API_BASE}/voices`, {
    headers: { 'xi-api-key': key },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(t.elevenlabs.httpError(res.status, body));
  }

  const data = await res.json();
  cachedVoices = (data.voices || []).map((v) => ({
    voice_id: v.voice_id,
    name: v.name,
    category: v.category || 'unknown',
    labels: v.labels || {},
    languages: mergeLanguages(v.verified_languages, v.languages),
    preview_url: v.preview_url || null,
    multilingual: Array.isArray(v.high_quality_base_model_ids)
      && v.high_quality_base_model_ids.some(id => /multilingual/i.test(id)),
  }));

  console.log(t.elevenlabs.voicesLoaded(cachedVoices.length));
  return cachedVoices;
}

/**
 * Returns the currently selected voice ID.
 * Falls back to the first premade voice, or the very first voice available.
 */
async function getSelectedVoice() {
  const configured = process.env.ELEVENLABS_VOICE;
  if (configured) return configured;

  // Fetch voices if not cached
  const voices = cachedVoices || (await fetchVoices());
  if (!voices.length) throw new Error(t.elevenlabs.noVoices);

  // Prefer first premade (free) voice
  const premade = voices.find((v) => v.category === 'premade');
  return premade ? premade.voice_id : voices[0].voice_id;
}

/**
 * Returns the cached voices or fetches them.
 */
async function getVoices() {
  return cachedVoices || (await fetchVoices());
}

// ─── Text-to-Speech ─────────────────────────────────────────────────────────

/**
 * Synthesizes text to speech and returns an MP3 buffer.
 *
 * @param {string} text - The text to speak
 * @param {string} [voiceId] - Override voice ID (defaults to selected voice)
 * @returns {Promise<Buffer>} MP3 audio buffer
 */
async function synthesize(text, voiceId) {
  const key = getApiKey();
  if (!key) throw new Error(t.elevenlabs.noApiKey);

  const voice = voiceId || (await getSelectedVoice());

  console.log(t.elevenlabs.synthesizing(text.substring(0, 80), voice));

  const res = await fetch(`${API_BASE}/text-to-speech/${voice}`, {
    method: 'POST',
    headers: {
      'xi-api-key': key,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(t.elevenlabs.httpError(res.status, body));
  }

  const arrayBuf = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);

  console.log(t.elevenlabs.synthesized(buffer.length));
  return buffer;
}

module.exports = {
  isEnabled,
  isConfigured,
  fetchVoices,
  getVoices,
  getSelectedVoice,
  synthesize,
};
