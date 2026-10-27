/**
 * Seite «Auslastung» (UI-23, AP-E5-4; BC RK.02.04, UC-009 Schritt 5) gegen die nachgebildete API: Kennzahlen, Engpass
 * nach dem Mustertext aus darstellung.md, Tabelle Rolle × Monat mit Symbol und Text, Einzelwerte in der Schublade,
 * Szenario, leerer Zeitraum, Fehler, ungültiger Zeitraum.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AppPermission } from '../../auth/permissions.ts';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { AuslastungPage } from './AuslastungPage.tsx';
import type { AuslastungSearch, SetAuslastungSearch } from './search.ts';
import { TR } from './texte.ts';

const P1 = '00000000-0000-4000-8000-0000000000b1';
const P2 = '00000000-0000-4000-8000-0000000000b2';
const RM = { roles: ['rm'], permissions: ['tenant:read', 'stammdaten:read', 'portfolio:read', 'projekt:read', 'ressource:read', 'ressource:write', 'auswertung:read'] as AppPermission[] };

const zelle = (monat: string, angebot: number | null, bedarf: number, lage: string, beitraege: { projektId: string; phase: string; fte: number; gedeckt: boolean }[] = []) =>
  ({ monat, angebot, bedarf, frei: Math.round(((angebot ?? 0) - bedarf) * 100) / 100, lage, beitraege });
const auslastung = (o: Record<string, unknown> = {}) => ({
  von: '2027-04', bis: '2027-06', monate: ['2027-04', '2027-05', '2027-06'], szenario: null,
  rollen: [
    { rolle: 'projektleitung', zellen: [
      zelle('2027-04', 6, 3, 'frei', [{ projektId: P1, phase: 'P2', fte: 3, gedeckt: true }]),
      zelle('2027-05', 5, 5.5, 'ueberbucht', [{ projektId: P1, phase: 'P2', fte: 3, gedeckt: true }, { projektId: P2, phase: 'P1', fte: 2.5, gedeckt: false }]),
      zelle('2027-06', 5, 5.5, 'ueberbucht', [{ projektId: P1, phase: 'P2', fte: 3, gedeckt: true }, { projektId: P2, phase: 'P1', fte: 2.5, gedeckt: false }]),
    ] },
    { rolle: 'ctl', zellen: [zelle('2027-04', null, 1, 'ohne_angebot', [{ projektId: P2, phase: 'P1', fte: 1, gedeckt: false }]), zelle('2027-05', null, 0, 'leer'), zelle('2027-06', null, 0, 'leer')] },
  ],
  projekte: [{ id: P1, nummer: '2026-001', name: 'Klinikinformationssystem' }, { id: P2, nummer: '2026-002', name: 'Neubau Labor' }],
  engpaesse: [
    { rolle: 'ctl', quartal: '2027-Q2', monat: '2027-04', bedarf: 1, angebot: 0, projekte: 1 },
    { rolle: 'projektleitung', quartal: '2027-Q2', monat: '2027-05', bedarf: 5.5, angebot: 5, projekte: 2 },
  ],
  ...o,
});
const rollen = { items: [{ id: 'r1', codetabelle: 'ressourcenrolle', schluessel: 'projektleitung', label: 'Projektleitung', position: 1, aktiv: true }, { id: 'r2', codetabelle: 'ressourcenrolle', schluessel: 'ctl', label: 'CTL', position: 2, aktiv: true }], nextCursor: null };

function Page({ initial = { von: '2027-04', bis: '2027-06' } }: { initial?: AuslastungSearch }) {
  const [search, set] = useState<AuslastungSearch>(initial);
  const setSearch = useCallback<SetAuslastungSearch>(next => set(s => Object.fromEntries(Object.entries({ ...s, ...next }).filter(([, v]) => v !== undefined)) as AuslastungSearch), []);
  return <><AuslastungPage search={search} setSearch={setSearch} navigieren={() => {}} /><output data-testid="o">{search.o ?? ''}</output></>;
}

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi({ 'GET /v1/codetabellen/ressourcenrolle/werte': () => json(rollen), ...routes }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

describe('Auslastung', () => {
  it('zeigt Kennzahlen, Engpässe nach dem Mustertext und die Tabelle mit Symbol und Text (axe ohne Befund)', async () => {
    const api = stub({ 'GET /v1/auslastung': () => json(auslastung()) });
    const { container } = renderWithIam(<Page />, RM);
    // «Kapazität Q2 2027: 5,5 FTE Projektleitung statt höchstens 5,0. Verschieben Sie …» (darstellung.md)
    expect(await screen.findByText(/Kapazität Q2 2027: 5,5\sFTE Projektleitung statt höchstens 5,0\. Verschieben Sie den Start eines der 2 betroffenen Projekte/)).toBeInTheDocument();
    expect(screen.getByText(/Kapazität Q2 2027: 1,0\sFTE CTL ohne erfasstes Angebot/)).toBeInTheDocument();
    const kpis = screen.getByRole('region', { name: TR.kennzahlen });
    expect(within(kpis).getByText(TR.engpaesse).parentElement).toHaveTextContent('2');
    expect(within(kpis).getByText(TR.frei).parentElement).toHaveTextContent('3,0 FTE × Monate');
    const tabelle = screen.getByRole('table', { name: TR.tabelle });
    expect(within(tabelle).getAllByRole('columnheader').map(h => h.textContent)).toEqual([TR.rolle, 'Apr 27', 'Mai 27', 'Jun 27']);
    expect(within(tabelle).getByRole('button', { name: /^Projektleitung, Mai 2027: Bedarf 5,5\sFTE, Angebot 5,0\sFTE, überbucht$/ })).toBeInTheDocument();
    expect(within(tabelle).getByRole('button', { name: /^CTL, April 2027: Bedarf 1,0\sFTE, Angebot kein Angebot, ohne Angebot$/ })).toBeInTheDocument();
    expect(api.calls.some(c => c.url.includes('/v1/auslastung?von=2027-04&bis=2027-06'))).toBe(true);
    await expectNoAxe(container);
  });

  it('öffnet die Einzelwerte einer Zelle in der Schublade (Adresse ?o=<rolle>:<monat>)', async () => {
    stub({ 'GET /v1/auslastung': () => json(auslastung()) });
    renderWithIam(<Page />, RM);
    await userEvent.click(await screen.findByRole('button', { name: /^Projektleitung, Mai 2027/ }));
    expect(screen.getByTestId('o')).toHaveTextContent('projektleitung:2027-05');
    const drawer = await screen.findByRole('dialog', { name: 'Projektleitung · Mai 2027' });
    const zeilen = within(drawer).getAllByRole('row').map(r => r.textContent);
    expect(zeilen.some(t => t?.includes('2026-002 Neubau Labor') && t.includes('P1') && t.includes(TR.offen))).toBe(true);
    expect(zeilen.some(t => t?.includes('2026-001') && t.includes(TR.gedeckt))).toBe(true);
    await expectNoAxe(drawer);
    // Sprung aus dem Engpass auf denselben Monat
    await userEvent.click(within(drawer).getByRole('button', { name: /schliessen/i }));
    await userEvent.click(screen.getAllByRole('button', { name: TR.engpassZeigen })[1]!);
    expect(screen.getByTestId('o')).toHaveTextContent('projektleitung:2027-05');
  });

  it('Szenario: Hinweis mit Weg zum Ist-Stand', async () => {
    const api = stub({ 'GET /v1/auslastung': req => json(auslastung(new URL(req.url).searchParams.get('szenario') ? { szenario: { id: '00000000-0000-4000-8000-0000000000c1', name: 'Variante B' } } : {})) });
    renderWithIam(<Page initial={{ von: '2027-04', bis: '2027-06', szenario: '00000000-0000-4000-8000-0000000000c1' }} />, RM);
    expect(await screen.findByText(TR.szenario('Variante B'))).toBeInTheDocument();
    expect(api.calls.some(c => c.url.includes('szenario=00000000-0000-4000-8000-0000000000c1'))).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: TR.istStand }));
    await waitFor(() => expect(screen.queryByText(TR.szenario('Variante B'))).not.toBeInTheDocument());
    expect(screen.getByRole('table', { name: TR.tabelle })).toBeInTheDocument();
  });

  it('leer (Z2) mit Weg zur Kapazität, Fehler (Z5) mit «Erneut versuchen», ungültiger Zeitraum ohne Abfrage', async () => {
    let fehler = true;
    stub({ 'GET /v1/auslastung': () => (fehler ? json({ type: 'about:blank', title: 'Fehler im Dienst', status: 500 }, 500) : json(auslastung({ rollen: [], engpaesse: [], projekte: [] }))) });
    renderWithIam(<Page />, RM);
    expect(await screen.findByText('Fehler im Dienst')).toBeInTheDocument();
    fehler = false;
    await userEvent.click(screen.getByRole('button', { name: /erneut/i }));
    expect(await screen.findByText(TR.leer)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TR.leerAktion })).toBeInTheDocument();
  });

  it('Zeitraum, der vor seinem Beginn endet: Meldung statt Abfrage', async () => {
    const api = stub({ 'GET /v1/auslastung': () => json(auslastung()) });
    renderWithIam(<Page initial={{ von: '2027-06', bis: '2027-04' }} />, RM);
    expect(await screen.findByText(TR.zeitraumUngueltig)).toBeInTheDocument();
    expect(api.calls.some(c => c.url.includes('/v1/auslastung'))).toBe(false);
  });
});
