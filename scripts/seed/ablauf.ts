/**
 * Zeitlicher Ablauf der Demo: die letzten sechs Monate Monat für Monat (Statusberichte, Monatsabschluss,
 * Gremiumssitzungen mit Gate-, Ideen-, Eskalations-, Änderungs- und Abschlussentscheiden), danach der laufende Monat mit
 * offenen Ständen und den kommenden Sitzungen.
 */
import { bericht, BERICHTE, monatsabschluss } from './berichte.ts';
import { termin } from './grundlagen.ts';
import { ausIdee, ideeTelemedizin, weitereIdeen } from './ideen.ts';
import { pid, type Kontext, type Projekt } from './kontext.ts';
import { def, PROJEKTE, projektAnlegen, vertrag } from './projekte.ts';
import { auflage, sitzungDurchfuehren, sitzungVorbereiten, type Einplanen, type Entscheide } from './sitzungen.ts';
import { priorisierungEntscheid } from './weitere.ts';
import { heute, inTagen, monat, monatsende } from './zeit.ts';

const PRAT_ANWESENDE = 'Claudia Keller (Vorsitz), Thomas Brunner, Martina Vogel, Ursula Egli (Programmleitung), Patrick Meier (Protokoll)';
const GLPA_ANWESENDE = 'Martina Vogel (Vorsitz), Claudia Keller, Ursula Egli, Nina Baumann';

const berichtspflichtig = (pj: Projekt, n: number) =>
  pj.lebenszyklus === 'aktiv' && ['P0', 'P1', 'P2', 'P3'].includes(pj.phase) && pj.berichteAb <= n && pj.portfolio.schluessel !== 'pflege';

async function berichte(k: Kontext, n: number): Promise<void> {
  let z = 0;
  for (const pj of Object.values(k.projekte)) {
    if (!berichtspflichtig(pj, n) || BERICHTE[pj.key]?.[n]?.stand === 'fehlt') continue;
    await bericht(k, pj, n, monatsende(monat(def(pj.key)?.plan.P4 ?? 12)));
    z++;
  }
  k.log(`Statusberichte ${monat(n)}: ${z}`);
}

/** Änderung am Vertrag mit Wirkung auf das Budget (Kap. 9): SP legt sie dem PRAT vor (PS.03.02). */
async function aenderungKis(k: Kontext): Promise<void> {
  const pj = k.projekte.kis!;
  const pl = k.p[pj.pl];
  const e = await pl.post<{ version: { id: string } }>(`/v1/projekte/${pj.id}/vertrag/entwuerfe`, { anlass: 'aenderung', begruendung: 'Höhere Lizenzkosten nach der Vertragsverhandlung mit dem Anbieter.' });
  const v = e.body.version.id;
  const url = `/v1/vertragsversionen/${v}/kapitel/9`;
  const kap = await pl.get<{ inhalt: { kosten: { phase: string; art: string; betrag: number | null }[] } }>(url);
  const kosten = kap.body.inhalt.kosten.map(x => x.phase === 'P3' && x.art === 'capex' ? { ...x, betrag: Math.round((x.betrag ?? 0) * 1.12) } : x);
  await pl.put(url, { inhalt: { ...kap.body.inhalt, kosten } }, kap.etag);
  await pl.mitEtag('POST', `/v1/vertragsversionen/${v}/aenderung`, `/v1/vertragsversionen/${v}/aenderung/einreichen`);
  await k.p[pj.sp].mitEtag('POST', `/v1/vertragsversionen/${v}/aenderung`, `/v1/vertragsversionen/${v}/aenderung/entscheiden`, { ergebnis: 'an_prat' });
}

/** Abschlussbericht mit Nutzenbeurteilung, eingereicht zum Exit-Gate (UC-015). */
async function abschlussLabor(k: Kontext): Promise<void> {
  const pj = k.projekte.labor!;
  const url = `/v1/projekte/${pj.id}/abschluss`;
  let etag = (await k.p[pj.pl].put(url, {
    projektstand: 'Probenstrasse in Betrieb, alle Analysegeräte angeschlossen.', zielerreichung: 'Durchlaufzeit Routineproben von 4 auf 1,5 Stunden gesenkt.', kpiWerte: [],
    businessCase: 'Kosten 3 % unter Budget; Einsparung von 6 FTE ab dem zweiten Betriebsjahr bestätigt.', uebergabe: 'Betrieb durch die Labormedizin, Wartung durch den Hersteller.',
    offenePunkte: [{ text: 'Anbindung des Notfalllabors', verantwortlich: 'Labormedizin', termin: monatsende(monat(3)) }],
  }, 'W/"0"')).etag;
  etag = (await k.p[pj.sp].put(`${url}/nutzen`, { rolle: 'sp', beurteilung: 'Nutzen erreicht; die Einsparungen sind im Budget eingeplant.' }, etag)).etag;
  etag = (await k.p.ursula.put(`${url}/nutzen`, { rolle: 'ue', beurteilung: 'Bestätigt; Nutzenmessung nach einem Jahr im Jahresrückblick.' }, etag)).etag;
  await k.p[pj.pl].post(`${url}/einreichen`, undefined, etag);
}

/** Meilenstein mit Abnahme durch das Gremium erreicht (Vorschlag beim nächsten Statusbericht). */
async function meilensteinErreicht(k: Kontext, key: string): Promise<void> {
  const pj = k.projekte[key]!;
  const ms = await k.p[pj.pl].get<{ items: { id: string; text: string; version: number; terminAktuell: string | null }[] }>(`/v1/projekte/${pj.id}/meilensteine`);
  const m = ms.body.items.find(x => x.text === def(key)?.abnahme?.text)!;
  await k.p[pj.pl].patch(`/v1/projekte/${pj.id}/meilensteine/${m.id}`, { abnahme: 'gremium', erreichtAm: inTagen(-50) }, `W/"${m.version}"`);
}

export async function ablauf(k: Kontext): Promise<void> {
  for (const d of PROJEKTE.filter(x => !x.ausIdee)) await projektAnlegen(k, d);
  k.log(`Projekte: ${Object.keys(k.projekte).length} angelegt`);
  const P = k.projekte;
  let teleIdee = '';

  // Vorbereitung je Sitzung (Monat relativ zu heute): Verträge bis zur Unterschrift, Ideen, Berichte zum Abschluss
  const vorPrat: Record<number, () => Promise<Einplanen[] | void>> = {
    [-5]: async () => { for (const x of ['aufnahme', 'kis', 'pflege2030']) await vertrag(k, P[x]!); },
    [-4]: async () => { for (const x of ['aufnahme', 'logistik', 'aoz']) await vertrag(k, P[x]!); },
    [-3]: async () => { for (const x of ['betten', 'portal', 'forschung']) await vertrag(k, P[x]!); },
    [-2]: async () => {
      await vertrag(k, P.aufnahme!);
      teleIdee = await ideeTelemedizin(k);
      return [{ art: 'abschluss', projektId: P.logistik!.id, titel: `Sistierung ${P.logistik!.nummer} ${P.logistik!.name}`, antrag: 'Sistierung bis die ERP-Migration abgeschlossen ist.' }];
    },
    [-1]: async () => { await vertrag(k, P.aoz!); await aenderungKis(k); await abschlussLabor(k); await priorisierungEntscheid(k); },
  };
  const entscheidePrat: Record<number, Entscheide> = {
    [-2]: {
      idee: { ergebnis: 'mit_auflagen', begruendung: 'Nutzen überzeugt; Initialisierung mit Auflagen freigegeben.', auflagen: [
        { text: 'Tarifierung mit zwei Versicherern klären', verantwortlich: pid(k, 'sandra'), termin: inTagen(14) },
        { text: 'Datenschutz-Folgenabschätzung für das Telemonitoring erstellen', verantwortlich: pid(k, 'lea'), termin: inTagen(-5) },
      ] },
      'abschluss:logistik': { ergebnis: 'sistiert', begruendung: 'Fachpersonen der Logistik sind in der ERP-Migration gebunden; Wiederaufnahme nach deren Abschluss.' },
    },
    [-1]: {
      // Gate mit Auflagen: der Vertrag geht zur Überarbeitung zurück, die Phase bleibt
      'gate:aoz': { ergebnis: 'mit_auflagen', begruendung: 'Konzept überzeugt; Finanzierung der Bauetappe 2 offen.', auflagen: [auflage(k, 'aoz', 'Finanzierungsplan Bauetappe 2 vorlegen')] },
    },
  };
  const vorGlpa: Record<number, () => Promise<void>> = {
    [-3]: async () => { await vertrag(k, P.erp!); },
    [-2]: async () => { await vertrag(k, P.einkauf!); },
  };

  for (let n = -6; n <= -1; n++) {
    if (n === -2) await meilensteinErreicht(k, 'pflege2030');
    await berichte(k, n);
    await monatsabschluss(k, n);
    // Sitzungen des Folgemonats, soweit ihr Termin vorbei ist
    const m = n + 1;
    if (termin('prat', m) < heute()) {
      const extra = (await vorPrat[m]?.()) ?? [];
      await sitzungDurchfuehren(k, k.portfolios.A, termin('prat', m), entscheidePrat[m] ?? {}, PRAT_ANWESENDE, extra);
      if (m === -2) await ausIdee(k, teleIdee, 'tele', { sp: 'claudia', pl: 'sandra', ctl: 'lea', kt: ['sarah'], berichteAb: -1 }, 'A');
    }
    if (m >= -4 && termin('glpa', m) < heute()) {
      await vorGlpa[m]?.();
      await sitzungDurchfuehren(k, k.portfolios.B, termin('glpa', m), {}, GLPA_ANWESENDE);
    }
  }

  // Laufender Monat: offene Verträge, Wiederaufnahme, Ideen, Berichte, kommende Sitzungen
  await vertrag(k, P.betten!);
  await vertrag(k, P.portal!, 'eingereicht');
  await vertrag(k, P.tele!, 'entwurf');
  // Sistierungsbericht (angelegt mit dem Entscheid «sistiert»), danach Antrag auf Wiederaufnahme
  const sist = `/v1/projekte/${P.logistik!.id}/abschluss`;
  await k.p[P.logistik!.pl].mitEtag('PUT', sist, sist, {
    projektstand: 'RFID-Pilot auf Station 4 abgeschlossen, Rollout vorbereitet.', zielerreichung: 'Pilotziele erreicht.', kpiWerte: [], businessCase: '', uebergabe: '', offenePunkte: [],
  });
  await k.p[P.logistik!.pl].post(`/v1/projekte/${P.logistik!.id}/wiederaufnahme`, { begruendung: 'Die ERP-Migration ist im Plan; die Logistik kann ab dem nächsten Quartal wieder Fachpersonen stellen.' });
  await weitereIdeen(k);
  await berichte(k, 0);
  const portal = await k.p.ursula.get(`/v1/projekte/${P.portal!.id}/berichte/${monat(0)}`);
  await k.p.ursula.post(`/v1/projekte/${P.portal!.id}/berichte/${monat(0)}/rueckfragen`, { text: 'Bitte ergänze den Termin der Ausschreibung im nächsten Meilenstein.' }, portal.etag);
  const auflagen = await k.p.ursula.get<{ items: { auflagen: { id: string; verantwortlich: { id: string } | string }[] }[] }>('/v1/entscheide?auflagen=offen');
  const erste = auflagen.body.items.flatMap(x => x.auflagen)[0];
  if (erste) await k.p.ursula.post(`/v1/auflagen/${erste.id}/erfuellen`);
}

/** Kommende Sitzungen von PRAT und GLPA in Vorbereitung mit allen offenen Vorschlägen. */
export async function kommendeSitzungen(k: Kontext): Promise<void> {
  for (const [pf, kuerzel] of [[k.portfolios.A, 'prat'], [k.portfolios.B, 'glpa']] as const) {
    const n = termin(kuerzel, 0) >= heute() ? 0 : 1;
    await sitzungVorbereiten(k, pf, termin(kuerzel, n));
  }
}
