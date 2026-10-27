/**
 * Texte der Oberfläche an einer Stelle: Anrede «Sie» (docs/ux/README.md, UX-E7, bis zur Klärung von UX-OF-1),
 * Schweizer Rechtschreibung ohne Eszett, «Organisation» statt Mandant. `texts.test.ts` prüft diese Regeln über alle
 * Quelldateien.
 */
export const T = {
  app: 'PPM',
  nav: { main: 'Navigation', ziele: 'Ziele', palette: 'Befehle', skip: 'Zum Inhalt springen', open: 'Navigation öffnen', omni: 'Seiten und Befehle suchen …' },
  theme: { label: 'Farbschema', light: 'Hell', dark: 'Dunkel', system: 'Wie System', toggle: 'Hell/Dunkel umschalten' },
  palette: { title: 'Befehle', placeholder: 'Befehl oder Seite suchen …', empty: 'Nichts gefunden.', hint: 'Strg+K' },
  common: {
    save: 'Speichern', cancel: 'Abbrechen', close: 'Schliessen', delete: 'Löschen', edit: 'Bearbeiten', retry: 'Erneut versuchen',
    reload: 'Neu laden', more: 'Mehr laden', loading: 'Wird geladen …', search: 'Suchen', error: 'Etwas ist schiefgegangen.',
  },
  notFound: { title: 'Seite nicht gefunden', text: 'Diese Seite gibt es nicht (mehr). Prüfen Sie die Adresse oder kehren Sie zur Übersicht zurück.', back: 'Zur Übersicht' },
  handlungsfeld: {
    title: 'Handlungsfelder', sub: 'Strategische Handlungsfelder mit Leitsatz und Stossrichtungen, oberste Ordnung für Ziele und Vorhaben.', one: 'Handlungsfeld', create: 'Neues Handlungsfeld', search: 'Handlungsfelder durchsuchen',
    empty: 'Noch keine Handlungsfelder erfasst. Die Handlungsfelder der Strategie ordnen Ziele und Vorhaben.',
    emptySearch: 'Kein Handlungsfeld passt zur Suche.',
    label: 'Bezeichnung', leitsatz: 'Leitsatz', stossrichtungen: 'Stossrichtungen', position: 'Reihenfolge',
    stossrichtungenHint: 'Eine Stossrichtung je Zeile.', noLeitsatz: 'kein Leitsatz', noStossrichtungen: 'keine Stossrichtungen',
    created: 'Handlungsfeld angelegt.', saved: 'Änderungen gespeichert.', deleted: 'Handlungsfeld gelöscht.',
    confirmDelete: (label: string) => `«${label}» wirklich löschen? Der Verlauf bleibt im Protokoll erhalten.`,
    conflict: 'Dieses Handlungsfeld wurde inzwischen geändert. Laden Sie es neu und übernehmen Sie Ihre Änderungen danach nochmals.',
    gone: 'Dieses Handlungsfeld gibt es nicht mehr, oder Sie sehen es nicht.',
    history: 'Verlauf', version: (v: number) => `Fassung ${v}`,
    actions: { created: 'angelegt', updated: 'geändert', deleted: 'gelöscht' } as Record<string, string>,
    noRight: 'Sie können Handlungsfelder nur ansehen.',
    labelMissing: 'Geben Sie eine Bezeichnung ein.', tooMany: 'Höchstens 20 Stossrichtungen.', positionInvalid: 'Ganze Zahl von 0 bis 999.',
  },
} as const;
