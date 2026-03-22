/**
 * Image helper: manages a project-temp folder for received images.
 * Images from Web UI, Discord, and WhatsApp are saved here and
 * referenced via @/path/to/file.png when sent to Claude CLI.
 */

const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '..', 'temp');

/** Ensures the temp directory exists. */
function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Saves a Buffer as an image file in the temp directory.
 * Returns the absolute path to the saved file.
 */
function saveImage(buffer, filename) {
  ensureTempDir();
  const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const filePath = path.join(TEMP_DIR, safeName);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * Saves a base64-encoded image to the temp directory.
 * Returns the absolute path to the saved file.
 */
function saveBase64Image(base64Data, filename) {
  const buffer = Buffer.from(base64Data, 'base64');
  return saveImage(buffer, filename);
}

/**
 * Downloads an image from a URL and saves it to the temp directory.
 * Returns the absolute path to the saved file.
 */
async function downloadAndSave(url, filename) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return saveImage(buffer, filename);
}

/**
 * Formats image paths as Claude CLI @-references to append to a user message.
 * Claude Code CLI reads images via "@/path/to/file.png".
 */
function formatImageRefs(imagePaths) {
  if (!imagePaths || imagePaths.length === 0) return '';
  return '\n\n' + imagePaths.map(p => `here is the image: @${p}`).join('\n');
}

/**
 * Formats document paths as Claude CLI @-references to append to a user message.
 * Claude Code CLI reads files via "@/path/to/file.ext".
 */
function formatDocumentRefs(docPaths) {
  if (!docPaths || docPaths.length === 0) return '';
  return '\n\n' + docPaths.map(p => `here is the document: @${p}`).join('\n');
}

/**
 * Cleans up temp files older than maxAge (default: 24 hours).
 */
function cleanupOldFiles(maxAgeMs = 24 * 60 * 60 * 1000) {
  ensureTempDir();
  const now = Date.now();
  try {
    for (const file of fs.readdirSync(TEMP_DIR)) {
      const filePath = path.join(TEMP_DIR, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (err) {
    console.error('[images] cleanup error:', err.message);
  }
}

module.exports = { TEMP_DIR, ensureTempDir, saveImage, saveBase64Image, downloadAndSave, formatImageRefs, formatDocumentRefs, cleanupOldFiles };
