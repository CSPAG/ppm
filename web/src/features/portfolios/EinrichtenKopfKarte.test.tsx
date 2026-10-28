/**
 * Kopfkarte «Organisation einrichten» (Z2, UI-47) gegen die nachgebildete API: ohne Portfolio Hinweis mit Sprung zu
 * Administration › Portfolios und Gremien, mit Portfolio entfällt sie; axe.
 */
import { screen } from '@testing-library/react';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { EinrichtenKopfKarte } from './EinrichtenKopfKarte.tsx';
import { TP } from './texte.ts';

function stub(items: unknown[]) {
  const api = mockIamApi({ 'GET /v1/portfolios': () => json({ items, nextCursor: null }) }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

describe('Kopfkarte Organisation einrichten', () => {
  it('ohne Portfolio: Hinweis mit Sprung zu Portfolios und Gremien', async () => {
    const api = stub([]);
    const { container } = renderWithIam(<article><EinrichtenKopfKarte /></article>);
    expect(await screen.findByRole('heading', { name: TP.kopfkarte.titel })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: TP.kopfkarte.einrichten })).toHaveAttribute('href', '/administration/portfolios');
    expect(new URL(api.calls[0]!.url).searchParams.get('limit')).toBe('1');
    await expectNoAxe(container);
  });

  it('mit Portfolio entfällt die Karte', async () => {
    stub([{ id: '00000000-0000-4000-8000-000000000001' }]);
    const { container } = renderWithIam(<article><EinrichtenKopfKarte /></article>);
    await vi.waitFor(() => expect(container.querySelector('article')).toBeEmptyDOMElement());
  });
});
