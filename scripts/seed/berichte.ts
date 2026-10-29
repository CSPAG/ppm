/**
 * Statusberichte und Monatsabschluss der Demo (K1, UC-004/005): Berichte der Projektleitung je Periode, Prüfung durch
 * die UE, Abschluss der Periode und Portfoliobericht (Bericht der Programmleitung an das Gremium).
 */
import type { Kontext, Projekt } from './kontext.ts';
import { monat, monatsende } from './zeit.ts';

type Stufe = 'keine' | 'gering' | 'wesentlich';
export interface BerichtDef {
  status?: 'im_plan' | 'kritisch';
  trend?: 'aufwaerts' | 'gleichbleibend' | 'abwaerts';
  abweichung?: Partial<Record<'inhalt' | 'termin' | 'ressourcen' | 'budget', [Stufe, string]>>;
  begruendung?: string;
  massnahme?: string;
  entscheidNoetig?: boolean;
  /** Stand nach dem Seed: fehlt (ausstehend), Entwurf, eingereicht (ungeprüft) oder geprüft */
  stand?: 'fehlt' | 'entwurf' | 'eingereicht' | 'geprueft';
}

/** Besonderheiten je Projekt und Periode (Abstand zum laufenden Monat); sonst im Plan. */
export const BERICHTE: Record<string, Record<number, BerichtDef>> = {
  aufnahme: {
    [-2]: { trend: 'abwaerts', abweichung: { termin: ['gering', 'Schnittstelle zum KIS verzögert sich um drei Wochen.'] } },
    [-1]: { trend: 'abwaerts', abweichung: { termin: ['gering', 'Testumgebung des KIS weiterhin nicht verfügbar.'], ressourcen: ['gering', 'Zwei Entwickler im KIS-Projekt gebunden.'] } },
    0: {
      status: 'kritisch', trend: 'abwaerts', entscheidNoetig: true, stand: 'eingereicht',
      abweichung: { termin: ['wesentlich', 'Rollout Frauenklinik nicht vor Ende Quartal möglich.'], ressourcen: ['gering', 'Entwickler weiterhin im KIS-Projekt gebunden.'] },
      begruendung: 'Die Schnittstelle zur Patientenadministration ist nicht verfügbar; der Rollout verschiebt sich um zwei Monate.',
      massnahme: 'Übergangslösung mit Dateiimport; Entscheid des PRAT über die Priorität der Schnittstelle im KIS-Projekt.',
    },
  },
  kis: {
    [-3]: {
      status: 'kritisch', trend: 'abwaerts', entscheidNoetig: true,
      abweichung: { termin: ['wesentlich', 'Einsprache im Vergabeverfahren.'], budget: ['gering', 'Zusätzliche Kosten für Rechtsberatung.'] },
      begruendung: 'Ein unterlegener Anbieter hat Einsprache gegen den Zuschlag erhoben.', massnahme: 'Rechtliche Prüfung; Entscheid des PRAT über das weitere Vorgehen.',
    },
    [-2]: { trend: 'aufwaerts', abweichung: { termin: ['gering', 'Einsprache abgewiesen, Vertrag unterzeichnet.'] } },
    0: { trend: 'gleichbleibend', stand: 'geprueft', abweichung: { budget: ['gering', 'Höhere Lizenzkosten nach Vertragsverhandlung, Änderung freigegeben.'] } },
  },
  betten: { 0: { stand: 'entwurf', trend: 'gleichbleibend' } },
  aoz: { [-2]: { trend: 'aufwaerts' }, 0: { stand: 'eingereicht', trend: 'gleichbleibend' } },
  pflege2030: { [-1]: { trend: 'aufwaerts' }, 0: { stand: 'geprueft', trend: 'aufwaerts' } },
  logistik: { [-4]: { trend: 'abwaerts', abweichung: { ressourcen: ['wesentlich', 'Fachpersonen der Logistik in der ERP-Migration gebunden.'] } } },
  portal: { 0: { stand: 'eingereicht', trend: 'gleichbleibend' } },
  forschung: { [-1]: { abweichung: { inhalt: ['gering', 'Zweites Quellsystem später angeschlossen.'] } }, 0: { stand: 'eingereicht' } },
  erp: { [-1]: { abweichung: { budget: ['gering', 'Zusätzliche Migrationstage.'] } }, 0: { stand: 'eingereicht' } },
  einkauf: { 0: { stand: 'geprueft', trend: 'aufwaerts' } },
  energie: { 0: { stand: 'fehlt' } },
};

const MEILENSTEIN: Record<string, string> = {
  aufnahme: 'Pilot Notfallzentrum produktiv', kis: 'Zuschlag und Vertragsunterzeichnung', betten: 'Konzept Leitstelle abgenommen', aoz: 'Baueingabe eingereicht',
  pflege2030: 'Arbeitszeitmodell eingeführt', logistik: 'RFID-Pilot Station 4', portal: 'Ausschreibung publiziert', forschung: 'Zweites Quellsystem angeschlossen',
  erp: 'Testmigration Mandant 1', einkauf: 'Rahmenvertrag Verbrauchsmaterial', energie: 'Variantenstudie',
};

/** Bericht der Projektleitung für die Periode n (Abstand zum laufenden Monat). */
export async function bericht(k: Kontext, pj: Projekt, n: number, abschlussPer: string): Promise<'entwurf' | 'eingereicht' | 'geprueft'> {
  const d: BerichtDef = BERICHTE[pj.key]?.[n] ?? {};
  const pl = k.p[pj.pl];
  const periode = monat(n);
  const url = `/v1/projekte/${pj.id}/berichte/${periode}`;
  const stufe = (x: 'inhalt' | 'termin' | 'ressourcen' | 'budget') => ({ stufe: d.abweichung?.[x]?.[0] ?? 'keine', kommentar: d.abweichung?.[x]?.[1] ?? '' });
  const kritisch = d.status === 'kritisch';
  const body = {
    anlass: 'monatlich', status: d.status ?? 'im_plan', trend: d.trend ?? 'gleichbleibend', abschlussPer,
    naechsterMeilenstein: MEILENSTEIN[pj.key] ?? 'Nächstes Gate',
    abweichung: { inhalt: stufe('inhalt'), termin: stufe('termin'), ressourcen: stufe('ressourcen'), budget: stufe('budget') },
    abhaengigkeiten: pj.key === 'aufnahme' ? 'Schnittstelle Patientenadministration aus dem KIS-Projekt.' : '',
    entscheide: kritisch ? 'Priorität der Schnittstelle im KIS-Projekt.' : '',
    ...(kritisch ? { begruendung: d.begruendung, massnahme: d.massnahme, entscheidNoetig: d.entscheidNoetig ?? false } : {}),
  };
  const e = await pl.put(url, body, 'W/"0"');
  const stand = d.stand ?? (n < 0 ? 'geprueft' : 'eingereicht');
  if (stand === 'entwurf' || stand === 'fehlt') return 'entwurf';
  const r = await pl.post(`${url}/einreichen`, undefined, e.etag);
  if (stand === 'geprueft') await k.p.ursula.post(`${url}/pruefen`, undefined, r.etag);
  return stand;
}

/** Periode abschliessen und Portfoliobericht bereitstellen (Traktandum 1 der nächsten Sitzung). */
export async function monatsabschluss(k: Kontext, n: number): Promise<void> {
  const ue = k.p.ursula;
  const periode = monat(n);
  await ue.post(`/v1/perioden/${periode}/abschliessen`);
  for (const pf of [k.portfolios.A, k.portfolios.B]) {
    const b = await ue.post<{ id: string }>('/v1/portfolioberichte', { portfolio: pf.schluessel, periode });
    const c = await ue.patch(`/v1/portfolioberichte/${b.body.id}`, {
      kommentar: pf === k.portfolios.A ? `Programm insgesamt auf Kurs; Abhängigkeiten zur KIS-Ablösung bleiben das Hauptrisiko (Stand ${monatsende(periode)}).` : 'Portfolio im Plan.',
    }, b.etag);
    await ue.post(`/v1/portfolioberichte/${b.body.id}/bereitstellen`, undefined, c.etag);
  }
}
