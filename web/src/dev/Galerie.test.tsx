/** Galerie der Bausteine: rendert alle Bausteine in allen Zuständen ohne Befund von axe (Q-B1). */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StaticIam } from '@vollholz/iam-web/testing';
import { describe, expect, it } from 'vitest';
import { expectNoAxe } from '../test/axe.ts';
import { Galerie } from './Galerie.tsx';

describe('Galerie', () => {
  it('alle Bausteine und Zustände der Liste ohne Befund', async () => {
    const { container } = render(<StaticIam><Galerie /></StaticIam>);
    expect(screen.getByRole('heading', { name: 'Galerie der Bausteine', level: 1 })).toBeInTheDocument();
    await expectNoAxe(container);
    for (const z of ['leer', 'gefiltert', 'fehler', 'teilweise']) {
      await userEvent.click(screen.getByRole('button', { name: z }));
      await expectNoAxe(container);
    }
  });
});
