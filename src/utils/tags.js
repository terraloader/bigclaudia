/**
 * Utilities for stripping and extracting custom XML-style tags from Claude responses.
 */

const CUSTOM_TAGS = ['speak', 'update_instructions', 'update_crontab'];

/**
 * Strips all known custom tags (and their content) from text.
 * @param {string} text
 * @returns {string}
 */
function stripCustomTags(text) {
  return CUSTOM_TAGS.reduce(
    (t, tag) => t.replace(new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, 'g'), ''),
    text
  ).trim();
}

module.exports = { stripCustomTags };
