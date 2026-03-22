const t = require('./i18n');

const WHISPER_URL = process.env.WHISPER_URL || 'http://localhost:9000';

/**
 * Transcribes an audio buffer using the local Whisper ASR service.
 * @param {Buffer} audioBuffer  – raw audio data (ogg, mp3, wav, …)
 * @param {string} filename     – original filename (used for MIME hint)
 * @param {string} [language]   – optional BCP-47 language hint, e.g. "de"
 * @returns {Promise<string>}   – transcribed text
 */
async function transcribe(audioBuffer, filename = 'audio.ogg', language = null) {
  const blob = new Blob([audioBuffer], { type: mimeFromFilename(filename) });
  const form = new FormData();
  form.append('audio_file', blob, filename);

  const params = new URLSearchParams({ output: 'json' });
  if (language) params.set('language', language);

  const url = `${WHISPER_URL}/asr?${params}`;
  console.log(t.whisper.sending(filename, audioBuffer.length));

  const res = await fetch(url, { method: 'POST', body: form });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(t.whisper.httpError(res.status, body));
  }

  const json = await res.json();
  const text = (json.text || '').trim();

  if (!text) throw new Error(t.whisper.emptyResult);

  console.log(t.whisper.success(text.substring(0, 120)));
  return text;
}

function mimeFromFilename(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map = {
    ogg: 'audio/ogg', opus: 'audio/opus', mp3: 'audio/mpeg',
    wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4',
    webm: 'audio/webm',
  };
  return map[ext] || 'application/octet-stream';
}

module.exports = { transcribe };
