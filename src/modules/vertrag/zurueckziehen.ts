/**
 * Projektvertrag zurückziehen (BC DM.02.04; UC-002 A4; K2 Schritt 6 «Zurückziehen»): Der Sponsor nimmt ein Vorhaben,
 * das er nicht weiterverfolgen will, mit Begründung aus dem Prozess. Vertrag und Projekt werden als «zurückgezogen»
 * geschlossen, der Ressourcenbedarf zählt nicht mehr (A-63: nur aktive Projekte), die Unternehmensentwicklung wird
 * informiert.
 *
 * Annahmen (Spezifikation schweigt, im STAND gemeldet): nur der erste Vertrag (Anlass `initial`, UC-002) eines aktiven
 * Projekts, aus jedem Stand des Entwurfs; ein Gate-Traktandum wird zurückgenommen, solange die Traktandenliste nicht
 * versendet ist, sonst entscheidet das Gremium (409). Quality-Checks und Unterschriften bleiben als Verlauf; offene
 * Aufgaben zum Vertrag entfallen. «Informiert die UE» = Mitteilung an die Personen, die einen Quality-Check des
 * Projekts erfasst haben (eine Mitteilung an ein Recht gibt es nicht, vgl. A-53).
 *
 * Läuft in voller Sicht nach der Prüfung von `vertrag:decide` (der SP hat weder `vertrag:write` noch `projekt:write`,
 * wie beim Entscheid über eine Änderung).
 */
import { conflict, invalid, type Actor, type Tx } from '@vollholz/platform';
import { aufgabe, mitteilung } from '../eingang/index.ts';
import { projekt as projektAktion } from '../projekt/index.ts';
import { traktandum } from '../sitzung/index.ts';
import { record, SCHEMA } from '../../platform.ts';
import { intern } from './aenderung.ts';
import { STAND_TEXT } from './entwurf.ts';
import * as gs from './gate-store.ts';
import * as store from './store.ts';

/** Zurückziehen möglich (Stand und Projekt; das Recht prüft der Aufrufer). */
export const zurueckziehbar = (v: store.VersionRow, p: store.ProjektKopf) =>
  v.anlass === 'initial' && store.ENTWURF.includes(v.stand) && p.lebenszyklus === 'aktiv';

/** Begründung Pflicht (K2 «Regeln»: Zurückziehen ohne Begründung, UC-002 A4). */
export function pruefeBegruendung(begruendung: string): void {
  if (!begruendung.trim()) {
    throw invalid('Begründung fehlt: Ohne Begründung wissen Projektleitung und Unternehmensentwicklung nicht, warum das Vorhaben endet.',
      [{ path: '/begruendung', message: 'Pflicht beim Zurückziehen.' }]);
  }
}

/** Personen, die einen Quality-Check des Projekts erfasst haben (Unternehmensentwicklung). */
async function pruefende(tx: Tx, projektId: string): Promise<string[]> {
  return (await tx.query<{ by_person: string }>(
    `SELECT DISTINCT by_person FROM ${SCHEMA}.quality_check WHERE projekt_id = $1 ORDER BY by_person`, [projektId])).rows.map(r => r.by_person);
}

/**
 * Vertrag und Projekt zurückziehen (UC-002 A4.1). Liefert false bei fremder Änderung (412). In voller Sicht in der
 * Transaktion des Aufrufers.
 */
export async function zurueckziehen(tx: Tx, who: Actor, o: { version: store.VersionRow; projekt: store.ProjektKopf; erwartet: number; begruendung: string }): Promise<boolean> {
  const { version: v, projekt: p } = o;
  if (!zurueckziehbar(v, p)) {
    throw conflict(v.anlass !== 'initial'
      ? `Version ${v.nummer} ist kein erster Projektvertrag; ein laufendes Projekt beendet das Gremium (Gate «Gestoppt») oder der Abschluss.`
      : p.lebenszyklus !== 'aktiv' ? `Das Projekt ${p.nummer} ist nicht aktiv und kann nicht zurückgezogen werden.`
        : `Version ${v.nummer} ist ${STAND_TEXT[v.stand]} und kann nicht zurückgezogen werden.`,
    { reason: 'stand', stand: v.stand, lebenszyklus: p.lebenszyklus });
  }
  const begruendung = o.begruendung.trim();
  pruefeBegruendung(begruendung);
  // Gate-Traktandum (Bezug Projekt): zurücknehmen, solange die Traktandenliste nicht versendet ist
  const a = await gs.antrag(tx, v.id);
  const weg = await traktandum.zuruecknehmen(tx, { art: 'gate', bezug: { typ: 'projekt', id: p.id } });
  if (!weg && (v.stand === 'traktandiert' || a?.stand === 'traktandiert')) {
    throw conflict(`Das Gate-Review von ${p.nummer} steht auf einer versendeten Traktandenliste; das Gremium entscheidet in der Sitzung (z. B. «Gestoppt»).`,
      { reason: 'traktandiert' });
  }
  const ok = await intern(tx, async () => {
    if (!(await store.standSetzen(tx, v.id, o.erwartet, store.ENTWURF, 'zurueckgezogen'))) return false;
    if (a?.stand === 'traktandiert') await gs.traktandumEntfernen(tx, a.id);
    return true;
  });
  if (!ok) return false;
  // Offene Aufgaben zum Vertrag entfallen (fachmodell.md 4.2)
  for (const art of ['vertrag.quality_check', 'vertrag.unterzeichnen', 'vertrag.ueberarbeiten']) await aufgabe.entfallen(tx, { art, bezug: { typ: 'vertrag_version', id: v.id } });
  for (const art of ['vertrag.erstellen', 'gate.vorbereiten']) await aufgabe.entfallen(tx, { art, bezug: { typ: 'projekt', id: p.id } });
  await projektAktion.lebenszyklusWechseln(tx, who, p.id, 'zurueckgezogen', { grund: 'Projektvertrag zurückgezogen', versionId: v.id, begruendung });
  const kurz = begruendung.length > 140 ? `${begruendung.slice(0, 139)}…` : begruendung;
  for (const an of await pruefende(tx, p.id)) {
    await mitteilung.senden(tx, {
      an, bezug: { typ: 'projekt', id: p.id }, link: `/projekte/${p.nummer}/vertrag`,
      text: `Der Sponsor hat das Projekt ${p.nummer} ${p.name} zurückgezogen: ${kurz}`,
    });
  }
  const daten = { id: v.id, projektId: p.id, nummer: v.nummer, anlass: v.anlass, zielphase: v.zielphase, stand: 'zurueckgezogen' as const };
  await record(tx, who, { action: 'vertrag.withdrawn', resourceType: 'vertrag_version', resourceId: v.id, data: { ...daten, projekt: p.nummer, begruendung, vorher: v.stand }, event: daten });
  return true;
}
