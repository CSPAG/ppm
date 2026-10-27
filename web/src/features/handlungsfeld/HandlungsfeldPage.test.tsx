/** Seite «Handlungsfelder» gegen die nachgebildete API: Liste, Schublade, Bearbeiten mit 412, Rechte aus `can`. */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { T } from '../../ui/index.ts';
import { HandlungsfeldPage } from './HandlungsfeldPage.tsx';
import type { HandlungsfeldSearch, SetHandlungsfeldSearch } from './search.ts';

const ID = '00000000-0000-4000-8000-000000000001';
const URL_ONE = `/v1/handlungsfelder/${ID}`;
const item = (o: Record<string, unknown> = {}) => ({
  id: ID, label: 'Patientenorientierung', leitsatz: 'Im Zentrum stehen die Patientinnen und Patienten.', stossrichtungen: ['Zugang', 'Abläufe'],
  position: 2, version: 3, createdAt: '2026-10-01T08:00:00Z', createdBy: null, updatedAt: '2026-10-02T08:00:00Z', updatedBy: null,
  can: { write: true, delete: true }, ...o,
});

function Page({ initial = {} }: { initial?: HandlungsfeldSearch }) {
  const [search, set] = useState<HandlungsfeldSearch>(initial);
  const setSearch = useCallback<SetHandlungsfeldSearch>(next => set(s => {
    const merged: Record<string, string | undefined> = { ...s, ...next };
    return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined)) as HandlungsfeldSearch;
  }), []);
  return <HandlungsfeldPage search={search} setSearch={setSearch} />;
}

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

describe('Handlungsfelder', () => {
  it('zeigt die Liste mit Leitsatz', async () => {
    stub({ 'GET /v1/handlungsfelder': () => json({ items: [item()], nextCursor: null }) });
    renderWithIam(<Page />);
    expect(await screen.findByRole('button', { name: 'Patientenorientierung' })).toBeInTheDocument();
    expect(screen.getByText('Im Zentrum stehen die Patientinnen und Patienten.')).toBeInTheDocument();
  });

  it('zeigt den leeren Zustand', async () => {
    stub({ 'GET /v1/handlungsfelder': () => json({ items: [], nextCursor: null }) });
    renderWithIam(<Page />);
    expect(await screen.findByText(T.handlungsfeld.empty)).toBeInTheDocument();
  });

  it('lädt weitere Seiten über den Cursor', async () => {
    const api = stub({
      'GET /v1/handlungsfelder': req => new URL(req.url).searchParams.get('cursor') === 'c2'
        ? json({ items: [item({ id: '00000000-0000-4000-8000-000000000002', label: 'Wirtschaftlichkeit' })], nextCursor: null })
        : json({ items: [item()], nextCursor: 'c2' }),
    });
    renderWithIam(<Page />);
    await userEvent.click(await screen.findByRole('button', { name: T.common.more }));
    expect(await screen.findByRole('button', { name: 'Wirtschaftlichkeit' })).toBeInTheDocument();
    expect(api.calls.some(c => c.url.includes('cursor=c2'))).toBe(true);
  });

  it('meldet beim Speichern einen Konflikt (412) und lädt neu', async () => {
    let version = 3;
    const api = stub({
      'GET /v1/handlungsfelder': () => json({ items: [item()], nextCursor: null }),
      [`GET ${URL_ONE}`]: () => json(item({ version }), 200, { ETag: `W/"${version}"` }),
      [`GET ${URL_ONE}/history`]: () => json({ items: [] }),
      [`PATCH ${URL_ONE}`]: () => { version = 4; return json({ title: 'Inzwischen geändert', status: 412 }, 412); },
    });
    renderWithIam(<Page initial={{ o: ID }} />);
    await userEvent.click(await screen.findByRole('button', { name: T.common.edit }));
    const label = await screen.findByLabelText(T.handlungsfeld.label);
    await userEvent.clear(label);
    await userEvent.type(label, 'Patientenzentrierung');
    await userEvent.click(screen.getByRole('button', { name: T.common.save }));
    expect(await screen.findByText(T.handlungsfeld.conflict)).toBeInTheDocument();
    const patch = api.calls.find(c => c.method === 'PATCH')!;
    expect(patch.headers.get('If-Match')).toBe('W/"3"');
    await userEvent.click(screen.getByRole('button', { name: T.common.reload }));
    await waitFor(() => expect(screen.queryByText(T.handlungsfeld.conflict)).not.toBeInTheDocument());
    expect(screen.getByLabelText(T.handlungsfeld.label)).toHaveValue('Patientenorientierung');
  });

  it('ohne Schreibrecht weder Anlegen noch Bearbeiten', async () => {
    stub({
      'GET /v1/handlungsfelder': () => json({ items: [item({ can: { write: false, delete: false } })], nextCursor: null }),
      [`GET ${URL_ONE}`]: () => json(item({ can: { write: false, delete: false } })),
      [`GET ${URL_ONE}/history`]: () => json({ items: [] }),
    });
    renderWithIam(<Page initial={{ o: ID }} />, { roles: ['leser'], permissions: ['tenant:read', 'handlungsfeld:read'] });
    expect(await screen.findByText(T.handlungsfeld.noRight)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: T.common.edit })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: new RegExp(T.handlungsfeld.create) })).not.toBeInTheDocument();
  });

  it('legt mit Idempotency-Key an, Stossrichtungen je Zeile', async () => {
    const api = stub({
      'GET /v1/handlungsfelder': () => json({ items: [], nextCursor: null }),
      'POST /v1/handlungsfelder': () => json(item({ version: 1 }), 201, { ETag: 'W/"1"' }),
      [`GET ${URL_ONE}/history`]: () => json({ items: [] }),
    });
    renderWithIam(<Page initial={{ o: 'neu' }} />);
    await userEvent.type(await screen.findByLabelText(T.handlungsfeld.label), 'Medizin der Zukunft');
    await userEvent.type(screen.getByLabelText(T.handlungsfeld.stossrichtungen), ' Forschung {enter}{enter}Digitalisierung');
    await userEvent.click(screen.getByRole('button', { name: T.common.save }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    const post = api.calls.find(c => c.method === 'POST')!;
    expect(post.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(await post.json()).toEqual({ label: 'Medizin der Zukunft', leitsatz: '', stossrichtungen: ['Forschung', 'Digitalisierung'], position: 0 });
  });

  it('löscht nach Rückfrage, meldet es und schliesst die Schublade', async () => {
    let gone = false;
    const api = stub({
      // Nach dem Löschen antwortet die Liste langsam (wie im Netz): Die Schublade lädt inzwischen neu
      'GET /v1/handlungsfelder': async () => { if (gone) await new Promise(r => setTimeout(r, 300)); return json({ items: gone ? [] : [item()], nextCursor: null }); },
      [`GET ${URL_ONE}`]: () => (gone ? json({ title: 'Nicht gefunden', status: 404 }, 404) : json(item(), 200, { ETag: 'W/"3"' })),
      [`GET ${URL_ONE}/history`]: () => json({ items: [] }),
      [`DELETE ${URL_ONE}`]: () => { gone = true; return new Response(null, { status: 204 }); },
    });
    renderWithIam(<Page initial={{ o: ID }} />);
    await userEvent.click(await screen.findByRole('button', { name: T.common.delete }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: T.common.delete })).getByRole('button', { name: T.common.delete }));
    expect(await screen.findByText(T.handlungsfeld.deleted)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.calls.find(c => c.method === 'DELETE')!.headers.get('If-Match')).toBe('W/"3"');
  });
});
