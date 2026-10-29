/**
 * Seite «Portfolios und Gremien» (UI-47) gegen die nachgebildete API: Liste mit entscheidendem Gremium, Gremienweg mit
 * «via SNS-VR», Bearbeiten des Gremienwegs mit `If-Match`, Anlegen, Termine, Rechte (nur lesen), axe.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog, Me } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { T } from '../../ui/index.ts';
import { PortfoliosPage } from './PortfoliosPage.tsx';
import type { PortfoliosSearch, SetPortfoliosSearch } from './search.ts';
import { TP } from './texte.ts';

const PA = '00000000-0000-4000-8000-00000000000a';
const PC = '00000000-0000-4000-8000-00000000000c';
const PRAT = '00000000-0000-4000-8000-000000000001';
const SNS = '00000000-0000-4000-8000-000000000002';
const meta = { createdAt: '2026-10-01T08:00:00Z', createdBy: null, updatedAt: '2026-10-01T08:00:00Z', updatedBy: null };
const portfolio = (o: Record<string, unknown> = {}) => ({
  id: PA, kategorie: 'A', schluessel: 'transformation', name: 'Transformationsprogramm', pflichten: true, orgEinheitId: null, version: 3, ...meta,
  can: { admin: true }, ...o,
});
const gremium = (o: Record<string, unknown> = {}) => ({
  id: PRAT, portfolioId: PA, kuerzel: 'prat', name: 'PRAT', art: 'entscheidend', rhythmus: 'monatlich', version: 1, ...meta, can: { admin: true }, ...o,
});
const GREMIEN = [gremium(), gremium({ id: SNS, kuerzel: 'sns-vr', name: 'SNS-VR', art: 'extern', rhythmus: '' })];
const kurz = (g: ReturnType<typeof gremium>) => ({ id: g.id, kuerzel: g.kuerzel, name: g.name, art: g.art });
const WEG = {
  portfolioId: PA, version: 3, can: { admin: true },
  schritte: [
    { gate: 'P0_P1', gremium: kurz(GREMIEN[0]!), zusaetzlich: kurz(GREMIEN[1]!), viaSns: true },
    { gate: 'P2_P3', gremium: kurz(GREMIEN[0]!), zusaetzlich: null, viaSns: false },
  ],
};

function Page({ initial = {} }: { initial?: PortfoliosSearch }) {
  const [search, set] = useState<PortfoliosSearch>(initial);
  const setSearch = useCallback<SetPortfoliosSearch>(next => set(s => {
    const merged: Record<string, string | undefined> = { ...s, ...next };
    return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined)) as PortfoliosSearch;
  }), []);
  return <PortfoliosPage search={search} setSearch={setSearch} />;
}

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi({
    'GET /v1/portfolios': () => json({ items: [portfolio(), portfolio({ id: PC, kategorie: 'C', schluessel: 'dti', name: 'Direktion DTI', pflichten: false })], nextCursor: null }),
    'GET /v1/gremien': () => json({ items: GREMIEN, nextCursor: null }),
    [`GET /v1/portfolios/${PA}`]: () => json(portfolio(), 200, { ETag: 'W/"3"' }),
    [`GET /v1/portfolios/${PA}/gremienweg`]: () => json(WEG, 200, { ETag: 'W/"3"' }),
    ...routes,
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

const UE: Partial<Me> = { roles: ['ue'], permissions: ['tenant:read', 'portfolio:read', 'portfolio:admin'] };
const LESEND: Partial<Me> = { roles: ['gl'], permissions: ['tenant:read', 'portfolio:read'] };

describe('Portfolios und Gremien', () => {
  it('zeigt Portfolios mit Kategorie, Pflichten und entscheidendem Gremium', async () => {
    stub({});
    const { container } = renderWithIam(<Page />, UE);
    const zeile = (await screen.findByRole('button', { name: 'Transformationsprogramm' })).closest('tr')!;
    expect(within(zeile).getByText(TP.kategorien.A!)).toBeInTheDocument();
    expect(within(zeile).getByText('PRAT')).toBeInTheDocument();
    const c = screen.getByRole('button', { name: 'Direktion DTI' }).closest('tr')!;
    expect(within(c).getByText(TP.pflichtKurz(false))).toBeInTheDocument();
    expect(within(c).getByText(TP.keinGremium)).toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('leer: erklärt die Ansicht und bietet das Anlegen an', async () => {
    stub({ 'GET /v1/portfolios': () => json({ items: [], nextCursor: null }) });
    renderWithIam(<Page />, UE);
    expect(await screen.findByText(TP.empty)).toBeInTheDocument();
    // nur die Aktion der leeren Liste (Z2), kein zweiter Button im Kopf
    expect(screen.getAllByRole('button', { name: new RegExp(TP.create) }).length).toBe(1);
  });

  it('Schublade: Gremien und Gremienweg mit «via SNS-VR»', async () => {
    stub({});
    renderWithIam(<Page initial={{ o: 'transformation' }} />, UE);
    const drawer = await screen.findByRole('dialog', { name: 'Transformationsprogramm' });
    expect(await within(drawer).findByText(TP.wegVia('PRAT', 'SNS-VR'))).toBeInTheDocument();
    expect(within(drawer).getByText(TP.mitPflichten)).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'SNS-VR' })).toBeInTheDocument();
    expect(within(drawer).getAllByText(TP.wegKein).length).toBe(4);
    await expectNoAxe(drawer);
  });

  it('Gremienweg bearbeiten: PUT mit If-Match des Portfolios', async () => {
    // wie der Server: nach dem Speichern liefern Portfolio und Gremienweg die neue Version
    let version = 3;
    const api = stub({
      [`GET /v1/portfolios/${PA}`]: () => json(portfolio({ version }), 200, { ETag: `W/"${version}"` }),
      [`GET /v1/portfolios/${PA}/gremienweg`]: () => json({ ...WEG, version }, 200, { ETag: `W/"${version}"` }),
      [`PUT /v1/portfolios/${PA}/gremienweg`]: () => { version = 4; return json({ ...WEG, version }, 200, { ETag: 'W/"4"' }); },
    });
    renderWithIam(<Page initial={{ o: 'transformation' }} />, UE);
    await userEvent.click(await screen.findByRole('button', { name: TP.gremienwegBearbeiten }));
    const eintritt = await screen.findByLabelText('Gate Eintritt P0');
    await userEvent.selectOptions(eintritt, TP.wegVia('PRAT', 'SNS-VR'));
    await userEvent.selectOptions(screen.getByLabelText('Gate P2–P3'), TP.wegKein);
    await userEvent.click(screen.getByRole('button', { name: T.common.save }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'PUT')).toBe(true));
    const put = api.calls.find(c => c.method === 'PUT')!;
    expect(put.headers.get('If-Match')).toBe('W/"3"');
    expect(await screen.findByText(TP.gremienwegSaved)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: TP.gremienwegBearbeiten })).toBeInTheDocument();
    expect(await put.json()).toEqual({ schritte: [
      { gate: 'EINTRITT_P0', gremiumId: PRAT, zusaetzlichGremiumId: SNS },
      { gate: 'P0_P1', gremiumId: PRAT, zusaetzlichGremiumId: SNS },
    ] });
  });

  it('meldet beim Gremienweg einen Konflikt (412)', async () => {
    stub({ [`PUT /v1/portfolios/${PA}/gremienweg`]: () => json({ title: 'Inzwischen geändert', status: 412 }, 412) });
    renderWithIam(<Page initial={{ o: 'transformation' }} />, UE);
    await userEvent.click(await screen.findByRole('button', { name: TP.gremienwegBearbeiten }));
    await screen.findByLabelText('Gate Eintritt P0');
    await userEvent.click(screen.getByRole('button', { name: T.common.save }));
    expect(await screen.findByText(TP.conflict)).toBeInTheDocument();
  });

  it('legt ein Portfolio mit Idempotency-Key an', async () => {
    const api = stub({
      'POST /v1/portfolios': () => json(portfolio({ id: PC, kategorie: 'B', schluessel: 'geschaeftsleitung', name: 'Geschäftsleitung', version: 1 }), 201, { ETag: 'W/"1"' }),
    });
    renderWithIam(<Page initial={{ o: 'neu' }} />, UE);
    await userEvent.type(await screen.findByLabelText(TP.name), 'Geschäftsleitung');
    await userEvent.selectOptions(screen.getByLabelText(TP.kategorie), TP.kategorien.B!);
    await userEvent.type(screen.getByLabelText(TP.schluessel), 'Geschaeftsleitung');
    await userEvent.click(screen.getByRole('button', { name: T.common.save }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    const post = api.calls.find(c => c.method === 'POST')!;
    expect(post.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(await post.json()).toEqual({ kategorie: 'B', schluessel: 'geschaeftsleitung', name: 'Geschäftsleitung' });
  });

  it('prüft Bezeichnung und Schlüssel vor dem Absenden', async () => {
    const api = stub({});
    renderWithIam(<Page initial={{ o: 'neu' }} />, UE);
    await userEvent.type(await screen.findByLabelText(TP.schluessel), 'mit_unterstrich');
    await userEvent.click(screen.getByRole('button', { name: T.common.save }));
    expect(await screen.findByText(TP.nameMissing)).toBeInTheDocument();
    expect(screen.getByText(TP.schluesselInvalid)).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
  });

  it('zweites entscheidendes Gremium: Hinweis auf A-45 (409)', async () => {
    stub({ 'POST /v1/gremien': () => json({ title: 'Konflikt', status: 409 }, 409) });
    renderWithIam(<Page initial={{ o: 'transformation', g: 'neu' }} />, UE);
    const art = await screen.findByLabelText(TP.art);
    expect(art).toHaveValue('extern');
    await userEvent.selectOptions(art, TP.arten.entscheidend!);
    await userEvent.type(screen.getByLabelText(TP.name), 'Zweiter Ausschuss');
    await userEvent.type(screen.getByLabelText(TP.kuerzel), 'zweiter');
    await userEvent.click(screen.getByRole('button', { name: T.common.save }));
    expect(await screen.findByText(TP.zweitesEntscheidend)).toBeInTheDocument();
  });

  it('Gremium: Sitzungstermin planen', async () => {
    const api = stub({
      [`GET /v1/gremien/${PRAT}`]: () => json(gremium(), 200, { ETag: 'W/"1"' }),
      [`GET /v1/gremien/${PRAT}/termine`]: () => json({ items: [{ id: SNS, gremiumId: PRAT, datum: '2026-11-18', ...meta }], can: { admin: true } }),
      [`POST /v1/gremien/${PRAT}/termine`]: () => json({ id: PC, gremiumId: PRAT, datum: '2026-12-16', ...meta }, 201),
    });
    const { container } = renderWithIam(<Page initial={{ o: 'transformation', g: 'prat' }} />, UE);
    const drawer = await screen.findByRole('dialog', { name: 'PRAT' });
    expect(await within(drawer).findByRole('button', { name: /Termin .* entfernen/ })).toBeInTheDocument();
    const datum = within(drawer).getByLabelText(TP.terminDatum);
    await userEvent.type(datum, '2026-12-16');
    await userEvent.click(within(drawer).getByRole('button', { name: TP.terminPlanen }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    expect(await api.calls.find(c => c.method === 'POST')!.json()).toEqual({ datum: '2026-12-16' });
    await expectNoAxe(container.ownerDocument.body);
  });

  it('Gremium: Termin entfernen mit «Rückgängig» plant ihn wieder ein (I-R1 Stufe 1)', async () => {
    const api = stub({
      [`GET /v1/gremien/${PRAT}`]: () => json(gremium(), 200, { ETag: 'W/"1"' }),
      [`GET /v1/gremien/${PRAT}/termine`]: () => json({ items: [{ id: SNS, gremiumId: PRAT, datum: '2026-11-18', ...meta }], can: { admin: true } }),
      [`DELETE /v1/gremien/${PRAT}/termine/2026-11-18`]: () => new Response(null, { status: 204 }),
      [`POST /v1/gremien/${PRAT}/termine`]: () => json({ id: PC, gremiumId: PRAT, datum: '2026-11-18', ...meta }, 201),
    });
    renderWithIam(<Page initial={{ o: 'transformation', g: 'prat' }} />, UE);
    const drawer = await screen.findByRole('dialog', { name: 'PRAT' });
    await userEvent.click(await within(drawer).findByRole('button', { name: /Termin .* entfernen/ }));
    await userEvent.click(await screen.findByRole('button', { name: TP.rueckgaengig }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    expect(await api.calls.find(c => c.method === 'POST')!.json()).toEqual({ datum: '2026-11-18' });
  });

  it('nur lesen: keine Bearbeiten-Elemente, Hinweis wer ändern darf', async () => {
    stub({
      'GET /v1/portfolios': () => json({ items: [portfolio({ can: { admin: false } })], nextCursor: null }),
      [`GET /v1/portfolios/${PA}`]: () => json(portfolio({ can: { admin: false } }), 200, { ETag: 'W/"3"' }),
      [`GET /v1/portfolios/${PA}/gremienweg`]: () => json({ ...WEG, can: { admin: false } }),
    });
    renderWithIam(<Page initial={{ o: 'transformation' }} />, LESEND);
    expect(await screen.findByText(TP.noRight)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: T.common.edit })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TP.gremienwegBearbeiten })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: new RegExp(TP.create) })).not.toBeInTheDocument();
  });

  it('unbekannter Schlüssel: gleiche Meldung wie ohne Zugriff (Z10)', async () => {
    stub({});
    renderWithIam(<Page initial={{ o: 'gibt-es-nicht' }} />, UE);
    expect(await screen.findByText(TP.gone)).toBeInTheDocument();
  });
});
