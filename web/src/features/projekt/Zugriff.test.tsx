/**
 * Bereich «Zugriff» (UI-51, UC-016 A2) gegen die nachgebildete API: Liste am Projekt und darunter geerbt, Zugriff geben
 * nur mit `access:admin` am Ort, Hinweis bei vertraulichen Projekten, Schublade mit Befristen und Entfernen; Hinweis
 * «kein Zugriff» an der Projektorganisation (UX-E14); axe ohne Befund.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog, Me } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { T } from '../../ui/index.ts';
import { ProjektUebersicht } from './ProjektUebersicht.tsx';
import { TP } from './texte.ts';
import { PortfolioZugriffPage, ProjektZugriffPage } from './Zugriff.tsx';

const ID = '00000000-0000-4000-8000-000000000001';
const PF = '00000000-0000-4000-8000-0000000000f1';
const PL = '00000000-0000-4000-8000-0000000000a2';
const KT = '00000000-0000-4000-8000-0000000000a3';
const UE = '00000000-0000-4000-8000-0000000000a4';
const T1 = '00000000-0000-4000-8000-0000000000b1';

const projekt = (o: Record<string, unknown> = {}) => ({
  id: ID, nummer: '2026-014', name: 'Digitale Patientenaufnahme', portfolioId: PF,
  portfolio: { schluessel: 'transformation', name: 'Transformation', kategorie: 'A' }, orgEinheitId: null, handlungsfeldId: null,
  handlungsfeld: null, phase: 'P1', phasenmodellId: null, lebenszyklus: 'aktiv', vertraulich: false,
  sponsor: null, projektleitung: PL, rollen: ['pl'], version: 2, createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-02T08:00:00Z',
  can: { write: true, organisation: true }, ...o,
});
const eintrag = (o: Record<string, unknown>) => ({ expiresAt: null, createdAt: '2026-10-01T08:00:00Z', createdBy: 'Ursula Egli', removable: false, ...o });
const liste = (grantable: string[]) => ({
  resource: { type: 'projekt', id: ID }, classification: null, grantable,
  items: [
    eintrag({ id: T1, subject: { ref: `user:${PL}`, kind: 'user', name: 'Sandra Huber' }, relation: 'projekt-fuehren', place: { type: 'projekt', id: ID }, via: 'direct', removable: grantable.length > 0 }),
    eintrag({ id: 't2', subject: { ref: `user:${UE}`, kind: 'user', name: 'Ursula Egli' }, relation: 'alle-fuehren', place: { type: 'org', id: null }, via: 'inherited' }),
  ],
});

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

const PL_ME: Partial<Me> = { roles: [], permissions: ['tenant:read', 'projekt:read', 'access:admin'] };

describe('Zugriff am Projekt (UI-51)', () => {
  it('Liste am Projekt und geerbt, Hinweis bei vertraulich; Schublade: befristen und entfernen', async () => {
    const api = stub({
      'GET /v1/projekte': () => json({ items: [projekt({ vertraulich: true })], nextCursor: null }),
      'GET /v1/access': () => json(liste(['projekt-fuehren', 'projekt-steuern', 'projekt-mitlesen'])),
      [`PATCH /v1/access/${T1}`]: async req => json({ ...liste([]).items[0], ...(await req.json() as object) }),
      [`DELETE /v1/access/${T1}`]: () => new Response(null, { status: 204 }),
    });
    const { container } = renderWithIam(<ProjektZugriffPage nummer="2026-014" />, PL_ME);
    const hier = await screen.findByRole('region', { name: TP.zugriff.gruppeProjekt });
    expect(await within(hier).findByText('Sandra Huber')).toBeInTheDocument();
    const geerbt = screen.getByRole('region', { name: TP.zugriff.gruppeGeerbt });
    expect(within(geerbt).getByText('Ursula Egli')).toBeInTheDocument();
    expect(within(geerbt).getByText(TP.zugriff.uebergreifend)).toBeInTheDocument();
    expect(screen.getByText(TP.zugriff.vertraulich)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TP.zugriff.geben })).toBeInTheDocument();
    await expectNoAxe(container);

    // Schublade: Befristung mit Datum in der Vergangenheit wird abgewiesen, ein künftiges gespeichert
    await userEvent.click(within(hier).getByRole('button', { name: T.liste.oeffnen('Sandra Huber') }));
    const drawer = await screen.findByRole('dialog', { name: 'Sandra Huber' });
    const feld = within(drawer).getByLabelText(TP.zugriff.bisFeld);
    await userEvent.type(feld, '2020-01-01');
    expect(within(drawer).getByText(TP.zugriff.bisVergangen)).toBeInTheDocument();
    await userEvent.clear(feld);
    await userEvent.type(feld, '2099-12-31');
    await userEvent.click(within(drawer).getByRole('button', { name: T.common.save }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'PATCH')).toBe(true));
    const patch = api.calls.find(c => c.method === 'PATCH')!;
    expect(((await patch.json()) as { expiresAt: string }).expiresAt.slice(0, 4)).toBe('2099');

    // entfernen mit Bestätigung
    await userEvent.click(within(hier).getByRole('button', { name: T.liste.oeffnen('Sandra Huber') }));
    const d2 = await screen.findByRole('dialog', { name: 'Sandra Huber' });
    await userEvent.click(within(d2).getByRole('button', { name: TP.zugriff.entfernen }));
    const confirm = await screen.findByRole('dialog', { name: TP.zugriff.entfernenTitel });
    await userEvent.click(within(confirm).getByRole('button', { name: TP.zugriff.entfernen }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'DELETE')).toBe(true));
  });

  it('ohne access:admin: nur lesen, keine Aktionen; geerbte Einträge nennen den Ursprung', async () => {
    stub({
      'GET /v1/projekte': () => json({ items: [projekt()], nextCursor: null }),
      'GET /v1/access': () => json(liste([])),
    });
    renderWithIam(<ProjektZugriffPage nummer="2026-014" />, { roles: [], permissions: ['tenant:read', 'projekt:read'] });
    expect(await screen.findByText(TP.zugriff.nurLesen)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TP.zugriff.geben })).not.toBeInTheDocument();
    expect(screen.queryByText(TP.zugriff.vertraulich)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: T.liste.oeffnen('Ursula Egli') }));
    const drawer = await screen.findByRole('dialog', { name: 'Ursula Egli' });
    expect(within(drawer).getByText(TP.zugriff.geerbtHinweis(TP.zugriff.uebergreifend))).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: TP.zugriff.entfernen })).not.toBeInTheDocument();
  });
});

describe('Projektorganisation: Hinweis «kein Zugriff» (UX-E14)', () => {
  it('nennt Personen ohne Zugriff und führt in den Bereich «Zugriff»', async () => {
    stub({
      'GET /v1/projekte': () => json({ items: [projekt()], nextCursor: null }),
      [`GET /v1/projekte/${ID}/organisation`]: () => json({
        version: 1, can: { write: true }, vorschlaege: [],
        mitglieder: [{ personId: PL, funktion: 'pl', funktionText: '', akv: '' }, { personId: KT, funktion: 'weitere', funktionText: 'Kernteam', akv: '' }],
      }, 200, { ETag: 'W/"1"' }),
      'GET /v1/access': () => json(liste(['projekt-mitlesen'])),
    });
    const { container } = renderWithIam(<ProjektUebersicht nummer="2026-014" />, PL_ME);
    const kt = (await screen.findByText('Kernteam')).closest('.pj-org-g') as HTMLElement;
    expect(await within(kt).findByText(TP.org.ohneZugriff)).toBeInTheDocument();
    expect(within(kt).getByRole('link', { name: TP.org.zugriffGeben })).toHaveAttribute('href', '/projekte/2026-014/zugriff');
    // die Projektleitung hat Zugriff: kein Hinweis
    const pl = screen.getByText(TP.funktionLang.pl).closest('.pj-org-g') as HTMLElement;
    expect(within(pl).queryByText(TP.org.ohneZugriff)).not.toBeInTheDocument();
    await expectNoAxe(container);
  });
});

describe('Zugriff am Portfolio (UI-51)', () => {
  it('Auswahl im Kopf, Liste des gewählten Portfolios; unbekannter Schlüssel benannt', async () => {
    const api = stub({
      'GET /v1/portfolios': () => json({ items: [{ id: PF, schluessel: 'transformation', name: 'Transformation', kategorie: 'A' }], nextCursor: null }),
      'GET /v1/access': () => json({ ...liste(['portfolio-fuehren']), resource: { type: 'portfolio', id: PF } }),
    });
    const { container, unmount } = renderWithIam(<PortfolioZugriffPage portfolio="transformation" setPortfolio={() => {}} />, PL_ME);
    expect(await screen.findByRole('heading', { level: 1, name: TP.zugriff.titelPortfolio })).toBeInTheDocument();
    expect(await screen.findByText(TP.zugriff.introPortfolio)).toBeInTheDocument();
    await waitFor(() => expect(api.calls.some(c => c.url.includes('/v1/access') && new URL(c.url).searchParams.get('type') === 'portfolio')).toBe(true));
    await expectNoAxe(container);
    unmount();
    renderWithIam(<PortfolioZugriffPage portfolio="gibts-nicht" setPortfolio={() => {}} />, PL_ME);
    expect(await screen.findByText(TP.zugriff.portfolioUnbekannt)).toBeInTheDocument();
  });
});
