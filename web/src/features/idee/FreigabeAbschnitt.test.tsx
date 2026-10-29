/**
 * Entscheid über die Initialisierung (AP-E4-3, K4 Schritte 8–10) gegen die nachgebildete API: die UE erfasst Sponsor und
 * Projektleitung und legt dem Gremium vor (If-Match), die Direktion gibt frei (Sperre ohne Projektleitung) oder weist
 * nur mit Begründung zurück; nach der Freigabe Verweis auf das Projekt.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import type { AppPermission } from '../../auth/permissions.ts';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import type { Idee } from './api.ts';
import { FreigabeAbschnitt } from './FreigabeAbschnitt.tsx';
import { TF } from './FreigabeTexte.ts';

const ID = '00000000-0000-4000-8000-0000000000a1';
const AS = '00000000-0000-4000-8000-0000000000e1';
const SP = '00000000-0000-4000-8000-0000000000e2';
const PR = '00000000-0000-4000-8000-0000000000b1';
const UE = { roles: ['ue'], permissions: ['tenant:read', 'stammdaten:read', 'portfolio:read', 'idee:read', 'idee:write'] as AppPermission[] };
const DIREKTION = { roles: ['direktion'], permissions: ['tenant:read', 'stammdaten:read', 'portfolio:read', 'idee:read'] as AppPermission[] };

const idee = (stand: string) => ({
  id: ID, nummer: 7, stand, standAt: '2026-10-03T08:00:00Z', eingereichtAt: '2026-10-01T08:00:00Z', erfasstVon: AS, eigene: false,
  titel: 'Digitale Aufnahme', ausgangslage: 'Papier', zielsetzung: 'Ohne Papier', handlungsfeldId: null, strategischesZielId: null, bereiche: [],
  nutzen: 'hoch', nutzenText: '', aufwand: 'mittel', aufwandText: '', relevanz: 'hoch', relevanzText: '', herkunft: null, fuehrendeIdeeId: null,
  begruendung: '', rueckfragen: [], version: 3, createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-03T08:00:00Z',
  can: { bearbeiten: false, einreichen: false, loeschen: false },
}) as unknown as Idee;
const freigabe = (o: Record<string, unknown> = {}) => ({
  weg: 'gremium', zustaendig: 'PRAT Programmausschuss', vorgesehenerSponsor: SP, sponsor: null, projektleitung: null, freigegebenAt: null, projekt: null,
  can: { traktandieren: true, angaben: true, entscheiden: false, initialisieren: false }, vermerke: [], ...o,
});

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}
const gehe = vi.fn<(p: string) => void>();

describe('Entscheid über die Initialisierung', () => {
  it('UE: Sponsor vorbelegt, speichern und dem Gremium vorlegen mit If-Match', async () => {
    let f = freigabe();
    const api = stub({
      [`GET /v1/ideen/${ID}/freigabe`]: () => json(f, 200, { ETag: 'W/"3"' }),
      [`PUT /v1/ideen/${ID}/freigabe/angaben`]: () => { f = freigabe({ sponsor: SP }); return json(f, 200, { ETag: 'W/"4"' }); },
      [`POST /v1/ideen/${ID}/traktandieren`]: () => { f = freigabe({ sponsor: SP, can: { traktandieren: false, angaben: true, entscheiden: false } }); return json(f, 200, { ETag: 'W/"5"' }); },
    });
    const { container } = renderWithIam(<FreigabeAbschnitt idee={idee('in_pruefung')} gehe={gehe} titleId="t" />, UE);
    expect(await screen.findByRole('heading', { name: TF.titel })).toBeInTheDocument();
    expect(screen.getByText(TF.traktandierenWirkung('PRAT Programmausschuss'))).toBeInTheDocument();
    await expectNoAxe(container);
    await userEvent.click(screen.getByRole('button', { name: TF.angabenSpeichern }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'PUT')).toBe(true));
    const put = api.calls.find(c => c.method === 'PUT')!;
    expect(put.headers.get('If-Match')).toBe('W/"3"');
    expect(await put.json()).toEqual({ sponsor: SP, projektleitung: null });
    await userEvent.click(await screen.findByRole('button', { name: TF.traktandieren }));
    await waitFor(() => expect(api.calls.some(c => c.url.endsWith('/traktandieren'))).toBe(true));
    expect(api.calls.find(c => c.url.endsWith('/traktandieren'))!.headers.get('If-Match')).toBe('W/"4"');
  });

  it('Direktion: Freigabe sperrt ohne Projektleitung; Zurückweisen nur mit Begründung', async () => {
    const api = stub({
      [`GET /v1/ideen/${ID}/freigabe`]: () => json(freigabe({ weg: 'direktion', zustaendig: 'Direktion Pflege', can: { traktandieren: false, angaben: false, entscheiden: true } }), 200, { ETag: 'W/"6"' }),
      [`POST /v1/ideen/${ID}/freigeben`]: () => json(freigabe(), 200, { ETag: 'W/"7"' }),
      [`POST /v1/ideen/${ID}/ablehnen`]: () => json(freigabe(), 200, { ETag: 'W/"7"' }),
    });
    const { container } = renderWithIam(<FreigabeAbschnitt idee={idee('traktandiert')} gehe={gehe} titleId="t" />, DIREKTION);
    expect(await screen.findByText(TF.freigebenWirkung('Digitale Aufnahme'))).toBeInTheDocument();
    await expectNoAxe(container);
    await userEvent.click(screen.getByRole('button', { name: TF.freigeben }));
    expect(screen.getByText(TF.plFehlt)).toBeInTheDocument();
    expect(api.calls.some(c => c.url.endsWith('/freigeben'))).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: TF.zurueckweisen }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: TF.zurueckweisen }));
    expect(within(dialog).getByText(TF.begruendungFehlt)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(TF.begruendung), 'Kein Budget');
    await userEvent.click(within(dialog).getByRole('button', { name: TF.zurueckweisen }));
    await waitFor(() => expect(api.calls.some(c => c.url.endsWith('/ablehnen'))).toBe(true));
    const post = api.calls.find(c => c.url.endsWith('/ablehnen'))!;
    expect(post.headers.get('If-Match')).toBe('W/"6"');
    expect(await post.json()).toEqual({ begruendung: 'Kein Budget' });
  });

  it('nach der Freigabe: Projekt in P0 mit Verweis', async () => {
    stub({ [`GET /v1/ideen/${ID}/freigabe`]: () => json(freigabe({ sponsor: SP, projektleitung: SP, projekt: { id: PR, nummer: '2026-014', name: 'Digitale Aufnahme' }, can: { traktandieren: false, angaben: false, entscheiden: false } }), 200, { ETag: 'W/"8"' }) });
    renderWithIam(<FreigabeAbschnitt idee={idee('freigegeben')} gehe={gehe} titleId="t" />, UE);
    expect(await screen.findByText(TF.freigegeben('2026-014', 'Digitale Aufnahme'))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: TF.zumProjekt }));
    expect(gehe).toHaveBeenCalledWith('/projekte/2026-014');
  });
});
