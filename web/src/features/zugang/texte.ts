/**
 * Texte für Zugang entziehen und Neubesetzung (UC-016 A1, AP-E7-8; Namensraum = Feature, fachmodell.md 7.2). Anrede
 * «Du»; sichtbar «Organisation», nie «Mandant».
 */
const anzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

export const Z = {
  bereich: 'Zugänge',
  titel: 'Zugänge',
  sub: 'Zugang entziehen, wenn jemand die Organisation verlässt – mit den Rollen und Aufgaben, die neu zu besetzen sind.',
  entziehen: 'Zugang entziehen',
  aktionEntziehen: 'Zugang entziehen …',
  filter: { titel: 'Anzeige', alle: 'Alle', offen: 'Nur offene' },
  liste: {
    titel: 'Entzogene Zugänge',
    leer: 'Noch kein Zugang entzogen. Verlässt jemand die Organisation, entziehst du hier den Zugang; die Rollen, die neu zu besetzen sind, erscheinen dann hier und als Aufgabe im Eingang.',
    leerOffen: 'Keine offene Neubesetzung.',
    person: 'Person', entzogen: 'Entzogen', rollen: 'Rollen', stand: 'Stand',
    rollenText: (offen: number, alle: number) => (alle === 0 ? 'keine' : offen === 0 ? `${alle} neu besetzt` : `${offen} von ${alle} offen`),
    erledigt: 'erledigt', offen: 'offen', nichts: 'nichts zu tun',
    von: (wer: string) => `durch ${wer}`,
  },
  form: {
    person: 'Person', personHint: 'Name eingeben und Person wählen.', suchen: 'Person suchen', keineTreffer: 'Keine Person gefunden.',
    gewaehlt: (name: string) => `Gewählt: ${name}`, aendern: 'Andere Person wählen',
    personFehlt: 'Wähle die Person, deren Zugang du entziehst.',
    selbst: 'Den eigenen Zugang kannst du nicht entziehen.',
  },
  vorschau: {
    titel: 'Was mit dem Zugang entfällt',
    orgRollen: 'Rollen in der Organisation',
    rollen: 'Rollen in Projekten und Portfolios – neu zu besetzen',
    aufgaben: 'Offene Aufgaben',
    keine: 'keine',
    wirkung: (name: string, rollen: number, aufgaben: number) =>
      `${name} wird aus der Organisation entfernt und verliert alle Rollen. ${rollen || aufgaben
        ? `Danach liegt in deinem Eingang die Aufgabe «Rollen von ${name} neu besetzen» (${[rollen ? anzahl(rollen, 'Rolle', 'Rollen') : null, aufgaben ? anzahl(aufgaben, 'offene Aufgabe', 'offene Aufgaben') : null].filter(Boolean).join(', ')}).`
        : 'Es bleibt nichts neu zu besetzen.'}`,
  },
  frage: (name: string) => `Zugang von ${name} entziehen?`,
  frageText: 'Die Person wird aus der Organisation entfernt. Rückgängig machen geht nur, indem du sie neu einlädst und die Rollen neu vergibst.',
  entzogen: (name: string) => `Zugang von ${name} entzogen.`,
  detail: {
    titel: (name: string) => `Neubesetzung: ${name}`,
    sub: (datum: string, wer: string | null) => `Zugang entzogen am ${datum}${wer ? ` durch ${wer}` : ''}.`,
    zurueck: 'Zu den Zugängen',
    rollen: 'Rollen, die neu zu besetzen sind',
    rollenLeer: 'Die Person hatte keine Rollen in Projekten oder Portfolios.',
    ort: 'Ort', rolle: 'Rolle', stand: 'Stand', aktion: 'Aktion', besetzt: 'neu besetzt', offen: 'offen', oeffnen: 'Öffnen',
    ortUnbekannt: (typ: string) => `${typ} (nicht sichtbar)`,
    aufgaben: 'Offene Aufgaben der Person',
    aufgabenLeer: 'Keine offenen Aufgaben mehr.',
    aufgabenHint: 'Diese Aufgaben gehen noch an die Person, die keinen Zugang mehr hat. Kläre mit der neuen Besetzung, wer sie übernimmt.',
    erledigt: 'Alle Rollen sind neu besetzt und die Aufgabe ist erledigt.',
    offenHint: 'Besetze die Rollen dort neu, wo sie vergeben werden (z. B. in der Projektorganisation). Erledige danach die Aufgabe im Eingang.',
    zumEingang: 'Zum Eingang',
  },
  // Kopfkarte im Eingang (informationsarchitektur.md «Startseite je Rolle», ADM): nur mit offenen Neubesetzungen
  kopfkarte: {
    titel: 'Zugänge',
    offen: (n: number) => (n === 1 ? '1 Person mit Rollen zum Neubesetzen' : `${n} Personen mit Rollen zum Neubesetzen`),
    person: (name: string) => `Rollen von ${name} neu besetzen`,
  },
} as const;
