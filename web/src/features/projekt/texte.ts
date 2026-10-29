/**
 * Texte des Features «Projekte» (Namensraum des Features, fachmodell.md 7.2): Anrede «Du», Schweizer Rechtschreibung,
 * Begriffe nach docs/ux/darstellung.md (Funktionen ausgeschrieben; weitere Funktionen als freier Text, A-72).
 */
import { NAV } from './nav.ts';
import type { StandFamilie } from '../../ui/index.ts';

type Funktion = 'sp' | 'pl' | 'weitere';
type Lebenszyklus = 'aktiv' | 'sistiert' | 'abgebrochen' | 'abgeschlossen' | 'zurueckgezogen';

export const TP = {
  bereich: NAV.bereich,
  titel: 'Projekte',
  sub: 'Projekte, in denen du eine Rolle hast oder die du sehen darfst. Öffne ein Projekt, um seine Projektakte zu führen.',
  suche: 'Projekte durchsuchen',
  sucheHinweis: 'Name oder Nummer',
  leer: 'Du bist noch in keinem Projekt eingetragen. Projekte entstehen aus freigegebenen Projektideen; Projektauftraggeber:in und Projektleitung legen danach die Projektorganisation fest.',
  leerGefiltert: 'Kein Projekt passt zu deiner Suche oder den Filtern.',
  oeffnen: 'Projektakte öffnen',
  // Filter (I-L1)
  filter: {
    rolle: 'Meine Rolle', rolleAlle: 'Alle Rollen', phase: 'Phase', phaseAlle: 'Alle Phasen', stand: 'Stand',
    laufend: 'Laufend', beendet: 'Beendet', alle: 'Alle',
  },
  spalte: {
    nummer: 'Nummer', handlungsfeld: 'Handlungsfeld', name: 'Projekt', projektleitung: 'Projektleitung', phase: 'Phase',
    portfolio: 'Portfolio', rollen: 'Meine Rolle', stand: 'Stand',
  },
  funktion: NAV.funktion satisfies Record<Funktion, string>,
  funktionLang: { sp: 'Projektauftraggeber:in', pl: 'Projektleitung', weitere: 'Weitere Funktion' } satisfies Record<Funktion, string>,
  lebenszyklus: {
    aktiv: 'aktiv', sistiert: 'sistiert', abgebrochen: 'abgebrochen', abgeschlossen: 'abgeschlossen', zurueckgezogen: 'zurückgezogen',
  } satisfies Record<Lebenszyklus, string>,
  // Bearbeitungsstand des Projekts (darstellung.md, Familien)
  familie: {
    aktiv: 'entwurf', sistiert: 'ruhend', abgebrochen: 'negativ', abgeschlossen: 'positiv', zurueckgezogen: 'ruhend',
  } satisfies Record<Lebenszyklus, StandFamilie>,
  vertraulich: 'vertraulich',
  vertraulichHinweis: 'Vertraulich: sichtbar nur für die Projektrollen, die Programmleitung und das Gremium des Portfolios.',
  keinePl: 'keine Projektleitung',
  // Projektakte (Rahmen)
  akte: {
    reiter: 'Bereiche der Projektakte', inhalt: 'Inhalt der Projektakte', uebersicht: NAV.uebersicht, zurueck: 'Zu den Projekten',
    nichtGefunden: 'Dieses Projekt gibt es nicht, oder du siehst es nicht.',
    beendet: (stand: string) => `Das Projekt ist ${stand}. Die Projektakte kann nur noch gelesen werden.`,
    sistiert: 'Das Projekt ist sistiert. Es wird mit einem Entscheid des Gremiums wieder aufgenommen.',
  },
  // Projektübersicht (UI-06, Bericht)
  uebersicht: {
    phasen: 'Phasen', angaben: 'Angaben', portfolio: 'Portfolio', kategorie: (k: string) => `Kategorie ${k}`, handlungsfeld: 'Handlungsfeld',
    keinHandlungsfeld: 'kein Handlungsfeld zugeordnet', phase: 'Phase', stand: 'Stand', erledigt: 'erledigt', aktuell: 'aktuell', offen: 'folgt',
  },
  // Projektorganisation (PP.04.04, UC-002 Schritt 2)
  org: {
    titel: 'Projektorganisation', bearbeiten: 'Projektorganisation bearbeiten', leer: 'Noch niemand benannt. Projektauftraggeber:in und Projektleitung legen die Projektorganisation fest.',
    nurLesen: 'Die Projektorganisation legen Projektauftraggeber:in, Projektleitung und Programmleitung fest.',
    funktion: 'Funktion', funktionText: 'Bezeichnung', funktionTextHint: 'z. B. Kernteam, CTL, PMO', textFehlt: 'Gib die Funktion an, z. B. Kernteam.',
    person: 'Person', akv: 'Aufgaben, Kompetenzen, Verantwortung', akvKurz: 'AKV', optional: 'optional',
    hinzufuegen: 'Person hinzufügen', entfernen: (n: number) => `Zeile ${n} entfernen`, zeile: (n: number) => `Zeile ${n}`,
    gespeichert: 'Projektorganisation gespeichert.',
    personFehlt: 'Wähle eine Person.',
    einzeln: (f: string) => `${f}: höchstens eine Person. Entferne eine der Zeilen.`,
    doppelt: 'Diese Person steht schon mit dieser Funktion in der Liste.',
    konflikt: 'Die Projektorganisation wurde inzwischen geändert. Lade den neuen Stand; deine Eingaben bleiben erhalten, die Wirkung zeigt dann die Unterschiede zum neuen Stand.',
    // Master Entscheid 16: die Projektorganisation ist ein Projektergebnis und vergibt keinen Zugriff
    keinZugriff: 'Die Projektorganisation vergibt keinen Zugriff. Wer am Projekt mitarbeiten soll, erhält ihn im Bereich «Zugriff».',
    // Hinweis am Eintrag, wenn die genannte Person das Projekt nicht sieht (K2 Schritt 3, UX-E14)
    ohneZugriff: 'kein Zugriff',
    zugriffGeben: 'Zugriff geben',
  },
  // Bereich «Zugriff» (UI-51, UC-016 A2)
  zugriff: {
    titelPortfolio: 'Zugriff am Portfolio', portfolio: 'Portfolio',
    introProjekt: 'Wer das Projekt führt, steuert oder mitliest. Wer über das Portfolio oder übergreifend Zugriff hat, steht darunter.',
    introPortfolio: 'Wer das Portfolio führt, steuert oder als Gremium mitliest. Zugriff am Portfolio gilt für alle seine Projekte.',
    geben: 'Zugriff geben', warum: 'Warum?',
    nurLesen: 'Den Zugriff ändert, wer hier führt.',
    vertraulich: 'Das Projekt ist vertraulich: Wer hier Zugriff erhält, sieht es mit allen Angaben, auch die Beträge.',
    gruppeProjekt: 'Am Projekt', gruppePortfolio: 'Am Portfolio', gruppeGeerbt: 'Über das Portfolio und übergreifend',
    wer: 'Person', rolle: 'Rolle', ueber: 'Über', befristet: 'Befristet',
    amProjekt: 'Projekt', amPortfolio: 'Portfolio', ueberPortfolio: (name: string) => `Portfolio ${name}`, ueberPortfolioOhne: 'Portfolio',
    uebergreifend: 'übergreifend', anderes: 'anderer Ort',
    niemand: 'Niemand hat über das Portfolio oder übergreifend Zugriff.',
    niemandHier: 'Hier hat noch niemand eine Rolle. Gib Zugriff, damit die Projektleitung und das Team arbeiten können.',
    vergebenVon: 'Vergeben von',
    geerbtHinweis: (ort: string) => `Dieser Zugriff gilt über «${ort}» und wird dort geändert.`,
    warumPerson: (wer: string) => `Warum sieht ${wer} das?`,
    bis: (datum: string) => `bis ${datum}`,
    bisFeld: 'Gültig bis', bisHinweis: 'Leer lassen für unbefristet.', bisVergangen: 'Wähle ein Datum ab heute.',
    befristetGespeichert: 'Befristung gespeichert.',
    entfernen: 'Zugriff entfernen',
    entfernenTitel: 'Zugriff entfernen',
    entfernenText: (wer: string, rolle: string, ort: string) => `${wer} verliert die Rolle «${rolle}» an ${ort}. Die Änderung steht im Verlauf.`,
    entfernt: 'Zugriff entfernt.',
    portfolioUnbekannt: 'Dieses Portfolio gibt es nicht, oder du siehst es nicht.',
    keinPortfolio: 'Du siehst noch kein Portfolio.',
  },
  palette: NAV.palette,
  // Kopfkarte im Eingang (informationsarchitektur.md «Startseite je Rolle»: Projekt führen, Projekt steuern)
  kopfkarte: {
    titel: 'Meine Projekte',
    alle: (n: number) => `Alle ${n} Projekte`,
    berichtFaellig: (monat: string, frist: string) => `Statusbericht ${monat} fällig ${frist}`,
    berichtOffen: (monat: string) => `Statusbericht ${monat} offen`,
    kritischGrund: (grund: string) => `Grund: ${grund}`,
    meilenstein: (m: string) => `Nächster Meilenstein: ${m}`,
    traktandum: (art: string, gremium: string, datum: string) => `${art} im ${gremium} ${datum}`,
    vorstellen: (datum: string, gremium: string) => `Du stellst am ${datum} im ${gremium} vor`,
  },
};
