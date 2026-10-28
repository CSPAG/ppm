/**
 * Risikolage (UI-18) und Portfoliobericht (UI-29) gegen die nachgebildete API (AP-E2-3; UC-014 Schritte 2–3, K3
 * Schritt 4): Matrix als Tabelle mit Text, Risiken mit Stand, Abhängigkeiten, Eskalationen; Bericht erzeugen, Kommentar
 * mit If-Match, Bereitstellen mit Wirkung vorher, Dokument-Links; Leser ohne Bericht; ohne Recht.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog, Me } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { PortfolioberichtPage } from './PortfolioberichtPage.tsx';
import type { PortfolioberichtSearch, SetPortfolioberichtSearch } from './PortfolioberichtSuche.ts';
import { TP, TR } from './PortfolioberichtTexte.ts';
import { RisikenPage } from './RisikenPage.tsx';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PF = { id: id(900), schluessel: 'transformation', name: 'Transformation', kategorie: 'A' };
const GREMIUM: Partial<Me> = { roles: ['gremium'], permissions: ['tenant:read', 'projekt:read', 'auswertung:read'] };
const UE: Partial<Me> = { roles: ['ue'], permissions: ['tenant:read', 'projekt:read', 'auswertung:read', 'auswertung:write'] };
const STUFEN = ['hoch', 'mittel', 'tief'];

const LAGE = {
  risiken: [
    { id: id(1), ebene: 'portfolio', projekt: null, portfolioId: PF.id, text: 'Budget knapp', wahrscheinlichkeit: 'hoch', auswirkung: 'hoch', massnahme: 'Reserve', massnahmeStand: 'offen', verantwortlich: 'UE' },
    { id: id(2), ebene: 'projekt', projekt: { id: id(10), nummer: '2026-001', name: 'Vorhaben 1' }, portfolioId: PF.id, text: 'Lieferant fällt aus', wahrscheinlichkeit: 'mittel', auswirkung: 'hoch', massnahme: 'Zweitlieferant', massnahmeStand: 'umgesetzt', verantwortlich: 'PL' },
  ],
  matrix: STUFEN.flatMap(w => STUFEN.map(a => ({ wahrscheinlichkeit: w, auswirkung: a, anzahl: w === 'hoch' && a === 'hoch' ? 1 : w === 'mittel' && a === 'hoch' ? 1 : 0 }))),
  abhaengigkeiten: [{ id: id(3), von: { id: id(11), nummer: '2026-002', name: 'Vorhaben 2' }, zu: { id: id(10), nummer: '2026-001', name: 'Vorhaben 1' }, text: 'Schnittstelle' }],
  eskalationen: [{ id: id(4), projekt: { id: id(10), nummer: '2026-001', name: 'Vorhaben 1' }, periode: '2026-10', grund: 'Lieferverzug', massnahme: 'Zweitlieferant', stand: 'offen' }],
};

const DASH = {
  periode: '2026-10', periodeStand: 'abgeschlossen', abgeschlossenAt: '2026-10-31T16:00:00Z',
  perioden: [{ periode: '2026-11', stand: 'offen' }, { periode: '2026-10', stand: 'abgeschlossen' }],
  portfolios: [PF], portfolio: null, items: [], funnel: [],
};

function stubRisiken() {
  const api = mockIamApi({ 'GET /v1/dashboard/risiken': () => json({ portfolios: [PF], portfolio: null, stand: '2026-11-03T08:00:00Z', ...LAGE }) }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

type Bericht = Record<string, unknown> & { id: string; version: number; stand: string; kommentar: string };

function server(start: Bericht[] = []) {
  const berichte = new Map(start.map(b => [b.id, b]));
  const calls: { method: string; pfad: string; ifMatch: string | null; body?: unknown }[] = [];
  const neu = (): Bericht => ({
    id: id(50), portfolio: { id: PF.id, schluessel: PF.schluessel, name: PF.name }, periode: '2026-10', stand: 'entwurf',
    erzeugtAt: '2026-11-03T08:00:00Z', bereitgestelltAt: null, version: 1, kommentar: '',
    dashboard: { abgeschlossenAt: '2026-10-31T16:00:00Z', items: [], funnel: ['P0', 'P1', 'P2', 'P3', 'P4'].map(phase => ({ phase, anzahl: 0, imPlan: 0, kritisch: 0, ohneStatus: 0, nichtGemeldet: 0 })) },
    risikolage: LAGE, can: { bearbeiten: true, bereitstellen: true },
  });
  const kurz = (b: Bericht) => ({ id: b.id, portfolio: b.portfolio, periode: b.periode, stand: b.stand, erzeugtAt: b.erzeugtAt, bereitgestelltAt: b.bereitgestelltAt, version: b.version });
  const api = mockIamApi({
    'GET /v1/dashboard': () => json(DASH),
    'GET /v1/portfolioberichte': () => json({ items: [...berichte.values()].map(kurz) }),
    'POST /v1/portfolioberichte': () => { const b = neu(); berichte.set(b.id, b); calls.push({ method: 'POST', pfad: 'erzeugen', ifMatch: null }); return json(b, 201); },
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  const dynamisch: [string, RegExp, (req: Request) => Response | Promise<Response>][] = [
    ['GET', /^\/v1\/portfolioberichte\/[0-9a-f-]{36}$/, req => json(berichte.get(new URL(req.url).pathname.split('/').pop()!)!)],
    ['PATCH', /^\/v1\/portfolioberichte\/[0-9a-f-]{36}$/, async req => {
      const b = berichte.get(new URL(req.url).pathname.split('/').pop()!)!;
      const body = await req.json() as { kommentar: string };
      calls.push({ method: 'PATCH', pfad: 'kommentar', ifMatch: req.headers.get('if-match'), body });
      if (req.headers.get('if-match') !== `W/"${b.version}"`) return json({ title: 'Inzwischen geändert', status: 412 }, 412);
      Object.assign(b, { kommentar: body.kommentar.trim(), version: b.version + 1 });
      return json(b);
    }],
    ['POST', /^\/v1\/portfolioberichte\/[0-9a-f-]{36}\/bereitstellen$/, req => {
      const b = berichte.get(new URL(req.url).pathname.split('/')[3]!)!;
      calls.push({ method: 'POST', pfad: 'bereitstellen', ifMatch: req.headers.get('if-match') });
      Object.assign(b, { stand: 'bereitgestellt', bereitgestelltAt: '2026-11-03T09:00:00Z', version: b.version + 1, can: { bearbeiten: false, bereitstellen: false } });
      return json(b);
    }],
  ];
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const pfad = new URL(req.url).pathname;
    const t = dynamisch.find(([m, re]) => m === req.method && re.test(pfad));
    return t ? Promise.resolve(t[2](req)) : api.fetch(req);
  });
  return { berichte, calls };
}

function Bericht({ initial = {} }: { initial?: PortfolioberichtSearch }) {
  const [search, set] = useState<PortfolioberichtSearch>(initial);
  const setSearch = useCallback<SetPortfolioberichtSearch>(next => set(s => Object.fromEntries(Object.entries({ ...s, ...next }).filter(([, v]) => v !== undefined)) as PortfolioberichtSearch), []);
  return <PortfolioberichtPage search={search} setSearch={setSearch} />;
}

describe('Risikolage', () => {
  it('Matrix als Tabelle mit Text, Risiken mit Stand, Abhängigkeiten, Eskalationen; ohne axe-Befund', async () => {
    stubRisiken();
    const { container } = renderWithIam(<RisikenPage search={{}} setSearch={() => {}} />, GREMIUM);
    const m = await screen.findByRole('table', { name: TR.matrix.titel });
    expect(within(m).getByRole('button', { name: TR.zeigen(TR.matrix.feld('hoch', 'hoch', 1)) })).toHaveTextContent('1');
    expect(within(m).getByRole('button', { name: TR.zeigen(TR.matrix.feld('tief', 'tief', 0)) })).toBeDisabled();
    const kennzahlen = within(document.querySelector('.db-kennzahlen') as HTMLElement).getAllByRole('listitem').map(li => li.textContent);
    expect(kennzahlen).toEqual(['2 Risiken', '1 mit hoher Auswirkung und Wahrscheinlichkeit', '1 Massnahme offen']);
    expect(screen.getByRole('link', { name: '2026-001 Vorhaben 1' })).toHaveAttribute('href', '/projekte/2026-001');
    expect(screen.getByText('umgesetzt')).toBeInTheDocument();
    expect(screen.getByText('Schnittstelle')).toBeInTheDocument();
    expect(screen.getByText('Lieferverzug')).toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('jede Zahl führt zu ihren Risiken (Feld der Matrix, Kennzahl; Adresse); Z3; Export als CSV mit Auswahl', async () => {
    const api = stubRisiken();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:risiken'), revokeObjectURL: vi.fn() }));
    const klick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    function Seite() {
      const [s, set] = useState<Record<string, string>>({});
      const setSearch = useCallback((next: Record<string, string | undefined>) => set(v => Object.fromEntries(Object.entries({ ...v, ...next }).filter(([, x]) => x !== undefined)) as Record<string, string>), []);
      return <><RisikenPage search={s} setSearch={setSearch} /><output data-testid="s">{JSON.stringify(s)}</output></>;
    }
    renderWithIam(<Seite />, GREMIUM);
    const m = await screen.findByRole('table', { name: TR.matrix.titel });
    await userEvent.click(within(m).getByRole('button', { name: TR.zeigen(TR.matrix.feld('hoch', 'hoch', 1)) }));
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('{"w":"hoch","a":"hoch"}'));
    const tab = screen.getByRole('table', { name: TR.risiken.titel });
    expect(within(tab).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText(TR.filter.feld('hoch', 'hoch'))).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: TR.exportieren }));
    expect(await screen.findByText(TR.exportiert('risikolage.csv'))).toBeInTheDocument();
    const exp = api.calls.find(c => c.url.includes('format=csv'))!;
    expect(exp.url).toContain('w=hoch');
    expect(exp.url).toContain('a=hoch');
    expect(klick).toHaveBeenCalledOnce();
    klick.mockRestore();

    // die Gesamtzahl hebt die Auswahl auf und zeigt alle Risiken
    await userEvent.click(screen.getByRole('button', { name: TR.zeigen(TR.kennzahl.risiken(2)) }));
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('{}'));
    expect(within(screen.getByRole('table', { name: TR.risiken.titel })).getAllByRole('row')).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: TR.zeigen(TR.kennzahl.offen(1)) }));
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('{"massnahme":"offen"}'));
  });

  it('Z3: leer durch Filter mit «Filter zurücksetzen»', async () => {
    stubRisiken();
    const gesetzt: unknown[] = [];
    renderWithIam(<RisikenPage search={{ w: 'tief', a: 'tief' }} setSearch={n => gesetzt.push(n)} />, GREMIUM);
    expect(await screen.findByText(TR.leerFilter)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TR.zuruecksetzen }));
    expect(gesetzt).toEqual([{ w: undefined, a: undefined, massnahme: undefined }]);
  });

  it('ohne Recht: Erklärung statt Daten', () => {
    stubRisiken();
    renderWithIam(<RisikenPage search={{}} setSearch={() => {}} />, { roles: [], permissions: ['tenant:read'] });
    expect(screen.getByText(TR.keinRecht)).toBeInTheDocument();
  });
});

describe('Portfoliobericht', () => {
  it('UE: erzeugen, Kommentar mit If-Match, bereitstellen mit Wirkung vorher; Dokument als PDF und Word', async () => {
    const s = server();
    const { container } = renderWithIam(<Bericht />, UE);
    await userEvent.click(await screen.findByRole('button', { name: TP.aktion.erzeugen }));
    const feld = await screen.findByRole('textbox', { name: TP.kommentar.label });
    await expectNoAxe(container);
    await userEvent.type(feld, 'Lage stabil');
    await userEvent.click(screen.getByRole('button', { name: TP.aktion.speichern }));
    await waitFor(() => expect(s.calls.find(c => c.pfad === 'kommentar')).toMatchObject({ ifMatch: 'W/"1"', body: { kommentar: 'Lage stabil' } }));
    expect(screen.getByRole('link', { name: TP.aktion.pdf })).toHaveAttribute('href', `/v1/portfolioberichte/${id(50)}/dokument?format=pdf`);
    expect(screen.getByRole('link', { name: TP.aktion.word })).toHaveAttribute('href', `/v1/portfolioberichte/${id(50)}/dokument?format=docx`);

    await userEvent.click(screen.getByRole('button', { name: TP.aktion.bereitstellen }));
    const d = await screen.findByRole('dialog', { name: TP.bereitstellenDialog.titel('Oktober 2026') });
    expect(within(d).getByText(/Traktandum «Bericht der Programmleitung» als Vorschlag/)).toBeInTheDocument();
    await userEvent.click(within(d).getByRole('button', { name: TP.aktion.bereitstellen }));
    await waitFor(() => expect(s.calls.find(c => c.pfad === 'bereitstellen')?.ifMatch).toBe('W/"2"'));
    expect(await screen.findByText('bereitgestellt')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('Lage stabil')).toBeInTheDocument();
  });

  it('Kommentar mit Konflikt (412): der eigene Text bleibt, der inzwischen gespeicherte steht daneben (Z7)', async () => {
    const s = server();
    renderWithIam(<Bericht />, UE);
    await userEvent.click(await screen.findByRole('button', { name: TP.aktion.erzeugen }));
    const feld = await screen.findByRole('textbox', { name: TP.kommentar.label });
    await userEvent.type(feld, 'Meins');
    Object.assign(s.berichte.get(id(50))!, { kommentar: 'Von Paula', version: 2 }); // jemand anderes speichert dazwischen
    await userEvent.click(screen.getByRole('button', { name: TP.aktion.speichern }));
    expect(await screen.findByText(/Dein Kommentar ist noch da/)).toBeInTheDocument(); // Toast: «TP.konflikt: Titel»
    expect(await screen.findByText(TP.kommentar.andere('Von Paula'))).toBeInTheDocument();
    expect(feld).toHaveValue('Meins');
    // den Text der anderen übernehmen: der Hinweis verschwindet
    await userEvent.clear(feld);
    await userEvent.type(feld, 'Von Paula');
    expect(screen.queryByText(TP.kommentar.andere('Von Paula'))).toBeNull();
    await userEvent.clear(feld);
    await userEvent.type(feld, 'Meins');
    await userEvent.click(screen.getByRole('button', { name: TP.aktion.speichern }));
    await waitFor(() => expect(s.calls.filter(c => c.pfad === 'kommentar').at(-1)).toMatchObject({ ifMatch: 'W/"2"', body: { kommentar: 'Meins' } }));
    await waitFor(() => expect(screen.queryByText(TP.kommentar.andere('Von Paula'))).toBeNull());
    expect(feld).toHaveValue('Meins');
  });

  it('Gremium ohne bereitgestellten Bericht: Erklärung, keine Aktion; offene Periode: Hinweis', async () => {
    server();
    renderWithIam(<Bericht />, GREMIUM);
    expect(await screen.findByText(TP.keinBerichtLeser('Oktober 2026'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TP.aktion.erzeugen })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(TP.filter.periode), '2026-11');
    expect(await screen.findByText(TP.periodeOffen('November 2026'))).toBeInTheDocument();
  });
});
