const fs = require('fs').promises;
const path = require('path');

const HEARTBEAT_FILE = path.join(__dirname, '..', 'heartbeat.md');
const HEARTBEAT_EXAMPLE_FILE = path.join(__dirname, '..', 'heartbeat.md.example');
const MAX_SIZE = parseInt(process.env.HEARTBEAT_MAX_SIZE || '50000', 10);


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
 * Reads heartbeat.md and extracts instructions, crontab section, and history in one read.
 */
async function readHeartbeat() {
  const content = await fs.readFile(HEARTBEAT_FILE, 'utf-8');

  const instructionsMatch = content.match(
    /## Instructions\s*(?:<!--[^>]*-->\s*)?([\s\S]*?)(?=\n## |$)/
  );
  const crontabMatch = content.match(
    /\n(## Crontab[\s\S]*?)(?=\n## History|$)/
  );
  const historyMatch = content.match(
    /## History\s*(?:<!--[^>]*-->\s*)?([\s\S]*?)$/
  );

  const instructions = instructionsMatch ? instructionsMatch[1].trim() : '';
  const crontabRaw = crontabMatch ? '\n\n' + crontabMatch[1].trimEnd() : '';
  const history = historyMatch ? historyMatch[1].trim() : '';

  return { instructions, crontabRaw, history, raw: content };
}

/**
 * Appends a new entry to the history in heartbeat.md.
 */
async function appendToHistory(summary) {
  const { instructions, crontabRaw, history } = await readHeartbeat();
  const timestamp = new Date().toISOString();
  const newEntry = `\n### ${timestamp}\n${summary}\n`;
  const updatedHistory = history + newEntry;

  const newContent = `# Heartbeat\n\n## Instructions\n<!-- Current instructions for the agent -->\n\n${instructions}${crontabRaw}\n\n## History\n<!-- Execution history is automatically appended here -->\n${updatedHistory}`;
  await fs.writeFile(HEARTBEAT_FILE, newContent, 'utf-8');
}

/**
 * Overwrites heartbeat.md completely (after summarization).
 */
async function writeHeartbeat(instructions, summarizedHistory, crontabRaw = '') {
  const content = `# Heartbeat\n\n## Instructions\n<!-- Current instructions for the agent -->\n\n${instructions}${crontabRaw}\n\n## History\n<!-- Execution history is automatically appended here -->\n\n${summarizedHistory}\n`;
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
  const { crontabRaw, history } = await readHeartbeat();
  // Strip any ## Crontab section Claude may have included in newInstructions
  // to prevent duplication (the existing one is preserved via crontabRaw).
  const pureInstructions = newInstructions.replace(/\n*## Crontab[\s\S]*$/, '').trim();
  const content = `# Heartbeat\n\n## Instructions\n<!-- Current instructions for the agent -->\n\n${pureInstructions}${crontabRaw}\n\n## History\n<!-- Execution history is automatically appended here -->\n${history ? '\n' + history : ''}`;
  await fs.writeFile(HEARTBEAT_FILE, content, 'utf-8');
}

/**
 * Replaces only the crontab section, leaving instructions and history unchanged.
 */
async function updateCrontab(newCrontabContent) {
  const { instructions, history } = await readHeartbeat();
  const crontabRaw = newCrontabContent.trim()
    ? `\n\n## Crontab\n<!-- Scheduled tasks. Format: every [day|weekday] at HH:MM [am|pm]: task description -->\n\n${newCrontabContent.trim()}`
    : `\n\n## Crontab\n<!-- Scheduled tasks. Format: every [day|weekday] at HH:MM [am|pm]: task description -->`;
  const content = `# Heartbeat\n\n## Instructions\n<!-- Current instructions for the agent -->\n\n${instructions}${crontabRaw}\n\n## History\n<!-- Execution history is automatically appended here -->\n${history ? '\n' + history : ''}`;
  await fs.writeFile(HEARTBEAT_FILE, content, 'utf-8');
}

module.exports = {
  initHeartbeat,
  readHeartbeat,
  appendToHistory,
  writeHeartbeat,
  updateInstructions,
  updateCrontab,
  needsSummarization,
  getFileSize,
  MAX_SIZE,
};
