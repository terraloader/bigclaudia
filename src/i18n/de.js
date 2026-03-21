module.exports = {
  bot: {
    starting: '[Bot] Starte...',
    heartbeatInterval: (mins) => `[Bot] Heartbeat-Intervall: ${mins} Minuten`,
    heartbeatCreated: '[Bot] heartbeat.md nicht gefunden – aus heartbeat.md.example erstellt.',
    running: '[Bot] Läuft.',
    stopping: '\n[Bot] Beende...',
    fatalError: '[Bot] Fataler Fehler:',
  },
  heartbeat: {
    startingAt: (ts) => `[Heartbeat] Starte Routine um ${ts}`,
    noInstructions: '[Heartbeat] Keine Anweisungen gefunden, überspringe.',
    claudeDone: '[Heartbeat] Claude fertig:',
    fileSize: (size, max) => `[Heartbeat] heartbeat.md: ${size} / ${max} Bytes`,
    compressing: '[Heartbeat] Komprimiere heartbeat.md...',
    newSize: (size) => `[Heartbeat] Neue Größe: ${size} Bytes`,
    error: '[Heartbeat] Fehler:',
    instructionsUpdated: (via) => `[Heartbeat] Anweisungen aktualisiert via ${via}.`,
    compressedLabel: (date) => `**[Komprimiert am ${date}]**`,
    systemPrompt: `Du bist ein autonomer Agent, der regelmäßig ausgeführt wird. Du hast Zugriff auf einen Discord-Kanal.

Deine Aufgaben stehen in den Anweisungen. Führe sie aus und gib strukturiert zurück:
- "discord_messages": Array mit Nachrichten an Discord (leer = keine)
- "summary": kurze Zusammenfassung was du getan hast

Regeln:
- Schreibe auf Deutsch, außer wenn anders angewiesen
- Discord-Nachrichten: freundlich, max. 2000 Zeichen pro Nachricht

Crontab:
Wenn die Anweisungen einen ## Crontab-Abschnitt enthalten, verarbeite ihn wie folgt:
- Jeder Eintrag hat das Format: every [day|weekday] at HH:MM [am|pm]: Aufgabenbeschreibung
- Berechne für jeden Eintrag den letzten vergangenen geplanten Zeitpunkt relativ zum aktuellen Zeitstempel
- Suche im ## History-Abschnitt nach einer Ausführung dieser Aufgabe nach dem letzten geplanten Zeitpunkt
- Wenn kein solcher Eintrag existiert, ist die Aufgabe fällig – führe sie jetzt aus
- Füge ausgeführte Crontab-Aufgaben in deine Zusammenfassung ein`,

    userMessage: (instructions, history) =>
      `## Anweisungen\n${instructions}\n\n## Bisherige Historie\n${history || '(keine)'}

---
Führe die Anweisungen aus und gib das JSON-Ergebnis zurück.`,
  },
  discord: {
    messageFrom: (tag, text) => `[Discord] Nachricht von ${tag}: ${text}`,
    error: '[Discord] Fehler:',
    sendError: '[Discord] Sendefehler:',
    mirrorFailed: '[Discord] Spiegeln fehlgeschlagen:',
    loggedInAs: (tag) => `[Discord] Bot eingeloggt als ${tag}`,
    unknownId: (id) => `[Discord] Nachricht von unbekannter ID ${id} ignoriert.`,
    tokenMissing: 'DISCORD_BOT_TOKEN nicht gesetzt',
    userIdMissing: 'DISCORD_ALLOWED_USER_ID nicht gesetzt',
  },
  claude: {
    summarizing: '[Claude] Fasse Historie zusammen...',
    invalidJson: (raw) => `Claude CLI Ausgabe kein gültiges JSON:\n${raw}`,
    cliError: (msg) => `Claude CLI Fehler: ${msg}`,
    noStructuredResult: (raw) => `Kein strukturiertes Ergebnis:\n${raw}`,
    startFailed: (msg) => `Claude CLI konnte nicht gestartet werden: ${msg}`,
    exitCode: (code, stderr) => `Claude CLI Code ${code}:\n${stderr}`,
    roleUser: 'Nutzer',
    roleAssistant: 'Assistent',
    summarizePrompt: (history) =>
      `Fasse die folgende Ausführungshistorie eines autonomen Agenten prägnant zusammen. Behalte wichtige Fakten, Entscheidungen und Muster. Schreibe auf Deutsch. Gib nur den zusammengefassten Markdown-Text zurück, ohne Einleitung.\n\n## Bisherige Historie\n${history}`,
    chatSystemPrompt: (instructions) =>
      `Du bist ein hilfreicher, freundlicher Assistent mit Zugriff auf einen autonomen Heartbeat-Agenten.

## Aktuelle Heartbeat-Anweisungen
${instructions || '(keine Anweisungen gesetzt)'}

## Aufgaben
- Beantworte Fragen und führe Gespräche
- Wenn der User die Heartbeat-**Anweisungen** ändern möchte, füge am absoluten Ende deiner Antwort (nach einer Leerzeile) exakt diesen Block hinzu:

<update_instructions>
[vollständige neue Anweisungen – kein ## Crontab-Abschnitt]
</update_instructions>

- Wenn der User die **Crontab / geplante Aufgaben** ändern möchte, füge am absoluten Ende deiner Antwort (nach einer Leerzeile) exakt diesen Block hinzu:

<update_crontab>
every day at 09:00 am: Beispielaufgabe
every weekday at 06:00 pm: Weitere Aufgabe
</update_crontab>

Der Inhalt von <update_crontab> darf nur die Aufgaben-Zeilen enthalten (kein ## Heading, keine Kommentare). Um alle Aufgaben zu löschen, sende einen leeren Block.
Diese Blöcke werden dem Nutzer nicht angezeigt.
- Bestätige alle Änderungen im normalen Antworttext.
- Antworte auf Deutsch, außer der Nutzer schreibt in einer anderen Sprache.

## Crontab / Zeitplanung
- Wenn der Nutzer "cron", "crontab", "schedule" oder "scheduler" erwähnt, meint er geplante Aufgaben für den Heartbeat-Agenten – verwende den <update_crontab>-Block.
- Nur wenn der Nutzer explizit "system-cron" oder "system-crontab" sagt, meint er etwas außerhalb des Heartbeats (z.B. den Cron-Daemon des Betriebssystems).`,
  },
  settings: {
    groups: {
      general:   'Allgemein',
      claude:    'Claude',
      discord:   'Discord',
      heartbeat: 'Heartbeat',
      webServer: 'Webserver',
    },
    fields: {
      LANGUAGE:                { label: 'Sprache',                  description: 'Sprache für UI und Logs.' },
      CLAUDE_MODEL:            { label: 'Modell',                   description: 'Modell-Alias: opus, sonnet, haiku – oder eine vollständige Modell-ID.' },
      CLAUDE_BIN:              { label: 'CLI-Pfad',                 description: 'Pfad zur Claude-CLI-Binary. Leer lassen, um "claude" aus dem PATH zu verwenden.' },
      DISCORD_ENABLED:         { label: 'Discord aktivieren',       description: 'Discord-Bot-Integration vollständig aktivieren oder deaktivieren.' },
      DISCORD_BOT_TOKEN:       { label: 'Bot-Token',                description: 'Discord-Bot-Token aus dem Discord Developer Portal.' },
      DISCORD_ALLOWED_USER_ID: { label: 'Erlaubte Nutzer-ID',       description: 'Discord-Nutzer-ID, die mit dem Bot interagieren darf.' },
      HEARTBEAT_INTERVAL_MINS: { label: 'Intervall (Minuten)',      description: 'Wie oft der Heartbeat läuft, in Minuten. Standard: 30.' },
      HEARTBEAT_MAX_SIZE:      { label: 'Max. Dateigröße (Bytes)',   description: 'Maximale Größe von heartbeat.md bevor die Historie zusammengefasst wird. Standard: 50000.' },
      WEB_PORT:                { label: 'Port',                     description: 'Port für die Web-UI. Standard: 3000.' },
      WEB_HOST:                { label: 'Host',                     description: 'Bind-Adresse. 127.0.0.1 = nur lokal, 0.0.0.0 = alle Schnittstellen.' },
    },
  },
  web: {
    serverRunning: (host, port) => `[Web] BigClaudia läuft auf http://${host}:${port}`,
    processingError: '[Web] Verarbeitungsfehler:',
  },
  chat: {
    sessionReset: 'Session zurückgesetzt. ✓',
    error: (msg) => `Fehler: ${msg}`,
  },
  ui: {
    htmlLang: 'de',
    locale: 'de-DE',
    loading: 'Lade\u2026',
    overview: 'Übersicht',
    entries: 'Einträge',
    fileSize: 'Dateigröße',
    timestamps: 'Zeitstempel',
    botStarted: 'Bot gestartet',
    lastHeartbeat: 'Letzter Heartbeat',
    instructions: 'Anweisungen',
    executionHistory: 'Ausführungshistorie',
    noEntries: 'Noch keine Einträge.',
    noMessages: 'Noch keine Nachrichten. Schreib etwas!',
    messagePlaceholder: 'Nachricht schreiben\u2026 (Enter zum Senden, Shift+Enter = Zeilenumbruch)',
    sendButton: 'Senden',
    stopButton: 'Stopp',
    chatHint: '/new \u2192 Session zurücksetzen &nbsp;\u00b7&nbsp; Shift+Enter \u2192 Zeilenumbruch',
    sessionReset: 'Session zurückgesetzt.',
    notRunYet: 'noch nicht gelaufen',
    noInstructionsSet: 'Keine Anweisungen gesetzt.',
    sendError: 'Sendefehler:',
    maxLabel: 'Max:',
    tabInsights: 'Einblicke',
    tabCrontab: 'Crontab',
    noCrontabEntries: 'Keine geplanten Aufgaben.',
    tabChat: 'Chat',
    tabSettings: 'Einstellungen',
    settingsSaveBtn: 'Speichern',
    settingsRestartBtn: 'Neustart',
    settingsSaved: 'Einstellungen gespeichert.',
    settingsRestarting: 'Neustart läuft…',
    settingsRestartConfirm: 'Server jetzt neu starten, um die neuen Einstellungen anzuwenden?',
  },
};
