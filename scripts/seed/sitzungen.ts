/**
 * Gremiumssitzungen der Demo (K3, UC-006): Sitzung zum Termin, alle offenen Vorschläge traktandieren, versenden,
 * durchführen, entscheiden, schliessen, Protokoll versenden. Kommende Sitzungen bleiben in Vorbereitung.
 */
import type { Kontext, Portfolio } from './kontext.ts';
import { pid } from './kontext.ts';
import { nachlesen } from './projekte.ts';
import { inTagen } from './zeit.ts';

export interface Entscheid { ergebnis: string; begruendung: string; auflagen?: { text: string; verantwortlich: string; termin: string }[]; anVr?: boolean }

/** Entscheid je Traktandum: nach Art und Projekt (Schlüssel aus dem Katalog) oder Vorgabe der Art. */
export type Entscheide = Record<string, Entscheid>;

const VORGABE: Record<string, Entscheid> = {
  gate: { ergebnis: 'freigegeben', begruendung: 'Projektvertrag vollständig, Nutzen und Planung überzeugen.' },
  idee: { ergebnis: 'freigegeben', begruendung: 'Strategisch relevant; Initialisierung freigegeben.' },
  aenderung: { ergebnis: 'freigegeben', begruendung: 'Die Änderung ist begründet und finanziert.' },
  meilenstein: { ergebnis: 'abgenommen', begruendung: 'Ergebnis liegt vor und ist abgenommen.' },
  eskalation: { ergebnis: 'erledigt', begruendung: 'Massnahme beschlossen; die Projektleitung berichtet im nächsten Statusbericht.' },
  abschluss: { ergebnis: 'abgeschlossen', begruendung: 'Ziele erreicht, Übergabe an die Linie erfolgt.' },
  quartalsreporting: { ergebnis: 'verabschiedet', begruendung: 'Bericht zuhanden des VR verabschiedet.' },
  jahresrueckblick: { ergebnis: 'verabschiedet', begruendung: 'Erkenntnisse und Massnahmen verabschiedet.' },
  priorisierung: { ergebnis: 'szenario_gewaehlt', begruendung: 'Das beantragte Szenario wird umgesetzt.' },
};

interface Traktandum { traktandumId: string; art: string; titel: string; projekt: { id: string } | null; optionen: unknown[] }

const projektKey = (k: Kontext, t: Traktandum) => {
  const id = t.projekt?.id;
  return Object.values(k.projekte).find(p => p.id === id)?.key;
};

/** Traktandum ohne Vorschlag (z. B. Sistierung eines Projekts, A-45). */
export interface Einplanen { art: string; projektId: string; titel?: string; antrag?: string }

async function anlegen(k: Kontext, pf: Portfolio, datum: string, ort: string, extra: Einplanen[] = []): Promise<{ id: string; etag: string }> {
  const ue = k.p.ursula;
  const s = await ue.post<{ id: string }>(`/v1/gremien/${pf.gremium.kuerzel}/sitzungen`, { datum });
  let etag = s.etag;
  const vorschlaege = await ue.get<{ gruppen: { art: string; traktanden: { id: string }[] }[] }>(`/v1/sitzungen/${s.body.id}/vorschlaege`);
  // Der Bericht der Programmleitung steht schon als Traktandum 1 in der Sitzung
  for (const g of vorschlaege.body.gruppen.filter(x => x.art !== 'portfoliobericht')) for (const t of g.traktanden) etag = (await ue.post(`/v1/sitzungen/${s.body.id}/traktanden`, { vorschlagId: t.id })).etag;
  for (const x of extra) etag = (await ue.post(`/v1/sitzungen/${s.body.id}/traktanden`, x)).etag;
  etag = (await ue.patch(`/v1/sitzungen/${s.body.id}`, { beginn: '14:00', dauerMin: 180, ort }, etag)).etag;
  return { id: s.body.id, etag };
}

/** Vergangene Sitzung vollständig: durchgeführt, entschieden, Protokoll versendet. */
export async function sitzungDurchfuehren(k: Kontext, pf: Portfolio, datum: string, entscheide: Entscheide, anwesende: string, extra: Einplanen[] = []): Promise<void> {
  const ue = k.p.ursula;
  const s = await anlegen(k, pf, datum, 'Sitzungszimmer Direktion, Haus A', extra);
  const v = await ue.post(`/v1/sitzungen/${s.id}/versenden`, undefined, s.etag);
  const modus = await ue.post<{ traktanden: Traktandum[] }>(`/v1/sitzungen/${s.id}/starten`, undefined, v.etag);
  let n = 0;
  for (const t of modus.body.traktanden) {
    if (!t.optionen.length) continue;
    const key = projektKey(k, t);
    const e = (key && entscheide[`${t.art}:${key}`]) || entscheide[t.art] || VORGABE[t.art];
    if (!e) continue;
    await ue.put(`/v1/traktanden/${t.traktandumId}/entscheid`, e);
    n++;
  }
  await ue.mitEtag('POST', `/v1/sitzungen/${s.id}`, `/v1/sitzungen/${s.id}/schliessen`);
  await ue.mitEtag('PUT', `/v1/sitzungen/${s.id}/protokoll`, `/v1/sitzungen/${s.id}/protokoll`, { anwesende, bemerkungen: 'Keine Bemerkungen zum Protokoll der letzten Sitzung.' });
  await ue.mitEtag('POST', `/v1/sitzungen/${s.id}/protokoll`, `/v1/sitzungen/${s.id}/protokoll/versenden`);
  for (const pj of Object.values(k.projekte)) if (pj.portfolio.id === pf.id) await nachlesen(k, pj);
  k.log(`Sitzung ${pf.gremium.kuerzel.toUpperCase()} ${datum}: ${modus.body.traktanden.length} Traktanden, ${n} Entscheide, Protokoll versendet`);
}

/** Kommende Sitzung in Vorbereitung mit allen offenen Vorschlägen. */
export async function sitzungVorbereiten(k: Kontext, pf: Portfolio, datum: string): Promise<string> {
  const s = await anlegen(k, pf, datum, 'Sitzungszimmer Direktion, Haus A');
  k.log(`Sitzung ${pf.gremium.kuerzel.toUpperCase()} ${datum}: in Vorbereitung`);
  return s.id;
}

/** Auflage mit Termin in zwei Wochen für die Projektleitung. */
export const auflage = (k: Kontext, key: string, text: string) => ({ text, verantwortlich: pid(k, k.projekte[key]!.pl), termin: inTagen(14) });
