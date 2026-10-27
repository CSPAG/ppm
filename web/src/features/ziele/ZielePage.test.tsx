/**
 * Seite «Strategische Ziele» (AP-E0-9, BC ZM.01.02) gegen die nachgebildete API: Liste nach Nummer mit Handlungsfeld,
 * Hinweis ohne Metrik, Schublade über die Nummer, Verlauf mit früheren Ständen, Anlegen mit Idempotency-Key, 412 beim
 * Speichern, vergebene Nummer (409), Rechte aus `can`.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { T } from '../../ui/index.ts';
import type { SetZielSearch, ZielSearch } from './search.ts';
import { validateZielSearch } from './search.ts';
import { TZ } from './texte.ts';
import { ZielePage } from './ZielePage.tsx';

const ID = '00000000-0000-4000-8000-0000000000a1';
const HF = '00000000-0000-4000-8000-0000000000f1';
const HF2 = '00000000-0000-4000-8000-0000000000f2';
const URL_ONE = `/v1/strategische-ziele/${ID}`;
const ziel = (o: Record<string, unknown> = {}) => ({
  id: ID, handlungsfeldId: HF, nummer: '1.1', text: 'Zugang zur Versorgung verbessern', horizont: 2030, metrik: 'Wartezeit in Tagen', zielwert: '< 14',
  version: 3, createdAt: '2026-10-01T08:00:00Z', createdBy: null, updatedAt: '2026-10-02T08:00:00Z', updatedBy: null, can: { write: true }, ...o,
});
const felder = { items: [{ id: HF, label: 'Patientenorientierung' }, { id: HF2, label: 'Wirtschaftlichkeit' }], nextCursor: null };

function Page({ initial = {} }: { initial?: ZielSearch }) {
  const [search, set] = useState<ZielSearch>(initial);
  const setSearch = useCallback<SetZielSearch>(next => set(s => {
    const merged: Record<string, string | undefined> = { ...s, ...next };
    return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined)) as ZielSearch;
  }), []);
  return <><ZielePage search={search} setSearch={setSearch} /><output data-testid="o">{search.o ?? ''}</output></>;
}

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi({ 'GET /v1/handlungsfelder': () => json(felder), ...routes }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

/** Liste und Einzelabruf über die Nummer (`?nummer=`). */
const lesen = (item: () => ReturnType<typeof ziel>) => ({
  'GET /v1/strategische-ziele': (req: Request) => {
    const n = new URL(req.url).searchParams.get('nummer');
    return json({ items: !n || n === item().nummer ? [item()] : [], nextCursor: null });
  },
  [`GET ${URL_ONE}`]: () => json(item(), 200, { ETag: `W/"${item().version}"` }),
});

describe('Strategische Ziele', () => {
  it('zeigt die Liste mit Handlungsfeld und markiert Ziele ohne Metrik', async () => {
    stub({ 'GET /v1/strategische-ziele': () => json({ items: [ziel(), ziel({ id: 'x2', nummer: '2.1', handlungsfeldId: HF2, text: 'Kosten senken', metrik: '' })], nextCursor: null }) });
    const { container } = renderWithIam(<Page />);
    expect(await screen.findByRole('button', { name: T.liste.oeffnen('1.1 Zugang zur Versorgung verbessern') })).toBeInTheDocument();
    expect(await screen.findByText('Wirtschaftlichkeit')).toBeInTheDocument();
    expect(screen.getByText(TZ.metrikFehlt)).toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('zeigt den leeren Zustand mit Erklärung', async () => {
    stub({ 'GET /v1/strategische-ziele': () => json({ items: [], nextCursor: null }) });
    renderWithIam(<Page />);
    expect(await screen.findByText(TZ.empty)).toBeInTheDocument();
  });

  it('öffnet über die Nummer und zeigt den Verlauf mit früheren Ständen', async () => {
    stub({
      ...lesen(() => ziel()),
      [`GET ${URL_ONE}/history`]: () => json({ items: [
        { version: 2, action: 'updated', handlungsfeldId: HF, nummer: '1.1', text: 'Zugang zur Versorgung verbessern', horizont: 2030, metrik: 'Wartezeit in Tagen', zielwert: '< 14', changedAt: '2026-10-02T08:00:00Z', changedBy: null },
        { version: 1, action: 'created', handlungsfeldId: HF, nummer: '1.1', text: 'Zugang zur Versorgung verbessern', horizont: 2030, metrik: '', zielwert: '', changedAt: '2026-10-01T08:00:00Z', changedBy: null },
      ] }),
    });
    renderWithIam(<Page initial={{ o: 'ziel:1.1' }} />);
    expect(await screen.findByText(TZ.version(2))).toBeInTheDocument();
    expect(screen.getByText(/Metrik: Wartezeit in Tagen/)).toBeInTheDocument();
    expect(screen.getAllByText(`(${TZ.vorher}: –)`)).toHaveLength(2);   // Metrik und Zielwert neu
  });

  it('unbekannte Nummer: Hinweis statt Fehler', async () => {
    stub({ 'GET /v1/strategische-ziele': () => json({ items: [], nextCursor: null }) });
    renderWithIam(<Page initial={{ o: 'ziel:9.9' }} />);
    expect(await screen.findByText(TZ.gone)).toBeInTheDocument();
  });

  it('legt mit Idempotency-Key an, Horizont 2030 vorgegeben, und öffnet das Ziel über seine Nummer', async () => {
    const api = stub({
      'GET /v1/strategische-ziele': () => json({ items: [], nextCursor: null }),
      'POST /v1/strategische-ziele': () => json(ziel({ version: 1, nummer: '1.2' }), 201, { ETag: 'W/"1"' }),
    });
    renderWithIam(<Page initial={{ o: 'neu' }} />);
    await screen.findByRole('option', { name: 'Patientenorientierung' });
    await userEvent.selectOptions(screen.getByLabelText(TZ.handlungsfeld), 'Patientenorientierung');
    await userEvent.type(screen.getByLabelText(TZ.nummer), '1.2');
    await userEvent.type(screen.getByLabelText(TZ.text), ' Zugang verbessern ');
    expect(screen.getByLabelText(TZ.horizont)).toHaveValue('2030');
    await userEvent.click(screen.getByRole('button', { name: T.common.save }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    const post = api.calls.find(c => c.method === 'POST')!;
    expect(post.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(await post.json()).toEqual({ handlungsfeldId: HF, nummer: '1.2', text: 'Zugang verbessern', horizont: 2030, metrik: '', zielwert: '' });
    await waitFor(() => expect(screen.getByTestId('o')).toHaveTextContent('ziel:1.2'));
  });

  it('prüft Eingaben vor dem Senden', async () => {
    const api = stub({ 'GET /v1/strategische-ziele': () => json({ items: [], nextCursor: null }) });
    renderWithIam(<Page initial={{ o: 'neu' }} />);
    await userEvent.type(await screen.findByLabelText(TZ.nummer), 'A1');
    await userEvent.click(screen.getByRole('button', { name: T.common.save }));
    expect(await screen.findByText(TZ.nummerInvalid)).toBeInTheDocument();
    expect(screen.getByText(TZ.handlungsfeldMissing)).toBeInTheDocument();
    expect(screen.getByText(TZ.textMissing)).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
  });

  it('vergebene Nummer (409) erscheint am Feld', async () => {
    stub({
      'GET /v1/strategische-ziele': () => json({ items: [], nextCursor: null }),
      'POST /v1/strategische-ziele': () => json({ title: 'Konflikt', status: 409 }, 409),
    });
    renderWithIam(<Page initial={{ o: 'neu' }} />);
    await screen.findByRole('option', { name: 'Wirtschaftlichkeit' });
    await userEvent.selectOptions(screen.getByLabelText(TZ.handlungsfeld), 'Wirtschaftlichkeit');
    await userEvent.type(screen.getByLabelText(TZ.nummer), '1.1');
    await userEvent.type(screen.getByLabelText(TZ.text), 'Doppelt');
    await userEvent.click(screen.getByRole('button', { name: T.common.save }));
    expect(await screen.findByText(TZ.nummerVergeben)).toBeInTheDocument();
  });

  it('meldet beim Speichern einen Konflikt (412) mit If-Match und lädt neu', async () => {
    let version = 3;
    const api = stub({
      ...lesen(() => ziel({ version })),
      [`GET ${URL_ONE}/history`]: () => json({ items: [] }),
      [`PATCH ${URL_ONE}`]: () => { version = 4; return json({ title: 'Inzwischen geändert', status: 412 }, 412); },
    });
    renderWithIam(<Page initial={{ o: 'ziel:1.1' }} />);
    await userEvent.click(await screen.findByRole('button', { name: T.common.edit }));
    const metrik = await screen.findByLabelText(TZ.metrik);
    await userEvent.clear(metrik);
    await userEvent.type(metrik, 'Tage bis Termin');
    await userEvent.click(screen.getByRole('button', { name: T.common.save }));
    expect(await screen.findByText(TZ.conflict)).toBeInTheDocument();
    expect(api.calls.find(c => c.method === 'PATCH')!.headers.get('If-Match')).toBe('W/"3"');
    await userEvent.click(screen.getByRole('button', { name: T.common.reload }));
    await waitFor(() => expect(screen.queryByText(TZ.conflict)).not.toBeInTheDocument());
  });

  it('ohne Schreibrecht weder Anlegen noch Bearbeiten', async () => {
    stub({ ...lesen(() => ziel({ can: { write: false } })), [`GET ${URL_ONE}/history`]: () => json({ items: [] }) });
    renderWithIam(<Page initial={{ o: 'ziel:1.1' }} />, { roles: ['leser'], permissions: ['tenant:read', 'handlungsfeld:read', 'ziel:read'] });
    expect(await screen.findByText(TZ.noRight)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: T.common.edit })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: new RegExp(TZ.create) })).not.toBeInTheDocument();
  });

  it('Adresse: Nummer als Schlüssel, Unbekanntes fällt weg (I-N5)', () => {
    expect(validateZielSearch({ o: 'ziel:2.1', q: 'x' })).toEqual({ o: 'ziel:2.1', q: 'x' });
    expect(validateZielSearch({ o: '2.1' })).toEqual({});
    expect(validateZielSearch({ o: '00000000-0000-4000-8000-0000000000a1', x: 1 })).toEqual({});
  });
});
