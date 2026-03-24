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
    systemPrompt: (graceMins) => `Du bist ein autonomer Agent, der regelmäßig ausgeführt wird. Du kannst Nachrichten an den Nutzer senden.

Deine Aufgaben stehen in den Anweisungen. Führe sie aus und gib strukturiert zurück:
- "messages": Array mit Nachrichten an den Nutzer (leer = keine)
- "summary": kurze Zusammenfassung was du getan hast

Regeln:
- Nachrichten: freundlich, max. 2000 Zeichen pro Nachricht
- Um eine Sprachnachricht zu senden, füge einen <speak>Text</speak>-Block in die Nachricht ein. Der Text darin wird über ElevenLabs in Sprache umgewandelt und als Audio-Nachricht zusammen mit dem Text gesendet.
- Sende keine Nachrichten über die Ausführung von Cron-Aufgaben, es sei denn, der Cron-Eintrag selbst wird ausgeführt und enthält ausdrücklich eine Nachrichten-Aufgabe.

## Crontab-Ausführungsregeln
Wenn ein ## Crontab-Abschnitt vorhanden ist, verarbeite jeden Eintrag wie folgt:
- Eintragsformat: every [day|weekday] at HH:MM [am|pm]: Aufgabenbeschreibung
- Der aktuelle Zeitstempel steht am Ende der Nutzernachricht.
- Für jeden Eintrag:
  1. Berechne den letzten vergangenen geplanten Zeitpunkt relativ zum aktuellen Zeitstempel.
  2. Prüfe ob (aktuelle Zeit − geplante Zeit) ≤ ${graceMins} Minuten. Falls das Toleranzfenster überschritten ist, überspringe diesen Eintrag.
  3. Suche im ## History-Abschnitt nach einer Zeile mit [CRON], die genau diesen Eintrag referenziert UND ein executed_at nach dem berechneten geplanten Zeitpunkt hat. Wenn gefunden, wurde die Aufgabe bereits ausgeführt – überspringe sie.
  4. Wenn nicht gefunden und im Toleranzfenster: führe die Aufgabe jetzt aus.
  5. Für jede ausgeführte Crontab-Aufgabe füge genau diese Zeile in deine Zusammenfassung ein (eine pro Aufgabe):
     [CRON] schedule="<vollständiger Eintragstext>" scheduled_at="<ISO-Zeitstempel>" executed_at="<aktueller ISO-Zeitstempel>" task="<Aufgabenbeschreibung>"`,

    userMessage: (instructions, crontabRaw, history) =>
      `## Anweisungen\n${instructions}${crontabRaw ? '\n\n' + crontabRaw : ''}\n\n## Bisherige Historie\n${history || '(keine)'}

---
Aktueller Zeitstempel: ${new Date().toString()}
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
      `Du bist ein hilfreicher, freundlicher Assistent mit Zugriff auf einen autonomen Heartbeat-Agenten. Dein Name ist "BigClaudia". Du bist eine neue Generation der KI: Du lebst auf einem PC und kannst mehr als nur Texte beantworten. Du bist ein Node.js-Prozess verpackt in einer Electron-App bzw. Webseite und hast eine Web-UI.

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

Der Inhalt von <update_crontab> darf nur die Aufgaben-Zeilen enthalten (kein ## Heading, keine Kommentare). Wiederhole alle alten Aufgaben, um sie beizubehalten. Um alle Aufgaben zu löschen, sende einen leeren Block.
Diese Blöcke werden dem Nutzer nicht angezeigt.
- Bestätige alle Änderungen im normalen Antworttext.

## Crontab / Zeitplanung
- Wenn der Nutzer "cron", "crontab", "schedule" oder "scheduler" erwähnt, meint er geplante Aufgaben für den Heartbeat-Agenten – verwende den <update_crontab>-Block.
- Nur wenn der Nutzer explizit "system-cron" oder "system-crontab" sagt, meint er etwas außerhalb des Heartbeats (z.B. den Cron-Daemon des Betriebssystems).

## Sprachausgabe (Text-to-Speech)
- Wenn ElevenLabs aktiviert ist und du eine Sprachnachricht senden möchtest, verpacke den gesprochenen Text in einen <speak>-Tag:

<speak>Hallo! Dieser Text wird in Sprache umgewandelt und als Sprachnachricht verschickt.</speak>

- Der <speak>-Block wird dem Nutzer NICHT als Text angezeigt – er dient nur zur Audio-Erzeugung.
- Du kannst mehrere <speak>-Blöcke in einer Antwort verwenden für separate Sprachnachrichten.
- Nutze <speak>, wenn der Nutzer Sprachausgabe wünscht, oder wenn eine Sprachnachricht natürlich wirkt (z.B. Begrüßungen, kurze Ankündigungen, emotionale Nachrichten).
- Halte gesprochenen Text kurz und natürlich – schreibe ihn so, wie man ihn sprechen würde.
- Nutze <speak> NICHT für lange oder komplexe Antworten – nur für kurze, gesprochene Nachrichten.`,
  },
  whatsapp: {
    qrReady: '[WhatsApp] QR-Code bereit – mit WhatsApp-Handy scannen.',
    loggedIn: '[WhatsApp] Eingeloggt.',
    authFailed: '[WhatsApp] Authentifizierung fehlgeschlagen:',
    disconnected: '[WhatsApp] Verbindung getrennt:',
    phoneMissing: 'WHATSAPP_PHONE nicht gesetzt',
    notReady: '[WhatsApp] Client nicht bereit.',
    unknownPhone: (phone) => `[WhatsApp] Nachricht von unbekannter Nummer ${phone} ignoriert.`,
    error: '[WhatsApp] Fehler:',
    sendError: '[WhatsApp] Sendefehler:',
    mirrorFailed: '[WhatsApp] Spiegeln fehlgeschlagen:',
  },
  whisper: {
    sending: (file, bytes) => `[Whisper] Sende ${file} (${bytes} Bytes) zur Transkription...`,
    httpError: (status, body) => `Whisper-API HTTP ${status}: ${body}`,
    emptyResult: 'Whisper hat keinen Text erkannt.',
    success: (text) => `[Whisper] Transkribiert: ${text}`,
    transcribing: '[Discord] Sprachnachricht erkannt – transkribiere...',
    transcribeError: (msg) => `Sprachnachricht konnte nicht transkribiert werden: ${msg}`,
    alreadyRunning: '[Whisper] Lokaler Container läuft bereits.',
    starting: (port) => `[Whisper] Starte lokalen Docker-Container auf Port ${port}...`,
    started: '[Whisper] Lokaler Container gestartet.',
    stopped: '[Whisper] Lokaler Container gestoppt.',
    startError: (msg) => `[Whisper] Lokaler Container konnte nicht gestartet werden: ${msg}`,
  },
  elevenlabs: {
    noApiKey: 'ELEVENLABS_API_KEY nicht gesetzt.',
    httpError: (status, body) => `ElevenLabs-API HTTP ${status}: ${body}`,
    voicesLoaded: (n) => `[ElevenLabs] ${n} Stimmen geladen.`,
    noVoices: 'Keine ElevenLabs-Stimmen verfügbar.',
    synthesizing: (text, voice) => `[ElevenLabs] Synthetisiere "${text}…" mit Stimme ${voice}`,
    synthesized: (bytes) => `[ElevenLabs] Audio generiert: ${bytes} Bytes`,
    sendError: (msg) => `[ElevenLabs] Sendefehler: ${msg}`,
    speakError: (msg) => `[ElevenLabs] TTS-Fehler: ${msg}`,
  },
  settings: {
    groups: {
      general:   'Allgemein',
      claude:    'Claude',
      discord:   'Discord',
      heartbeat: 'Heartbeat',
      webServer: 'Webserver',
      whisper:   'Whisper (Sprache-zu-Text)',
      whatsapp:   'WhatsApp',
      elevenlabs: 'ElevenLabs (Text-zu-Sprache)',
    },
    fields: {
      LANGUAGE:                { label: 'Sprache',                  description: 'Sprache für UI und Logs.' },
      CLAUDE_MODEL:            { label: 'Modell',                   description: 'Modell-Alias: opus, sonnet, haiku – oder eine vollständige Modell-ID.' },
      CLAUDE_BIN:              { label: 'CLI-Pfad',                 description: 'Pfad zur Claude-CLI-Binary. Leer lassen, um "claude" aus dem PATH zu verwenden.' },
      DISCORD_ENABLED:         { label: 'Discord aktivieren',       description: 'Discord-Bot-Integration vollständig aktivieren oder deaktivieren.' },
      DISCORD_BOT_TOKEN:       { label: 'Bot-Token',                description: 'Discord-Bot-Token aus dem Discord Developer Portal.' },
      DISCORD_ALLOWED_USER_ID: { label: 'Erlaubte Nutzer-ID',       description: 'Discord-Nutzer-ID, die mit dem Bot interagieren darf.' },
      HEARTBEAT_INTERVAL_MINS: { label: 'Intervall (Minuten)',         description: 'Wie oft der Heartbeat läuft, in Minuten. Standard: 30.' },
      HEARTBEAT_MAX_SIZE:      { label: 'Max. Dateigröße (Bytes)',     description: 'Maximale Größe von heartbeat.md bevor die Historie zusammengefasst wird. Standard: 50000.' },
      CRONTAB_GRACE_MINS:      { label: 'Cron-Toleranzfenster (Min)', description: 'Wie viele Minuten nach dem geplanten Zeitpunkt ein Cron-Job noch ausgeführt werden darf. Standard: 30.' },
      WEB_PORT:                { label: 'Port',                     description: 'Port für die Web-UI. Standard: 3000.' },
      WEB_HOST:                { label: 'Host',                     description: 'Bind-Adresse. 127.0.0.1 = nur lokal, 0.0.0.0 = alle Schnittstellen.' },
      SUPPRESS_CHANNELS_ON_FOCUS: { label: 'Kanäle bei Fokus unterdrücken', description: 'Wenn aktiviert, werden Nachrichten nicht an Discord/WhatsApp weitergeleitet, solange der Web-UI-Tab fokussiert ist.' },
      WHATSAPP_ENABLED:        { label: 'WhatsApp aktivieren',      description: 'WhatsApp-Integration aktivieren. Beim ersten Start ist ein QR-Scan erforderlich.' },
      WHATSAPP_PHONE:          { label: 'Erlaubte Nummer',          description: 'Telefonnummer, die mit dem Bot interagieren darf (z.B. +491234567890). Hinweis: Dies ist manchmal nicht die eigene Nummer – bitte Terminal-Logs nach dem ersten Verbinden prüfen.' },
      WHISPER_LOCAL_ENABLED:   { label: 'Lokales Whisper starten',    description: 'Whisper-Docker-Container beim App-Start automatisch starten.' },
      WHISPER_URL:             { label: 'Whisper-URL',               description: 'URL der lokalen Whisper-ASR-API. Standard: http://localhost:9000' },
      WHATSAPP_SEND_PHONE:     { label: 'Sende-Nummer',             description: 'Nummer, an die Heartbeat- und Web-UI-Nachrichten gesendet werden. Wenn nicht gesetzt, wird die erlaubte Nummer verwendet.' },
      ELEVENLABS_ENABLED:      { label: 'ElevenLabs aktivieren',    description: 'Text-zu-Sprache-Ausgabe über ElevenLabs aktivieren oder deaktivieren.' },
      ELEVENLABS_API_KEY:      { label: 'API-Key',                  description: 'ElevenLabs API-Key aus dem ElevenLabs Dashboard.' },
      ELEVENLABS_VOICE:        { label: 'Stimme',                   description: 'Sprache und Stimme für die Text-zu-Sprache-Ausgabe auswählen.' },
    },
  },
  web: {
    serverRunning: (host, port) => `[Web] BigClaudia läuft auf http://${host}:${port}`,
    processingError: '[Web] Verarbeitungsfehler:',
  },
  chat: {
    sessionReset: 'Session zurückgesetzt. ✓',
    stopped: 'Gestoppt. ■',
    restarting: 'Server wird neu gestartet… ⟳',
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
    compressedSummary: 'Komprimierte Zusammenfassung',
    noMessages: 'Noch keine Nachrichten. Schreib etwas!',
    messagePlaceholder: 'Nachricht schreiben\u2026',
    sendButton: 'Senden',
    stopButton: 'Stopp',
    chatHint: '/new \u2192 Session zurücksetzen &nbsp;\u00b7&nbsp; /stop \u2192 Antwort stoppen &nbsp;\u00b7&nbsp; /restart \u2192 Server neustarten &nbsp;\u00b7&nbsp; Shift+Enter \u2192 Zeilenumbruch',
    sessionReset: 'Session zurückgesetzt.',
    notRunYet: 'noch nicht gelaufen',
    noInstructionsSet: 'Keine Anweisungen gesetzt.',
    sendError: 'Sendefehler:',
    maxLabel: 'Max:',
    tabInsights: 'Insights',
    consoleOutput: 'Konsole',
    tabCrontab: 'Crontab',
    noCrontabEntries: 'Keine geplanten Aufgaben.',
    tabChat: 'Chat',
    tabSettings: 'Einstellungen',
    settingsSaveBtn: 'Speichern',
    settingsRestartBtn: 'Neustart',
    settingsSaved: 'Einstellungen gespeichert.',
    settingsRestarting: 'Neustart läuft…',
    settingsRestartConfirm: 'Server jetzt neu starten, um die neuen Einstellungen anzuwenden?',
    settingsShutdownBtn: 'Herunterfahren',
    settingsShutdownConfirm: 'Server herunterfahren? Du musst ihn manuell neu starten.',
    settingsShuttingDown: 'Fährt herunter…',
    whatsappQrTitle: 'Mit WhatsApp scannen',
    whatsappQrHint: 'WhatsApp öffnen → Verknüpfte Geräte → Gerät verknüpfen\nund diesen QR-Code scannen.',
    whatsappAuthenticated: 'WhatsApp verbunden ✓',
    thinking: 'Denkt nach',
    toolUse: 'Tool-Aufruf',
    redactedThinking: 'Geschwärztes Denken',
    thinkingSummary: (seconds, chars) => `Nachgedacht für ${seconds} Sekunden, ${chars} Zeichen lang.`,
    toolUseSummary: (seconds, chars, name) => `Tool aufgerufen${name ? ' (' + name + ')' : ''} für ${seconds} Sekunden, ${chars} Zeichen lang.`,
    redactedThinkingSummary: (seconds) => `Geschwärztes Denken für ${seconds} Sekunden.`,
    channels: 'Kanäle',
  },
};
