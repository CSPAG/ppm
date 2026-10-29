/** Vermerk offen und «weiter ohne Vermerk» (UX-E12, darstellung.md): Text statt nur Farbe, Wirkung vor dem Klick, axe ohne Befund. */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../test/axe.ts';
import { Vermerke, VorabAktion } from './index.ts';

describe('Vermerke', () => {
  it('zeigt jeden offenen Vermerk mit Text; ohne Vermerk nichts', async () => {
    const { container, rerender } = render(<p><Vermerke vermerke={[{ art: 'abnahme_offen', text: 'Abnahme offen' }]} /></p>);
    expect(screen.getByText('Abnahme offen')).toBeInTheDocument();
    await expectNoAxe(container);
    rerender(<p><Vermerke vermerke={[]} /></p>);
    expect(screen.queryByText('Abnahme offen')).not.toBeInTheDocument();
  });

  it('VorabAktion: Dialog mit Wirkung, ausführen erst mit der Aktion, Abbrechen ohne Wirkung', async () => {
    const ausfuehren = vi.fn((fertig: () => void) => fertig());
    render(<VorabAktion label="Vor der Abnahme abschliessen" frage="Abschliessen?" wirkung="Vermerk «Abnahme offen»." laeuft={false} ausfuehren={ausfuehren} />);
    await userEvent.click(screen.getByRole('button', { name: 'Vor der Abnahme abschliessen' }));
    const d = screen.getByRole('dialog', { name: 'Abschliessen?' });
    expect(within(d).getByText('Vermerk «Abnahme offen».')).toBeInTheDocument();
    await userEvent.click(within(d).getByRole('button', { name: 'Abbrechen' }));
    expect(ausfuehren).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Vor der Abnahme abschliessen' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Vor der Abnahme abschliessen' }));
    expect(ausfuehren).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
