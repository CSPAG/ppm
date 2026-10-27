/** Bausteine aus docs/ux/darstellung.md: Text statt nur Farbe (Q-B5), Zustände der Datenliste (Z1–Z5), axe ohne Befund. */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StaticIam } from '@vollholz/iam-web/testing';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../test/axe.ts';
import {
  Datenliste, Hinweis, ProjektKlein, ProjektListe, Regelmeldung, regelText, Stand, Status, statusText, T, type ProjektKurz, type Spalte,
} from './index.ts';

const P: ProjektKurz = {
  nummer: '2026-014', name: 'Digitale Patientenaufnahme', phase: 'P2', status: 'kritisch', vorperiode: 'im-plan', trend: 'ab',
  projektleitung: 'Lea Brunner', meilenstein: { termin: '2026-11-12', text: 'Go-Live Pilot' }, merkmale: ['eskalation'],
};

describe('Status und Trend', () => {
  it('zeigt Text und Wechsel gegenüber der Vorperiode, Trend für Bildschirmleser', async () => {
    const { container } = render(<Status status="kritisch" vorperiode="im-plan" trend="ab" />);
    expect(screen.getByText('Im Plan → Kritisch')).toBeInTheDocument();
    expect(screen.getByText('Trend abwärts')).toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('«Nicht gemeldet» nennt die Vorperiode; kompakt bleibt der Text für Bildschirmleser', () => {
    expect(statusText({ status: 'nicht-gemeldet', vorperiode: 'kritisch' })).toBe('Nicht gemeldet · Vorperiode Kritisch');
    expect(statusText({ status: 'im-plan', vorperiode: 'im-plan' })).toBe('Im Plan');
    render(<Status status="im-plan" kompakt />);
    expect(screen.getByText('Im Plan')).toHaveClass('sr');
  });
});

describe('Bearbeitungsstand', () => {
  it('Badge mit Symbol, Stand und Zusatz', async () => {
    const { container } = render(<Stand familie="wartet" label="eingereicht" detail="wartet auf Unternehmensentwicklung" />);
    expect(container.textContent).toBe('eingereicht · wartet auf Unternehmensentwicklung');
    expect(container.querySelector('svg')).not.toBeNull();
    await expectNoAxe(container);
  });
});

describe('Hinweis und Regelmeldung', () => {
  it('Text nach «‹Regel›: ‹Ist› statt ‹Grenze› (‹wer›). ‹Vorschlag›.»', () => {
    expect(regelText({ regel: 'Unterlagen', ist: 'Versand 3', grenze: 'mindestens 5 Arbeitstage vor der Sitzung', wer: 'PRAT Mi 12.11.', vorschlag: 'Verschieben Sie das Traktandum.' }))
      .toBe('Unterlagen: Versand 3 statt mindestens 5 Arbeitstage vor der Sitzung (PRAT Mi 12.11.). Verschieben Sie das Traktandum.');
  });

  it('Stufe als Text, Sperre live als Alarm, Quelle einblendbar', async () => {
    const { container } = render(<>
      <Regelmeldung stufe="sperre" live regel="Kapazität Q2 2027" ist="7,5 FTE" grenze="höchstens 5,0" quelle="PM-Handbuch" />
      <Hinweis stufe="hinweis">Ähnliche Ideen vorhanden.</Hinweis>
    </>);
    expect(screen.getByRole('alert')).toHaveTextContent('Sperre: Kapazität Q2 2027: 7,5 FTE statt höchstens 5,0.');
    expect(screen.getByText(T.regel.quelle)).toBeInTheDocument();
    expect(screen.getByText('Hinweis:')).toBeInTheDocument();
    await expectNoAxe(container);
  });
});

describe('Projekt', () => {
  it('klein: Name, Phase mit Namen für Bildschirmleser, Status, Badge', async () => {
    const { container } = render(<ProjektKlein projekt={P} />);
    expect(screen.getByText('P2 Implementierung')).toHaveClass('sr');
    expect(screen.getByText('Eskalation offen')).toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('mittel: Zeile öffnet das Projekt per Klick und Tastatur', async () => {
    const oeffnen = vi.fn();
    const { container } = render(<StaticIam><ProjektListe titel="Projekte" heute="2026-10-22" zeilen={[P]} laedt={false} leer="leer" oeffnen={oeffnen} name={p => p.name} /></StaticIam>);
    const zeile = screen.getByRole('row', { name: /Digitale Patientenaufnahme/ });
    expect(within(zeile).getByText('Do 12.11. · Go-Live Pilot')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Digitale Patientenaufnahme öffnen' }));
    expect(oeffnen).toHaveBeenCalledWith(P);
    await expectNoAxe(container);
  });
});

describe('Datenliste', () => {
  type R = { id: string; label: string };
  const spalten: Spalte<R>[] = [{ key: 'label', titel: 'Bezeichnung', art: 'name', zelle: r => r.label }];
  const liste = (p: Partial<Parameters<typeof Datenliste<R>>[0]>) => (
    <StaticIam><Datenliste<R> titel="Liste" spalten={spalten} zeilen={[]} schluessel={r => r.id} laedt={false} leer="Noch nichts erfasst." {...p} /></StaticIam>
  );

  it('Laden: Skelett erst nach 300 ms (Z1)', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(liste({ laedt: true }));
      expect(container.querySelector('.skeleton')).toBeNull();
      expect(screen.getByText(T.common.loading)).toHaveAttribute('role', 'status');
      act(() => { vi.advanceTimersByTime(300); });
      expect(container.querySelector('.skeleton')).not.toBeNull();
    } finally { vi.useRealTimers(); }
  });

  it('leer beim ersten Mal mit Aktion (Z2), leer durch Filter mit Zurücksetzen (Z3)', async () => {
    const { unmount } = render(liste({ leerAktion: <button type="button">Erfassen</button> }));
    expect(screen.getByText('Noch nichts erfasst.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Erfassen' })).toBeInTheDocument();
    unmount();
    const zurueck = vi.fn();
    const { container } = render(liste({ gefiltert: true, zuruecksetzen: zurueck }));
    expect(screen.getByText(T.liste.leerGefiltert)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: T.liste.filterZuruecksetzen }));
    expect(zurueck).toHaveBeenCalled();
    await expectNoAxe(container);
  });

  it('Fehler mit «Erneut versuchen» (Z5), teilweise benannt (Z4), «Mehr laden»', async () => {
    const erneut = vi.fn();
    const { unmount } = render(liste({ fehler: new Error('kaputt'), erneut }));
    await userEvent.click(screen.getByRole('button', { name: T.common.retry }));
    expect(erneut).toHaveBeenCalled();
    unmount();
    const laden = vi.fn();
    const { container } = render(liste({ zeilen: [{ id: 'a', label: 'Eins' }], teilweise: 'Salden werden berechnet …', mehr: { vorhanden: true, laedt: false, laden } }));
    expect(screen.getByText('Salden werden berechnet …')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Liste' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: T.common.more }));
    expect(laden).toHaveBeenCalled();
    await expectNoAxe(container);
  });
});
