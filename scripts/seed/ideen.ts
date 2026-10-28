/** Projektideen der Demo (K4, UC-001) in allen Ständen: Entwurf bis Freigabe mit neuem Projekt. */
import type { Als } from './api.ts';
import type { Kontext, PersonKey, Projekt } from './kontext.ts';
import { pid } from './kontext.ts';
import { organisation } from './projekte.ts';

interface IdeeDef { titel: string; ausgangslage: string; zielsetzung: string; handlungsfeld: string; bereich: string; nutzen: 'hoch' | 'mittel' | 'tief'; aufwand: 'hoch' | 'mittel' | 'tief'; relevanz: 'hoch' | 'mittel' | 'tief' }

async function erfassen(k: Kontext, wer: PersonKey, d: IdeeDef, einreichen = true): Promise<{ id: string; etag: string }> {
  const a = k.p[wer];
  const r = await a.post<{ id: string }>('/v1/ideen', {
    titel: d.titel, ausgangslage: d.ausgangslage, zielsetzung: d.zielsetzung, handlungsfeldId: k.handlungsfelder[d.handlungsfeld], bereiche: [k.orgEinheiten[d.bereich]],
    nutzen: d.nutzen, nutzenText: 'Siehe Zielsetzung.', aufwand: d.aufwand, aufwandText: 'Grobe Schätzung der Antragstellerin bzw. des Antragstellers.', relevanz: d.relevanz, relevanzText: 'Betrifft mehrere Kliniken.',
    herkunft: 'bereich',
  });
  if (!einreichen) return { id: r.body.id, etag: r.etag };
  const e = await a.post(`/v1/ideen/${r.body.id}/einreichen`, undefined, r.etag);
  return { id: r.body.id, etag: e.etag };
}

/** Prüfung durch die UE: Leitfragen zum Eintritt P0, Kriterienraster, Kategorie. */
async function pruefen(k: Kontext, idee: { id: string; etag: string }, kategorie: 'A' | 'B' | 'C', sponsor: PersonKey): Promise<string> {
  const ue = k.p.ursula;
  let etag = (await ue.put(`/v1/ideen/${idee.id}/leitfragen`, {
    antworten: [0, 1, 2, 3, 4].map(position => ({ position, antwort: ['Ja, Beitrag zur Strategie 2035.', 'Betrifft mehrere Direktionen.', 'Grobaufwand ist plausibel.', 'Sponsor ist bereit.', 'Keine Doppelung mit laufenden Vorhaben.'][position]! })),
    vorgesehenerSponsor: pid(k, sponsor),
  }, idee.etag)).etag;
  etag = (await ue.put(`/v1/ideen/${idee.id}/raster`, {
    raster: [['relevanz', 'hoch'], ['direktionen', kategorie === 'C' ? 'tief' : 'hoch'], ['abhaengigkeiten', 'mittel'], ['priorisierung', kategorie === 'C' ? 'tief' : 'hoch'], ['change', 'mittel']]
      .map(([kriterium, einschaetzung]) => ({ kriterium, einschaetzung })),
  }, etag)).etag;
  return (await ue.post(`/v1/ideen/${idee.id}/kategorie`, { kategorie, portfolioId: k.portfolios[kategorie].id, begruendung: 'Gesamtbeurteilung nach Kriterienraster.' }, etag)).etag;
}

const TELE: IdeeDef = {
  titel: 'Telemedizinische Nachsorge', ausgangslage: 'Nach der Entlassung fehlen strukturierte Kontakte; Wiedereintritte sind häufig.',
  zielsetzung: 'Nachsorge per Video und Telemonitoring für chronisch Kranke, Wiedereintritte um 20 % senken.', handlungsfeld: 'patient', bereich: 'AeD', nutzen: 'hoch', aufwand: 'mittel', relevanz: 'hoch',
};

/** Idee «Telemedizin» (mit zusammengeführter Idee) bis zum Traktandum im PRAT; der Entscheid fällt in der Sitzung. */
export async function ideeTelemedizin(k: Kontext): Promise<string> {
  const idee = await erfassen(k, 'sarah', TELE);
  const doppelt = await erfassen(k, 'simon', { ...TELE, titel: 'Telemonitoring Herzinsuffizienz', zielsetzung: 'Gewicht und Blutdruck zu Hause messen und überwachen.', relevanz: 'mittel' });
  await k.p.ursula.post(`/v1/ideen/${doppelt.id}/zusammenfuehren`, { fuehrendeIdeeId: idee.id }, doppelt.etag);
  let etag = await pruefen(k, { id: idee.id, etag: (await k.p.ursula.get(`/v1/ideen/${idee.id}`)).etag }, 'A', 'claudia');
  etag = (await k.p.ursula.put(`/v1/ideen/${idee.id}/freigabe/angaben`, { sponsor: pid(k, 'claudia'), projektleitung: pid(k, 'sandra') }, etag)).etag;
  await k.p.ursula.post(`/v1/ideen/${idee.id}/traktandieren`, undefined, etag);
  return idee.id;
}

/** Projekt aus einer freigegebenen Idee übernehmen und die Projektorganisation ergänzen. */
export async function ausIdee(k: Kontext, ideeId: string, key: string, als: Pick<Projekt, 'sp' | 'pl' | 'ctl' | 'kt' | 'berichteAb'>, portfolio: 'A' | 'C'): Promise<Projekt> {
  const f = await k.p.ursula.get<{ projekt: { id: string } | string }>(`/v1/ideen/${ideeId}/freigabe`);
  const id = typeof f.body.projekt === 'string' ? f.body.projekt : f.body.projekt.id;
  const p = await k.p.ursula.get<{ nummer: string; name: string; phase: string }>(`/v1/projekte/${id}`);
  const pj: Projekt = { key, id, nummer: p.body.nummer, name: p.body.name, portfolio: k.portfolios[portfolio], phase: p.body.phase, lebenszyklus: 'aktiv', ...als };
  await organisation(k, pj);
  k.projekte[key] = pj;
  return pj;
}

/** Weitere Ideen in den übrigen Ständen; Kategorie C mit Freigabe durch die Direktion. */
export async function weitereIdeen(k: Kontext): Promise<void> {
  const ue: Als = k.p.ursula;
  // Entwurf
  await erfassen(k, 'sarah', { titel: 'KI-gestützte Triage im Notfall', ausgangslage: 'Die Ersteinschätzung im Notfall dauert zu Spitzenzeiten zu lange.', zielsetzung: 'Vorschlag der Dringlichkeit aus Vitaldaten und Leitsymptom.', handlungsfeld: 'medizin', bereich: 'AeD', nutzen: 'hoch', aufwand: 'hoch', relevanz: 'mittel' }, false);
  // Eingereicht, noch nicht geprüft
  await erfassen(k, 'sarah', { titel: 'Mehrsprachige Patienteninformation', ausgangslage: 'Informationen zu Eingriffen gibt es nur auf Deutsch und Französisch.', zielsetzung: 'Aufklärung in den zehn häufigsten Sprachen, digital und gedruckt.', handlungsfeld: 'patient', bereich: 'DPF', nutzen: 'mittel', aufwand: 'tief', relevanz: 'mittel' });
  // In Ergänzung (Rückfrage der UE)
  const visite = await erfassen(k, 'simon', { titel: 'Digitale Visite', ausgangslage: 'Visiten werden auf Papier vorbereitet.', zielsetzung: 'Visite mit Tablet und aktuellen Daten aus dem KIS.', handlungsfeld: 'medizin', bereich: 'AeD', nutzen: 'mittel', aufwand: 'mittel', relevanz: 'mittel' });
  await ue.post(`/v1/ideen/${visite.id}/rueckfragen`, { fragen: [{ feld: 'zielsetzung', text: 'Woran misst du den Erfolg? Bitte ergänze eine Zielgrösse.' }] }, visite.etag);
  // Zurückgewiesen
  const parken = await erfassen(k, 'marco', { titel: 'Parkplatz-App für Mitarbeitende', ausgangslage: 'Freie Parkplätze sind schwer zu finden.', zielsetzung: 'App zeigt freie Plätze in den Parkhäusern.', handlungsfeld: 'kultur', bereich: 'DIB', nutzen: 'tief', aufwand: 'mittel', relevanz: 'tief' });
  await ue.post(`/v1/ideen/${parken.id}/zurueckweisen`, { begruendung: 'Kein Bezug zu den strategischen Zielen; Anliegen geht an die Direktion Immobilien und Betrieb.' }, parken.etag);
  // Kategorie B, dem GLPA vorgelegt
  const robotik = await erfassen(k, 'lea', { titel: 'Robotik in der Spitalapotheke', ausgangslage: 'Medikamente werden von Hand kommissioniert.', zielsetzung: 'Kommissionierroboter für Stationsbestellungen, Fehlerquote unter 0,1 %.', handlungsfeld: 'wirtschaft', bereich: 'DMS', nutzen: 'mittel', aufwand: 'mittel', relevanz: 'mittel' });
  let etag = await pruefen(k, robotik, 'B', 'martina');
  etag = (await ue.put(`/v1/ideen/${robotik.id}/freigabe/angaben`, { sponsor: pid(k, 'martina'), projektleitung: pid(k, 'daniel') }, etag)).etag;
  await ue.post(`/v1/ideen/${robotik.id}/traktandieren`, undefined, etag);
  // Kategorie C: Freigabe durch die Direktion Pflege
  const doku = await erfassen(k, 'sarah', { titel: 'Pflegedokumentation mobil', ausgangslage: 'Die Pflege dokumentiert am Stationsrechner, oft erst am Schichtende.', zielsetzung: 'Dokumentation am Bett mit dem Smartphone.', handlungsfeld: 'kultur', bereich: 'DPF', nutzen: 'mittel', aufwand: 'tief', relevanz: 'mittel' });
  etag = await pruefen(k, doku, 'C', 'eva');
  etag = (await ue.post(`/v1/ideen/${doku.id}/traktandieren`, undefined, etag)).etag;
  await k.p.eva.post(`/v1/ideen/${doku.id}/freigeben`, { sponsor: pid(k, 'eva'), projektleitung: pid(k, 'sarah'), begruendung: 'Entlastet die Teams; Umsetzung im Direktionsportfolio.' }, etag);
  await ausIdee(k, doku.id, 'doku', { sp: 'eva', pl: 'sarah', ctl: null, kt: ['jonas'], berichteAb: 99 }, 'C');
  k.log('Ideen: Entwurf, eingereicht, in Ergänzung, zurückgewiesen, zusammengeführt, dem GLPA vorgelegt, von der Direktion freigegeben');
}
