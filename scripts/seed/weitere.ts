/**
 * Weitere Bereiche der Demo: Priorisierung (K5, UC-008), Ressourcen (Kapazität, Zuteilung), Finanzen (Kostenträger,
 * Ist aus dem ERP, Budgetübergabe), Register der Projekte (KPI-Werte, erreichte Meilensteine, Meldungen),
 * Zielerreichung, Quartalsreporting (UC-012), Jahresrückblick (UC-013), Lessons Learned und Stellvertretung.
 */
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Kontext, Projekt } from './kontext.ts';
import { pid } from './kontext.ts';
import { def } from './projekte.ts';
import { heute, inTagen, jahr, monat, quartaleVorbei } from './zeit.ts';

const laufend = (k: Kontext, pf: 'A' | 'B') => Object.values(k.projekte).filter(p => p.portfolio === k.portfolios[pf] && p.lebenszyklus === 'aktiv');

/** Bewertungsmodell in Kraft, Bewertungen, Szenario beantragt und traktandiert (Entscheid in der Sitzung). */
export async function priorisierungEntscheid(k: Kontext): Promise<void> {
  const ue = k.p.ursula;
  const m = await ue.post<{ id: string; kriterien: { schluessel: string }[] }>('/v1/bewertungsmodelle', { beschreibung: `Priorisierung ${jahr(1)}` });
  const p = await ue.patch(`/v1/bewertungsmodelle/${m.body.id}`, { budgetrahmen: [{ portfolioId: k.portfolios.A.id, betrag: 120_000_000 }, { portfolioId: k.portfolios.B.id, betrag: 10_000_000 }] }, m.etag);
  await ue.post(`/v1/bewertungsmodelle/${m.body.id}/in-kraft-setzen`, { beschluss: 'PRAT, Traktandum Priorisierungsmodell' }, p.etag);
  const kriterien = m.body.kriterien.map(x => x.schluessel);
  const stufe = ['hoch', 'mittel', 'tief'] as const;
  for (const pf of ['A', 'B'] as const) {
    const zellen = laufend(k, pf).flatMap((pj, i) => kriterien.map((kriterium, j) => ({ projektId: pj.id, kriterium, einschaetzung: stufe[(i + j) % 3], kommentar: '' })));
    await ue.put(`/v1/portfolios/${k.portfolios[pf].id}/bewertungen`, { zellen });
  }
  const pfA = k.portfolios.A.id;
  const s = await ue.post<{ id: string }>(`/v1/portfolios/${pfA}/szenarien`, { name: 'A: Plattformen zuerst' });
  const reihenfolge = ['kis', 'aufnahme', 'pflege2030', 'forschung', 'aoz', 'portal', 'betten'].map(x => k.projekte[x]).filter((x): x is Projekt => !!x && x.lebenszyklus === 'aktiv');
  let etag = (await ue.put(`/v1/szenarien/${s.body.id}/positionen`, { positionen: reihenfolge.map(pj => ({ projektId: pj.id })) }, s.etag)).etag;
  const b = await ue.post<{ id: string }>(`/v1/portfolios/${pfA}/szenarien`, { name: 'B: Patientennutzen zuerst' });
  await ue.put(`/v1/szenarien/${b.body.id}/positionen`, { positionen: [...reihenfolge].sort((x, y) => (y.key === 'portal' || y.key === 'aufnahme' ? 1 : 0) - (x.key === 'portal' || x.key === 'aufnahme' ? 1 : 0)).map(pj => ({ projektId: pj.id, ...(pj.key === 'aoz' ? { startMonat: monat(4) } : {}) })) }, b.etag);
  etag = (await ue.post(`/v1/szenarien/${s.body.id}/beantragen`, { vergleich: [b.body.id] }, etag)).etag;
  const e = await ue.get<{ unterWasserlinie: { projektId: string }[] }>(`/v1/szenarien/${s.body.id}/entscheid`);
  if (e.body.unterWasserlinie.length) {
    etag = (await ue.put(`/v1/szenarien/${s.body.id}/folgen`, { folgen: e.body.unterWasserlinie.map(x => ({ projektId: x.projektId, folge: 'zurueckstellen', begruendung: 'Budgetrahmen ausgeschöpft; Start im Folgejahr.' })) }, e.etag)).etag;
  } else etag = e.etag;
  await ue.post(`/v1/szenarien/${s.body.id}/traktandieren`, undefined, etag);
}

/** Kapazitätsangebot (RM), Zuteilungen auf die Bedarfe aus den Verträgen, eine gemeldete Lücke. */
export async function ressourcen(k: Kontext): Promise<void> {
  const zellen = Array.from({ length: 12 }, (_, i) => monat(i)).flatMap(m => [
    { rolle: 'projektleitung', monat: m, fte: 6 }, { rolle: 'ctl', monat: m, fte: 2.5 }, { rolle: 'projektmitarbeit', monat: m, fte: 14 },
  ]);
  await k.p.reto.put('/v1/kapazitaet', { zellen });
  const bedarfe = (await k.p.reto.get<{ items: { id: string; projektId: string; rolle: string; stand: string }[] }>('/v1/bedarfe')).body.items;
  const mitarbeit = ['jonas', 'sarah', 'bruno'] as const;
  let z = 0, luecke = false;
  for (const [i, b] of bedarfe.entries()) {
    const pj = Object.values(k.projekte).find(p => p.id === b.projektId);
    if (!pj || b.stand === 'gedeckt') continue;
    const person = b.rolle === 'projektleitung' ? pj.pl : b.rolle === 'ctl' ? pj.ctl : mitarbeit[i % mitarbeit.length]!;
    if (b.rolle === 'projektmitarbeit' && !luecke && pj.key === 'aufnahme') {
      await k.p.reto.put(`/v1/bedarfe/${b.id}/luecke`, { text: 'Keine Entwicklerinnen und Entwickler frei bis Ende Quartal; externe Unterstützung wird geprüft.' });
      luecke = true;
      continue;
    }
    // Ein Teil der Projektmitarbeit bleibt offen (Sammelaufgabe «Bedarf decken»)
    if (!person || (b.rolle === 'projektmitarbeit' && i % 3 === 0)) continue;
    const fte = b.rolle === 'projektmitarbeit' ? 0.5 : b.rolle === 'ctl' ? 0.5 : 0.8;
    const r = await k.p.reto.try('POST', `/v1/bedarfe/${b.id}/zuteilungen`, { personId: pid(k, person), fte });
    if (r.status < 300) z++;
  }
  k.log(`Ressourcen: Kapazität ${monat(0)}–${monat(11)}, ${bedarfe.length} Bedarfe, ${z} Zuteilungen, eine Lücke`);
}

/** Kostenträger (FI), Ist-Kosten über die Schnittstelle zum ERP, Abweichungsbegründung, Budgetübergabe des Folgejahres. */
export async function finanzen(k: Kontext): Promise<void> {
  // Vertrauliche Vorhaben sieht die Finanzen nicht (A-34)
  const mitBudget = Object.values(k.projekte).filter(p => p.portfolio !== k.portfolios.C && !def(p.key)?.vertraulich && Object.keys(def(p.key)?.budget ?? {}).length);
  const buchungen: { kostentraeger: string; monat: string; art: 'capex' | 'opex'; betrag: number }[] = [];
  for (const pj of mitBudget) {
    const kt = `KT-${pj.nummer}`;
    await k.p.nina.put(`/v1/projekte/${pj.id}/kostentraeger`, { nummer: kt });
    const jahresbudget = Object.values(def(pj.key)!.budget).reduce((s, x) => s + (x ?? 0), 0) / 12;
    // Mehr Ist als geplant bei der Patientenaufnahme (Abweichung)
    const faktor = pj.key === 'aufnahme' ? 1.4 : 0.8;
    for (let n = -6; n <= -1; n++) {
      buchungen.push({ kostentraeger: kt, monat: monat(n), art: 'capex', betrag: Math.round(jahresbudget * 0.6 * faktor) });
      buchungen.push({ kostentraeger: kt, monat: monat(n), art: 'opex', betrag: Math.round(jahresbudget * 0.25 * faktor) });
    }
  }
  // ERP der Demo: ein Server dieses Prozesses liefert die Buchungen für einen Lauf
  const server = createServer((_, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ buchungen })); });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  try {
    const port = (server.address() as AddressInfo).port;
    const s = await k.p.anna.post<{ schnittstelle: { id: string } }>('/v1/schnittstellen', { umsystem: 'erp', daten: 'ist_kosten', rhythmus: 'manuell', adresse: `http://127.0.0.1:${port}/ist` });
    await k.p.anna.post(`/v1/schnittstellen/${s.body.schnittstelle.id}/starten`);
  } finally { server.close(); }
  const auf = k.projekte.aufnahme!;
  await k.p[auf.pl].put(`/v1/projekte/${auf.id}/abweichungsbegruendungen/${monat(-1)}`, { text: 'Zusätzliche Kiosk-Terminals für den Pilot im Notfallzentrum; im Budget der Phase P3 kompensiert.' }, 'W/"0"');
  await k.p.nina.put(`/v1/budgetuebergaben/${jahr(1)}`, { korrekturen: [{ projektId: k.projekte.kis!.id, capex: null, opex: 250_000, bemerkung: 'Betriebskosten Altsystem bis zur Ablösung' }] });
  k.log(`Finanzen: ${mitBudget.length} Kostenträger, ${buchungen.length} Buchungen aus dem ERP, Budgetübergabe ${jahr(1)} in Arbeit`);
}

/** KPI-Werte der letzten Monate, erreichte Meilensteine, Meldungen an ICT und Infrastruktur. */
export async function register(k: Kontext): Promise<void> {
  let werte = 0, erreicht = 0;
  for (const pj of Object.values(k.projekte)) {
    if (pj.lebenszyklus !== 'aktiv') continue;
    const pl = k.p[pj.pl];
    if (['P2', 'P3', 'P4'].includes(pj.phase)) {
      const kpis = (await pl.get<{ items: { id: string; zielwert: string }[] }>(`/v1/projekte/${pj.id}/kpis`)).body.items;
      for (const [i, kpi] of kpis.entries()) {
        for (let n = -3; n <= -1; n++) {
          await pl.put(`/v1/projekte/${pj.id}/kpis/${kpi.id}/werte/${monat(n)}`, { wert: Math.round((20 + 10 * i + 4 * (n + 3)) * 10) / 10, kommentar: n === -1 ? 'Messung aus dem Reporting' : '' }, 'W/"0"');
          werte++;
        }
      }
    }
    const ms = (await pl.get<{ items: { id: string; version: number; terminAktuell: string | null; erreichtAm: string | null; phase: string }[] }>(`/v1/projekte/${pj.id}/meilensteine`)).body.items;
    for (const m of ms) {
      if (m.erreichtAm || !m.terminAktuell || m.terminAktuell >= heute() || m.phase >= pj.phase) continue;
      await pl.patch(`/v1/projekte/${pj.id}/meilensteine/${m.id}`, { erreichtAm: m.terminAktuell }, `W/"${m.version}"`);
      erreicht++;
    }
  }
  const P = k.projekte;
  await k.p[P.aufnahme!.pl].post(`/v1/projekte/${P.aufnahme!.id}/meldungen`, { stelle: 'dti', text: '12 Kiosk-Terminals mit Kartenleser für den Rollout in der Frauenklinik' });
  await k.p[P.aoz!.pl].post(`/v1/projekte/${P.aoz!.id}/meldungen`, { stelle: 'dbi', text: 'Flächenbedarf für sechs Operationssäle und Aufwachraum im Gebäude Nord' });
  k.log(`Register: ${werte} KPI-Werte, ${erreicht} erreichte Meilensteine, 2 Meldungen`);
}

/** Zielerreichung der abgeschlossenen Quartale, Quartalsbericht zuhanden des VR, Jahresrückblick in Arbeit. */
export async function ziele(k: Kontext): Promise<void> {
  const quartale = quartaleVorbei();
  const stand = ['auf Kurs', 'auf Kurs', 'gefährdet'] as const;
  for (const [qi, q] of quartale.entries()) {
    for (const [i, id] of Object.values(k.ziele.strategisch).entries()) {
      await k.p.claudia.post(`/v1/zielerreichung/${q}`, { zielTyp: 'strategisch', zielId: id, stand: `${20 + 15 * qi + i} % des Zielwerts`, beurteilung: stand[(i + qi) % 3] });
    }
    for (const [i, id] of Object.values(k.ziele.jahr).entries()) {
      await k.p.ursula.post(`/v1/zielerreichung/${q}`, { zielTyp: 'jahresziel', zielId: id, stand: `${25 * (qi + 1) - i} %`, beurteilung: stand[(i + qi + 1) % 3] });
    }
  }
  const q = quartale.at(-1);
  if (q) {
    const ue = k.p.ursula;
    const b = await ue.post(`/v1/quartalsberichte/${q}/erzeugen`);
    const c = await ue.patch(`/v1/quartalsberichte/${q}`, { kommentare: {
      gesamtstatus: 'Das Transformationsprogramm ist insgesamt auf Kurs; ein Vorhaben ist sistiert.',
      entwicklungen: 'Zuschlag für das neue KIS erteilt; Pilot der digitalen Aufnahme erfolgreich.',
      risiken: 'Fachkräftemangel und Abhängigkeit von der KIS-Ablösung.',
      auswirkungen: 'Höhere Lizenzkosten des KIS im Budget des Folgejahres.',
    } }, b.etag);
    await ue.post(`/v1/quartalsberichte/${q}/traktandieren`, undefined, c.etag);
  }
  await k.p.ursula.put(`/v1/jahresrueckblicke/${jahr()}`, {
    erkenntnisse: 'Zu viele Vorhaben gleichzeitig in der Einführung; Abhängigkeiten zur KIS-Ablösung früher klären.',
    massnahmen: 'Einführungsfenster je Klinik; Abhängigkeiten als Pflichtangabe im Gate P1–P2.',
  });
  k.log(`Ziele: Zielerreichung ${quartale.join(', ') || '–'}, Quartalsbericht ${q ?? '–'} traktandiert, Jahresrückblick ${jahr()} in Arbeit`);
}

/** Lessons Learned der abgeschlossenen und laufenden Vorhaben, Stellvertretung der Programmleitung. */
export async function lessonsUndStellvertretung(k: Kontext): Promise<void> {
  const P = k.projekte;
  for (const [key, text, kategorie] of [
    ['labor', 'Den Betrieb von Beginn an ins Kernteam nehmen; die Übergabe war dadurch reibungslos.', 'Übergabe'],
    ['labor', 'Testläufe mit echten Proben früh einplanen; Simulationen deckten nicht alle Fälle ab.', 'Qualität'],
    ['labor', 'Lieferantenvertrag mit Pönale für Verzug hat sich bewährt.', 'Beschaffung'],
    ['kis', 'Einsprachen im Vergabeverfahren im Terminplan einrechnen.', 'Beschaffung'],
    ['logistik', 'Ressourcenkonflikte mit anderen Vorhaben vor dem Gate klären.', 'Ressourcen'],
  ] as const) await k.p[P[key]!.pl].post(`/v1/projekte/${P[key]!.id}/lessons-learned`, { text, kategorie });
  await k.p.ursula.post('/v1/stellvertretungen', { vertreter: pid(k, 'patrick'), von: heute(), bis: inTagen(14) });
  k.log('Lessons Learned: 5, Stellvertretung der Programmleitung aktiv');
}
