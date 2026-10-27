/**
 * Seite «Phasenmodell» (UI-46) gegen die nachgebildete API: leerer Zustand mit Vorgabe, Lesemodus einer Version in Kraft,
 * automatisches Speichern mit If-Match, Rückgängig, lokale Prüfung, Konflikt (412) und In-Kraft-Setzen mit Wirkung.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { T } from '../../ui/index.ts';
import { PhasenmodellPage } from './PhasenmodellPage.tsx';
import type { PhasenmodellSearch, SetPhasenmodellSearch } from './search.ts';

const P = T.phasenmodell;
const E = '00000000-0000-4000-8000-0000000000e1';
const K = '00000000-0000-4000-8000-0000000000a1';

const kurz = (id: string, nummer: number, stand: string) => ({
  id, nummer, stand, beschreibung: '', inKraftAb: stand === 'entwurf' ? null : '2026-10-01T08:00:00Z', inKraftVon: null, version: 1,
  createdAt: '2026-10-01T08:00:00Z', createdBy: null, updatedAt: '2026-10-01T08:00:00Z', updatedBy: null,
});

const modell = (id: string, nummer: number, stand: string, o: Record<string, unknown> = {}) => ({
  ...kurz(id, nummer, stand),
  phasen: [
    { code: 'P0', name: 'Initialisierung', position: 0, ergebnisse: [{ art: 'lieferergebnis', text: 'Projektvertrag für P1' }], pflichtangaben: [] },
    { code: 'P1', name: 'Konzept & Planung', position: 1, ergebnisse: [], pflichtangaben: [] },
  ],
  gates: [{
    code: 'P0_P1', name: 'Gate P0–P1', vonPhase: 'P0', nachPhase: 'P1', position: 0,
    leitfragen: [{ wertestrom: 'nutzen', text: 'Hat das Projekt ausreichenden Nutzen?' }], pflichtangaben: [],
  }],
  kapitelWirkung: [{ kapitel: 9, dimension: 'budget' }],
  fristen: [{ schluessel: 'versand', wert: 5, einheit: 'arbeitstage' }],
  toleranzen: [{ dimension: 'kosten', wert: null, einheit: 'prozent' }],
  pruefung: [{ stufe: 'warnung', regel: 'leitfragen_je_wertestrom', text: 'Leitfragen je Wertestrom: Gate P0–P1 hat keine Leitfrage für Projektmanagement.', ort: { art: 'gate', code: 'P0_P1' } }],
  can: { write: stand === 'entwurf', activate: stand === 'entwurf' },
  ...o,
});

function Page({ initial = {} }: { initial?: PhasenmodellSearch }) {
  const [search, set] = useState<PhasenmodellSearch>(initial);
  const setSearch = useCallback<SetPhasenmodellSearch>(next => set(s => {
    const merged: Record<string, string | undefined> = { ...s, ...next };
    return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined)) as PhasenmodellSearch;
  }), []);
  return <PhasenmodellPage search={search} setSearch={setSearch} />;
}

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

const ADMIN = { permissions: ['tenant:read', 'phasenmodell:read', 'phasenmodell:write', 'phasenmodell:activate'] } as const;
const mitEtag = (body: unknown, v: number, status = 200) => json(body, status, { ETag: `W/"${v}"` });

afterEach(() => { vi.unstubAllGlobals(); });

describe('Phasenmodell', () => {
  it('leer: lädt die Vorgabe des PM-Handbuchs als Entwurf', async () => {
    let angelegt = false;
    const api = stub({
      'GET /v1/phasenmodelle': () => json(angelegt ? { items: [kurz(E, 1, 'entwurf')], nextCursor: null, can: { create: true } } : { items: [], nextCursor: null, can: { create: true } }),
      'POST /v1/phasenmodelle': () => { angelegt = true; return mitEtag(modell(E, 1, 'entwurf'), 1, 201); },
      [`GET /v1/phasenmodelle/${E}`]: () => mitEtag(modell(E, 1, 'entwurf'), 1),
    });
    renderWithIam(<Page />, ADMIN as never);
    expect(await screen.findByText(P.leer)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: P.vorgabeLaden }));
    expect(await screen.findByRole('button', { name: P.inKraftSetzen })).toBeInTheDocument();
    const post = api.calls.find(c => c.method === 'POST')!;
    expect(await post.json()).toEqual({ quelle: 'vorgabe' });
    expect(post.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('Version in Kraft: gesperrt, ohne Bearbeiten-Elemente, mit Prüfbericht und Abschnitten', async () => {
    stub({
      'GET /v1/phasenmodelle': () => json({ items: [kurz(K, 1, 'in_kraft')], nextCursor: null, can: { create: false } }),
      [`GET /v1/phasenmodelle/${K}`]: () => mitEtag(modell(K, 1, 'in_kraft'), 4),
    });
    renderWithIam(<Page />, { permissions: ['tenant:read', 'phasenmodell:read'] } as never);
    expect(await screen.findByText(P.gesperrt(1))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: P.inKraftSetzen })).toBeNull();
    expect(screen.queryByRole('button', { name: P.entwurfAnlegen })).toBeNull();
    expect(screen.getByText(/keine Leitfrage für Projektmanagement/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: P.zumObjekt }));
    expect(await screen.findByText('Hat das Projekt ausreichenden Nutzen?')).toBeInTheDocument();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('Entwurf: speichert automatisch mit If-Match, Rückgängig stellt den Text wieder her', async () => {
    const patches: { ifMatch: string | null; body: Record<string, unknown> }[] = [];
    let version = 1;
    stub({
      'GET /v1/phasenmodelle': () => json({ items: [kurz(K, 1, 'in_kraft'), kurz(E, 2, 'entwurf')], nextCursor: null, can: { create: true } }),
      [`GET /v1/phasenmodelle/${E}`]: () => mitEtag(modell(E, 2, 'entwurf'), version),
      [`PATCH /v1/phasenmodelle/${E}`]: req => {
        patches.push({ ifMatch: req.headers.get('if-match'), body: {} });
        return req.json().then((b: Record<string, unknown>) => { patches[patches.length - 1]!.body = b; version++; return mitEtag(modell(E, 2, 'entwurf', { version }), version); });
      },
    });
    renderWithIam(<Page initial={{ e: 'P0_P1' }} />, ADMIN as never);
    const feld = await screen.findByRole('textbox', { name: `${P.wertestrom.nutzen} 1` });
    await userEvent.clear(feld);
    await userEvent.type(feld, 'Ist der Nutzen belegt?');
    await waitFor(() => expect(patches.length).toBe(1), { timeout: 3000 });
    expect(patches[0]!.ifMatch).toBe('W/"1"');
    const gates = patches[0]!.body.gates as { code: string; leitfragen: { text: string }[] }[];
    expect(gates[0]!.leitfragen[0]!.text).toBe('Ist der Nutzen belegt?');
    expect(await screen.findByText(P.gespeichert)).toBeInTheDocument();

    fireEvent.keyDown(feld, { key: 'z', ctrlKey: true });
    expect(screen.getByRole('textbox', { name: `${P.wertestrom.nutzen} 1` })).toHaveValue('Hat das Projekt ausreichenden Nutzen?');
    await waitFor(() => expect(patches.length).toBe(2), { timeout: 3000 });
    expect(patches[1]!.ifMatch).toBe('W/"2"');
  });

  it('lokale Prüfung: ohne Bezeichnung kein Speichern, Meldung am Feld', async () => {
    const api = stub({
      'GET /v1/phasenmodelle': () => json({ items: [kurz(E, 1, 'entwurf')], nextCursor: null, can: { create: true } }),
      [`GET /v1/phasenmodelle/${E}`]: () => mitEtag(modell(E, 1, 'entwurf'), 1),
    });
    renderWithIam(<Page initial={{ e: 'P1' }} />, ADMIN as never);
    const name = await screen.findByRole('textbox', { name: P.name });
    await userEvent.clear(name);
    expect(await screen.findByText(P.nameFehlt)).toBeInTheDocument();
    expect(await screen.findByText(P.ungespeichert, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'PATCH')).toBe(false);
  });

  it('Konflikt (412): eigene Fassung auf den neuen Stand speichern', async () => {
    let n = 0;
    const etags: (string | null)[] = [];
    stub({
      'GET /v1/phasenmodelle': () => json({ items: [kurz(E, 1, 'entwurf')], nextCursor: null, can: { create: true } }),
      [`GET /v1/phasenmodelle/${E}`]: () => mitEtag(modell(E, 1, 'entwurf'), n === 0 ? 1 : 7),
      [`PATCH /v1/phasenmodelle/${E}`]: req => {
        etags.push(req.headers.get('if-match'));
        n++;
        return n === 1
          ? json({ type: 'about:blank', title: 'Version weicht ab', status: 412, currentVersion: 7 }, 412)
          : mitEtag(modell(E, 1, 'entwurf', { version: 8, beschreibung: 'Neu' }), 8);
      },
    });
    renderWithIam(<Page />, ADMIN as never);
    await userEvent.type(await screen.findByRole('textbox', { name: P.beschreibung }), 'Neu');
    expect(await screen.findByText(P.konflikt, {}, { timeout: 3000 })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: P.konfliktMeine }));
    await waitFor(() => expect(etags).toEqual(['W/"1"', 'W/"7"']), { timeout: 3000 });
    expect(screen.queryByText(P.konflikt)).toBeNull();
  });

  it('In Kraft setzen zeigt die Wirkung und setzt nach Bestätigung in Kraft', async () => {
    const api = stub({
      'GET /v1/phasenmodelle': () => json({ items: [kurz(K, 1, 'in_kraft'), kurz(E, 2, 'entwurf')], nextCursor: null, can: { create: true } }),
      [`GET /v1/phasenmodelle/${E}`]: () => mitEtag(modell(E, 2, 'entwurf'), 3),
      [`POST /v1/phasenmodelle/${E}/in-kraft-setzen`]: () => mitEtag(modell(E, 2, 'in_kraft', { can: { write: false, activate: false } }), 4),
    });
    renderWithIam(<Page />, ADMIN as never);
    await userEvent.click(await screen.findByRole('button', { name: P.inKraftSetzen }));
    const dlg = await screen.findByRole('dialog', { name: P.inKraftFrage(2) });
    expect(within(dlg).getByText(P.inKraftWirkung)).toBeInTheDocument();
    expect(within(dlg).getByText(P.inKraftAbloesung(1))).toBeInTheDocument();
    expect(within(dlg).getByText(P.inKraftWarnungen(1))).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('button', { name: P.inKraftSetzen }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST' && c.url.endsWith('/in-kraft-setzen') && c.headers.get('If-Match') === 'W/"3"')).toBe(true));
  });

  it('axe ohne Befund: Entwurf mit Gate, Fristen und Kapitelwirkung', async () => {
    stub({
      'GET /v1/phasenmodelle': () => json({ items: [kurz(K, 1, 'in_kraft'), kurz(E, 2, 'entwurf')], nextCursor: null, can: { create: true } }),
      [`GET /v1/phasenmodelle/${E}`]: () => mitEtag(modell(E, 2, 'entwurf'), 1),
    });
    const { container } = renderWithIam(<Page initial={{ e: 'P0_P1' }} />, ADMIN as never);
    await screen.findByRole('textbox', { name: `${P.wertestrom.nutzen} 1` });
    await expectNoAxe(container);
    for (const abschnitt of [P.fristenToleranzen, P.wirkung, 'Initialisierung']) {
      await userEvent.click(screen.getByRole('button', { name: abschnitt }));
      await expectNoAxe(container);
    }
  });
});
