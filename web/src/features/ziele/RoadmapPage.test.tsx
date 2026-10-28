/**
 * Portfolio-Roadmap (UI-31, K6 Schritt 8; AP-E6-2) gegen die nachgebildete API: publizierte Roadmap je Handlungsfeld
 * mit Jahreszielen, Hauptaktivitäten und Projekten (ein Klick zur Projektakte), leer, Vorschau mit Wirkung und
 * Publizieren für die UE, Sperre vor der Freigabe.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import type { RoadmapInhalt } from './RoadmapApi.ts';
import { RoadmapPage } from './RoadmapPage.tsx';
import { validateRoadmapSearch, type RoadmapSearch, type SetRoadmapSearch } from './RoadmapSearch.ts';
import { TR } from './RoadmapTexte.ts';

const inhalt: RoadmapInhalt = {
  jahr: 2027,
  handlungsfelder: [{
    id: '00000000-0000-4000-8000-0000000000f1', label: 'Wirtschaftlichkeit',
    ziele: [{
      nummer: '2.1', text: 'Kosten senken', metrik: '', zielwert: '', projekte: [],
      jahresziele: [{
        nummer: '2.1.1', text: 'Einkauf bündeln', metrik: 'Anteil', zielwert: '60 %',
        hauptaktivitaeten: [{ text: 'Rahmenverträge', verantwortlich: 'Anna Muster' }],
        projekte: [{ nummer: '2027-001', name: 'Einkauf', phase: 'P1', lebenszyklus: 'aktiv' }],
      }],
    }],
  }],
};
const roadmap = { jahr: 2027, publiziertAt: '2026-12-16T08:00:00Z', publiziertBy: null, version: 1, inhalt, can: { publizieren: false } };

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

const projektOeffnen = vi.fn();
function Page({ initial = {} }: { initial?: RoadmapSearch }) {
  const [search, set] = useState<RoadmapSearch>(initial);
  const setSearch = useCallback<SetRoadmapSearch>(next => set(s => Object.fromEntries(Object.entries({ ...s, ...next }).filter(([, v]) => v !== undefined)) as RoadmapSearch), []);
  return <><RoadmapPage search={search} setSearch={setSearch} projektOeffnen={projektOeffnen} /><output data-testid="s">{JSON.stringify(search)}</output></>;
}

describe('Roadmap', () => {
  it('zeigt die neueste publizierte Roadmap; Projekt mit einem Klick', async () => {
    stub({ 'GET /v1/roadmap': () => json({ items: [{ jahr: 2027, publiziertAt: '2026-12-16T08:00:00Z', version: 1 }] }), 'GET /v1/roadmap/2027': () => json(roadmap) });
    const { container } = renderWithIam(<Page />, { roles: ['leser'], permissions: ['tenant:read', 'ziel:read'] });
    expect(await screen.findByRole('heading', { level: 1, name: TR.titel(2027) })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Wirtschaftlichkeit' })).toBeInTheDocument();
    expect(screen.getByText('Rahmenverträge')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TR.publizieren })).not.toBeInTheDocument();
    await expectNoAxe(container);
    await userEvent.click(screen.getByRole('button', { name: TR.projektOeffnen('2027-001', 'Einkauf') }));
    expect(projektOeffnen).toHaveBeenCalledWith('2027-001');
  });

  it('leer: noch nicht publiziert', async () => {
    stub({ 'GET /v1/roadmap': () => json({ items: [] }), 'GET /v1/roadmap/2028': () => json({ title: 'Nicht gefunden', status: 404 }, 404) });
    renderWithIam(<Page initial={{ jahr: '2028' }} />, { roles: ['leser'], permissions: ['tenant:read'] });
    expect(await screen.findByText(TR.leer(2028))).toBeInTheDocument();
  });

  it('UE: Vorschau mit Wirkung und Publizieren', async () => {
    const api = stub({
      'GET /v1/roadmap': () => json({ items: [] }),
      'GET /v1/roadmap/2027': () => json({ title: 'Nicht gefunden', status: 404 }, 404),
      'GET /v1/roadmap/2027/vorschau': () => json({ jahr: 2027, stand: 'in_kraft', publiziertAt: null, inhalt, can: { publizieren: true } }),
      'POST /v1/roadmap/2027': () => json(roadmap),
    });
    renderWithIam(<Page initial={{ jahr: '2027' }} />, { roles: ['ue'], permissions: ['tenant:read', 'ziel:read', 'ziel:freigabe'] });
    await userEvent.click(await screen.findByRole('button', { name: TR.publizieren }));
    expect(await screen.findByText(TR.wirkung(2027))).toBeInTheDocument();
    expect(screen.getByText('Einkauf bündeln', { exact: false })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TR.publizieren }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    expect(api.calls.find(c => c.method === 'POST')!.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('{"jahr":"2027"}'));
  });

  it('UE: vor der Freigabe gesperrt (Sperre mit Grund)', async () => {
    stub({
      'GET /v1/roadmap': () => json({ items: [] }),
      'GET /v1/roadmap/2028': () => json({ title: 'Nicht gefunden', status: 404 }, 404),
      'GET /v1/roadmap/2028/vorschau': () => json({ jahr: 2028, stand: 'in_arbeit', publiziertAt: null, inhalt: { jahr: 2028, handlungsfelder: [] }, can: { publizieren: false } }),
    });
    renderWithIam(<Page initial={{ jahr: '2028', ansicht: 'vorschau' }} />, { roles: ['ue'], permissions: ['tenant:read', 'ziel:read', 'ziel:freigabe'] });
    expect(await screen.findByText(TR.nichtInKraft(2028))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TR.publizieren })).not.toBeInTheDocument();
  });

  it('Adresse: Jahr vierstellig, Ansicht nur «vorschau»', () => {
    expect(validateRoadmapSearch({ jahr: '2027', ansicht: 'vorschau' })).toEqual({ jahr: '2027', ansicht: 'vorschau' });
    expect(validateRoadmapSearch({ jahr: 27, ansicht: 'x' })).toEqual({});
  });
});
