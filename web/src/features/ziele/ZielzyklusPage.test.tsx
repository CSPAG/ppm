/**
 * Zielzyklus (UI-38, K6 Schritte 1–5; AP-E6-1) gegen die nachgebildete API: leerer Zyklus mit «Zielzyklus starten»
 * (Z2), Zielbaum nach WAI-ARIA mit Tastatur, Markierung ohne Metrik und Prüfbericht mit Sprung (I-P4), Jahresziel mit
 * automatischem Speichern und If-Match, Hauptaktivität, Projekt mit einem Klick (K6-2), nur lesen (Z8), gesperrt (Z9).
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import type { Zielzyklus } from './ZielzyklusApi.ts';
import { ZielzyklusPage } from './ZielzyklusPage.tsx';
import { validateZielzyklusSearch, type SetZielzyklusSearch, type ZielzyklusSearch } from './ZielzyklusSearch.ts';
import { TZZ } from './ZielzyklusTexte.ts';

const HF = '00000000-0000-4000-8000-0000000000f1';
const SZ = '00000000-0000-4000-8000-0000000000a1';
const JZ1 = '00000000-0000-4000-8000-0000000000b1';
const JZ2 = '00000000-0000-4000-8000-0000000000b2';
const PR = '00000000-0000-4000-8000-0000000000c1';

const zieljahr = (o: Record<string, unknown> = {}) => ({
  jahr: 2027, stand: 'in_arbeit', vorlageBis: '2026-11-15', freigabeAt: null, freigabeText: '', version: 1,
  createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-01T08:00:00Z', can: { write: true }, ...o,
});

function zyklus(o: Partial<Zielzyklus> = {}): Zielzyklus {
  return {
    jahr: 2027,
    zieljahr: zieljahr() as Zielzyklus['zieljahr'],
    strategischeZiele: [{
      id: SZ, handlungsfeldId: HF, nummer: '2.1', text: 'Kosten senken', metrik: 'Sachkosten', zielwert: '−5 %',
      projekte: [],
      jahresziele: [
        {
          id: JZ1, nummer: '2.1.1', text: 'Einkauf bündeln', metrik: 'Anteil gebündelt', zielwert: '≥ 60 %', version: 1,
          hauptaktivitaeten: [{ id: 'h1', text: 'Rahmenverträge verhandeln', verantwortlich: null, position: 0, version: 1 }],
          projekte: [{ zuordnungId: 'z1', projektId: PR, nummer: '2026-014', name: 'Neues KIS', phase: 'P1', lebenszyklus: 'aktiv' }],
        },
        { id: JZ2, nummer: '2.1.2', text: 'Lager reduzieren', metrik: '', zielwert: '', version: 1, hauptaktivitaeten: [], projekte: [] },
      ],
    }],
    pruefung: { ohneMetrik: [{ id: JZ2, nummer: '2.1.2' }], ohneUmsetzung: [{ id: JZ2, nummer: '2.1.2' }] },
    can: { start: false, write: true, zuordnen: true },
    ...o,
  };
}

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi({
    'GET /v1/handlungsfelder': () => json({ items: [{ id: HF, label: 'Wirtschaftlichkeit' }], nextCursor: null }),
    ...routes,
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

const projektOeffnen = vi.fn();

function Page({ initial = {} }: { initial?: ZielzyklusSearch }) {
  const [search, set] = useState<ZielzyklusSearch>(initial);
  const setSearch = useCallback<SetZielzyklusSearch>(next => set(s => {
    const merged: Record<string, string | undefined> = { ...s, ...next };
    return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined)) as ZielzyklusSearch;
  }), []);
  return (
    <>
      <ZielzyklusPage jahr={2027} search={search} setSearch={setSearch} jahrWechseln={() => undefined} projektOeffnen={projektOeffnen} strategischeZiele={() => undefined} />
      <output data-testid="o">{search.o ?? ''}</output>
    </>
  );
}

describe('Zielzyklus', () => {
  it('Z2: noch nicht gestartet, «Zielzyklus starten» mit Idempotency-Key', async () => {
    let gestartet = false;
    const api = stub({
      'GET /v1/ziele/2027': () => json(gestartet ? zyklus() : zyklus({ zieljahr: null, can: { start: true, write: false, zuordnen: true } })),
      'POST /v1/ziele/2027': () => { gestartet = true; return json(zieljahr(), 201); },
    });
    renderWithIam(<Page />);
    expect(await screen.findByText(TZZ.leerTitel(2027))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TZZ.starten }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    expect(api.calls.find(c => c.method === 'POST')!.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByRole('tree', { name: TZZ.baum })).toBeInTheDocument();
  });

  it('Baum nach WAI-ARIA: Ebenen, Pfeiltasten, Enter öffnet; ohne Metrik markiert; Prüfbericht springt zum Ziel', async () => {
    stub({ 'GET /v1/ziele/2027': () => json(zyklus()) });
    const { container } = renderWithIam(<Page />);
    const baum = await screen.findByRole('tree', { name: TZZ.baum });
    await screen.findByText('Wirtschaftlichkeit');
    const items = within(baum).getAllByRole('treeitem');
    expect(items.map(i => i.getAttribute('aria-level'))).toEqual(['1', '2', '3', '4', '4', '3']);
    expect(within(items[5]!).getByText(TZZ.metrikFehlt)).toBeInTheDocument();
    // ein Tabstopp; Pfeiltasten bewegen, links klappt zu, Enter öffnet
    expect(items.filter(i => i.tabIndex === 0)).toHaveLength(1);
    items[0]!.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[1]);
    await userEvent.keyboard('{ArrowLeft}');
    expect(items[1]).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(document.activeElement?.getAttribute('data-key')).toBe('jz:2.1.1');
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('o')).toHaveTextContent('ziel:2.1.1');
    expect(await screen.findByRole('heading', { level: 2, name: '2.1.1 Einkauf bündeln' })).toBeInTheDocument();
    // Prüfbericht (K6 Regeln): Text mit Nummern, Sprung zum Ziel
    expect(screen.getByText(TZZ.ohneMetrik(1, ['2.1.2']))).toBeInTheDocument();
    expect(screen.getByText(TZZ.ohneUmsetzung('2.1.2'))).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: TZZ.springen('2.1.2') })[0]!);
    expect(screen.getByTestId('o')).toHaveTextContent('ziel:2.1.2');
    await expectNoAxe(container);
  });

  it('K6-2: vom Ziel zum Projekt mit einem Klick', async () => {
    stub({ 'GET /v1/ziele/2027': () => json(zyklus()) });
    projektOeffnen.mockClear();
    renderWithIam(<Page initial={{ o: 'ziel:2.1.1' }} />);
    const baum = await screen.findByRole('tree');
    await userEvent.click(within(baum).getByText('2026-014 Neues KIS'));
    expect(projektOeffnen).toHaveBeenCalledWith('2026-014');
    await userEvent.click(screen.getByRole('button', { name: TZZ.projektOeffnen('2026-014', 'Neues KIS') }));
    expect(projektOeffnen).toHaveBeenCalledTimes(2);
  });

  it('Jahresziel: Metrik speichert beim Verlassen mit If-Match; Hauptaktivität hinzufügen', async () => {
    const api = stub({
      'GET /v1/ziele/2027': () => json(zyklus()),
      [`PATCH /v1/jahresziele/${JZ2}`]: () => json({ id: JZ2, jahr: 2027, strategischesZielId: SZ, nummer: '2.1.2', text: 'Lager reduzieren', metrik: 'Lagerwert', zielwert: '', version: 2, createdAt: '2026-10-01T08:00:00Z', createdBy: null, updatedAt: '2026-10-02T08:00:00Z', updatedBy: null, can: { write: true } }),
      'POST /v1/hauptaktivitaeten': () => json({ id: 'h2', jahreszielId: JZ2, text: 'Inventur', verantwortlich: null, position: 0, version: 1, createdAt: '2026-10-02T08:00:00Z', updatedAt: '2026-10-02T08:00:00Z', can: { write: true } }, 201),
    });
    renderWithIam(<Page initial={{ o: 'ziel:2.1.2' }} />);
    const metrik = await screen.findByLabelText(TZZ.metrik);
    await userEvent.type(metrik, ' Lagerwert ');
    await userEvent.tab();
    await waitFor(() => expect(api.calls.some(c => c.method === 'PATCH')).toBe(true));
    const patch = api.calls.find(c => c.method === 'PATCH')!;
    expect(patch.headers.get('If-Match')).toBe('W/"1"');
    expect(await patch.json()).toEqual({ metrik: 'Lagerwert' });
    expect(await screen.findByText(TZZ.gespeichert)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: TZZ.hauptaktivitaetHinzufuegen }));
    expect(await screen.findByText(TZZ.textMissing)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(TZZ.hauptaktivitaet), 'Inventur');
    await userEvent.click(screen.getByRole('button', { name: TZZ.hauptaktivitaetHinzufuegen }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    expect(await api.calls.find(c => c.method === 'POST')!.json()).toEqual({ jahreszielId: JZ2, text: 'Inventur', verantwortlich: null });
  });

  it('zwei Felder rasch nacheinander: das zweite speichert mit der Version aus der ersten Antwort (kein 412)', async () => {
    let n = 0;
    const antwort = (version: number) => json({ id: JZ2, jahr: 2027, strategischesZielId: SZ, nummer: '2.1.2', text: 'Lager reduzieren', metrik: 'Lagerwert', zielwert: '1', version, createdAt: '2026-10-01T08:00:00Z', createdBy: null, updatedAt: '2026-10-02T08:00:00Z', updatedBy: null, can: { write: true } });
    const api = stub({
      'GET /v1/ziele/2027': () => json(zyklus()),
      [`PATCH /v1/jahresziele/${JZ2}`]: async () => {
        n += 1;
        // erste Antwort kommt erst, nachdem das zweite Feld schon verlassen ist
        if (n === 1) { await new Promise(r => setTimeout(r, 150)); return antwort(2); }
        return antwort(3);
      },
    });
    renderWithIam(<Page initial={{ o: 'ziel:2.1.2' }} />);
    await userEvent.type(await screen.findByLabelText(TZZ.metrik), 'Lagerwert');
    await userEvent.type(screen.getByLabelText(TZZ.zielwert), '1');
    await userEvent.tab();
    expect(await screen.findByText(TZZ.gespeichert)).toBeInTheDocument();
    await waitFor(() => expect(api.calls.filter(c => c.method === 'PATCH')).toHaveLength(2));
    expect(api.calls.filter(c => c.method === 'PATCH').map(c => c.headers.get('If-Match'))).toEqual(['W/"1"', 'W/"2"']);
    expect(screen.queryByText(TZZ.konflikt)).not.toBeInTheDocument();
  });

  it('Jahresziel hinzufügen unter dem strategischen Ziel öffnet das neue Jahresziel', async () => {
    const api = stub({
      'GET /v1/ziele/2027': () => json(zyklus()),
      'POST /v1/jahresziele': () => json({ id: 'n', jahr: 2027, strategischesZielId: SZ, nummer: '2.1.3', text: 'Neu', metrik: '', zielwert: '', version: 1, createdAt: '2026-10-02T08:00:00Z', createdBy: null, updatedAt: '2026-10-02T08:00:00Z', updatedBy: null, can: { write: true } }, 201),
    });
    renderWithIam(<Page initial={{ o: 'ziel:2.1' }} />);
    await userEvent.click(await screen.findByRole('button', { name: TZZ.jahreszielHinzufuegen }));
    await userEvent.type(screen.getByLabelText(TZZ.text), 'Neu');
    await userEvent.click(within(screen.getByRole('form', { name: TZZ.jahreszielHinzufuegen })).getByRole('button', { name: TZZ.jahreszielHinzufuegen }));
    await waitFor(() => expect(screen.getByTestId('o')).toHaveTextContent('ziel:2.1.3'));
    expect(await api.calls.find(c => c.method === 'POST')!.json()).toEqual({ strategischesZielId: SZ, text: 'Neu', metrik: '', zielwert: '', jahr: 2027 });
  });

  it('Z8 nur lesen: keine Bearbeiten-Elemente, Hinweis', async () => {
    stub({ 'GET /v1/ziele/2027': () => json(zyklus({ zieljahr: zieljahr({ can: { write: false } }) as Zielzyklus['zieljahr'], can: { start: false, write: false, zuordnen: false } })) });
    renderWithIam(<Page initial={{ o: 'ziel:2.1.2' }} />, { roles: ['leser'], permissions: ['tenant:read', 'handlungsfeld:read', 'ziel:read'] });
    expect(await screen.findByText(TZZ.nurLesen)).toBeInTheDocument();
    expect(screen.queryByLabelText(TZZ.metrik)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TZZ.projektZuordnen })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TZZ.jahreszielLoeschen })).not.toBeInTheDocument();
  });

  it('Z9 zur Freigabe: Banner, gesperrt', async () => {
    stub({ 'GET /v1/ziele/2027': () => json(zyklus({ zieljahr: zieljahr({ stand: 'zur_freigabe', can: { write: false } }) as Zielzyklus['zieljahr'], can: { start: false, write: false, zuordnen: true } })) });
    renderWithIam(<Page initial={{ o: 'ziel:2.1.1' }} />);
    expect(await screen.findByText(/liegen dem VR zur Freigabe vor/)).toBeInTheDocument();
    expect(screen.queryByLabelText(TZZ.metrik)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TZZ.hauptaktivitaetHinzufuegen })).not.toBeInTheDocument();
  });

  it('unbekanntes Ziel in der Adresse: Hinweis (Z10); Adresse prüft die Nummer (I-N5)', async () => {
    stub({ 'GET /v1/ziele/2027': () => json(zyklus()) });
    renderWithIam(<Page initial={{ o: 'ziel:9.9' }} />);
    expect(await screen.findByText(TZZ.nichtGefunden)).toBeInTheDocument();
    expect(validateZielzyklusSearch({ o: 'ziel:2.1.3' })).toEqual({ o: 'ziel:2.1.3' });
    expect(validateZielzyklusSearch({ o: JZ1 })).toEqual({});
  });
});
