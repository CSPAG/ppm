/**
 * App-weite Kürzel (docs/ux/rahmen/interaktion.md Abschnitt 11): «/» setzt den Fokus in die Suche der Liste, «?» zeigt
 * die Übersicht mit den festen Kürzeln und denen der Ansicht (`aria-keyshortcuts`); nie in Eingaben, nie über Dialogen.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { expectNoAxe } from '../test/axe.ts';
import { T } from '../ui/index.ts';
import { kuerzelTaste, KuerzelUebersicht } from './Kuerzel.tsx';

function Probe({ suche = true }: { suche?: boolean }) {
  const [offen, setOffen] = useState(false);
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (kuerzelTaste(e, () => setOffen(true))) e.preventDefault(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);
  return (
    <>
      <main id="main">
        {suche ? <input type="search" aria-label="Projekte durchsuchen" defaultValue="alt" /> : null}
        <input aria-label="Notiz" />
        <button type="button" aria-keyshortcuts="B" aria-label="Bericht bestätigen: 2026-001 Vorhaben 1">Bestätigen</button>
        <button type="button" aria-keyshortcuts="B" aria-label="Bericht bestätigen: 2026-002 Vorhaben 2">Bestätigen</button>
        <button type="button" aria-keyshortcuts="R">Rückfrage stellen</button>
      </main>
      {offen ? <KuerzelUebersicht onClose={() => setOffen(false)} /> : null}
    </>
  );
}

describe('Kürzel «/» und «?»', () => {
  it('«/» setzt den Fokus in die Suche und markiert den Text; im Eingabefeld bleibt «/» ein Zeichen', async () => {
    render(<Probe />);
    await userEvent.keyboard('/');
    const suche = screen.getByRole('searchbox', { name: 'Projekte durchsuchen' }) as HTMLInputElement;
    expect(suche).toHaveFocus();
    expect(suche).toHaveValue('alt');
    expect([suche.selectionStart, suche.selectionEnd]).toEqual([0, 3]);
    await userEvent.click(screen.getByLabelText('Notiz'));
    await userEvent.keyboard('a/b');
    expect(screen.getByLabelText('Notiz')).toHaveValue('a/b');
  });

  it('ohne Suche in der Ansicht bleibt «/» wirkungslos', () => {
    render(<Probe suche={false} />);
    const e = fireEvent.keyDown(window, { key: '/' });
    expect(e).toBe(true); // nicht verbraucht
    expect(document.body).toHaveFocus();
  });

  it('«?» zeigt feste Kürzel und die der Ansicht je Taste einmal; Escape schliesst; über einem Dialog nicht', async () => {
    render(<Probe />);
    await userEvent.keyboard('?');
    const d = screen.getByRole('dialog', { name: T.kuerzel.titel });
    const fest = within(d).getByRole('table', { name: T.kuerzel.allgemein });
    expect(within(fest).getByText('Strg+K')).toBeInTheDocument();
    const ansicht = within(d).getByRole('table', { name: T.kuerzel.ansicht });
    expect(within(ansicht).getAllByRole('row').slice(1).map(r => r.textContent)).toEqual(['BBericht bestätigen', 'RRückfrage stellen']);
    await expectNoAxe(d);
    // Im offenen Dialog öffnet «/» keine Suche dahinter
    await userEvent.keyboard('/');
    expect(screen.getByRole('searchbox')).not.toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
