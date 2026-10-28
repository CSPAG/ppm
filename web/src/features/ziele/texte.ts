/**
 * Texte des Features «Ziele» (Namensraum je Feature, docs/fachmodell.md 7.2): Anrede «Du» (UX-E7), Schweizer
 * Rechtschreibung, Begriffe der Ebenen aus K6 («Handlungsfeld», «Strategisches Ziel»).
 */
import { NAV } from './nav.ts';

export const TZ = {
  bereich: NAV.ziele,
  aktionAnlegen: NAV.aktionAnlegen,
  title: 'Strategische Ziele',
  sub: 'Mehrjahresziele je Handlungsfeld mit Metrik und Zielwert; jede Änderung bleibt im Verlauf nachvollziehbar.',
  one: 'Strategisches Ziel',
  create: 'Neues strategisches Ziel',
  search: 'Strategische Ziele durchsuchen',
  empty: 'Noch keine strategischen Ziele erfasst. Strategische Ziele halten je Handlungsfeld fest, was bis zum Horizont erreicht sein soll.',
  emptySearch: 'Kein strategisches Ziel passt zur Suche.',
  nummer: 'Nummer', text: 'Ziel', handlungsfeld: 'Handlungsfeld', horizont: 'Horizont', metrik: 'Metrik', zielwert: 'Zielwert',
  nummerHint: 'Ziffern mit Punkten, z. B. 2.1; eindeutig in der Organisation.',
  horizontHint: 'Zieljahr; strategische Ziele sind die Ziele 2030.',
  metrikFehlt: 'Metrik fehlt',
  metrikFehltHinweis: 'Dieses Ziel hat noch keine Metrik. Ergänze Metrik und Zielwert, damit sich die Erreichung beurteilen lässt.',
  keinZielwert: 'kein Zielwert',
  handlungsfeldWaehlen: 'Handlungsfeld wählen',
  handlungsfeldUnbekannt: 'Handlungsfeld nicht sichtbar',
  keineHandlungsfelder: 'Erfasse zuerst ein Handlungsfeld; jedes strategische Ziel gehört zu einem Handlungsfeld.',
  created: 'Strategisches Ziel angelegt.', saved: 'Änderungen gespeichert.', deleted: 'Strategisches Ziel gelöscht.',
  confirmDelete: (nummer: string) => `Strategisches Ziel ${nummer} wirklich löschen? Der Verlauf bleibt erhalten.`,
  conflict: 'Dieses Ziel wurde inzwischen geändert. Lade es neu und übernimm deine Änderungen danach nochmals.',
  nummerVergeben: 'Diese Nummer ist bereits vergeben. Wähle eine andere Nummer.',
  gone: 'Dieses strategische Ziel gibt es nicht mehr, oder du siehst es nicht.',
  history: 'Verlauf', version: (v: number) => `Fassung ${v}`,
  actions: { created: 'angelegt', updated: 'geändert', deleted: 'gelöscht' } as Record<string, string>,
  vorher: 'vorher',
  noRight: 'Du kannst strategische Ziele nur ansehen.',
  nummerInvalid: 'Gib eine Nummer aus Ziffern und Punkten ein, z. B. 2.1.',
  textMissing: 'Formuliere das Ziel.',
  handlungsfeldMissing: 'Wähle ein Handlungsfeld.',
  horizontInvalid: 'Jahr von 2000 bis 2100.',
};
