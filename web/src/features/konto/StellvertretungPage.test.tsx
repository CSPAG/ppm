/**
 * Profil mit Stellvertretung (UI-43, UC-016 Schritt 4) gegen die nachgebildete API: Liste, Erfassen mit Personensuche,
 * Prüfung am Feld (I-F3), Wirkung vor dem Absenden (I-F5), Beenden mit Rückfrage (I-R1), axe.
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import type { KontoSearch, SetKontoSearch } from './search.ts';
import { StellvertretungPage } from './StellvertretungPage.tsx';
import { K } from './texte.ts';

const BEAT = { id: '00000000-0000-4000-8000-0000000000bb', name: 'Beat Beispiel' };
const ICH = { id: '00000000-0000-4000-8000-0000000000aa', name: 'Anna Muster' };
const stv = (o: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-000000000101', vertretene: ICH, vertreter: BEAT, von: '2026-11-02', bis: '2026-11-13', unterschriften: false,
  aktiv: false, richtung: 'eigene', createdAt: '2026-10-27T08:00:00Z', can: { beenden: true }, ...o,
});

function Page({ initial = {} }: { initial?: KontoSearch }) {
  const [search, set] = useState<KontoSearch>(initial);
  const setSearch = useCallback<SetKontoSearch>(next => set(s => {
    const m: Record<string, unknown> = { ...s, ...next };
    return Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined)) as KontoSearch;
  }), []);
  return <StellvertretungPage search={search} setSearch={setSearch} />;
}

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

describe('Profil und Stellvertretung', () => {
  it('zeigt Stellvertretungen; leer mit erster Aktion', async () => {
    stub({ 'GET /v1/stellvertretungen': () => json({ items: [] }) });
    const { container } = renderWithIam(<Page />);
    expect(await screen.findByText(K.liste.leer)).toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('erfasst eine Stellvertretung: Person suchen und wählen, Prüfung, Wirkung, Absenden', async () => {
    let items: unknown[] = [];
    let gesendet: unknown = null;
    const api = stub({
      'GET /v1/stellvertretungen': () => json({ items }),
      'GET /v1/people': () => json({ items: [{ ...BEAT, kind: 'user', email: null, clientId: null, lastSeenAt: null }], nextCursor: null }),
      'POST /v1/stellvertretungen': async req => { gesendet = await req.json(); items = [stv()]; return json(stv(), 201); },
    });
    const { container } = renderWithIam(<Page initial={{ o: 'neu' }} />);
    const dlg = await screen.findByRole('dialog', { name: K.erfassen });
    await userEvent.click(within(dlg).getByRole('button', { name: K.form.speichern }));
    expect(within(dlg).getByText(K.form.personFehlt)).toBeInTheDocument();
    expect(within(dlg).getAllByText(K.form.datumFehlt).length).toBe(1);
    await userEvent.type(within(dlg).getByLabelText(K.form.person), 'Be');
    await userEvent.click(await within(dlg).findByRole('button', { name: /Beat Beispiel/ }));
    expect(within(dlg).getByText(K.form.wirkung('Beat Beispiel'))).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText(K.form.bis), '2099-11-13');
    await expectNoAxe(container);
    await userEvent.click(within(dlg).getByRole('button', { name: K.form.speichern }));
    expect(await screen.findByText(K.liste.eigene('Beat Beispiel'))).toBeInTheDocument();
    const post = api.calls.find(c => c.method === 'POST');
    expect(post?.headers.get('idempotency-key')).toBeTruthy();
    expect(gesendet).toMatchObject({ vertreter: BEAT.id, bis: '2099-11-13', unterschriften: false });
  });

  it('beendet mit Rückfrage; fremde Vertretungen ohne Beenden', async () => {
    let items: unknown[] = [stv(), stv({ id: '00000000-0000-4000-8000-000000000102', vertretene: { id: '00000000-0000-4000-8000-0000000000cc', name: 'Cora' }, vertreter: ICH, richtung: 'fuer_andere', can: { beenden: false } })];
    stub({
      'GET /v1/stellvertretungen': () => json({ items }),
      'DELETE /v1/stellvertretungen/00000000-0000-4000-8000-000000000101': () => { items = items.slice(1); return new Response(null, { status: 204 }); },
    });
    renderWithIam(<Page />);
    expect(await screen.findByText(K.liste.fuerAndere('Cora'))).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /beenden/ })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: K.beendenAria('Beat Beispiel') }));
    const dlg = await screen.findByRole('dialog', { name: K.beendenFrage('Beat Beispiel') });
    await userEvent.click(within(dlg).getByRole('button', { name: K.beenden }));
    expect(await screen.findByText(K.beendet)).toBeInTheDocument();
    expect(screen.queryByText(K.liste.eigene('Beat Beispiel'))).not.toBeInTheDocument();
  });
});
