/** Formate nach docs/ux/darstellung.md (Beispiele von dort). */
import { describe, expect, it } from 'vitest';
import {
  arbeitstageBis, fmtAbweichung, fmtAbweichungWochen, fmtBetrag, fmtBetragKurz, fmtDatum, fmtFrist, fmtFristArbeitstage, fmtFte,
  fmtGate, fmtMonate, fmtPeriode, fmtPhase, fmtProzent, fmtQuartal, fmtZeitpunkt,
} from './format.ts';

const NB = '\u00a0';
// Donnerstag, 22. Oktober 2026
const HEUTE = '2026-10-22';

describe('Datum und Fristen', () => {
  it('Datum zum Planen mit Wochentag, Jahr nur ausserhalb des laufenden', () => {
    expect(fmtDatum('2026-11-12', HEUTE)).toBe('Do 12.11.');
    expect(fmtDatum('2027-03-31', HEUTE)).toBe('Mi 31.3.2027');
  });

  it('nahe Frist relativ und absolut, ferne nur absolut, vergangene überfällig', () => {
    expect(fmtFrist('2026-10-25', HEUTE)).toBe('So 25.10. · in 3 Tagen');
    expect(fmtFrist('2026-10-22', HEUTE)).toBe('Do 22.10. · heute');
    expect(fmtFrist('2026-10-23', HEUTE)).toBe('Fr 23.10. · morgen');
    expect(fmtFrist('2026-11-05', HEUTE)).toBe('Do 5.11. · in 14 Tagen');
    expect(fmtFrist('2026-11-06', HEUTE)).toBe('Fr 6.11.');
    expect(fmtFrist('2026-10-17', HEUTE)).toBe('überfällig seit Sa 17.10.');
  });

  it('Frist in Arbeitstagen ohne Wochenende, ausdrücklich benannt', () => {
    expect(arbeitstageBis('2026-10-28', HEUTE)).toBe(4);
    expect(fmtFristArbeitstage('2026-10-28', HEUTE)).toBe('Mi 28.10. · in 4 Arbeitstagen');
    expect(fmtFristArbeitstage('2026-10-23', HEUTE)).toBe('Fr 23.10. · in 1 Arbeitstag');
    expect(fmtFristArbeitstage('2026-10-20', HEUTE)).toBe('überfällig seit Di 20.10.');
  });

  it('Zeitpunkt absolut mit Zeit in Schweizer Zeit', () => {
    expect(fmtZeitpunkt('2026-11-12T14:42:00Z')).toBe('Do 12.11.2026, 15:42');
    expect(fmtZeitpunkt('2026-07-01T06:05:00Z')).toBe('Mi 1.7.2026, 08:05');
  });

  it('Periode, Quartal, Monate', () => {
    expect(fmtPeriode('2026-10')).toBe('Oktober 2026');
    expect(fmtQuartal(2026, 3)).toBe('Q3 2026');
    expect(fmtMonate('2027-03', '2027-12')).toBe('Mrz–Dez 2027');
    expect(fmtMonate('2026-11', '2027-02')).toBe('Nov 2026–Feb 2027');
  });
});

describe('Beträge und Zahlen', () => {
  it('Betrag im Detail mit Apostroph, ohne Rappen', () => {
    expect(fmtBetrag(1_250_000)).toBe(`CHF${NB}1'250'000`);
    expect(fmtBetrag(999.6)).toBe(`CHF${NB}1'000`);
  });

  it('Betrag in Listen in Mio. oder Tsd.', () => {
    expect(fmtBetragKurz(1_250_000)).toBe(`CHF${NB}1,25${NB}Mio.`);
    expect(fmtBetragKurz(380_000)).toBe(`CHF${NB}380${NB}Tsd.`);
    expect(fmtBetragKurz(999_600)).toBe(`CHF${NB}1,00${NB}Mio.`);
    expect(fmtBetragKurz(800)).toBe(`CHF${NB}800`);
  });

  it('Abweichungen mit Vorzeichen', () => {
    expect(fmtAbweichung(300_000, 14)).toBe(`+CHF${NB}300${NB}Tsd. · +14${NB}%`);
    expect(fmtAbweichung(-50_000)).toBe(`−CHF${NB}50${NB}Tsd.`);
    expect(fmtProzent(-3.4)).toBe(`−3${NB}%`);
    expect(fmtAbweichungWochen(3)).toBe(`+3${NB}Wochen`);
    expect(fmtAbweichungWochen(-1)).toBe(`−1${NB}Woche`);
  });

  it('FTE, Phase, Gate', () => {
    expect(fmtFte(2.5)).toBe(`2,5${NB}FTE`);
    expect(fmtPhase('P1')).toBe('P1 Konzept und Planung');
    expect(fmtGate('P1', 'P2')).toBe('Gate P1–P2');
    expect(fmtGate('eintritt', 'P0')).toBe('Gate Eintritt P0');
    expect(fmtGate('P4', 'exit')).toBe('Gate Exit P4');
  });
});
