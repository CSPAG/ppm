/**
 * Seiten «Organisation» und «Codetabellen» gegen die nachgebildete API (UI-44, UI-45): Liste, Schublade, Anlegen,
 * Konflikt 412, nur lesen ohne Recht (Z8), Vorgabe laden (Z2), deaktivieren mit «Rückgängig» (I-R1); axe ohne Befund.
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
import { CodetabellenPage } from './CodetabellenPage.tsx';
import { OrganisationPage } from './OrganisationPage.tsx';
import type { CodetabellenSearch, OrganisationSearch } from './search.ts';
import { TS } from './texte.ts';

const ADM: Partial<Me> = { roles: ['org-admin'], permissions: ['tenant:read', 'stammdaten:read', 'stammdaten:write'] as Me['permissions'] };
const LESER: Partial<Me> = { roles: ['leser'], permissions: ['tenant:read', 'stammdaten:read'] as Me['permissions'] };

const DTI = '00000000-0000-4000-8000-000000000001';
const ICT = '00000000-0000-4000-8000-000000000002';
const meta = { version: 1, createdAt: '2026-10-01T08:00:00Z', createdBy: null, updatedAt: '2026-10-01T08:00:00Z', updatedBy: null };
const org = (o: Record<string, unknown> = {}) => ({ id: DTI, parentId: null, kuerzel: 'DTI', name: 'Direktion Technologie und Innovation', art: 'direktion', aktiv: true, ...meta, can: { write: true, delete: false }, ...o });
const ict = org({ id: ICT, parentId: DTI, kuerzel: 'DTI-ICT', name: 'ICT', art: 'bereich', can: { write: true, delete: true } });

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

function Org({ initial = {} }: { initial?: OrganisationSearch }) {
  const [search, set] = useState<OrganisationSearch>(initial);
  const setSearch = useCallback((next: Record<string, unknown>) => set(s => {
    const merged: Record<string, unknown> = { ...s, ...next };
    return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined)) as OrganisationSearch;
  }), []);
  return <OrganisationPage search={search} setSearch={setSearch} />;
}

function Code({ initial = {} }: { initial?: CodetabellenSearch }) {
  const [search, set] = useState<CodetabellenSearch>(initial);
  const setSearch = useCallback((next: Record<string, string | undefined>) => set(s => {
    const merged: Record<string, string | undefined> = { ...s, ...next };
    return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined)) as CodetabellenSearch;
  }), []);
  return <CodetabellenPage search={search} setSearch={setSearch} />;
}

const liste = (items: unknown[]) => () => json({ items, nextCursor: null, can: { write: true } });

describe('Organisation (UI-44)', () => {
  it('zeigt die Einheiten mit übergeordneter Einheit, nur aktive als Vorgabe', async () => {
    const api = stub({ 'GET /v1/org-einheiten': liste([org(), ict]) });
    const { container } = renderWithIam(<Org />, ADM);
    expect(await screen.findByRole('button', { name: /DTI-ICT ICT/ })).toBeInTheDocument();
    expect(screen.getByText('Direktion Technologie und Innovation')).toBeInTheDocument();
    expect(api.calls.some(c => c.url.includes('aktiv=true'))).toBe(true);
    await expectNoAxe(container);
  });

  it('legt eine Einheit an und prüft das Kürzel vorab', async () => {
    let body: unknown;
    stub({
      'GET /v1/org-einheiten': liste([org()]),
      'POST /v1/org-einheiten': async req => { body = await req.json(); return json(ict, 201, { ETag: 'W/"1"' }); },
      [`GET /v1/org-einheiten/${ICT}`]: () => json(ict, 200, { ETag: 'W/"1"' }),
    });
    renderWithIam(<Org initial={{ o: 'neu' }} />, ADM);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(TS.org.kuerzel), 'mit leer');
    await userEvent.click(within(dialog).getByRole('button', { name: T.common.save }));
    expect(await within(dialog).findByText(TS.org.kuerzelMissing)).toBeInTheDocument();
    const k = within(dialog).getByLabelText(TS.org.kuerzel);
    expect(k).toHaveFocus();
    await userEvent.clear(k);
    await userEvent.type(k, 'DTI-ICT');
    await userEvent.type(within(dialog).getByLabelText(TS.org.name), 'ICT');
    await userEvent.selectOptions(within(dialog).getByLabelText(TS.org.art), 'bereich');
    await waitFor(() => expect(within(dialog).getByRole('option', { name: /DTI · Direktion/ })).toBeInTheDocument());
    await userEvent.selectOptions(within(dialog).getByLabelText(TS.org.parent), DTI);
    await userEvent.click(within(dialog).getByRole('button', { name: T.common.save }));
    await waitFor(() => expect(body).toEqual({ kuerzel: 'DTI-ICT', name: 'ICT', art: 'bereich', parentId: DTI, aktiv: true }));
  });

  it('Direktion mit Untereinheit: nicht löschbar, Grund genannt; eigene Nachfahren nicht als übergeordnete wählbar', async () => {
    stub({
      'GET /v1/org-einheiten': liste([org(), ict]),
      [`GET /v1/org-einheiten/${DTI}`]: () => json(org(), 200, { ETag: 'W/"1"' }),
    });
    renderWithIam(<Org initial={{ o: DTI }} />, ADM);
    expect(await screen.findByText(TS.org.nichtLoeschbar)).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: T.common.delete })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: T.common.edit }));
    const parent = await within(screen.getByRole('dialog')).findByLabelText(TS.org.parent);
    expect(within(parent).queryByRole('option', { name: /DTI-ICT/ })).not.toBeInTheDocument();
  });

  it('meldet beim Speichern einen Konflikt (412)', async () => {
    const api = stub({
      'GET /v1/org-einheiten': liste([ict]),
      [`GET /v1/org-einheiten/${ICT}`]: () => json(ict, 200, { ETag: 'W/"1"' }),
      [`PATCH /v1/org-einheiten/${ICT}`]: () => json({ title: 'Inzwischen geändert', status: 412 }, 412),
    });
    renderWithIam(<Org initial={{ o: ICT }} />, ADM);
    await userEvent.click(await screen.findByRole('button', { name: T.common.edit }));
    await userEvent.type(await screen.findByLabelText(TS.org.name), ' neu');
    await userEvent.click(screen.getByRole('button', { name: T.common.save }));
    expect(await screen.findByText(TS.org.conflict)).toBeInTheDocument();
    expect(api.calls.find(c => c.method === 'PATCH')!.headers.get('If-Match')).toBe('W/"1"');
  });

  it('nur lesen: keine Bearbeiten-Elemente, Hinweis auf das Recht (Z8)', async () => {
    const lesend = { ...ict, can: { write: false, delete: false } };
    stub({
      'GET /v1/org-einheiten': () => json({ items: [lesend], nextCursor: null, can: { write: false } }),
      [`GET /v1/org-einheiten/${ICT}`]: () => json(lesend, 200, { ETag: 'W/"1"' }),
    });
    renderWithIam(<Org initial={{ o: ICT }} />, LESER);
    expect(await screen.findByText(TS.org.noRight)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TS.org.create })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: T.common.edit })).not.toBeInTheDocument();
  });

  it('Feiertage je Jahr erfassen', async () => {
    let body: unknown;
    const ft = { id: '00000000-0000-4000-8000-0000000000f1', datum: '2026-12-25', label: 'Weihnachten', ...meta, can: { write: true, delete: true } };
    const api = stub({
      'GET /v1/feiertage': () => json({ items: body ? [ft] : [], nextCursor: null, can: { write: true } }),
      'POST /v1/feiertage': async req => { body = await req.json(); return json(ft, 201, { ETag: 'W/"1"' }); },
      [`GET /v1/feiertage/${ft.id}`]: () => json(ft, 200, { ETag: 'W/"1"' }),
    });
    renderWithIam(<Org initial={{ ansicht: 'feiertage', jahr: 2026 }} />, ADM);
    expect(await screen.findByText(TS.feiertag.emptyJahr(2026))).toBeInTheDocument();
    expect(api.calls.some(c => c.url.includes('jahr=2026'))).toBe(true);
    await userEvent.click(screen.getAllByRole('button', { name: TS.feiertag.create })[0]!);
    const dialog = await screen.findByRole('dialog');
    const datum = within(dialog).getByLabelText(TS.feiertag.datum);
    await userEvent.clear(datum);
    await userEvent.type(datum, '2026-12-25');
    await userEvent.type(within(dialog).getByLabelText(TS.feiertag.label), 'Weihnachten');
    await userEvent.click(within(dialog).getByRole('button', { name: T.common.save }));
    await waitFor(() => expect(body).toEqual({ datum: '2026-12-25', label: 'Weihnachten' }));
    expect(await screen.findByRole('button', { name: 'Weihnachten' })).toBeInTheDocument();
  });
});

describe('Codetabellen (UI-45)', () => {
  const tabellen = (anzahl: number) => [
    { schluessel: 'projektstatus', label: 'Projektstatus', beschreibung: 'Status im Statusbericht.', anzahl, anzahlAktiv: anzahl },
    { schluessel: 'trend', label: 'Trend', beschreibung: 'Entwicklung.', anzahl: anzahl ? 3 : 0, anzahlAktiv: anzahl ? 2 : 0 },
  ];
  const wert = (o: Record<string, unknown>) => ({ id: '00000000-0000-4000-8000-0000000000a1', codetabelle: 'trend', schluessel: 'aufwaerts', label: 'aufwärts', position: 10, aktiv: true, ...meta, can: { write: true }, ...o });

  it('leer beim ersten Mal: Vorgabe laden (Z2)', async () => {
    let geladen = false;
    stub({
      'GET /v1/codetabellen': () => json({ items: tabellen(geladen ? 2 : 0), can: { write: true } }),
      'POST /v1/codetabellen/vorgabe': () => { geladen = true; return json({ angelegt: 31 }); },
    });
    const { container } = renderWithIam(<Code />, ADM);
    expect(await screen.findByText(TS.code.empty)).toBeInTheDocument();
    await expectNoAxe(container);
    await userEvent.click(screen.getByRole('button', { name: TS.code.vorgabe }));
    expect(await screen.findByText(TS.code.vorgabeGeladen(31))).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(TS.code.empty)).not.toBeInTheDocument());
    expect(screen.getByText(TS.code.anzahl(2, 3))).toBeInTheDocument();
  });

  it('Werte: deaktivieren sofort mit «Rückgängig», Schlüssel beim Bearbeiten fest', async () => {
    const w = wert({});
    const api = stub({
      'GET /v1/codetabellen': () => json({ items: tabellen(2), can: { write: true } }),
      'GET /v1/codetabellen/trend/werte': () => json({ items: [w], nextCursor: null, can: { write: true } }),
      [`POST /v1/codetabellen/trend/werte/${w.id}/deaktivieren`]: () => json({ ...w, aktiv: false, version: 2 }),
    });
    renderWithIam(<Code initial={{ o: 'trend' }} />, ADM);
    await userEvent.click(await screen.findByRole('button', { name: `${TS.code.deaktivieren}: aufwärts` }));
    const dialog = screen.getByRole('dialog');
    expect(await screen.findByText(TS.code.deaktiviert('aufwärts'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TS.code.rueckgaengig })).toBeInTheDocument();
    expect(api.calls.find(c => c.method === 'POST')!.headers.get('If-Match')).toBe('W/"1"');
    await userEvent.click(within(dialog).getByRole('button', { name: TS.code.bearbeiten('aufwärts') }));
    expect(await screen.findByLabelText(TS.code.schluessel)).toHaveAttribute('readonly');
  });

  it('nur lesen: keine Aktionen an den Werten (Z8)', async () => {
    stub({
      'GET /v1/codetabellen': () => json({ items: tabellen(2), can: { write: false } }),
      'GET /v1/codetabellen/trend/werte': () => json({ items: [wert({ can: { write: false } })], nextCursor: null, can: { write: false } }),
    });
    renderWithIam(<Code initial={{ o: 'trend' }} />, LESER);
    expect(await screen.findByText(TS.code.noRight)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TS.code.neu })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Deaktivieren/ })).not.toBeInTheDocument();
  });
});
