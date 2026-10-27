/**
 * Testdaten K1-4 (docs/ux/ablaeufe/K1-statusbericht.md, Zielgrösse K1-4; AP-E1-2): eine Periode mit 30 eingereichten
 * Berichten, davon genau 5 mit eingebauter Auffälligkeit – Status geändert (2), Termin verschoben gegenüber der
 * Baseline (1) bzw. «Abschluss per» gegenüber der Vorperiode (1), Prognose über Budget (1). Die übrigen 25 haben
 * Vorperiode, Meilensteine und Kosten ohne Abweichung (unauffällig, Sammelbestätigung K1-3). Für den automatischen
 * Test und als Vorlage der Daten im Aufgabentest.
 */
import type { Tx } from '@vollholz/platform';

export interface Testdaten {
  /** Projekt-ID je Nummer (2026-101 … 2026-130). */
  projekte: Record<string, string>;
  /** Nummern mit Auffälligkeit und deren Art. */
  auffaellig: Record<string, 'status' | 'termin' | 'budget'>;
}

const BEURTEILUNG = JSON.stringify(Object.fromEntries(['inhalt', 'termin', 'ressourcen', 'budget'].map(d => [d, { stufe: 'keine', kommentar: '' }])));

/** Legt Portfolio, 30 Projekte in P1–P3, Vorperiode (geprüft) und Periode (eingereicht) mit Registern an (volle Sicht). */
export async function testdatenK14(tx: Tx, t: string, periode: string, vorperiode: string, portfolioId: string): Promise<Testdaten> {
  const projekte: Record<string, string> = {};
  const auffaellig: Testdaten['auffaellig'] = { '2026-104': 'status', '2026-111': 'status', '2026-117': 'termin', '2026-123': 'termin', '2026-129': 'budget' };
  await tx.query('INSERT INTO ppm.periode (tenant_id, periode) VALUES ($1, $2), ($1, $3) ON CONFLICT DO NOTHING', [t, vorperiode, periode]);
  for (let i = 1; i <= 30; i++) {
    const nr = `2026-${100 + i}`;
    const phase = ['P1', 'P2', 'P3'][i % 3]!;
    const id = (await tx.query<{ id: string }>(
      "INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase, created_at) VALUES ($1, $2, $3, $4, $5, now() - interval '1 year') RETURNING id",
      [t, nr, `Vorhaben ${nr}`, portfolioId, phase])).rows[0]!.id;
    projekte[nr] = id;
    const art = auffaellig[nr];
    const vorStatus = art === 'status' && nr === '2026-111' ? 'kritisch' : 'im_plan';
    const status = art === 'status' && nr === '2026-104' ? 'kritisch' : 'im_plan';
    const abschlussVor = '2027-06-30';
    const abschluss = art === 'termin' && nr === '2026-123' ? '2027-08-31' : abschlussVor;
    const bericht = (p: string, stand: string, s: string, abschlussPer: string) => tx.query(
      `INSERT INTO ppm.statusbericht (tenant_id, projekt_id, periode, stand, status, trend, phase, abschluss_per, naechster_meilenstein, abweichung,
                                      begruendung, massnahme, eingereicht_at, geprueft_at)
       VALUES ($1, $2, $3, $4, $5, 'gleichbleibend', $6, $7, 'Nächster Schritt', $8, $9, $9, now() - interval '2 days', CASE WHEN $4 = 'geprueft' THEN now() END)`,
      [t, id, p, stand, s, phase, abschlussPer, BEURTEILUNG, s === 'kritisch' ? 'Lieferverzug' : '']);
    await bericht(vorperiode, 'geprueft', vorStatus, abschlussVor);
    await bericht(periode, 'eingereicht', status, abschluss);
    // Register: Meilenstein mit Baseline (verschoben nur bei 2026-117), Kosten mit Budget (Prognose darüber nur bei 2026-129)
    await tx.query(
      `INSERT INTO ppm.meilenstein (tenant_id, projekt_id, phase, art, text, termin_baseline, termin_aktuell)
       VALUES ($1, $2, $3, 'meilenstein', 'Abnahme', '2027-03-31', $4), ($1, $2, 'P3', 'lieferergebnis', 'Einführung', '2027-06-30', '2027-06-30')`,
      [t, id, phase === 'P3' ? 'P2' : phase, nr === '2026-117' ? '2027-04-21' : '2027-03-31']);
    await tx.query(
      `INSERT INTO ppm.kosten (tenant_id, projekt_id, phase, art, text, budget_baseline, prognose) VALUES ($1, $2, 'P2', 'capex', 'Lizenzen', 1000000, $3)`,
      [t, id, nr === '2026-129' ? 1060000 : 980000]);
  }
  return { projekte, auffaellig };
}
