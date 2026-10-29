/** Verlauf am Objekt und Markierung «geändert nach …» (UX-E13, darstellung.md): Text mit Datum, axe ohne Befund. */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxe } from '../test/axe.ts';
import { GeaendertNach, Verlauf } from './index.ts';

describe('Verlauf', () => {
  it('zeigt Einträge mit Person und hebt «geändert nach …» hervor', async () => {
    const { container } = render(<Verlauf titel="Verlauf" laedt={false} eintraege={[
      { at: '2026-10-20T08:00:00Z', person: 'Sandra Huber', aktion: 'statusbericht.submitted', text: 'eingereicht' },
      { at: '2026-10-21T09:00:00Z', person: 'Sandra Huber', aktion: 'statusbericht.amended', text: 'geändert nach Einreichen' },
    ]} />);
    expect(screen.getByRole('region', { name: 'Verlauf' })).toBeInTheDocument();
    expect(screen.getByText('eingereicht')).toBeInTheDocument();
    expect(screen.getByText('geändert nach Einreichen').closest('.geaendert')).not.toBeNull();
    expect(screen.getAllByText(/Sandra Huber/)).toHaveLength(2);
    await expectNoAxe(container);
  });

  it('Markierung nennt Text und Zeitpunkt', () => {
    render(<p><GeaendertNach text="geändert nach Abschluss" at="2026-11-03T10:00:00Z" /></p>);
    expect(screen.getByText(/geändert nach Abschluss ·/)).toBeInTheDocument();
  });
});
