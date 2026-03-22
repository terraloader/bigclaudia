/**
 * Splits long text into chunks that fit within a character limit,
 * preferring newline boundaries.
 * @param {string} text
 * @param {number} maxLength
 * @returns {string[]}
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

module.exports = { splitMessage };
