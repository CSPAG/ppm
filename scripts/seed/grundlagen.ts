/**
 * Grundlagen der Demo: Stammdaten (Organisationseinheiten, Codetabellen, Feiertage), Strategie (Handlungsfelder,
 * strategische Ziele, Zielzyklen), Phasenmodell, Portfolios A/B/C mit Gremien, Terminen, Gremienweg und Rollen am
 * Portfolio (Spezifikation 4, Q8 Kap. 1 und 5).
 */
import type { Kontext, Portfolio } from './kontext.ts';
import { pid } from './kontext.ts';
import { feiertage, jahr, sitzungstag } from './zeit.ts';

const ORG_EINHEITEN = [
  { kuerzel: 'AeD', name: 'Ärztliche Direktion', art: 'direktion' },
  { kuerzel: 'DPF', name: 'Direktion Pflege', art: 'direktion' },
  { kuerzel: 'DLF', name: 'Direktion Lehre und Forschung', art: 'direktion' },
  { kuerzel: 'DMS', name: 'Direktion Medizinische Services', art: 'direktion' },
  { kuerzel: 'DTI', name: 'Direktion Technologie und Innovation', art: 'direktion' },
  { kuerzel: 'DP', name: 'Direktion Personal', art: 'direktion' },
  { kuerzel: 'DIB', name: 'Direktion Immobilien und Betrieb', art: 'direktion' },
  { kuerzel: 'DTI-ICT', name: 'ICT', art: 'bereich', parent: 'DTI' },
  { kuerzel: 'DPF-BI', name: 'Bildung Pflege', art: 'bereich', parent: 'DPF' },
  { kuerzel: 'DMS-LAB', name: 'Labormedizin', art: 'bereich', parent: 'DMS' },
  { kuerzel: 'DIB-LOG', name: 'Logistik', art: 'bereich', parent: 'DIB' },
] as const;

/** Strategie 2035 (Q9, öffentlich; docs/PPM-Master.md Abschnitt 4) mit Stossrichtungen und strategischen Zielen der Demo. */
export const STRATEGIE = [
  {
    key: 'kultur', label: 'Mitarbeitende und Unternehmenskultur', leitsatz: 'Wir sind eine attraktive Arbeitgeberin und entwickeln unsere Mitarbeitenden.',
    stossrichtungen: ['Fachkräfte gewinnen und halten', 'Führung stärken'],
    ziele: [
      { nummer: '1.1', text: 'Fluktuation in der Pflege senken', metrik: 'Fluktuationsrate Pflege', zielwert: '≤ 10 %' },
      { nummer: '1.2', text: 'Ausbildungsplätze ausbauen', metrik: 'Ausbildungsplätze Pflege', zielwert: '+ 15 %' },
    ],
  },
  {
    key: 'patient', label: 'Patientenorientierung', leitsatz: 'Wir stellen die Patientinnen und Patienten ins Zentrum.',
    stossrichtungen: ['Zugang vereinfachen', 'Behandlungspfade durchgängig gestalten'],
    ziele: [
      { nummer: '2.1', text: 'Wartezeit bis zur Aufnahme senken', metrik: 'Median Wartezeit Aufnahme', zielwert: '− 30 %' },
      { nummer: '2.2', text: 'Patientenzufriedenheit steigern', metrik: 'Net Promoter Score', zielwert: '≥ 60' },
    ],
  },
  {
    key: 'medizin', label: 'Medizin der Zukunft', leitsatz: 'Wir nutzen Daten und Technologie für bessere Medizin.',
    stossrichtungen: ['Digitale Klinik', 'Datennutzung für Forschung'],
    ziele: [
      { nummer: '3.1', text: 'Klinische Dokumentation vollständig digital', metrik: 'Anteil digitaler Dokumentation', zielwert: '100 %' },
      { nummer: '3.2', text: 'Forschungsdaten nutzbar machen', metrik: 'Studien mit Datenplattform', zielwert: '≥ 25 pro Jahr' },
    ],
  },
  {
    key: 'markt', label: 'Marktpositionierung und Vernetzung', leitsatz: 'Wir vernetzen uns mit Partnern in der Region.',
    stossrichtungen: ['Ambulante Angebote ausbauen', 'Zuweisende einbinden'],
    ziele: [
      { nummer: '4.1', text: 'Ambulanten Anteil erhöhen', metrik: 'Anteil ambulanter Eingriffe', zielwert: '≥ 45 %' },
    ],
  },
  {
    key: 'wirtschaft', label: 'Wirtschaftlichkeit', leitsatz: 'Wir arbeiten effizient und sichern unsere Investitionskraft.',
    stossrichtungen: ['Prozesse automatisieren', 'Sachkosten senken'],
    ziele: [
      { nummer: '5.1', text: 'EBITDA-Marge verbessern', metrik: 'EBITDA-Marge', zielwert: '≥ 10 %' },
      { nummer: '5.2', text: 'Sachkosten senken', metrik: 'Sachkosten je Fall', zielwert: '− 5 %' },
    ],
  },
] as const;

/** Jahresziele des laufenden Jahres je strategischem Ziel, mit Hauptaktivitäten. */
const JAHRESZIELE = [
  { ziel: '1.1', text: 'Fluktuation Pflege auf 12 % senken', metrik: 'Fluktuationsrate', zielwert: '≤ 12 %', aktivitaeten: [['Fachkräfteprogramm Pflege umsetzen', 'eva']] },
  { ziel: '2.1', text: 'Digitale Aufnahme in zwei Kliniken einführen', metrik: 'Kliniken mit digitaler Aufnahme', zielwert: '2', aktivitaeten: [['Pilot Notfallzentrum', 'sandra'], ['Rollout Frauenklinik', 'sandra']] },
  { ziel: '2.2', text: 'Patientenportal lancieren', metrik: 'Registrierte Nutzende', zielwert: '≥ 20 000', aktivitaeten: [['Portal ausschreiben', 'daniel']] },
  { ziel: '3.1', text: 'KIS-Ablösung starten', metrik: 'Meilensteine erreicht', zielwert: '3 von 3', aktivitaeten: [['Ausschreibung abschliessen', 'marco'], ['Systemarchitektur festlegen', 'marco']] },
  { ziel: '3.2', text: 'Datenplattform Forschung aufbauen', metrik: 'Angeschlossene Quellsysteme', zielwert: '5', aktivitaeten: [['Plattform bereitstellen', 'daniel']] },
  { ziel: '4.1', text: 'Ambulantes Operationszentrum planen', metrik: 'Baueingabe', zielwert: 'eingereicht', aktivitaeten: [['Betriebskonzept erstellen', 'marco']] },
  { ziel: '5.2', text: 'Sachkosten um 2 % senken', metrik: 'Sachkosten', zielwert: '− 2 %', aktivitaeten: [['Rahmenverträge neu verhandeln', 'martina'], ['Laborautomatisierung abschliessen', 'simon']] },
] as const;

export async function stammdaten(k: Kontext): Promise<void> {
  const a = k.p.anna;
  for (const o of ORG_EINHEITEN) {
    const r = await a.post<{ id: string }>('/v1/org-einheiten', {
      kuerzel: o.kuerzel, name: o.name, art: o.art, parentId: 'parent' in o ? k.orgEinheiten[o.parent] : null,
    });
    k.orgEinheiten[o.kuerzel] = r.body.id;
  }
  await a.post('/v1/codetabellen/vorgabe');
  for (const j of [jahr(), jahr(1)]) for (const f of feiertage(j)) await a.post('/v1/feiertage', f);
  k.log(`Stammdaten: ${ORG_EINHEITEN.length} Organisationseinheiten, Codetabellen, Feiertage ${jahr()}–${jahr(1)}`);
}

export async function strategie(k: Kontext): Promise<void> {
  const gl = k.p.claudia;
  const vorhanden = (await gl.get<{ items: { id: string; label: string }[] }>('/v1/handlungsfelder')).body.items;
  for (const [i, h] of STRATEGIE.entries()) {
    const da = vorhanden.find(x => x.label.toLowerCase() === h.label.toLowerCase());
    const felder = { leitsatz: h.leitsatz, stossrichtungen: [...h.stossrichtungen], position: i + 1 };
    k.handlungsfelder[h.key] = da
      ? (await gl.mitEtag('PATCH', `/v1/handlungsfelder/${da.id}`, `/v1/handlungsfelder/${da.id}`, felder), da.id)
      : (await gl.post<{ id: string }>('/v1/handlungsfelder', { label: h.label, ...felder })).body.id;
    for (const z of h.ziele) {
      k.ziele.strategisch[z.nummer] = (await gl.post<{ id: string }>('/v1/strategische-ziele', {
        handlungsfeldId: k.handlungsfelder[h.key], ...z, horizont: 2035,
      })).body.id;
    }
  }

  // Zielzyklus des laufenden Jahres: erfasst, vorgelegt, vom VR freigegeben, Roadmap publiziert (UC-011)
  const j = jahr();
  await gl.post(`/v1/ziele/${j}`, { vorlageBis: `${j - 1}-11-30` });
  for (const z of JAHRESZIELE) {
    const jz = (await gl.post<{ id: string }>('/v1/jahresziele', { jahr: j, strategischesZielId: k.ziele.strategisch[z.ziel], text: z.text, metrik: z.metrik, zielwert: z.zielwert })).body.id;
    k.ziele.jahr[z.ziel] = jz;
    for (const [text, wer] of z.aktivitaeten) await gl.post('/v1/hauptaktivitaeten', { jahreszielId: jz, text, verantwortlich: pid(k, wer) });
  }
  const zj = async () => `W/"${(await gl.get<{ zieljahr: { version: number } }>(`/v1/ziele/${j}`)).body.zieljahr.version}"`;
  await gl.post(`/v1/ziele/${j}/vorlegen`, undefined, await zj());
  await k.p.ursula.post(`/v1/ziele/${j}/freigabe`, { entscheid: 'freigegeben', datum: `${j - 1}-12-16`, text: 'Der VR gibt die Jahresziele einstimmig frei.' }, await zj());
  await k.p.ursula.post(`/v1/roadmap/${j}`);

  // Zielzyklus des Folgejahres: in Arbeit (Vorlage an den VR im Dezember)
  await gl.post(`/v1/ziele/${j + 1}`, { vorlageBis: `${j}-11-30` });
  for (const [ziel, text, metrik, zielwert] of [
    ['2.1', 'Digitale Aufnahme in allen Kliniken', 'Kliniken mit digitaler Aufnahme', '8'],
    ['3.1', 'KIS-Pilot in der Inneren Medizin', 'Pilotklinik produktiv', 'ja'],
    ['1.2', 'Ausbildungsplätze Pflege um 5 % erhöhen', 'Ausbildungsplätze', '+ 5 %'],
  ] as const) await gl.post('/v1/jahresziele', { jahr: j + 1, strategischesZielId: k.ziele.strategisch[ziel], text, metrik, zielwert });
  k.log(`Strategie: ${STRATEGIE.length} Handlungsfelder, ${Object.keys(k.ziele.strategisch).length} strategische Ziele, Jahresziele ${j} in Kraft, ${j + 1} in Arbeit`);
}

export async function phasenmodell(k: Kontext): Promise<void> {
  if ((await k.p.ursula.try('GET', '/v1/phasenmodelle/aktuell')).status === 200) return k.log('Phasenmodell: bereits in Kraft');
  const e = await k.p.ursula.post<{ id: string }>('/v1/phasenmodelle', { quelle: 'vorgabe', beschreibung: 'Phasenmodell nach PM-Handbuch' });
  const p = await k.p.ursula.patch(`/v1/phasenmodelle/${e.body.id}`, {
    toleranzen: [
      { dimension: 'termin', wert: 14, einheit: 'kalendertage' },
      { dimension: 'kosten', wert: 10, einheit: 'prozent' },
      { dimension: 'umfang', wert: 10, einheit: 'prozent' },
    ],
  }, e.etag);
  await k.p.anna.post(`/v1/phasenmodelle/${e.body.id}/in-kraft-setzen`, undefined, p.etag);
  k.log('Phasenmodell: Vorgabe mit Toleranzen in Kraft');
}

/** Sitzungstermine je Gremium: Monate relativ zu heute und Woche im Monat. */
const TERMINE = { prat: { von: -5, bis: 3, woche: 3 }, glpa: { von: -4, bis: 2, woche: 2 }, 'dir-pflege': { von: -2, bis: 2, woche: 4 } } as const;
export const termin = (kuerzel: keyof typeof TERMINE, n: number) => sitzungstag(n, TERMINE[kuerzel].woche);

export async function portfolios(k: Kontext): Promise<void> {
  const ue = k.p.ursula;
  const anlegen = async (kategorie: 'A' | 'B' | 'C', schluessel: string, name: string, gremium: { kuerzel: keyof typeof TERMINE; name: string; rhythmus: string }, orgEinheitId?: string): Promise<Portfolio> => {
    const pf = await ue.post<{ id: string }>('/v1/portfolios', { kategorie, schluessel, name, ...(orgEinheitId ? { orgEinheitId } : {}) });
    const g = await ue.post<{ id: string }>('/v1/gremien', { portfolioId: pf.body.id, kuerzel: gremium.kuerzel, name: gremium.name, art: 'entscheidend', rhythmus: gremium.rhythmus });
    const t = TERMINE[gremium.kuerzel];
    for (let n = t.von; n <= t.bis; n++) await ue.post(`/v1/gremien/${g.body.id}/termine`, { datum: termin(gremium.kuerzel, n) });
    return { id: pf.body.id, schluessel, gremium: { id: g.body.id, kuerzel: gremium.kuerzel } };
  };
  k.portfolios.A = await anlegen('A', 'transformation', 'Transformationsprogramm', { kuerzel: 'prat', name: 'Programmausschuss Transformation', rhythmus: 'monatlich' });
  k.portfolios.B = await anlegen('B', 'geschaeftsleitung', 'Portfolio der Geschäftsleitung', { kuerzel: 'glpa', name: 'GL Portfolio Ausschuss', rhythmus: 'monatlich' });
  k.portfolios.C = await anlegen('C', 'pflege', 'Direktion Pflege', { kuerzel: 'dir-pflege', name: 'Direktionsausschuss Pflege', rhythmus: 'monatlich' }, k.orgEinheiten.DPF);
  // SNS-VR als externes Gremium des Transformationsprogramms (Schnittstelle PRAT ↔ VR)
  await ue.post('/v1/gremien', { portfolioId: k.portfolios.A.id, kuerzel: 'sns-vr', name: 'Strategie-, Nominations- und Strukturausschuss des VR', art: 'extern' });
  for (const pf of [k.portfolios.A, k.portfolios.B]) {
    await ue.mitEtag('PUT', `/v1/portfolios/${pf.id}`, `/v1/portfolios/${pf.id}/gremienweg`, {
      schritte: ['EINTRITT_P0', 'P0_P1', 'P1_P2', 'P2_P3', 'P3_P4', 'EXIT_P4'].map(gate => ({ gate, gremiumId: pf.gremium.id })),
    });
  }

  // Rollen am Portfolio: Mitglieder der Gremien, Direktion Pflege
  for (const [wer, relation, pf] of [
    ['claudia', 'gremium', 'A'], ['thomas', 'gremium', 'A'], ['martina', 'gremium', 'B'], ['claudia', 'gremium', 'B'],
    ['eva', 'direktion', 'C'], ['eva', 'gremium', 'C'],
  ] as const) await k.p.anna.post('/v1/access', { subject: `user:${pid(k, wer)}`, relation, type: 'portfolio', id: k.portfolios[pf].id });

  for (const [pf, text, wahrscheinlichkeit, auswirkung, massnahme, verantwortlich] of [
    ['A', 'Fachkräftemangel in Pflege und ICT bremst mehrere Vorhaben', 'hoch', 'hoch', 'Gemeinsamer Ressourcenpool, Priorisierung im PRAT', 'Ursula Egli'],
    ['A', 'Zu viele Vorhaben gleichzeitig in der Einführung', 'mittel', 'hoch', 'Einführungsfenster je Klinik abstimmen', 'Ursula Egli'],
    ['A', 'Abhängigkeit vieler Vorhaben von der KIS-Ablösung', 'mittel', 'mittel', 'Schnittstellen früh festlegen', 'Marco Frei'],
    ['B', 'Budgetkürzung im Folgejahr', 'mittel', 'hoch', 'Vorhaben mit Etappen planen', 'Martina Vogel'],
  ] as const) await ue.post(`/v1/portfolios/${k.portfolios[pf].id}/risiken`, { text, wahrscheinlichkeit, auswirkung, massnahme, verantwortlich });
  k.log('Portfolios: Transformationsprogramm (PRAT, SNS-VR), Geschäftsleitung (GLPA), Direktion Pflege, mit Terminen und Gremienweg');
}
