/**
 * Zugänge und Neubesetzung (UC-016 A1, AP-E7-8) gegen die nachgebildete API: Liste mit Stand und Filter, Entziehen mit
 * Personensuche, Wirkung vor dem Absenden (I-F5) und Rückfrage (I-R1), nicht sich selbst, Neubesetzung mit Stand der
 * Rollen und Namen der Orte, axe.
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { NeubesetzungPage } from './NeubesetzungPage.tsx';
import type { SetZugaengeSearch, ZugaengeSearch } from './search.ts';
import { Z } from './texte.ts';
import { ZugaengePage } from './ZugaengePage.tsx';

const PL = { id: '00000000-0000-4000-8000-0000000000bb', name: 'Paul Leiter' };
const ADM = { id: '00000000-0000-4000-8000-0000000000aa', name: 'Ada Admin' };
const NB = '00000000-0000-4000-8000-000000000201';
const PROJEKT = '00000000-0000-4000-8000-000000000301';
const PORTFOLIO = '00000000-0000-4000-8000-000000000401';

const nb = (o: Record<string, unknown> = {}) => ({
  id: NB, person: PL, entzogenAt: '2026-10-27T08:00:00Z', entzogenVon: ADM, rollen: 2, offeneRollen: 1, erledigt: false, ...o,
});
const vorschau = (o: Record<string, unknown> = {}) => ({
  person: PL,
  orgRollen: [{ rolle: 'leser', rolleName: 'Lesen' }],
  rollen: [
    { ort: { typ: 'projekt', id: PROJEKT }, rolle: 'pl', rolleName: 'Projektleitung (PL)' },
    { ort: { typ: 'portfolio', id: PORTFOLIO }, rolle: 'gremium', rolleName: 'Gremium' },
  ],
  aufgaben: [{ id: '00000000-0000-4000-8000-000000000501', art: 'statusbericht.erstellen', titel: 'Statusbericht Oktober erstellen', kontext: '2026-014 · als PL', link: '/projekte/2026-014/bericht', frist: '2026-10-25', fristArt: 'kalendertage' }],
  can: { entziehen: true },
  ...o,
});
const orte = {
  [`GET /v1/projekte/${PROJEKT}`]: () => json({ id: PROJEKT, nummer: '2026-014', name: 'Neues KIS' }),
  [`GET /v1/portfolios/${PORTFOLIO}`]: () => json({ id: PORTFOLIO, name: 'Digitalisierung' }),
};

function Page({ initial = {}, gehe = () => {} }: { initial?: ZugaengeSearch; gehe?: (p: string) => void }) {
  const [search, set] = useState<ZugaengeSearch>(initial);
  const setSearch = useCallback<SetZugaengeSearch>(next => set(s => {
    const m: Record<string, unknown> = { ...s, ...next };
    return Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined)) as ZugaengeSearch;
  }), []);
  return <ZugaengePage search={search} setSearch={setSearch} gehe={gehe} />;
}

/** ADM: Mitglieder und Rollen verwalten. */
const ADMIN = { roles: ['org-admin'], permissions: ['tenant:read', 'members:admin', 'projekt:read', 'portfolio:read'] } as const;

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

describe('Zugänge', () => {
  it('leer mit erster Aktion; Liste mit Stand; Filter «Nur offene»', async () => {
    let gefragt = '';
    stub({ 'GET /v1/neubesetzungen': req => { gefragt = new URL(req.url).search; return json({ items: gefragt.includes('offen') ? [] : [nb()], nextCursor: null }); } });
    const { container } = renderWithIam(<Page />);
    expect(await screen.findByRole('link', { name: PL.name })).toHaveAttribute('href', `/administration/neubesetzungen/${NB}`);
    expect(screen.getAllByText(Z.liste.rollenText(1, 2)).length).toBeGreaterThan(0);
    await expectNoAxe(container);
    await userEvent.click(screen.getByRole('button', { name: Z.filter.offen }));
    expect(await screen.findByText(Z.liste.leerOffen)).toBeInTheDocument();
    expect(gefragt).toContain('offen=true');
  });

  it('entzieht einen Zugang: Person wählen, Wirkung, Rückfrage, dann zur Neubesetzung', async () => {
    let entzogen = false;
    const gehe = vi.fn();
    stub({
      'GET /v1/neubesetzungen': () => json({ items: [], nextCursor: null }),
      'GET /v1/people': () => json({ items: [{ ...PL, kind: 'user', email: 'paul@demo.test', clientId: null, lastSeenAt: null }], nextCursor: null }),
      [`GET /v1/zugaenge/${PL.id}`]: () => json(vorschau()),
      [`POST /v1/zugaenge/${PL.id}/entziehen`]: req => { entzogen = !!req.headers.get('idempotency-key'); return json({ neubesetzung: NB, rollen: 2, aufgaben: 1 }, 201); },
      ...orte,
    });
    const { container } = renderWithIam(<Page initial={{ o: 'entziehen' }} gehe={gehe} />, { roles: [...ADMIN.roles], permissions: [...ADMIN.permissions] });
    const dlg = await screen.findByRole('dialog', { name: Z.entziehen });
    await userEvent.click(within(dlg).getByRole('button', { name: Z.entziehen }));
    expect(within(dlg).getByText(Z.form.personFehlt)).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText(Z.form.person), 'Pa');
    await userEvent.click(await within(dlg).findByRole('button', { name: /Paul Leiter/ }));
    expect(await within(dlg).findByText(Z.vorschau.wirkung(PL.name, 2, 1))).toBeInTheDocument();
    expect(await within(dlg).findByText(/2026-014 · Neues KIS/)).toBeInTheDocument();
    expect(within(dlg).getByText(/Digitalisierung/)).toBeInTheDocument();
    expect(within(dlg).getByText('Statusbericht Oktober erstellen')).toBeInTheDocument();
    await expectNoAxe(container);
    await userEvent.click(within(dlg).getByRole('button', { name: Z.entziehen }));
    const frage = await screen.findByRole('alertdialog', { name: Z.frage(PL.name) }).catch(() => screen.findByRole('dialog', { name: Z.frage(PL.name) }));
    await userEvent.click(within(frage).getByRole('button', { name: Z.entziehen }));
    await vi.waitFor(() => expect(gehe).toHaveBeenCalledWith(`/administration/neubesetzungen/${NB}`));
    expect(entzogen).toBe(true);
  });

  it('ohne Recht keine Aktionen (Z8)', async () => {
    stub({ 'GET /v1/neubesetzungen': () => json({ type: 'about:blank', title: 'Kein Zugriff', status: 403 }, 403) });
    renderWithIam(<Page initial={{ o: 'entziehen' }} />);
    expect(await screen.findByRole('heading', { level: 1, name: Z.titel })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: Z.entziehen })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('den eigenen Zugang nicht: Hinweis, Entziehen gesperrt', async () => {
    stub({
      'GET /v1/neubesetzungen': () => json({ items: [], nextCursor: null }),
      [`GET /v1/zugaenge/${ADM.id}`]: () => json(vorschau({ person: ADM, rollen: [], aufgaben: [], can: { entziehen: false } })),
    });
    renderWithIam(<Page initial={{ o: 'entziehen', person: ADM.id }} />, { roles: [...ADMIN.roles], permissions: [...ADMIN.permissions] });
    const dlg = await screen.findByRole('dialog', { name: Z.entziehen });
    expect(await within(dlg).findByText(Z.form.selbst)).toBeInTheDocument();
    expect(within(dlg).getByRole('button', { name: Z.entziehen })).toBeDisabled();
  });
});

describe('Neubesetzung', () => {
  it('zeigt Rollen mit Stand und Weg zum Ort, offene Aufgaben und den Hinweis zum Erledigen', async () => {
    stub({
      [`GET /v1/neubesetzungen/${NB}`]: () => json({
        neubesetzung: nb(),
        rollen: [
          { ort: { typ: 'portfolio', id: PORTFOLIO }, rolle: 'gremium', rolleName: 'Gremium', besetzt: true },
          { ort: { typ: 'projekt', id: PROJEKT }, rolle: 'pl', rolleName: 'Projektleitung (PL)', besetzt: false },
        ],
        aufgaben: vorschau().aufgaben,
      }),
      ...orte,
    });
    const { container } = renderWithIam(<NeubesetzungPage id={NB} gehe={() => {}} />);
    expect(await screen.findByRole('heading', { level: 1, name: Z.detail.titel(PL.name) })).toBeInTheDocument();
    expect((await screen.findAllByText('2026-014 · Neues KIS')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(Z.detail.offen).length).toBeGreaterThan(0);
    expect(screen.getAllByText(Z.detail.besetzt).length).toBeGreaterThan(0);
    expect((await screen.findAllByRole('link', { name: Z.detail.oeffnen })).map(a => a.getAttribute('href'))).toContain('/projekte/2026-014');
    expect(screen.getByRole('link', { name: 'Statusbericht Oktober erstellen' })).toHaveAttribute('href', '/projekte/2026-014/bericht');
    expect(screen.getByText(Z.detail.offenHint)).toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('nicht gefunden: Fehler und Weg zurück (Z10)', async () => {
    stub({ [`GET /v1/neubesetzungen/${NB}`]: () => json({ type: 'about:blank', title: 'Nicht gefunden', status: 404, detail: 'Neubesetzung nicht gefunden' }, 404) });
    renderWithIam(<NeubesetzungPage id={NB} gehe={() => {}} />);
    expect(await screen.findByRole('link', { name: Z.detail.zurueck })).toHaveAttribute('href', '/administration/zugaenge');
  });
});
