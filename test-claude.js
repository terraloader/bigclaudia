#!/usr/bin/env node
require('dotenv').config();

const { askClaude, summarizeHistory } = require('./src/claude');

const prompt = process.argv[2] || 'Sag kurz Hallo und nenn dein Modell.';
const mode = process.argv[3];

async function run() {
  if (mode === '--summarize') {
    // Teste die Zusammenfassungs-Funktion
    console.log('[Test] Teste summarizeHistory...\n');
    const fakeHistory = `### 2026-03-20T10:00:00Z\nHabe eine Begrüßungsnachricht auf Discord gesendet.\n\n### 2026-03-20T10:30:00Z\nHabe über das Wetter berichtet. Nachricht erfolgreich zugestellt.`;
    const result = await summarizeHistory('Begrüße die Community', fakeHistory);
    console.log('Zusammenfassung:\n', result);
    return;
  }

  // Teste askClaude mit strukturiertem Output
  console.log(`[Test] Prompt: "${prompt}"\n`);

  const systemPrompt = `Du bist ein Test-Agent. Antworte kurz und prägnant auf Deutsch.`;
  const { discord_messages, summary } = await askClaude(systemPrompt, prompt);

  console.log('summary:', summary);
  console.log('discord_messages:', discord_messages);
}

run().catch((err) => {
  console.error('[Test] Fehler:', err.message);
  process.exit(1);
});
