/**
 * Protokoll der Sitzung (BC PP.04.02; UC-006 Schritte 8–9; K3 Schritt 10; AP-E2-2): beim Schliessen aus Traktanden und
 * Entscheiden erzeugt, von der UE bereinigt (Anwesende, Notizen je Traktandum, Bemerkungen; Entscheide bleiben fest,
 * A-30) und innert 3 Arbeitstagen versendet (Q8 Kap. 8.1, K3-4).
 */
import { conflict, type Tx } from '@vollholz/platform';
import { aufgabe, mitteilung } from '../eingang/index.ts';
import { fristDatum } from '../phasenmodell/index.ts';
import { sitzungLink } from './aktionen.ts';
import { artLabel, type Art } from './arten.ts';
import * as es from './entscheid-store.ts';
import { heute, kurzDatum } from './format.ts';
import * as store from './store.ts';

export interface ProtokollAuflage { text: string; verantwortlich: string | null; termin: string }

export interface ProtokollTraktandum {
  traktandumId: string;
  position: number | null;
  art: Art;
  artLabel: string;
  titel: string;
  antrag: string;
  projekt: { nummer: string; name: string } | null;
  vertraulich: boolean;
  viaSns: boolean;
  /** Offene Vermerke beim Schliessen, z. B. «Unterlagen fehlen» (UC-006 A2.2, A-74); fehlt in älteren Protokollen. */
  vermerke?: string[];
  /** entschieden, zur Kenntnis genommen (ohne Entscheid) oder nicht behandelt (für die nächste Sitzung vorgeschlagen) */
  behandlung: 'entschieden' | 'kenntnisnahme' | 'nicht_behandelt';
  entscheid: {
    ergebnis: string; label: string; begruendung: string; stellungnahme: boolean; anVr: boolean; auflagen: ProtokollAuflage[];
  } | null;
  /** Diskussion in Kürze, von der UE ergänzt */
  notiz: string;
}

export interface ProtokollInhalt {
  kopf: { gremium: { kuerzel: string; name: string }; datum: string; beginn: string | null; ort: string };
  anwesende: string;
  traktanden: ProtokollTraktandum[];
  bemerkungen: string;
}

/** Protokollentwurf beim Schliessen (UC-006 Schritt 8): je Traktandum Entscheid, Begründung und Auflagen. */
export async function protokollErzeugen(tx: Tx, s: store.SitzungRow, ts: readonly store.TraktandumRow[], ent: Map<string, es.EntscheidRow>,
  auflagen: readonly es.AuflageRow[], o: { hatOptionen: (art: Art) => boolean; label: (art: Art, schluessel: string) => string; vermerke: (t: store.TraktandumRow) => string[] }): Promise<void> {
  if (await es.protokollVon(tx, s.id)) throw conflict('Das Protokoll besteht bereits.');
  const inhalt: ProtokollInhalt = {
    kopf: { gremium: { kuerzel: s.gremium_kuerzel, name: s.gremium_name }, datum: s.datum, beginn: s.beginn, ort: s.ort },
    anwesende: '',
    bemerkungen: '',
    traktanden: ts.map(t => {
      const e = ent.get(t.id);
      return {
        traktandumId: t.id, position: t.position, art: t.art, artLabel: artLabel(t.art), titel: t.titel, antrag: t.antrag,
        projekt: t.projekt_nummer ? { nummer: t.projekt_nummer, name: t.projekt_name ?? '' } : null,
        vertraulich: t.vertraulich, viaSns: t.via_sns, vermerke: o.vermerke(t),
        behandlung: e ? 'entschieden' : o.hatOptionen(t.art) ? 'nicht_behandelt' : 'kenntnisnahme',
        entscheid: e ? {
          ergebnis: e.ergebnis, label: o.label(t.art, e.ergebnis), begruendung: e.begruendung, stellungnahme: e.stellungnahme, anVr: e.an_vr,
          auflagen: auflagen.filter(a => a.entscheid_id === e.id).map(a => ({ text: a.text, verantwortlich: a.verantwortlich_name, termin: a.termin })),
        } : null,
        notiz: '',
      };
    }),
  };
  await es.protokollAnlegen(tx, s.id, inhalt);
}

/** Vertrauliche Traktanden ohne `projekt:vertraulich` ausblenden (A-34, UX-OF-13). */
export function fuerLeser(inhalt: ProtokollInhalt, vertraulichSichtbar: boolean): ProtokollInhalt {
  return vertraulichSichtbar ? inhalt : { ...inhalt, traktanden: inhalt.traktanden.filter(t => !t.vertraulich) };
}

export interface ProtokollAenderung { anwesende?: string; bemerkungen?: string; notizen?: { traktandumId: string; notiz: string }[] }

/** Bereinigen (K3 Schritt 10): Anwesende, Notizen, Bemerkungen; Entscheide bleiben unverändert. Liefert unbekannte Traktanden. */
export function bereinigen(inhalt: ProtokollInhalt, a: ProtokollAenderung): { inhalt: ProtokollInhalt; unbekannt: number[] } {
  const notizen = new Map((a.notizen ?? []).map(n => [n.traktandumId, n.notiz.trim()]));
  const unbekannt = (a.notizen ?? []).flatMap((n, i) => inhalt.traktanden.some(t => t.traktandumId === n.traktandumId) ? [] : [i]);
  return {
    unbekannt,
    inhalt: {
      ...inhalt,
      anwesende: a.anwesende !== undefined ? a.anwesende.trim() : inhalt.anwesende,
      bemerkungen: a.bemerkungen !== undefined ? a.bemerkungen.trim() : inhalt.bemerkungen,
      traktanden: inhalt.traktanden.map(t => notizen.has(t.traktandumId) ? { ...t, notiz: notizen.get(t.traktandumId)! } : t),
    },
  };
}

export interface Protokollfrist {
  /** Versand spätestens (Q8 Kap. 8.1: 2–3 Arbeitstage nach der Sitzung, A-27); ohne Phasenmodell null */
  bis: string | null;
  /** Arbeitstage bis zur Frist, negativ wenn überschritten */
  restArbeitstage: number | null;
  /** Arbeitstage zwischen Sitzung und Versand (bzw. heute), K3-4 */
  nachSitzung: number;
  eingehalten: boolean;
}

export async function protokollfrist(tx: Tx, s: store.SitzungRow, versendetAm: string | null, jetzt = heute()): Promise<Protokollfrist> {
  const f = await fristDatum(tx, 'protokoll', s.datum);
  const am = versendetAm ?? jetzt;
  const nach = am > s.datum ? await store.arbeitstageBis(tx, s.datum, am) : 0;
  if (!f) return { bis: null, restArbeitstage: null, nachSitzung: nach, eingehalten: true };
  return { bis: f.datum, restArbeitstage: await store.arbeitstageBis(tx, jetzt, f.datum), nachSitzung: nach, eingehalten: am <= f.datum };
}

/** Beteiligte, die das Protokoll erhalten (UC-006 Schritt 9): Eingeladene, PL und SP der Geschäfte, Verantwortliche von Auflagen. */
export async function beteiligte(tx: Tx, s: store.SitzungRow): Promise<{ personId: string; name: string | null }[]> {
  return (await tx.query<{ personId: string; name: string | null }>(
    `SELECT DISTINCT x.person AS "personId", p.display_name AS name FROM (
       SELECT e.person_id AS person FROM ppm.einladung e WHERE e.sitzung_id = $1
       UNION SELECT pp.person_id FROM ppm.traktandum t JOIN ppm.projekt_person pp ON pp.tenant_id = t.tenant_id AND pp.projekt_id = t.projekt_id
              WHERE t.sitzung_id = $1 AND t.stand = 'entschieden' AND pp.funktion IN ('pl', 'sp')
       UNION SELECT a.verantwortlich FROM ppm.auflage a JOIN ppm.entscheid en ON en.tenant_id = a.tenant_id AND en.id = a.entscheid_id WHERE en.sitzung_id = $1
     ) x JOIN ppm.principal p ON p.tenant_id = app.tenant_id() AND p.id = x.person AND p.removed_at IS NULL
     ORDER BY p.display_name`, [s.id])).rows;
}

/**
 * Protokoll versenden (UC-006 Schritt 9): Mitglieder sehen es ab jetzt (Lesesicht), die Beteiligten erhalten eine
 * Mitteilung mit Link (E-Mail nur mit Link, UX-E9; Netz-Adapter folgt, A-44); «Protokoll versenden» ist erledigt.
 */
export async function versenden(tx: Tx, s: store.SitzungRow, version: number): Promise<{ empfaenger: number; frist: Protokollfrist }> {
  if (s.stand !== 'geschlossen') throw conflict(s.stand === 'protokoll_versendet' ? 'Das Protokoll ist bereits versendet.' : 'Schliesse zuerst die Sitzung.');
  if (!(await es.protokollVersenden(tx, s.id, version))) {
    const p = await es.protokollVon(tx, s.id);
    throw conflict(!p ? 'Zur Sitzung gibt es kein Protokoll.' : 'Das Protokoll wurde inzwischen geändert. Lade es neu.');
  }
  await es.protokollVersendetMarkieren(tx, s.id);
  await aufgabe.erledigen(tx, { art: 'protokoll.versenden', bezug: { typ: 'sitzung', id: s.id } });
  const link = `${sitzungLink(s.gremium_kuerzel, s.datum)}/protokoll`;
  const an = await beteiligte(tx, s);
  for (const b of an) {
    await mitteilung.senden(tx, { an: b.personId, bezug: { typ: 'sitzung', id: s.id }, text: `Protokoll ${s.gremium_kuerzel.toUpperCase()} ${kurzDatum(s.datum)} versendet.`, link });
  }
  return { empfaenger: an.length, frist: await protokollfrist(tx, s, heute()) };
}
