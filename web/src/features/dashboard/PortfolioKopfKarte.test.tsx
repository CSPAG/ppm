/**
 * Kopfkarte «Portfolio» (IA «Startseite je Rolle»: PRAT, GLPA, DIR) gegen die nachgebildete API: Zahlen nach Status,
 * Eskalationen, kritische Projekte mit Link; ohne Projekte entfällt die Karte; axe.
 */
import { screen, within } from '@testing-library/react';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { PortfolioKopfKarte } from './PortfolioKopfKarte.tsx';

const zeile = (n: number, status: 'im_plan' | 'kritisch' | null, merkmale: string[] = []) => ({
  projektId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, nummer: `2026-0${10 + n}`, name: `Projekt ${n}`, status, trend: status === 'kritisch' ? 'abwaerts' : 'gleichbleibend', merkmale,
});
const dashboard = (items: unknown[]) => ({ periode: '2026-09', periodeStand: 'abgeschlossen', abgeschlossenAt: null, perioden: [], portfolios: [], portfolio: null, items, funnel: [] });

function stub(items: unknown[]) {
  vi.stubGlobal('fetch', mockIamApi({ 'GET /v1/dashboard': () => json(dashboard(items)) }, { catalog: CATALOG_PPM as unknown as AuthzCatalog }).fetch);
}

describe('Kopfkarte Portfolio', () => {
  it('Gesamtstatus «n im Plan · n kritisch · n Eskalationen» und kritische Projekte (PRAT, GLPA)', async () => {
    stub([zeile(1, 'im_plan'), zeile(2, 'im_plan'), zeile(3, 'kritisch', ['eskalation']), zeile(4, 'kritisch'), zeile(5, null)]);
    const { container } = renderWithIam(<article><PortfolioKopfKarte /></article>);
    expect(await screen.findByRole('heading', { name: 'Portfolio September 2026' })).toBeInTheDocument();
    expect(screen.getByText('2 im Plan · 2 kritisch · 1 ohne Status · 1 Eskalation')).toBeInTheDocument();
    const zeilen = screen.getAllByRole('listitem');
    expect(zeilen).toHaveLength(2);
    expect(within(zeilen[0]!).getByRole('link', { name: '2026-013 Projekt 3' })).toHaveAttribute('href', '/projekte/2026-013');
    expect(within(zeilen[0]!).getByText('Kritisch')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard öffnen' })).toHaveAttribute('href', '/portfolio/dashboard');
    await expectNoAxe(container);
  });

  it('ohne Projekte entfällt die Karte', async () => {
    stub([]);
    const { container } = renderWithIam(<article><PortfolioKopfKarte /></article>);
    await vi.waitFor(() => expect(container.querySelector('article')).toBeEmptyDOMElement());
  });
});
