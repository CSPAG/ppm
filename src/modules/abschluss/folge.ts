/**
 * Entscheide zu Abschluss, Sistierung, Abbruch und Wiederaufnahme (BC PS.04.01, PS.04.02; UC-015 Schritte 5–6, A1, A2;
 * A-09; fachmodell.md 2.9) und die Aufgabe «Abschlussbericht erstellen» (fachmodell.md 4.2 `abschluss.erstellen`).
 *
 * - Art `abschluss` in der Registry der Sitzung, Bezug ist das Projekt (wie beim Gate: ein von der UE eingeplantes
 *   Geschäft bleibt dasselbe Traktandum). Was das Gremium entscheidet, hängt von der Lage beim ersten Entscheid ab:
 *   Exit-Gate P4 mit eingereichtem Abschlussbericht (abgeschlossen, Nacharbeiten verlangt), aktives Projekt (sistiert,
 *   abgebrochen, weiterführen) oder sistiertes Projekt (weiterführen = Wiederaufnahme, A-09; sistiert; abgebrochen).
 * - Die Folge läuft in der Transaktion des Entscheids (UX-Rückfluss UC-006 7–8) mit `app.abschluss_intern`; eine
 *   Korrektur in der Sitzung (A-30) nimmt die vorige Folge zurück. Abgeschlossen und abgebrochen sind Endzustände
 *   (UC-015 Schritt 6): Das Modul `projekt` lässt keinen Weg zurück zu, die Korrektur wird mit 409 abgewiesen.
 * - Gate «Gestoppt» (UC-002 Ende, UC-003 A6, K2: «weiter in UC-015») über `gateEntscheid.registrieren` des Moduls
 *   vertrag: das Projekt ist abgebrochen. Gate P3–P4 freigegeben: Phase P4 erreicht, Aufgabe an die Projektleitung.
 */
import { conflict, invalid, systemActor, type Tx } from '@vollholz/platform';
import { aufgabe, mitteilung } from '../eingang/index.ts';
import { projekt as projektAktion } from '../projekt/index.ts';
import { registriereTraktandenart, type EntscheidFolge, type Unterlage } from '../sitzung/index.ts';
import { gateEntscheid, type GateEntscheid } from '../vertrag/index.ts';
import * as store from './store.ts';

export const ART_ERSTELLEN = 'abschluss.erstellen';

/** Ergebnisse des Gremiums (K3 Schritt 8, Art «Abschluss»). */
export const ERGEBNISSE = [
  { schluessel: 'abgeschlossen', label: 'Abgeschlossen' },
  { schluessel: 'nacharbeiten', label: 'Nacharbeiten verlangt' },
  { schluessel: 'sistiert', label: 'Sistiert' },
  { schluessel: 'abgebrochen', label: 'Abgebrochen' },
  { schluessel: 'weiterfuehren', label: 'Weiterführen' },
] as const satisfies readonly { schluessel: store.Ergebnis; label: string }[];

const LABEL = Object.fromEntries(ERGEBNISSE.map(e => [e.schluessel, e.label])) as Record<store.Ergebnis, string>;

/** Ergebnisse je Lage; die Lage gilt ab dem ersten Entscheid des Traktandums (Korrektur, A-30). */
export const MOEGLICH: Readonly<Record<store.Kontext, readonly store.Ergebnis[]>> = {
  exit: ['abgeschlossen', 'nacharbeiten'],
  aktiv: ['sistiert', 'abgebrochen', 'weiterfuehren'],
  sistiert: ['weiterfuehren', 'sistiert', 'abgebrochen'],
};
const LAGE_TEXT: Record<store.Kontext, string> = {
  exit: 'Am Exit-Gate P4', aktiv: 'Für ein laufendes Vorhaben', sistiert: 'Für ein sistiertes Vorhaben',
};

const BERICHT_TITEL: Record<store.Art, string> = { abschluss: 'Abschlussbericht', sistierung: 'Bericht zur Sistierung', abbruch: 'Bericht zum Abbruch' };
const link = (p: Pick<store.ProjektKopf, 'nummer'>) => `/projekte/${p.nummer}/abschluss`;
const bezugVon = (p: Pick<store.ProjektKopf, 'id'>) => ({ typ: 'projekt', id: p.id });

// ---------------------------------------------------------------- Aufgabe «Abschlussbericht erstellen»

/** Aufgabe an die Projektleitung (fachmodell.md 4.2): P4 erreicht, Sistierung oder Abbruch entschieden, Nacharbeit. */
export async function erstellenOeffnen(tx: Tx, p: store.ProjektKopf, art: store.Art, grund?: string): Promise<number> {
  let n = 0;
  for (const person of await store.projektleitung(tx, p.id)) {
    await aufgabe.oeffnen(tx, {
      art: ART_ERSTELLEN, bezug: bezugVon(p), empfaenger: { person },
      titel: grund ? `${BERICHT_TITEL[art]} ${p.name} überarbeiten` : `${BERICHT_TITEL[art]} ${p.name} erstellen`,
      kontext: `${p.nummer} ${p.name}${grund ? ` · ${grund}` : ''}`,
      link: link(p),
    });
    n += 1;
  }
  return n;
}

export const erstellenErledigen = (tx: Tx, p: Pick<store.ProjektKopf, 'id'>) => aufgabe.erledigen(tx, { art: ART_ERSTELLEN, bezug: bezugVon(p) });
const erstellenEntfallen = (tx: Tx, p: Pick<store.ProjektKopf, 'id'>) => aufgabe.entfallen(tx, { art: ART_ERSTELLEN, bezug: bezugVon(p) });

// ---------------------------------------------------------------- Lage und Folge

/** Lage beim ersten Entscheid; ein beendetes Projekt lässt keinen Entscheid mehr zu. */
export async function lageVon(tx: Tx, p: store.ProjektKopf): Promise<store.Kontext> {
  const b = await store.offenerBericht(tx, p.id);
  if (b?.art === 'abschluss' && (b.stand === 'eingereicht' || b.stand === 'traktandiert')) return 'exit';
  if (p.lebenszyklus === 'aktiv') return 'aktiv';
  if (p.lebenszyklus === 'sistiert') return 'sistiert';
  throw conflict(`Das Projekt ${p.nummer} ist beendet und kann nur noch gelesen werden; ein Entscheid ist nicht mehr möglich.`, { reason: 'lebenszyklus', lebenszyklus: p.lebenszyklus });
}

function pruefeErgebnis(lage: store.Kontext, ergebnis: store.Ergebnis): void {
  if (MOEGLICH[lage].includes(ergebnis)) return;
  const text = lage === 'exit' || ergebnis === 'abgeschlossen' || ergebnis === 'nacharbeiten'
    ? `${LAGE_TEXT[lage]} sind möglich: ${MOEGLICH[lage].map(e => `«${LABEL[e]}»`).join(', ')}.${lage !== 'exit' ? ' «Abgeschlossen» setzt einen eingereichten Abschlussbericht voraus (Phase P4).' : ''}`
    : `${LAGE_TEXT[lage]} sind möglich: ${MOEGLICH[lage].map(e => `«${LABEL[e]}»`).join(', ')}.`;
  throw invalid(text, [{ path: '/ergebnis', message: `möglich: ${MOEGLICH[lage].join(', ')}` }]);
}

const kurz = (t: string, n = 140) => { const s = t.trim().replace(/\s+/g, ' '); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

/** Wechsel des Lebenszyklus mit Grund (Audit beim Projekt). */
async function wechseln(tx: Tx, p: store.ProjektKopf, ziel: 'aktiv' | 'sistiert' | 'abgebrochen' | 'abgeschlossen', grund: Record<string, unknown>): Promise<void> {
  await projektAktion.lebenszyklusWechseln(tx, systemActor('system'), p.id, ziel, grund);
}

interface Folge { berichtId: string | null; artVorher: store.Art | null }

/** Bericht für Sistierung bzw. Abbruch: offenen Entwurf umwidmen, sonst neu anlegen (UC-015 A1.1). */
async function berichtFuer(tx: Tx, p: store.ProjektKopf, art: 'sistierung' | 'abbruch'): Promise<Folge> {
  const offen = await store.offenerBericht(tx, p.id);
  if (offen && (offen.stand === 'entwurf' || offen.stand === 'nacharbeit')) {
    if (offen.art !== art) await store.artSetzen(tx, offen.id, art);
    return { berichtId: offen.id, artVorher: offen.art };
  }
  return { berichtId: (await store.berichtAnlegen(tx, p.id, art)).id, artVorher: null };
}

/** Eingereichter Abschlussbericht am Exit-Gate; fehlt er (in Nacharbeit), ist kein Abschluss möglich. */
async function exitBericht(tx: Tx, p: store.ProjektKopf): Promise<store.BerichtRow> {
  const b = await store.offenerBericht(tx, p.id);
  if (b?.art !== 'abschluss' || (b.stand !== 'eingereicht' && b.stand !== 'traktandiert')) {
    throw conflict(`Der Abschlussbericht ${p.nummer} ist nicht eingereicht; das Gremium kann ihn nicht abnehmen.`, { reason: 'bericht' });
  }
  return b;
}

/** Folge des Ergebnisses anwenden (in der Lage des Traktandums). */
async function anwenden(tx: Tx, p: store.ProjektKopf, lage: store.Kontext, ergebnis: store.Ergebnis, grund: Record<string, unknown>, begruendung: string): Promise<Folge> {
  const keine: Folge = { berichtId: null, artVorher: null };
  switch (ergebnis) {
    case 'abgeschlossen': {
      // UC-015 Schritt 6: Abschlussbericht abgenommen, Vorhaben abgeschlossen, Projektakte lesend
      const b = await exitBericht(tx, p);
      await store.standSetzen(tx, b.id, ['eingereicht', 'traktandiert'], 'abgenommen');
      await wechseln(tx, p, 'abgeschlossen', grund);
      await erstellenErledigen(tx, p);
      return { berichtId: b.id, artVorher: null };
    }
    case 'nacharbeiten': {
      // UC-015 A2: Auflagen erfasst die UE in der Sitzung; die PL überarbeitet den Bericht (weiter bei Schritt 2)
      const b = await exitBericht(tx, p);
      await store.standSetzen(tx, b.id, ['eingereicht', 'traktandiert'], 'nacharbeit');
      const t = kurz(begruendung);
      await erstellenOeffnen(tx, p, 'abschluss', t ? `Nacharbeiten verlangt: ${t}` : 'Nacharbeiten verlangt');
      return { berichtId: b.id, artVorher: null };
    }
    case 'sistiert': {
      if (lage === 'sistiert') return keine; // Wiederaufnahme abgelehnt: bleibt sistiert
      await wechseln(tx, p, 'sistiert', grund);
      const f = await berichtFuer(tx, p, 'sistierung');
      await erstellenOeffnen(tx, p, 'sistierung');
      return f;
    }
    case 'abgebrochen': {
      // Ein sistiertes Vorhaben wird über «aktiv» beendet (Übergänge im Modul projekt, fachmodell.md 2.5)
      if (p.lebenszyklus === 'sistiert') await wechseln(tx, p, 'aktiv', { ...grund, zwischenschritt: 'abbruch' });
      await wechseln(tx, p, 'abgebrochen', grund);
      const f = await berichtFuer(tx, p, 'abbruch');
      await erstellenOeffnen(tx, p, 'abbruch');
      return f;
    }
    case 'weiterfuehren': {
      if (lage !== 'sistiert') return keine;
      // Wiederaufnahme (A-09): aktiv; der Vertrag wird über ein Gate fortgeschrieben (UC-003)
      await wechseln(tx, p, 'aktiv', grund);
      for (const an of await store.spUndPl(tx, p.id)) {
        await mitteilung.senden(tx, {
          an, bezug: bezugVon(p), link: `/projekte/${p.nummer}/vertrag`,
          text: `${p.nummer} ${p.name} ist wieder aufgenommen. Schreib den Projektvertrag über ein Gate fort.`,
        });
      }
      return keine;
    }
  }
}

/** Vorige Folge zurücknehmen (Korrektur in der Sitzung, A-30); Endzustände nicht (409). */
async function zuruecknehmen(tx: Tx, e: store.EntscheidRow, p: store.ProjektKopf): Promise<void> {
  const grund = { korrektur: true, ergebnis: e.ergebnis };
  switch (e.ergebnis) {
    case 'abgeschlossen':
    case 'abgebrochen':
      throw conflict(`Der Entscheid «${LABEL[e.ergebnis]}» hat das Projekt ${p.nummer} beendet und lässt sich nicht mehr korrigieren; das Projekt kann nur noch gelesen werden.`,
        { reason: 'lebenszyklus', lebenszyklus: p.lebenszyklus });
    case 'nacharbeiten': {
      const b = e.bericht_id ? await store.bericht(tx, e.bericht_id) : null;
      if (b) await store.standSetzen(tx, b.id, ['nacharbeit'], b.traktandum_id ? 'traktandiert' : 'eingereicht');
      await erstellenEntfallen(tx, p);
      return;
    }
    case 'sistiert': {
      if (e.kontext === 'sistiert') return;
      if (p.lebenszyklus === 'sistiert') await wechseln(tx, p, 'aktiv', grund);
      if (e.bericht_id) {
        if (e.bericht_art_vorher) await store.artSetzen(tx, e.bericht_id, e.bericht_art_vorher);
        else await store.entwurfEntfernen(tx, e.bericht_id);
      }
      await erstellenEntfallen(tx, p);
      return;
    }
    case 'weiterfuehren':
      if (e.kontext === 'sistiert' && p.lebenszyklus === 'aktiv') await wechseln(tx, p, 'sistiert', grund);
  }
}

/**
 * Folge des Entscheids der Art `abschluss` (fachmodell.md 2.9) in der Transaktion des Entscheids; idempotent und
 * angeglichen an das zuletzt übergebene Ergebnis (sitzung/README.md).
 */
export async function beiEntscheid(tx: Tx, f: EntscheidFolge): Promise<void> {
  if (f.bezug.typ !== 'projekt') return;
  await store.intern(tx, async () => {
    let p = await store.projekt(tx, f.bezug.id);
    if (!p) return;
    const ergebnis = f.ergebnis as store.Ergebnis;
    const vorher = await store.entscheid(tx, 'traktandum', f.traktandumId);
    if (vorher?.ergebnis === ergebnis) return;
    const lage = vorher?.kontext ?? await lageVon(tx, p);
    pruefeErgebnis(lage, ergebnis);
    if (vorher) {
      await zuruecknehmen(tx, vorher, p);
      p = (await store.projekt(tx, p.id))!;
    }
    const vorherLz = p.lebenszyklus as 'aktiv' | 'sistiert';
    const folge = await anwenden(tx, p, lage, ergebnis, { traktandumId: f.traktandumId, ergebnis }, f.begruendung);
    await store.entscheidSetzen(tx, {
      projekt_id: p.id, quelle: 'traktandum', quelle_id: f.traktandumId, kontext: lage, ergebnis, vorher_lebenszyklus: vorherLz,
      bericht_id: folge.berichtId, bericht_art_vorher: folge.artVorher,
    });
  });
}

/** Gate-Entscheid (Modul vertrag): «Gestoppt» bricht ab, P3–P4 freigegeben öffnet den Abschluss. */
export async function nachGate(tx: Tx, g: GateEntscheid): Promise<void> {
  await store.intern(tx, async () => {
    const p = await store.projekt(tx, g.projektId);
    if (!p) return;
    const vorher = await store.entscheid(tx, 'gate', g.versionId);
    if (g.ergebnis === 'abgelehnt') {
      if (vorher?.ergebnis === 'abgebrochen' || p.lebenszyklus !== 'aktiv') return;
      const folge = await anwenden(tx, p, 'aktiv', 'abgebrochen', { gate: g.gate, versionId: g.versionId, ergebnis: 'gestoppt' }, g.begruendung);
      await store.entscheidSetzen(tx, {
        projekt_id: p.id, quelle: 'gate', quelle_id: g.versionId, kontext: 'aktiv', ergebnis: 'abgebrochen', vorher_lebenszyklus: 'aktiv',
        bericht_id: folge.berichtId, bericht_art_vorher: folge.artVorher,
      });
      return;
    }
    if (vorher?.ergebnis === 'abgebrochen') await zuruecknehmen(tx, vorher, p); // 409: beendet
    if (g.gate !== 'P3_P4') return;
    if (g.ergebnis === 'freigegeben' && p.phase === 'P4' && p.lebenszyklus === 'aktiv') await erstellenOeffnen(tx, p, 'abschluss');
    else if (!(await store.offenerBericht(tx, p.id))) await erstellenEntfallen(tx, p);
  });
}

// ---------------------------------------------------------------- Art «abschluss» in der Registry der Sitzung

const datum = (d: Date) => new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', day: 'numeric', month: 'numeric' }).format(d);

/** Unterlagen: am Exit-Gate der Abschlussbericht mit Stand der Nutzenprüfung (UC-015 Schritte 3, 5), sonst die Projektakte. */
async function unterlagen(tx: Tx, projektId: string): Promise<Unterlage[]> {
  const p = await store.projekt(tx, projektId);
  if (!p) return [];
  const b = await store.offenerBericht(tx, p.id);
  if (b?.art === 'abschluss' && b.stand !== 'entwurf') {
    const nutzen = [b.nutzen_sp_at && 'Sponsor', b.nutzen_ue_at && 'UE'].filter(Boolean);
    const bereit = b.stand === 'eingereicht' || b.stand === 'traktandiert';
    return [{
      art: 'bericht', titel: `Abschlussbericht ${p.nummer}`, bereit,
      hinweis: bereit ? `eingereicht ${datum(b.eingereicht_at!)} · Nutzenprüfung ${nutzen.length ? `durch ${nutzen.join(' und ')}` : 'offen'}` : 'in Nacharbeit',
      inhalt: {
        zielerreichung: b.zielerreichung, kpiWerte: b.kpi_werte, businessCase: b.business_case, uebergabe: b.uebergabe, offenePunkte: b.offene_punkte,
        nutzen: { sp: b.nutzen_sp, ue: b.nutzen_ue }, nutzenpruefungGate: await store.letzteNutzenpruefung(tx, p.id),
      },
    }];
  }
  if (p.lebenszyklus === 'aktiv' && p.phase === 'P4') return [{ art: 'bericht', titel: `Abschlussbericht ${p.nummer}`, bereit: false, hinweis: 'noch nicht eingereicht' }];
  return [{ art: 'beilage', titel: `Projektakte ${p.nummer}`, bereit: true, hinweis: `Phase ${p.phase} · ${p.lebenszyklus}`, inhalt: { phase: p.phase, lebenszyklus: p.lebenszyklus } }];
}

/** Titel und Antrag aus der Lage (UE plant direkt ein, PP.04.05). */
async function zusammenfassung(tx: Tx, projektId: string): Promise<{ titel: string; antrag: string } | null> {
  const p = await store.projekt(tx, projektId);
  if (!p) return null;
  const lage = await lageVon(tx, p).catch(() => null);
  if (!lage) return null;
  const was = `${p.nummer} ${p.name}`;
  if (lage === 'exit' || (p.phase === 'P4' && lage === 'aktiv')) return { titel: `Exit-Gate P4 ${was}`, antrag: 'Abschlussbericht abnehmen und das Vorhaben formell abschliessen' };
  if (lage === 'sistiert') return { titel: `Wiederaufnahme ${was}`, antrag: 'Das sistierte Vorhaben wieder aufnehmen' };
  return { titel: `Sistierung oder Abbruch ${was}`, antrag: 'Über Sistierung oder Abbruch des Vorhabens entscheiden' };
}

/** Art `abschluss` und Folge des Gate-Entscheids registrieren (fachmodell.md 2.9, 7.2); einmal beim Laden des Moduls. */
export function registriereAbschluss(): void {
  registriereTraktandenart({
    art: 'abschluss',
    label: 'Abschluss',
    ergebnisse: ERGEBNISSE,
    zusammenfassung: async (tx, bezug) => (bezug.typ === 'projekt' ? zusammenfassung(tx, bezug.id) : null),
    unterlagen: async (tx, bezug) => (bezug.typ === 'projekt' ? unterlagen(tx, bezug.id) : []),
    beiEntscheid,
  });
  gateEntscheid.registrieren(nachGate);
}
