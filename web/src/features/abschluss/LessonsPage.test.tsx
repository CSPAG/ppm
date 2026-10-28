/**
 * Lessons Learned (UI-32, PS.04.03) gegen die nachgebildete API: Liste mit Projekt und Kategorie, Filter Jahr und
 * Kategorie in der Adresse, Schublade mit Ändern für die Projektleitung und nur Lesen für andere, leer, axe ohne Befund.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { LessonsPage } from './LessonsPage.tsx';
import { validateLessonsSearch, type LessonsSearch, type SetLessonsSearch } from './search.ts';
import { TA } from './texte.ts';

const lesson = (o: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-0000000000d1', projekt: { id: '00000000-0000-4000-8000-000000000001', nummer: '2026-014', name: 'Neues Labor' },
  text: 'Früh mit dem Betrieb planen', kategorie: 'Übergabe', jahr: 2026, version: 1, createdAt: '2026-10-28T08:00:00Z', von: 'Paula Leiterin',
  can: { write: false }, ...o,
});

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

const projektOeffnen = vi.fn();
function Page({ initial = {} }: { initial?: LessonsSearch }) {
  const [search, set] = useState<LessonsSearch>(initial);
  const setSearch = useCallback<SetLessonsSearch>(next => set(s => Object.fromEntries(Object.entries({ ...s, ...next }).filter(([, v]) => v !== undefined)) as LessonsSearch), []);
  return <><LessonsPage search={search} setSearch={setSearch} projektOeffnen={projektOeffnen} /><output data-testid="s">{JSON.stringify(search)}</output></>;
}

describe('Lessons Learned (UI-32)', () => {
  it('Liste, Filter in der Adresse, Schublade nur lesend, Projekt mit einem Klick', async () => {
    const api = stub({ 'GET /v1/lessons-learned': () => json({ items: [lesson()], nextCursor: null, kategorien: ['Übergabe'] }) });
    const { container } = renderWithIam(<Page />, { roles: ['gremium'], permissions: ['tenant:read', 'auswertung:read'] });
    expect(await screen.findByRole('heading', { level: 1, name: TA.liste.titel })).toBeInTheDocument();
    expect(await screen.findByText('Neues Labor', { exact: false })).toBeInTheDocument();
    await expectNoAxe(container);
    await userEvent.selectOptions(screen.getByLabelText(TA.liste.kategorie), 'Übergabe');
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('"kategorie":"Übergabe"'));
    await waitFor(() => expect(api.calls.some(c => c.url.includes('kategorie='))).toBe(true));

    await userEvent.click(screen.getAllByRole('button', { name: /Früh mit dem Betrieb planen/ })[0]!);
    const drawer = screen.getByRole('dialog', { name: TA.liste.eine });
    expect(within(drawer).getByText(TA.liste.nurLesen)).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: TA.liste.bearbeiten })).not.toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('button', { name: /2026-014/ }));
    expect(projektOeffnen).toHaveBeenCalledWith('2026-014');
  });

  it('Projektleitung ändert in der Schublade mit If-Match', async () => {
    let patch: Record<string, unknown> = {};
    const api = stub({
      'GET /v1/lessons-learned': () => json({ items: [lesson({ can: { write: true } })], nextCursor: null, kategorien: ['Übergabe'] }),
      'PATCH /v1/lessons-learned/00000000-0000-4000-8000-0000000000d1': async req => { patch = await req.json() as Record<string, unknown>; return json(lesson({ ...patch, version: 2, can: { write: true } })); },
    });
    renderWithIam(<Page />, { roles: ['ue'], permissions: ['tenant:read', 'auswertung:read'] });
    await userEvent.click((await screen.findAllByRole('button', { name: /Früh mit dem Betrieb planen/ }))[0]!);
    const drawer = screen.getByRole('dialog', { name: TA.liste.eine });
    await userEvent.click(within(drawer).getByRole('button', { name: TA.liste.bearbeiten }));
    const kat = within(drawer).getByLabelText(TA.lessons.kategorie);
    await userEvent.clear(kat);
    await userEvent.type(kat, 'Betrieb');
    await userEvent.click(within(drawer).getByRole('button', { name: TA.liste.speichern }));
    await waitFor(() => expect(patch).toEqual({ text: 'Früh mit dem Betrieb planen', kategorie: 'Betrieb' }));
    expect(api.calls.find(c => c.method === 'PATCH')!.headers.get('If-Match')).toBe('W/"1"');
  });

  it('leer beim ersten Mal; Adresse: Jahr vierstellig', async () => {
    stub({ 'GET /v1/lessons-learned': () => json({ items: [], nextCursor: null, kategorien: [] }) });
    renderWithIam(<Page />, { roles: ['gremium'], permissions: ['tenant:read', 'auswertung:read'] });
    expect(await screen.findByText(TA.liste.leer)).toBeInTheDocument();
    expect(validateLessonsSearch({ jahr: '2026', kategorie: '', q: ' ' })).toEqual({ jahr: '2026', kategorie: '' });
    expect(validateLessonsSearch({ jahr: 26 })).toEqual({});
  });
});
