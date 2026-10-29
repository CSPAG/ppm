/**
 * Alle Projekte (UI-52, Master Entscheid 14, A-73) gegen die nachgebildete API: Mitglieder ohne Leserecht sehen nur
 * diese Ansicht mit den Kopfdaten, die Schublade ohne Weg in die Akte; mit Leserecht wechseln sie zwischen «Meine
 * Projekte» und «Alle Projekte» über die Adresse.
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog, Me } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { MeineProjektePage } from './MeineProjektePage.tsx';
import { validateProjekteSearch, type ProjekteSearch, type SetProjekteSearch } from './search.ts';
import { TP } from './texte.ts';

const kopf = (o: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-000000000001', nummer: '2026-014', name: 'Digitale Patientenaufnahme', portfolioId: '00000000-0000-4000-8000-0000000000f1',
  portfolio: { schluessel: 'transformation', name: 'Transformation', kategorie: 'A' }, orgEinheitId: null, handlungsfeldId: null,
  handlungsfeld: null, phase: 'P1', phasenmodellId: null, lebenszyklus: 'aktiv', vertraulich: false,
  sponsor: null, projektleitung: null, rollen: [], version: 2, createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-02T08:00:00Z',
  can: { read: false, write: false, organisation: false }, ...o,
});

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

function Liste({ initial = {} }: { initial?: ProjekteSearch }) {
  const [search, set] = useState<ProjekteSearch>(initial);
  const setSearch = useCallback<SetProjekteSearch>(next => set(s => validateProjekteSearch({ ...s, ...next })), []);
  return <><output data-testid="adresse">{JSON.stringify(search)}</output><MeineProjektePage search={search} setSearch={setSearch} oeffnen={() => {}} /></>;
}

const MITGLIED: Partial<Me> = { roles: ['mitglied'], permissions: ['tenant:read', 'projekt:list', 'idee:list'] };
const PL: Partial<Me> = { roles: [], permissions: ['tenant:read', 'projekt:read', 'projekt:list'] };

describe('Alle Projekte (UI-52)', () => {
  it('Mitglied: nur «Alle Projekte», Kopfdaten, Schublade ohne Weg in die Akte', async () => {
    const api = stub({ 'GET /v1/projekte': () => json({ items: [kopf()], nextCursor: null }) });
    const { container } = renderWithIam(<Liste />, MITGLIED);
    expect(await screen.findByRole('heading', { level: 1, name: TP.alle.titel })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: TP.alle.ansicht })).not.toBeInTheDocument();
    expect(new URL(api.calls.find(c => c.url.includes('/v1/projekte'))!.url).searchParams.get('alle')).toBe('true');
    await expectNoAxe(container);

    await userEvent.click(await screen.findByRole('button', { name: '2026-014 Digitale Patientenaufnahme öffnen' }));
    const drawer = await screen.findByRole('dialog', { name: '2026-014 · Digitale Patientenaufnahme' });
    expect(within(drawer).getByText(TP.alle.nurKopf)).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: TP.oeffnen })).not.toBeInTheDocument();
  });

  it('mit Leserecht: Ansicht wechseln, Adresse `ansicht=alle`', async () => {
    const api = stub({ 'GET /v1/projekte': () => json({ items: [kopf({ can: { read: true, write: false, organisation: false } })], nextCursor: null }) });
    renderWithIam(<Liste />, PL);
    expect(await screen.findByRole('heading', { level: 1, name: TP.titel })).toBeInTheDocument();
    expect(new URL(api.calls[api.calls.length - 1]!.url).searchParams.get('alle')).toBeNull();
    const ansicht = screen.getByRole('navigation', { name: TP.alle.ansicht });
    await userEvent.click(within(ansicht).getByRole('button', { name: TP.alle.titel }));
    expect(await screen.findByRole('heading', { level: 1, name: TP.alle.titel })).toBeInTheDocument();
    expect(screen.getByTestId('adresse')).toHaveTextContent('"ansicht":"alle"');
  });
});
