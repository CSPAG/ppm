/**
 * Dashboard der Periode (AP-E1-3; UI-17, UC-014 Schritt 1) gegen die nachgebildete API: Liste mit Status, Vorperiode,
 * Badges «Nicht gemeldet» und «Eskalation», Kennzahlen, Funnel mit Tabelle und Sprung in die Liste, Hinweis bei offener
 * Periode, Rechte, 1000 Zeilen virtualisiert (Q-L5).
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog, Me } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import type { DashboardZeile } from './api.ts';
import { DashboardPage } from './DashboardPage.tsx';
import { validateDashboardSearch, type DashboardSearch, type SetDashboardSearch } from './search.ts';
import { TD } from './texte.ts';

const HEUTE = new Date(2026, 10, 3);
const GREMIUM: Partial<Me> = { roles: ['gremium'], permissions: ['tenant:read', 'projekt:read', 'auswertung:read'] };
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PF = id(900);

const zeile = (n: number, o: Partial<DashboardZeile> = {}): DashboardZeile => ({
  projektId: id(n), nummer: `2026-${String(n).padStart(3, '0')}`, name: `Vorhaben ${n}`, portfolioId: PF, portfolio: 'Transformation',
  handlungsfeld: 'Patientenorientierung', projektleitung: 'Lea Brunner', phase: 'P2', abschlussPer: '2027-06-30',
  naechsterMeilenstein: { termin: '2027-03-31', text: 'Pilot' }, status: 'im_plan', statusVorperiode: 'im_plan', trend: 'gleichbleibend',
  meldung: 'gemeldet', werteAus: '2026-10', merkmale: [], ...o,
});

const ITEMS = [
  zeile(1, { status: 'kritisch', merkmale: ['eskalation'] }),
  zeile(2, { meldung: 'nicht_gemeldet', status: 'kritisch', statusVorperiode: 'kritisch', werteAus: '2026-09', phase: 'P1' }),
  zeile(3),
];

const antwort = (items: DashboardZeile[], o: Record<string, unknown> = {}) => ({
  periode: '2026-10', periodeStand: 'abgeschlossen', abgeschlossenAt: '2026-10-31T16:00:00Z',
  perioden: [{ periode: '2026-11', stand: 'offen' }, { periode: '2026-10', stand: 'abgeschlossen' }],
  portfolios: [{ id: PF, schluessel: 'transformation', name: 'Transformation', kategorie: 'A' }], portfolio: null,
  items,
  funnel: ['P0', 'P1', 'P2', 'P3', 'P4'].map(phase => {
    const z = items.filter(i => i.phase === phase);
    return { phase, anzahl: z.length, imPlan: z.filter(i => i.status === 'im_plan').length, kritisch: z.filter(i => i.status === 'kritisch').length, ohneStatus: 0, nichtGemeldet: z.filter(i => i.meldung === 'nicht_gemeldet').length };
  }),
  ...o,
});

function Page({ initial = {} }: { initial?: DashboardSearch }) {
  const [search, set] = useState<DashboardSearch>(initial);
  const setSearch = useCallback<SetDashboardSearch>(next => set(s => {
    const merged: Record<string, string | undefined> = { ...s, ...next };
    return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined)) as DashboardSearch;
  }), []);
  return <><DashboardPage search={search} setSearch={setSearch} heute={HEUTE} /><output data-testid="s">{JSON.stringify(search)}</output></>;
}

function stub(body: unknown) {
  const api = mockIamApi({ 'GET /v1/dashboard': () => json(body) }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

describe('Dashboard', () => {
  it('Liste mit Status, «Nicht gemeldet», «Eskalation» und Kennzahlen; ohne axe-Befund', async () => {
    stub(antwort(ITEMS));
    const { container } = renderWithIam(<Page />, GREMIUM);
    expect(await screen.findByRole('link', { name: TD.oeffnen('2026-001', 'Vorhaben 1') })).toHaveAttribute('href', '/projekte/2026-001');
    expect(screen.getByText('Eskalation offen')).toBeInTheDocument();
    expect(screen.getByText('Nicht gemeldet · Vorperiode Kritisch')).toBeInTheDocument();
    expect(screen.getByText('Im Plan → Kritisch')).toBeInTheDocument();
    expect(screen.getByText('3 Projekte · 1 im Plan · 1 kritisch · 1 nicht gemeldet · 1 Eskalation')).toBeInTheDocument();
    expect(screen.queryByText(/ist noch offen/)).not.toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('Funnel mit Tabelle; eine Phase zeigt ihre Projekte in der Liste', async () => {
    stub(antwort(ITEMS));
    const { container } = renderWithIam(<Page initial={{ ansicht: 'funnel' }} />, GREMIUM);
    const tab = await screen.findByRole('table', { name: TD.funnel.titel });
    const p2 = within(tab).getByRole('row', { name: /P2/ });
    expect(within(p2).getAllByRole('cell').map(c => c.textContent)).toEqual(['2', '1', '1', '0', '0']);
    await expectNoAxe(container);
    await userEvent.click(within(tab).getByRole('button', { name: TD.funnel.filtern('P1 Konzept und Planung') }));
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('{"phase":"P1"}'));
    expect(screen.getAllByRole('link').map(a => a.textContent)).toEqual(['2026-002 Vorhaben 2']);
  });

  it('offene Periode: Hinweis, Werte vorläufig; Filter in der Adresse', async () => {
    const api = stub(antwort([zeile(5, { meldung: 'ausstehend', werteAus: '2026-09' })], { periode: '2026-11', periodeStand: 'offen', abgeschlossenAt: null }));
    renderWithIam(<Page initial={{ periode: '2026-11' }} />, GREMIUM);
    expect(await screen.findByText(/November ist noch offen/)).toBeInTheDocument();
    expect(screen.getByText(TD.meldung.ausstehend!)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(TD.filter.portfolio), 'transformation');
    await waitFor(() => expect(api.calls.some(c => c.url.includes('portfolio=transformation'))).toBe(true));
    expect(api.calls.some(c => c.url.includes('periode=2026-11'))).toBe(true);
  });

  it('Q-L5: 1000 Zeilen virtualisiert, nur sichtbare Zeilen im DOM', async () => {
    const viele = Array.from({ length: 1000 }, (_, i) => zeile(i + 1));
    stub(antwort(viele));
    const t0 = performance.now();
    renderWithIam(<Page />, GREMIUM);
    await screen.findByRole('link', { name: TD.oeffnen('2026-001', 'Vorhaben 1') });
    const ms = performance.now() - t0;
    const zeilen = screen.getAllByRole('link');
    expect(zeilen.length).toBeLessThan(60);
    expect(screen.getByRole('table', { name: TD.title })).toHaveAttribute('aria-rowcount', '1001');
    expect(ms).toBeLessThan(1500);
    // Scrollen ans Ende rendert die letzten Zeilen
    const tab = screen.getByRole('table', { name: TD.title });
    vi.spyOn(tab, 'getBoundingClientRect').mockReturnValue({ top: -51_000 } as DOMRect);
    fireEvent.scroll(window);
    expect(await screen.findByRole('link', { name: TD.oeffnen('2026-1000', 'Vorhaben 1000') })).toBeInTheDocument();
  });

  it('ohne Recht nur der Hinweis; Adresse prüft Schlüssel, Periode und Phase (I-N5)', async () => {
    stub(antwort([]));
    renderWithIam(<Page />, { roles: ['leser'], permissions: ['tenant:read', 'handlungsfeld:read'] });
    expect(await screen.findByText(TD.keinRecht)).toBeInTheDocument();
    expect(validateDashboardSearch({ portfolio: 'transformation', periode: '2026-10', ansicht: 'funnel', phase: 'P2', x: 1 }))
      .toEqual({ portfolio: 'transformation', periode: '2026-10', ansicht: 'funnel', phase: 'P2' });
    expect(validateDashboardSearch({ portfolio: 'Ä b', periode: '2026-13', ansicht: 'matrix', phase: 'P9' })).toEqual({});
  });
});
