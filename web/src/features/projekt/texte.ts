/**
 * Texte des Features «Projekte» (Namensraum des Features, fachmodell.md 7.2): Anrede «Du», Schweizer Rechtschreibung,
 * Begriffe nach docs/ux/darstellung.md (Rollen ausgeschrieben, «CTL» als Kurzform der Insel).
 */
import type { StandFamilie } from '../../ui/index.ts';

type Funktion = 'sp' | 'pl' | 'ctl' | 'kt' | 'koalition';
type Lebenszyklus = 'aktiv' | 'sistiert' | 'abgebrochen' | 'abgeschlossen' | 'zurueckgezogen';

export const TP = {
  bereich: 'Meine Projekte',
  titel: 'Projekte',
  sub: 'Projekte, in denen du eine Rolle hast oder die du sehen darfst. Öffne ein Projekt, um seine Projektakte zu führen.',
  suche: 'Projekte durchsuchen',
  sucheHinweis: 'Name oder Nummer',
  leer: 'Du bist noch in keinem Projekt eingetragen. Projekte entstehen aus freigegebenen Projektideen; Sponsor und Projektleitung legen danach die Projektorganisation fest.',
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
  funktion: { sp: 'Sponsor', pl: 'Projektleitung', ctl: 'CTL', kt: 'Kernteam', koalition: 'Sponsoren-Koalition' } satisfies Record<Funktion, string>,
  funktionLang: {
    sp: 'Sponsor', pl: 'Projektleitung', ctl: 'Clinical Transformation Lead (CTL)', kt: 'Kernteam', koalition: 'Sponsoren-Koalition',
  } satisfies Record<Funktion, string>,
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
    reiter: 'Bereiche der Projektakte', inhalt: 'Inhalt der Projektakte', uebersicht: 'Übersicht', zurueck: 'Zu den Projekten',
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
    titel: 'Projektorganisation', bearbeiten: 'Projektorganisation bearbeiten', leer: 'Noch niemand benannt. Sponsor und Projektleitung legen die Projektorganisation fest.',
    nurLesen: 'Die Projektorganisation legen Sponsor, Projektleitung und Programmleitung fest.',
    funktion: 'Funktion', person: 'Person', akv: 'Aufgaben, Kompetenzen, Verantwortung', akvKurz: 'AKV', optional: 'optional',
    hinzufuegen: 'Person hinzufügen', entfernen: (n: number) => `Zeile ${n} entfernen`, zeile: (n: number) => `Zeile ${n}`,
    gespeichert: 'Projektorganisation gespeichert.',
    personFehlt: 'Wähle eine Person.',
    einzeln: (f: string) => `${f}: höchstens eine Person. Entferne eine der Zeilen.`,
    doppelt: 'Diese Person steht schon mit dieser Funktion in der Liste.',
    konflikt: 'Die Projektorganisation wurde inzwischen geändert. Lade den neuen Stand; deine Eingaben bleiben erhalten, die Wirkung zeigt dann die Unterschiede zum neuen Stand.',
    wirkung: 'Wirkung beim Speichern',
    erhalten: 'erhalten Zugriff auf das Projekt:',
    verlieren: 'verlieren ihre Rolle im Projekt:',
    keineWirkung: 'Die Zugriffe auf das Projekt bleiben gleich.',
  },
  palette: { detail: 'Projekt' },
  // Kopfkarte im Eingang (informationsarchitektur.md «Startseite je Rolle»: PL, CTL, SP)
  kopfkarte: {
    titel: 'Meine Projekte',
    alle: (n: number) => `Alle ${n} Projekte`,
  },
};
