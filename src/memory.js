const fs = require('fs').promises;
const path = require('path');

const SOUL_FILE             = path.join(__dirname, '..', 'SOUL.md');
const SCHEDULE_FILE         = path.join(__dirname, '..', 'SCHEDULE.md');
const SCHEDULE_HISTORY_FILE = path.join(__dirname, '..', 'SCHEDULE_HISTORY.md');

// Legacy file (used only for migration in initHeartbeat)
const HEARTBEAT_FILE         = path.join(__dirname, '..', 'heartbeat.md');
const HEARTBEAT_EXAMPLE_FILE = path.join(__dirname, '..', 'heartbeat.md.example');

const MAX_SIZE = parseInt(process.env.HEARTBEAT_MAX_SIZE || '50000', 10);

/**
 * Reads a file safely, returning empty string on error.
 */
async function readFileSafe(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Extracts the body of a file below the first <!-- comment --> header line.
 * Falls back to the full content if no such header is found.
 */
function extractBody(content) {
  const match = content.match(/^#[^\n]*\n(?:<!--[^>]*-->\n)?\n?([\s\S]*)$/);
  return match ? match[1].trim() : content.trim();
}

/**
 * Extracts crontab task lines from a crontabRaw string (legacy format).
 * crontabRaw looks like: "\n\n## Crontab\n<!-- ... -->\n\n<lines>"
 */
function parseCrontabLines(crontabRaw) {
  if (!crontabRaw) return '';
  const match = crontabRaw.match(/## Crontab\s*(?:<!--[^>]*-->\s*)?([\s\S]*?)$/);
  return match ? match[1].trim() : '';
}

/**
 * Creates SOUL.md, SCHEDULE.md, and SCHEDULE_HISTORY.md if they do not exist.
 * Migrates content from the legacy heartbeat.md if available.
 * Returns true if any file was created, false if all already existed.
 */
async function initHeartbeat() {
  const missing = await Promise.all(
    [SOUL_FILE, SCHEDULE_FILE, SCHEDULE_HISTORY_FILE].map(f =>
      fs.access(f).then(() => false).catch(() => true)
    )
  );

  if (!missing.some(Boolean)) return false;

  // Try to read legacy heartbeat.md for migration
  let instructions = '';
  let crontabLines = '';
  let history = '';

  let legacyContent = '';
  try { legacyContent = await fs.readFile(HEARTBEAT_FILE, 'utf-8'); } catch {
    try { legacyContent = await fs.readFile(HEARTBEAT_EXAMPLE_FILE, 'utf-8'); } catch {}
  }

  if (legacyContent) {
    const im = legacyContent.match(/## Instructions\s*(?:<!--[^>]*-->\s*)?([\s\S]*?)(?=\n## |$)/);
    const cm = legacyContent.match(/## Crontab\s*(?:<!--[^>]*-->\s*)?([\s\S]*?)(?=\n## |$)/);
    const hm = legacyContent.match(/## History\s*(?:<!--[^>]*-->\s*)?([\s\S]*?)$/);
    instructions = im ? im[1].trim() : '';
    crontabLines = cm ? cm[1].trim() : '';
    history      = hm ? hm[1].trim() : '';
  }

  if (missing[0]) {
    await fs.writeFile(
      SOUL_FILE,
      `# Soul\n<!-- BigClaudia instructions -->\n\n${instructions}\n`,
      'utf-8'
    );
  }
  if (missing[1]) {
    await fs.writeFile(
      SCHEDULE_FILE,
      `# Schedule\n<!-- Scheduled tasks. Format: every [day|weekday] at HH:MM [am|pm]: task description -->\n\n${crontabLines}\n`,
      'utf-8'
    );
  }
  if (missing[2]) {
    await fs.writeFile(
      SCHEDULE_HISTORY_FILE,
      `# Schedule History\n<!-- Execution history is automatically appended here -->\n\n${history}\n`,
      'utf-8'
    );
  }

  return true;
}

/**
 * Reads SOUL.md, SCHEDULE.md, and SCHEDULE_HISTORY.md and returns the parsed
 * sections in the same shape as before (instructions, crontabRaw, history, raw).
 */
async function readHeartbeat() {
  const [soulContent, scheduleContent, historyContent] = await Promise.all([
    readFileSafe(SOUL_FILE),
    readFileSafe(SCHEDULE_FILE),
    readFileSafe(SCHEDULE_HISTORY_FILE),
  ]);

  const instructions = extractBody(soulContent);
  const crontabLines = extractBody(scheduleContent);
  const history      = extractBody(historyContent);

  const crontabRaw = crontabLines
    ? `\n\n## Crontab\n<!-- Scheduled tasks. Format: every [day|weekday] at HH:MM [am|pm]: task description -->\n\n${crontabLines}`
    : `\n\n## Crontab\n<!-- Scheduled tasks. Format: every [day|weekday] at HH:MM [am|pm]: task description -->`;

  // Build a virtual "raw" for any code that still reads the full content
  const raw = `# Heartbeat\n\n## Instructions\n<!-- Current instructions for the agent -->\n\n${instructions}${crontabRaw}\n\n## History\n<!-- Execution history is automatically appended here -->\n${history ? '\n' + history : ''}`;

  return { instructions, crontabRaw, history, raw };
}

/**
 * Appends a new timestamped entry to SCHEDULE_HISTORY.md.
 */
async function appendToHistory(summary) {
  const historyContent = await readFileSafe(SCHEDULE_HISTORY_FILE);
  const history = extractBody(historyContent);

  const timestamp = new Date().toISOString();
  const newEntry   = `\n### ${timestamp}\n${summary}\n`;
  const updated    = history + newEntry;

  await fs.writeFile(
    SCHEDULE_HISTORY_FILE,
    `# Schedule History\n<!-- Execution history is automatically appended here -->\n\n${updated}`,
    'utf-8'
  );
}

/**
 * Overwrites all three files completely (used after history summarization).
 */
async function writeHeartbeat(instructions, summarizedHistory, crontabRaw = '') {
  const crontabLines = parseCrontabLines(crontabRaw);

  await Promise.all([
    fs.writeFile(
      SOUL_FILE,
      `# Soul\n<!-- BigClaudia instructions -->\n\n${instructions}\n`,
      'utf-8'
    ),
    fs.writeFile(
      SCHEDULE_FILE,
      `# Schedule\n<!-- Scheduled tasks. Format: every [day|weekday] at HH:MM [am|pm]: task description -->\n\n${crontabLines}\n`,
      'utf-8'
    ),
    fs.writeFile(
      SCHEDULE_HISTORY_FILE,
      `# Schedule History\n<!-- Execution history is automatically appended here -->\n\n${summarizedHistory}\n`,
      'utf-8'
    ),
  ]);
}

/**
 * Returns true if SCHEDULE_HISTORY.md exceeds the maximum size.
 */
async function needsSummarization() {
  const stats = await fs.stat(SCHEDULE_HISTORY_FILE);
  return stats.size > MAX_SIZE;
}

/**
 * Returns the current size of SCHEDULE_HISTORY.md in bytes.
 */
async function getFileSize() {
  const stats = await fs.stat(SCHEDULE_HISTORY_FILE);
  return stats.size;
}

/**
 * Replaces only the instructions section (SOUL.md), leaving schedule and history unchanged.
 */
async function updateInstructions(newInstructions) {
  // Strip any ## Crontab section Claude may have included to prevent duplication
  const pure = newInstructions.replace(/\n*## Crontab[\s\S]*$/, '').trim();
  await fs.writeFile(
    SOUL_FILE,
    `# Soul\n<!-- BigClaudia instructions -->\n\n${pure}\n`,
    'utf-8'
  );
}

/**
 * Replaces only the crontab section (SCHEDULE.md), leaving soul and history unchanged.
 */
async function updateCrontab(newCrontabContent) {
  const crontabLines = newCrontabContent.trim();
  await fs.writeFile(
    SCHEDULE_FILE,
    `# Schedule\n<!-- Scheduled tasks. Format: every [day|weekday] at HH:MM [am|pm]: task description -->\n\n${crontabLines}\n`,
    'utf-8'
  );
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
