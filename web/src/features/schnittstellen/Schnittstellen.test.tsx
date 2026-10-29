/**
 * Schnittstellen (UI-49) und Änderungsprotokoll (UI-50), AP-E7-3 (BC AM.03.02, AM.03.03; UC-018 Schritte 3–5, A1), gegen
 * die nachgebildete API: Liste mit letztem Lauf, Einrichten mit Prüfung und Testlauf, Lauf starten mit Fehler inline,
 * Laufprotokoll, Bearbeiten mit If-Match und Konflikt (Z7), deaktiviert ohne «Lauf starten»; Protokoll mit altem und
 * neuem Wert, Filter in der Adresse, Zeitraum geprüft, leer durch Filter (Z3); axe ohne Befund.
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
import { AenderungsprotokollPage, verweis } from './AenderungsprotokollPage.tsx';
import { SchnittstellenPage } from './SchnittstellenPage.tsx';
import type { ProtokollSearch, SchnittstellenSearch } from './search.ts';
import { TX } from './texte.ts';

const S1 = '00000000-0000-4000-8000-0000000000e1';
const ADM = { roles: ['org-admin'], permissions: ['tenant:read', 'stammdaten:read', 'schnittstelle:admin', 'audit:read'] as AppPermission[] };
const UE = { roles: ['ue'], permissions: ['tenant:read', 'stammdaten:read', 'audit:read'] as AppPermission[] };

const katalog = [
  { umsystem: 'erp', umsystemLabel: 'ERP', daten: 'ist_kosten', datenLabel: 'Ist-Kosten je Kostenträger und Monat', richtung: 'eingehend', quelle: 'A-16 (K18), PC.01.02', verfuegbar: false },
  { umsystem: 'budget', umsystemLabel: 'Budgetprozess', daten: 'jahresbedarf', datenLabel: 'Jahresbedarf der Vorhaben', richtung: 'ausgehend', quelle: 'A-17 (K19), PC.01.05', verfuegbar: false },
];
const lauf = (o: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-0000000000f1', schnittstelleId: S1, art: 'test', stand: 'erfolgreich', start: '2026-10-28T08:00:00Z', ende: '2026-10-28T08:00:01Z',
  umfang: 0, fehler: null, gestartetVon: { id: '00000000-0000-4000-8000-0000000000a1', name: 'Anna Admin' }, ...o,
});
const schnittstelle = (o: Record<string, unknown> = {}) => ({
  id: S1, umsystem: 'erp', daten: 'ist_kosten', name: 'ERP · Ist-Kosten je Kostenträger und Monat', richtung: 'eingehend', rhythmus: 'monatlich',
  adresse: 'https://erp.beispiel.ch/ist', aktiv: true, verfuegbar: false, letzterLauf: lauf(), version: 2, updatedAt: '2026-10-28T08:00:00Z', ...o,
});
const liste = (items: unknown[] = [schnittstelle()]) => json({ items, katalog });

function Seite({ initial = {} }: { initial?: SchnittstellenSearch }) {
  const [search, set] = useState<SchnittstellenSearch>(initial);
  const setSearch = useCallback((next: Partial<SchnittstellenSearch>) => set(s => Object.fromEntries(Object.entries({ ...s, ...next }).filter(([, v]) => v !== undefined))), []);
  return <><SchnittstellenPage search={search} setSearch={setSearch} /><output data-testid="adresse">{JSON.stringify(search)}</output></>;
}
function Protokoll({ initial = {} }: { initial?: ProtokollSearch }) {
  const [search, set] = useState<ProtokollSearch>(initial);
  const setSearch = useCallback((next: Partial<ProtokollSearch>) => set(s => Object.fromEntries(Object.entries({ ...s, ...next }).filter(([, v]) => v !== undefined))), []);
  return <><AenderungsprotokollPage search={search} setSearch={setSearch} /><output data-testid="adresse">{JSON.stringify(search)}</output></>;
}

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

describe('Schnittstellen (UI-49)', () => {
  it('Liste mit Richtung, Rhythmus und letztem Lauf; Einrichten mit Prüfung und Testlauf (UC-018 Schritt 3; axe ohne Befund)', async () => {
    let gesendet: unknown;
    stub({
      'GET /v1/schnittstellen': () => liste(),
      'POST /v1/schnittstellen': async (req: Request) => {
        gesendet = await req.json();
        return json({ schnittstelle: schnittstelle({ id: '00000000-0000-4000-8000-0000000000e2', umsystem: 'budget', daten: 'jahresbedarf', name: 'Budgetprozess · Jahresbedarf der Vorhaben' }), testlauf: lauf() }, 201);
      },
      'GET /v1/schnittstellen/00000000-0000-4000-8000-0000000000e2': () => json(schnittstelle({ id: '00000000-0000-4000-8000-0000000000e2' }), 200, { etag: 'W/"1"' }),
      'GET /v1/schnittstellen/00000000-0000-4000-8000-0000000000e2/laeufe': () => json({ items: [lauf()], nextCursor: null }),
    });
    const { container } = renderWithIam(<Seite />, ADM);
    const zeile = await screen.findByRole('row', { name: /ERP · Ist-Kosten/ });
    expect(within(zeile).getByText('eingehend')).toBeInTheDocument();
    expect(within(zeile).getByText('monatlich')).toBeInTheDocument();
    expect(within(zeile).getByText(TX.s.stand.erfolgreich!)).toBeInTheDocument();
    await expectNoAxe(container);

    await userEvent.click(screen.getByRole('button', { name: TX.aktion.einrichten }));
    const dialog = await screen.findByRole('dialog', { name: TX.s.create });
    // ERP ist schon eingerichtet, Budgetprozess frei: vorgewählt
    expect(within(dialog).getByRole('option', { name: /ERP · Ist-Kosten.*bereits eingerichtet/ })).toBeDisabled();
    const adresse = within(dialog).getByLabelText(TX.s.adresse);
    await userEvent.clear(adresse);
    await userEvent.type(adresse, 'ftp://x');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    expect(within(dialog).getByText(TX.s.adresseUngueltig)).toBeInTheDocument();
    await userEvent.clear(adresse);
    await userEvent.type(adresse, 'https://budget.beispiel.ch/jahresbedarf');
    await userEvent.selectOptions(within(dialog).getByLabelText(TX.s.rhythmusLabel), 'manuell');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(gesendet).toEqual({ umsystem: 'budget', daten: 'jahresbedarf', rhythmus: 'manuell', adresse: 'https://budget.beispiel.ch/jahresbedarf', aktiv: true }));
    expect(await screen.findByText(TX.s.testOk)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('adresse').textContent).toContain('0000000000e2'));
    await expectNoAxe(container);
  });

  it('Lauf starten (A1.1): Fehler inline, Laufprotokoll; deaktiviert ohne «Lauf starten»', async () => {
    let gestartet = 0;
    stub({
      'GET /v1/schnittstellen': () => liste(),
      [`GET /v1/schnittstellen/${S1}`]: () => json(schnittstelle(), 200, { etag: 'W/"2"' }),
      [`GET /v1/schnittstellen/${S1}/laeufe`]: () => json({ items: [lauf({ art: 'manuell', stand: 'fehlgeschlagen', fehler: 'Das Umsystem antwortet mit Status 503.', umfang: null }), lauf()], nextCursor: null }),
      [`POST /v1/schnittstellen/${S1}/starten`]: () => { gestartet++; return json(lauf({ art: 'manuell', stand: 'fehlgeschlagen', fehler: 'Das Umsystem antwortet mit Status 503.', umfang: null }), 201); },
    });
    const { container } = renderWithIam(<Seite initial={{ o: S1 }} />, ADM);
    const dialog = await screen.findByRole('dialog', { name: /ERP · Ist-Kosten/ });
    expect(within(dialog).getByText(TX.s.nichtVerfuegbarHinweis)).toBeInTheDocument();
    const protokoll = await within(dialog).findByRole('table', { name: TX.s.laufe });
    expect(within(protokoll).getAllByRole('row')).toHaveLength(3);
    expect(within(protokoll).getByText('Das Umsystem antwortet mit Status 503.')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: TX.s.starten }));
    await waitFor(() => expect(gestartet).toBe(1));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(TX.s.laufFehler('Das Umsystem antwortet mit Status 503.'));
    await expectNoAxe(container);
  });

  it('inaktiv: kein «Lauf starten», Hinweis; Bearbeiten mit If-Match und Konflikt (Z7)', async () => {
    let ifMatch: string | null = null;
    stub({
      'GET /v1/schnittstellen': () => liste([schnittstelle({ aktiv: false })]),
      [`GET /v1/schnittstellen/${S1}`]: () => json(schnittstelle({ aktiv: false }), 200, { etag: 'W/"2"' }),
      [`GET /v1/schnittstellen/${S1}/laeufe`]: () => json({ items: [], nextCursor: null }),
      [`PATCH /v1/schnittstellen/${S1}`]: (req: Request) => {
        ifMatch = req.headers.get('if-match');
        return json({ type: 'about:blank', title: 'Precondition Failed', status: 412 }, 412, { 'content-type': 'application/problem+json' });
      },
    });
    renderWithIam(<Seite initial={{ o: S1 }} />, ADM);
    const dialog = await screen.findByRole('dialog', { name: /ERP · Ist-Kosten/ });
    expect(within(dialog).getByText(TX.s.startenGesperrt)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: TX.s.starten })).not.toBeInTheDocument();
    expect(await within(dialog).findByText(TX.s.laufeLeer)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: /Bearbeiten/ }));
    const edit = await screen.findByRole('dialog', { name: /Bearbeiten: ERP/ });
    await userEvent.click(within(edit).getByLabelText(TX.s.aktiv));
    await userEvent.click(within(edit).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(ifMatch).toBe('W/"2"'));
    expect(await within(edit).findByText(TX.s.conflict)).toBeInTheDocument();
  });

  it('leer beim ersten Mal: erklärt die Ansicht und bietet «Schnittstelle einrichten» an (Z2)', async () => {
    stub({ 'GET /v1/schnittstellen': () => liste([]) });
    renderWithIam(<Seite />, ADM);
    expect(await screen.findByText(TX.s.empty)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TX.aktion.einrichten })).toBeInTheDocument();
  });
});

describe('Änderungsprotokoll (UI-50)', () => {
  const eintrag = (o: Record<string, unknown> = {}) => ({
    id: '42', zeit: '2026-10-28T09:15:00Z', person: { id: '00000000-0000-4000-8000-0000000000a1', name: 'Anna Admin', art: 'user' }, quelle: 'ui',
    aktion: 'schnittstelle.updated', art: 'geaendert', objekt: { typ: 'schnittstelle', id: S1 },
    aenderungen: [{ feld: 'aktiv', vorher: true, nachher: false }, { feld: 'rhythmus', vorher: 'monatlich', nachher: 'taeglich' }], ...o,
  });

  it('Änderungen mit altem und neuem Wert; Filter in der Adresse; Zeitraum geprüft (Schritt 5; axe ohne Befund)', async () => {
    const abfragen: string[] = [];
    stub({
      'GET /v1/aenderungsprotokoll': (req: Request) => {
        abfragen.push(new URL(req.url).search);
        return json({ items: [eintrag(), eintrag({ id: '41', art: 'angelegt', aktion: 'schnittstelle.created', person: null, quelle: 'worker', aenderungen: [{ feld: 'umsystem', vorher: null, nachher: 'erp' }] })], nextCursor: null });
      },
      'GET /v1/aenderungsprotokoll/objekte': () => json({ items: ['projekt', 'schnittstelle'] }),
    });
    const { container } = renderWithIam(<Protokoll />, UE);
    const tabelle = await screen.findByRole('table', { name: TX.p.tabelle });
    const zeilen = within(tabelle).getAllByRole('row').slice(1);
    expect(within(zeilen[0]!).getByText('Anna Admin')).toBeInTheDocument();
    expect(zeilen[0]!).toHaveTextContent('rhythmus: monatlich → taeglich');
    expect(zeilen[0]!).toHaveTextContent('aktiv: ja → nein');
    expect(within(zeilen[1]!).getByText(TX.p.system)).toBeInTheDocument();
    expect(zeilen[1]!).toHaveTextContent('umsystem: erp');
    await expectNoAxe(container);

    await userEvent.selectOptions(await screen.findByLabelText(TX.p.objekt), 'schnittstelle');
    expect(screen.getByTestId('adresse').textContent).toContain('"objekt":"schnittstelle"');
    await waitFor(() => expect(abfragen.at(-1)).toContain('objekt=schnittstelle'));

    const von = screen.getByLabelText(TX.p.von);
    const bis = screen.getByLabelText(TX.p.bis);
    await userEvent.type(bis, '2026-10-01');
    await userEvent.type(von, '2026-10-28');
    expect(await screen.findByText(TX.p.vonNachBis)).toBeInTheDocument();
  });

  it('Export (Seitentyp Bericht): alle Einträge zum Filter als CSV über den Client, Datei gespeichert', async () => {
    const abfragen: string[] = [];
    stub({
      'GET /v1/aenderungsprotokoll': (req: Request) => {
        const q = new URL(req.url).searchParams;
        abfragen.push(q.toString());
        if (q.get('format') === 'csv') return new Response('﻿Zeitpunkt;Quelle\r\n', { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="aenderungsprotokoll-2026-10-01.csv"' } });
        return json({ items: [eintrag()], nextCursor: 'weiter' });
      },
      'GET /v1/aenderungsprotokoll/objekte': () => json({ items: ['schnittstelle'] }),
    });
    const url = vi.fn(() => 'blob:protokoll');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: url, revokeObjectURL: vi.fn() }));
    const klick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderWithIam(<Protokoll initial={{ objekt: 'schnittstelle', von: '2026-10-01' }} />, UE);
    await userEvent.click(await screen.findByRole('button', { name: TX.p.exportieren }));
    expect(await screen.findByText(TX.p.exportiert('aenderungsprotokoll-2026-10-01.csv'))).toBeInTheDocument();
    const exp = abfragen.find(a => a.includes('format=csv'))!;
    expect(exp).toContain('objekt=schnittstelle');
    expect(exp).toContain('von=2026-10-01');
    expect(exp).not.toContain('cursor');
    expect(klick).toHaveBeenCalledOnce();

    // Kennung im Feld: ungültig sperrt den Export; gültig gilt auch ohne Verlassen des Felds
    const feld = screen.getByLabelText(TX.p.objektId);
    await userEvent.type(feld, 'abc');
    expect(screen.getByRole('button', { name: TX.p.exportieren })).toBeDisabled();
    await userEvent.clear(feld);
    await userEvent.type(feld, S1);
    await userEvent.click(screen.getByRole('button', { name: TX.p.exportieren }));
    await waitFor(() => expect(abfragen.filter(a => a.includes('format=csv'))).toHaveLength(2));
    expect(abfragen.filter(a => a.includes('format=csv')).at(-1)).toContain(`objektId=${S1}`);
    klick.mockRestore();
  });

  it('leer durch Filter: «Filter zurücksetzen» (Z3)', async () => {
    stub({
      'GET /v1/aenderungsprotokoll': () => json({ items: [], nextCursor: null }),
      'GET /v1/aenderungsprotokoll/objekte': () => json({ items: ['projekt'] }),
    });
    renderWithIam(<Protokoll initial={{ objekt: 'projekt' }} />, UE);
    expect(await screen.findByText(TX.p.leerGefiltert)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: TX.p.zuruecksetzen })[0]!);
    expect(screen.getByTestId('adresse').textContent).toBe('{}');
  });
});

describe('Änderungsprotokoll: Verweise in Werten', () => {
  const id = '1adad698-19ff-4b19-82b0-84af0dc9d188';
  it('erkennt Kennungen und { id, typ }, sonst nichts', () => {
    expect(verweis(id)).toEqual({ id });
    expect(verweis(id.toUpperCase())).toEqual({ id });
    expect(verweis({ id, typ: 'idee' })).toEqual({ id, typ: 'idee' });
    expect(verweis({ id, typ: 'idee', titel: 'x' })).toBeNull();
    expect(verweis('Sitzungszimmer')).toBeNull();
    expect(verweis(null)).toBeNull();
  });
});
