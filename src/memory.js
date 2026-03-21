const fs = require('fs').promises;
const path = require('path');

const HEARTBEAT_FILE = path.join(__dirname, '..', 'heartbeat.md');
const HEARTBEAT_EXAMPLE_FILE = path.join(__dirname, '..', 'heartbeat.md.example');
const MAX_SIZE = parseInt(process.env.HEARTBEAT_MAX_SIZE || '50000', 10);

const INSTRUCTIONS_START = '## Instructions';
const INSTRUCTIONS_COMMENT_END = '-->';
const HISTORY_START = '## History';
const HISTORY_COMMENT_END = '-->';

/**
 * Creates heartbeat.md from heartbeat.md.example if it does not exist.
 * Returns true if the file was created, false if it already existed.
 */
async function initHeartbeat() {
  try {
    await fs.access(HEARTBEAT_FILE);
    return false;
  } catch {
    await fs.copyFile(HEARTBEAT_EXAMPLE_FILE, HEARTBEAT_FILE);
    return true;
  }
}

/**
 * Reads heartbeat.md and extracts instructions and history.
 */
async function readHeartbeat() {
  const content = await fs.readFile(HEARTBEAT_FILE, 'utf-8');

  const instructionsMatch = content.match(
    /## Instructions\s*(?:<!--[^>]*-->\s*)?([\s\S]*?)(?=\n## |$)/
  );
  const historyMatch = content.match(
    /## History\s*(?:<!--[^>]*-->\s*)?([\s\S]*?)$/
  );

  const instructions = instructionsMatch ? instructionsMatch[1].trim() : '';
  const history = historyMatch ? historyMatch[1].trim() : '';

  return { instructions, history, raw: content };
}

/**
 * Appends a new entry to the history in heartbeat.md.
 */
async function appendToHistory(summary) {
  const { instructions, history } = await readHeartbeat();
  const timestamp = new Date().toISOString();
  const newEntry = `\n### ${timestamp}\n${summary}\n`;
  const updatedHistory = history + newEntry;

  const newContent = `# Heartbeat\n\n## Instructions\n<!-- Current instructions for the agent -->\n\n${instructions}\n\n## History\n<!-- Execution history is automatically appended here -->\n${updatedHistory}`;
  await fs.writeFile(HEARTBEAT_FILE, newContent, 'utf-8');
}

/**
 * Overwrites heartbeat.md completely (after summarization).
 */
async function writeHeartbeat(instructions, summarizedHistory) {
  const content = `# Heartbeat\n\n## Instructions\n<!-- Current instructions for the agent -->\n\n${instructions}\n\n## History\n<!-- Execution history is automatically appended here -->\n\n${summarizedHistory}\n`;
  await fs.writeFile(HEARTBEAT_FILE, content, 'utf-8');
}

/**
 * Returns true if the file exceeds the maximum size.
 */
async function needsSummarization() {
  const stats = await fs.stat(HEARTBEAT_FILE);
  return stats.size > MAX_SIZE;
}

/**
 * Returns the current file size in bytes.
 */
async function getFileSize() {
  const stats = await fs.stat(HEARTBEAT_FILE);
  return stats.size;
}

/**
 * Replaces only the instructions section, leaving history unchanged.
 */
async function updateInstructions(newInstructions) {
  const { history } = await readHeartbeat();
  const content = `# Heartbeat\n\n## Instructions\n<!-- Current instructions for the agent -->\n\n${newInstructions}\n\n## History\n<!-- Execution history is automatically appended here -->\n${history ? '\n' + history : ''}`;
  await fs.writeFile(HEARTBEAT_FILE, content, 'utf-8');
}

module.exports = {
  initHeartbeat,
  readHeartbeat,
  appendToHistory,
  writeHeartbeat,
  updateInstructions,
  needsSummarization,
  getFileSize,
  MAX_SIZE,
};
