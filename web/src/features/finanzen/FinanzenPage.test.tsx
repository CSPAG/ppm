/**
 * Finanzen (UI-26, UI-27; AP-E7-4; BC PC.01.02, PC.01.04; UC-010 Schritte 2–4) gegen die nachgebildete API: Kennzahlen in
 * der Reihenfolge Prognose, Budget, Ist, Ist ohne Wert «noch nicht verfügbar» (nie 0), wesentliche Abweichung als
 * Warnung mit Text, Kostenträger ohne Projekt (A1), Schublade mit Verlauf, Kostenträger zuordnen (409), Begründung
 * festhalten mit If-Match, Abweichungen mit Begründung, Gremium nur lesen.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AppPermission } from '../../auth/permissions.ts';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { AbweichungenPage, FinanzenPage } from './FinanzenPage.tsx';
import { laufendePeriode } from './ProjektDrawer.tsx';
import type { FinanzenSearch, SetFinanzenSearch } from './search.ts';

const FI = { roles: ['fi'], permissions: ['tenant:read', 'portfolio:read', 'projekt:read', 'finanzen:read', 'finanzen:write'] as AppPermission[] };
const GREMIUM = { roles: ['gremium'], permissions: ['tenant:read', 'portfolio:read'] as AppPermission[], somewhere: ['finanzen:read', 'projekt:read'] as AppPermission[] };

const PF = { id: '00000000-0000-4000-8000-0000000000a1', kategorie: 'A', schluessel: 'transformation', name: 'Transformation', pflichten: true, version: 1 };
const A = '00000000-0000-4000-8000-000000000101';
const B = '00000000-0000-4000-8000-000000000102';

const projekt = (id: string, nummer: string, o: Record<string, unknown>) => ({
  id, nummer, name: `Projekt ${nummer.slice(-1)}`, phase: 'P2', portfolioId: PF.id, kostentraeger: null, budget: 100000, prognose: 100000, ist: null, istBis: null,
  istJeArt: { capex: null, opex: null }, abweichung: { betrag: 0, prozent: 0, wesentlich: false }, toleranzProzent: 10, phasen: [], verlauf: [], begruendung: null, ...o,
});

function liste(write: boolean, begruendet = false) {
  return {
    portfolio: null,
    projekte: [
      projekt(A, '2026-001', {
        kostentraeger: 'KT-1', budget: 150000, prognose: 170000, ist: 36200, istBis: '2026-10', istJeArt: { capex: 35000, opex: 1200 },
        abweichung: { betrag: 20000, prozent: 13.3, wesentlich: true },
        phasen: [{ phase: 'P1', art: 'capex', budget: 100000, prognose: 120000 }, { phase: 'P2', art: 'opex', budget: 50000, prognose: 50000 }],
        verlauf: [{ monat: '2026-09', capex: 35000, opex: 0 }, { monat: '2026-10', capex: 0, opex: 1200 }],
        begruendung: begruendet ? { periode: '2026-10', text: 'Lieferant teurer', version: 1, geaendertAt: '2026-10-20T10:00:00Z' } : null,
      }),
      projekt(B, '2026-002', { budget: 10000, prognose: 10500, abweichung: { betrag: 500, prozent: 5, wesentlich: false } }),
    ],
    summe: { budget: 160000, prognose: 180500, ist: 36200, abweichung: 20500 },
    istStand: '2026-10',
    ohneProjekt: write ? [{ kostentraeger: 'KT-9', betrag: 99, bis: '2026-10' }] : [],
    can: { write },
  };
}

function Page({ initial = {}, art = 'uebersicht' }: { initial?: FinanzenSearch; art?: 'uebersicht' | 'abweichungen' }) {
  const [search, set] = useState<FinanzenSearch>(initial);
  const setSearch = useCallback<SetFinanzenSearch>(next => set(s => Object.fromEntries(Object.entries({ ...s, ...next }).filter(([, v]) => v !== undefined)) as FinanzenSearch), []);
  const P = art === 'uebersicht' ? FinanzenPage : AbweichungenPage;
  return <><P search={search} setSearch={setSearch} navigieren={() => {}} /><output data-testid="o">{search.o ?? ''}</output></>;
}

function server(o: { write?: boolean; portfoliosFehler?: boolean } = {}) {
  const write = o.write ?? true;
  const puts: { url: string; ifMatch: string | null; body: unknown }[] = [];
  let begruendungen: { periode: string; text: string; version: number; geaendertAt: string }[] = [];
  const periode = laufendePeriode();
  const api = mockIamApi({
    'GET /v1/portfolios': () => (o.portfoliosFehler ? json({ type: 'about:blank', title: 'Fehler', status: 500 }, 500) : json({ items: [PF], nextCursor: null })),
    'GET /v1/finanzen': () => json(liste(write)),
    'GET /v1/finanzen/abweichungen': () => json(liste(write, true)),
    [`PUT /v1/projekte/${B}/kostentraeger`]: async req => {
      const body = await req.json() as { nummer: string };
      puts.push({ url: 'kostentraeger', ifMatch: null, body });
      if (body.nummer === 'KT-1') return json({ type: 'about:blank', title: 'Konflikt', status: 409 }, 409);
      return json({ ...liste(write).projekte[1], kostentraeger: body.nummer });
    },
    [`GET /v1/projekte/${A}/abweichungsbegruendungen`]: () => json({ items: begruendungen, can: { write } }),
    [`GET /v1/projekte/${B}/abweichungsbegruendungen`]: () => json({ items: [], can: { write } }),
    [`PUT /v1/projekte/${A}/abweichungsbegruendungen/${periode}`]: async req => {
      const body = await req.json() as { text: string };
      puts.push({ url: 'begruendung', ifMatch: req.headers.get('if-match'), body });
      begruendungen = [{ periode, text: body.text, version: 1, geaendertAt: '2026-10-28T10:00:00Z' }];
      return json(begruendungen[0]);
    },
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return { puts };
}

describe('Finanzen', () => {
  it('Übersicht: Prognose, Budget, Ist; «noch nicht verfügbar» statt 0; wesentlich als Text; Kostenträger ohne Projekt (axe ohne Befund)', async () => {
    server();
    const { container } = renderWithIam(<Page />, FI);
    const kz = await screen.findByText('Prognose', { selector: 'dt' });
    const dl = kz.closest('dl')!;
    expect([...dl.querySelectorAll('dt')].map(x => x.textContent)).toEqual(['Prognose', 'Budget', 'Ist', 'Abweichung', 'Über der Toleranz']);
    expect(dl).toHaveTextContent('Über der Toleranz1 Projekt');
    const tabelle = screen.getByRole('table', { name: 'Projekte mit Prognose, Budget und Ist' });
    const zeilen = within(tabelle).getAllByRole('row');
    expect(zeilen[1]).toHaveTextContent('wesentlich');
    expect(zeilen[2]).toHaveTextContent('noch nicht verfügbar');
    expect(zeilen[2]).not.toHaveTextContent('wesentlich');
    expect(screen.getByText(/1 Kostenträger mit Ist-Kosten ist keinem Projekt zugeordnet: KT-9/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^2026-001 Projekt 1: Prognose CHF.170.Tsd., Budget CHF.150.Tsd.$/ })).toBeInTheDocument();
    expect(screen.getByText(/Ist-Kosten bis Oktober 2026/)).toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('Reiter behalten den Filter (Portfolio, auch nicht aktive); Fehler beim Laden der Portfolios mit Wiederholen', async () => {
    server();
    const { unmount } = renderWithIam(<Page initial={{ portfolio: 'transformation', alle: '1' }} />, FI);
    const reiter = await screen.findByRole('link', { name: 'Abweichungen' });
    await waitFor(() => expect(reiter).toHaveAttribute('href', '/portfolio/finanzen/abweichungen?portfolio=transformation&alle=1'));
    unmount();
    server({ portfoliosFehler: true });
    renderWithIam(<Page initial={{ portfolio: 'transformation' }} />, FI);
    expect(await screen.findByRole('button', { name: 'Erneut versuchen' }, { timeout: 10_000 })).toBeInTheDocument();
  });

  it('Schublade: Werte je Phase, Verlauf; Kostenträger zuordnen mit Prüfung und 409', async () => {
    const s = server();
    renderWithIam(<Page initial={{ o: '2026-002' }} />, FI);
    const d = await screen.findByRole('dialog', { name: '2026-002 Projekt 2' });
    expect(within(d).getByText('Ohne Kostenträger übernimmt das System keine Ist-Kosten (UC-010 A1).', { selector: 'p' })).toBeInTheDocument();
    const feld = within(d).getByLabelText('Kostenträger im ERP');
    await userEvent.type(feld, 'KT 2');
    await userEvent.click(within(d).getByRole('button', { name: 'Zuordnen' }));
    expect(within(d).getByRole('alert')).toHaveTextContent('Nur Buchstaben, Ziffern');
    await userEvent.clear(feld);
    await userEvent.type(feld, 'KT-1');
    await userEvent.click(within(d).getByRole('button', { name: 'Zuordnen' }));
    expect(await within(d).findByText('Dieser Kostenträger ist schon einem anderen Projekt zugeordnet.')).toBeInTheDocument();
    await userEvent.clear(feld);
    await userEvent.type(feld, 'KT-2');
    await userEvent.click(within(d).getByRole('button', { name: 'Zuordnen' }));
    await waitFor(() => expect(s.puts.map(p => p.body)).toEqual([{ nummer: 'KT-1' }, { nummer: 'KT-2' }]));
    await expectNoAxe(d);
  });

  it('Begründung für die laufende Periode festhalten (If-Match W/"0"), Pflichtfeld; Verlauf der Ist-Kosten', async () => {
    const s = server();
    renderWithIam(<Page initial={{ o: '2026-001' }} />, FI);
    const d = await screen.findByRole('dialog', { name: '2026-001 Projekt 1' });
    expect(d).toHaveTextContent('September 2026');
    expect(d).toHaveTextContent('über der Toleranz von 10 %');
    await userEvent.click(await within(d).findByRole('button', { name: 'Begründung festhalten' }));
    await userEvent.click(within(d).getByRole('button', { name: 'Speichern' }));
    expect(within(d).getByRole('alert')).toHaveTextContent('Die Begründung fehlt.');
    await userEvent.type(within(d).getByRole('textbox', { name: /^Begründung für / }), 'Lieferant teurer als offeriert');
    await userEvent.click(within(d).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(s.puts).toEqual([{ url: 'begruendung', ifMatch: 'W/"0"', body: { text: 'Lieferant teurer als offeriert' } }]));
    expect(await within(d).findByText('Lieferant teurer als offeriert')).toBeInTheDocument();
  });

  it('Abweichungen: Begründung je Projekt, fehlende genannt', async () => {
    server();
    renderWithIam(<Page art="abweichungen" />, FI);
    const t = await screen.findByRole('table', { name: 'Projekte mit Abweichung' });
    const z = within(t).getAllByRole('row');
    expect(z[1]).toHaveTextContent('Oktober 2026: Lieferant teurer');
    expect(z[2]).toHaveTextContent('fehlt');
  });

  it('Gremium (Z8): liest ohne Kostenträger-Feld, ohne Liste der Kostenträger ohne Projekt; kein Reiter Budgetprozess', async () => {
    server({ write: false });
    const { container } = renderWithIam(<Page initial={{ o: '2026-001' }} />, GREMIUM);
    const d = await screen.findByRole('dialog', { name: '2026-001 Projekt 1' });
    expect(within(d).queryByLabelText('Kostenträger im ERP')).toBeNull();
    expect(within(d).getByText('KT-1')).toBeInTheDocument();
    expect(screen.queryByText(/keinem Projekt zugeordnet/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Budgetprozess' })).toBeNull();
    await waitFor(() => expect(within(d).queryByRole('button', { name: 'Begründung festhalten' })).toBeNull());
    await expectNoAxe(container);
  });
});
