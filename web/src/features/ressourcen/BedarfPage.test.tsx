/**
 * Seite «Bedarf» (UI-25, AP-E7-2; BC RK.02.02, RK.02.03, UC-009 Schritte 3–4, A1, A2) gegen die nachgebildete API:
 * Bedarfsliste mit Stand und Deckung, Filter in der Adresse, Schublade mit Deckung je Monat, Person zuteilen mit Prüfung
 * und Warnung bei Überbuchung, Lücke melden, Ansicht «Überbuchungen» nach Priorität, nur lesend ohne Recht, axe.
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
import { BedarfPage } from './BedarfPage.tsx';
import type { BedarfSearch, SetBedarfSearch } from './BedarfSearch.ts';
import { TB } from './BedarfTexte.ts';

const B1 = '00000000-0000-4000-8000-0000000000c1';
const B2 = '00000000-0000-4000-8000-0000000000c2';
const P1 = '00000000-0000-4000-8000-0000000000b1';
const ANNA = '00000000-0000-4000-8000-0000000000a1';
const RM = { roles: ['rm'], permissions: ['tenant:read', 'stammdaten:read', 'portfolio:read', 'projekt:read', 'ressource:read', 'ressource:write'] as AppPermission[] };
const UE = { roles: ['ue'], permissions: ['tenant:read', 'stammdaten:read', 'portfolio:read', 'projekt:read', 'ressource:read'] as AppPermission[] };

const bedarf = (o: Record<string, unknown> = {}) => ({
  id: B1, projektId: P1, projekt: { nummer: '2026-001', name: 'Klinikinformationssystem' }, phase: 'P2', rolle: 'ctl', fte: 1, vonMonat: '2027-01', bisMonat: '2027-03',
  bemerkung: '', benoetigt: 3, zugeteilt: 0, stand: 'offen', prioritaet: { rang: 2, quelle: 'Rangfolge' }, luecke: null, ...o,
});
const liste = (items = [bedarf(), bedarf({ id: B2, projekt: { nummer: '2026-002', name: 'Neubau Labor' }, stand: 'gedeckt', zugeteilt: 1.5, benoetigt: 1.5, fte: 0.5, prioritaet: { rang: 1, quelle: 'Rangfolge' } })]) =>
  json({ items, nextCursor: null, anzahl: { offen: 1, teilweise: 0, gedeckt: 1, ungedeckt: 0 }, can: { write: true } });
const detail = (can = true) => json({
  bedarf: bedarf(), can: { write: can },
  monate: ['2027-01', '2027-02', '2027-03'].map(m => ({ monat: m, bedarf: 1, zugeteilt: 0 })), zuteilungen: [],
});
const rollen = { items: [{ id: 'r2', codetabelle: 'ressourcenrolle', schluessel: 'ctl', label: 'CTL', position: 2, aktiv: true }], nextCursor: null };
const personen = json({ items: [{ id: ANNA, name: 'Anna Muster', monate: ['2027-01', '2027-02', '2027-03'].map(m => ({ monat: m, zugeteilt: 0.5, frei: 0.5 })) }] });
const konflikt = {
  art: 'person', monat: '2027-01', personId: ANNA, personName: 'Anna Muster', rolle: null, summe: 1.25, grenze: 1,
  beteiligte: [
    { zuteilungId: '00000000-0000-4000-8000-0000000000d2', projektId: P1, projekt: { nummer: '2026-002', name: 'Neubau Labor' }, personId: ANNA, personName: 'Anna Muster', rolle: 'ctl', fte: 0.75, version: 1, prioritaet: { rang: 1, quelle: 'R' } },
    { zuteilungId: '00000000-0000-4000-8000-0000000000d1', projektId: P1, projekt: { nummer: '2026-001', name: 'Klinikinformationssystem' }, personId: ANNA, personName: 'Anna Muster', rolle: 'ctl', fte: 0.5, version: 3, prioritaet: { rang: 2, quelle: 'R' } },
  ],
};

function Page({ initial = { von: '2027-01', bis: '2027-06' } }: { initial?: BedarfSearch }) {
  const [search, set] = useState<BedarfSearch>(initial);
  const setSearch = useCallback<SetBedarfSearch>(next => set(s => Object.fromEntries(Object.entries({ ...s, ...next }).filter(([, v]) => v !== undefined)) as BedarfSearch), []);
  return <><BedarfPage search={search} setSearch={setSearch} navigieren={() => {}} /><output data-testid="adresse">{JSON.stringify(search)}</output></>;
}

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi({ 'GET /v1/codetabellen/ressourcenrolle/werte': () => json(rollen), ...routes }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

describe('Bedarf (UI-25)', () => {
  it('Bedarfsliste mit Stand, Deckung und Priorität; Filter nach Stand in der Adresse (axe ohne Befund)', async () => {
    stub({ 'GET /v1/bedarfe': () => liste() });
    const { container } = renderWithIam(<Page />, RM);
    const zeile = await screen.findByRole('row', { name: /2026-001/ });
    expect(within(zeile).getByText(TB.stand.offen)).toBeInTheDocument();
    expect(within(zeile).getByText('0 von 3 FTE × Monate')).toBeInTheDocument();
    expect(within(zeile).getByText('Rang 2')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(TB.standFilter), 'offen');
    expect(screen.getByTestId('adresse').textContent).toContain('"stand":"offen"');
    await expectNoAxe(container);
  });

  it('Schublade: Deckung je Monat, Person zuteilen mit Prüfung des Anteils und Warnung bei Überbuchung', async () => {
    let gesendet: unknown;
    stub({
      'GET /v1/bedarfe': () => liste(),
      [`GET /v1/bedarfe/${B1}`]: () => detail(),
      [`GET /v1/bedarfe/${B1}/personen`]: () => personen,
      [`POST /v1/bedarfe/${B1}/zuteilungen`]: async (req: Request) => {
        gesendet = await req.json();
        return json({ bedarf: bedarf({ stand: 'teilweise', zugeteilt: 1.5 }), zuteilungen: [], konflikte: [konflikt] }, 201);
      },
    });
    const { container } = renderWithIam(<Page initial={{ von: '2027-01', bis: '2027-06', o: B1 }} />, RM);
    const dialog = await screen.findByRole('dialog', { name: /CTL · 2026-001/ });
    expect(await within(dialog).findByRole('row', { name: /Januar 2027/ })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: /Zuteilen/ }));
    expect(within(dialog).getByText(TB.personFehlt)).toBeInTheDocument();
    await userEvent.click(await within(dialog).findByRole('radio', { name: /Anna Muster/ }));
    const anteil = within(dialog).getByLabelText(TB.anteil);
    await userEvent.clear(anteil);
    await userEvent.type(anteil, '0,33');
    await userEvent.click(within(dialog).getByRole('button', { name: /Zuteilen/ }));
    expect(within(dialog).getByText(TB.anteilUngueltig)).toBeInTheDocument();
    await userEvent.clear(anteil);
    await userEvent.type(anteil, '0,5');
    await userEvent.click(within(dialog).getByRole('button', { name: /Zuteilen/ }));
    await waitFor(() => expect(gesendet).toEqual({ personId: ANNA, fte: 0.5, vonMonat: '2027-01', bisMonat: '2027-03' }));
    expect(await within(dialog).findByText(/Eine Person, eine Stelle: 1,25 FTE zugeteilt/)).toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('Zuteilung entfernen mit «Rückgängig»: dieselbe Person im selben Monat wieder zugeteilt (I-R1 Stufe 1)', async () => {
    const z = { id: '00000000-0000-4000-8000-0000000000d9', bedarfId: B1, projektId: P1, personId: ANNA, personName: 'Anna Muster', monat: '2027-01', fte: 0.5, version: 2, updatedAt: '2026-10-01T08:00:00Z', can: { write: true } };
    let wieder: unknown;
    const api = stub({
      'GET /v1/bedarfe': () => liste(),
      [`GET /v1/bedarfe/${B1}`]: () => json({ bedarf: bedarf(), can: { write: true }, monate: [{ monat: '2027-01', bedarf: 1, zugeteilt: 0.5 }], zuteilungen: [z] }),
      [`GET /v1/bedarfe/${B1}/personen`]: () => personen,
      [`DELETE /v1/zuteilungen/${z.id}`]: () => new Response(null, { status: 204 }),
      [`POST /v1/bedarfe/${B1}/zuteilungen`]: async (req: Request) => { wieder = await req.json(); return json({ bedarf: bedarf(), zuteilungen: [], konflikte: [] }, 201); },
    });
    renderWithIam(<Page initial={{ von: '2027-01', bis: '2027-06', o: B1 }} />, RM);
    const dialog = await screen.findByRole('dialog', { name: /CTL · 2026-001/ });
    await userEvent.click(await within(dialog).findByRole('button', { name: /^Zuteilung von Anna Muster im .* entfernen$/ }));
    await userEvent.click(await screen.findByRole('button', { name: TB.rueckgaengig }));
    await waitFor(() => expect(wieder).toEqual({ personId: ANNA, fte: 0.5, vonMonat: '2027-01', bisMonat: '2027-01' }));
    expect(api.calls.find(c => c.method === 'DELETE')!.headers.get('If-Match')).toBe('W/"2"');
  });

  it('Lücke melden (UC-009 A2) und nur lesend ohne ressource:write', async () => {
    let lueckeText: unknown;
    stub({
      'GET /v1/bedarfe': () => liste(),
      [`GET /v1/bedarfe/${B1}`]: () => detail(true),
      [`GET /v1/bedarfe/${B1}/personen`]: () => personen,
      [`PUT /v1/bedarfe/${B1}/luecke`]: async (req: Request) => { lueckeText = await req.json(); return json(bedarf({ stand: 'ungedeckt' })); },
    });
    renderWithIam(<Page initial={{ von: '2027-01', bis: '2027-06', o: B1 }} />, RM);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(await within(dialog).findByLabelText(TB.lueckeText), 'Keine CTL frei');
    await userEvent.click(within(dialog).getByRole('button', { name: TB.lueckeMelden }));
    await waitFor(() => expect(lueckeText).toEqual({ text: 'Keine CTL frei' }));
  });

  it('ohne Recht zum Zuteilen: kein Formular, Hinweis', async () => {
    stub({ 'GET /v1/bedarfe': () => liste(), [`GET /v1/bedarfe/${B1}`]: () => detail(false) });
    renderWithIam(<Page initial={{ von: '2027-01', bis: '2027-06', o: B1 }} />, UE);
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(TB.nurLesen)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Zuteilen/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(TB.lueckeText)).not.toBeInTheDocument();
  });

  it('Ansicht «Überbuchungen»: Regelmeldung, Beteiligte nach Priorität, Anteil ändern mit If-Match (axe ohne Befund)', async () => {
    let ifMatch: string | null = null;
    stub({
      'GET /v1/zuteilungen/konflikte': () => json({ von: '2027-01', bis: '2027-06', items: [konflikt], prioritaetVorhanden: true, can: { write: true } }),
      'PATCH /v1/zuteilungen/00000000-0000-4000-8000-0000000000d1': (req: Request) => { ifMatch = req.headers.get('if-match'); return json({ bedarf: bedarf(), zuteilungen: [], konflikte: [] }); },
    });
    const { container } = renderWithIam(<Page initial={{ von: '2027-01', bis: '2027-06', ansicht: 'konflikte' }} />, RM);
    expect(await screen.findByText(/Eine Person, eine Stelle: 1,25 FTE zugeteilt statt höchstens 1/)).toBeInTheDocument();
    const zeilen = screen.getAllByRole('row').slice(1);
    expect(zeilen.map(r => within(r).getAllByRole('cell')[0]!.textContent)).toEqual(['Rang 1', 'Rang 2']);
    const feld = screen.getByLabelText(TB.anteilLabel('Anna Muster', '2026-001'));
    await userEvent.clear(feld);
    await userEvent.type(feld, '0,25');
    await userEvent.click(within(zeilen[1]!).getByRole('button', { name: TB.speichern }));
    await waitFor(() => expect(ifMatch).toBe('W/"3"'));
    await expectNoAxe(container);
  });

  it('leer: erklärt, wozu die Liste dient (Z2)', async () => {
    stub({ 'GET /v1/bedarfe': () => json({ items: [], nextCursor: null, anzahl: { offen: 0, teilweise: 0, gedeckt: 0, ungedeckt: 0 }, can: { write: true } }) });
    renderWithIam(<Page />, RM);
    expect(await screen.findByText(TB.leer)).toBeInTheDocument();
  });
});
