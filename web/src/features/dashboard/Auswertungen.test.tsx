/**
 * Ad-hoc-Auswertungen (AP-E7-6; UI-30, UC-014 A2.1) gegen die nachgebildete API: Filter in der Adresse mit Chips und
 * «Alle Filter zurücksetzen», Kennzahlen und Gruppierung, Ergebnis mit Summe, jede Zahl öffnet ihre Einzelwerte,
 * Export als CSV, Beträge nur mit `finanzen:read`, leer durch Filter, Fehler, ohne Recht; ohne axe-Befund.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog, Me } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { AuswertungenPage } from './AuswertungenPage.tsx';
import { validateAuswertungenSearch, type AuswertungenSearch, type SetAuswertungenSearch } from './AuswertungenSearch.ts';
import { TA } from './AuswertungenTexte.ts';

const UE: Partial<Me> = { roles: ['ue'], permissions: ['tenant:read', 'projekt:read', 'auswertung:read', 'auswertung:write', 'finanzen:read'] };
const OHNE_FINANZEN: Partial<Me> = { roles: ['x'], permissions: ['tenant:read', 'projekt:read', 'auswertung:read', 'auswertung:write'] };
const GREMIUM: Partial<Me> = { roles: ['gremium'], permissions: ['tenant:read', 'projekt:read', 'auswertung:read'] };
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const einzel = (n: number, gruppe: string, o: Record<string, unknown> = {}) => ({
  projektId: id(n), nummer: `2026-00${n}`, name: `Vorhaben ${n}`, portfolio: gruppe === id(901) ? 'Transformation' : 'Betrieb', phase: 'P2',
  lebenszyklus: 'aktiv', status: 'im_plan', handlungsfeld: null, gruppe, werte: { projekte: 1, kritisch: 0 }, ...o,
});

const ANTWORT = {
  periode: '2026-10', gruppierung: 'portfolio',
  kennzahlen: [{ schluessel: 'projekte', label: 'Projekte', einheit: 'anzahl' }, { schluessel: 'kritisch', label: 'Status kritisch', einheit: 'anzahl' }],
  gruppen: [
    { schluessel: id(902), label: 'Betrieb', werte: { projekte: 1, kritisch: 0 } },
    { schluessel: id(901), label: 'Transformation', werte: { projekte: 2, kritisch: 1 } },
  ],
  summe: { projekte: 3, kritisch: 1 },
  einzelwerte: [einzel(1, id(901), { status: 'kritisch', werte: { projekte: 1, kritisch: 1 } }), einzel(2, id(901)), einzel(3, id(902), { status: null })],
  optionen: { portfolios: [{ schluessel: 'transformation', name: 'Transformation' }, { schluessel: 'betrieb', name: 'Betrieb' }], handlungsfelder: [], finanzen: true },
};

function Page({ initial = {} }: { initial?: AuswertungenSearch }) {
  const [search, set] = useState<AuswertungenSearch>(initial);
  const setSearch = useCallback<SetAuswertungenSearch>(next => set(s => {
    const merged: Record<string, string | undefined> = { ...s, ...next };
    return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined)) as AuswertungenSearch;
  }), []);
  return <><AuswertungenPage search={search} setSearch={setSearch} /><output data-testid="s">{JSON.stringify(search)}</output></>;
}

function stub(antwort: (url: URL) => Response = () => json(ANTWORT)) {
  const urls: URL[] = [];
  const api = mockIamApi({ 'GET /v1/auswertungen': (req: Request) => { const u = new URL(req.url); urls.push(u); return antwort(u); } }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return urls;
}
const suche = () => JSON.parse(screen.getByTestId('s').textContent!) as AuswertungenSearch;

afterEach(() => { vi.unstubAllGlobals(); });

describe('Ad-hoc-Auswertungen', () => {
  it('Ergebnis mit Summe; jede Zahl öffnet ihre Einzelwerte in der Schublade; ohne axe-Befund', async () => {
    stub();
    const { container } = renderWithIam(<Page />, UE);
    const tabelle = await screen.findByRole('table', { name: TA.ergebnisLabel('Portfolio', 3) });
    expect(within(tabelle).getAllByRole('row').map(r => r.textContent)).toEqual(['PortfolioProjekteStatus kritisch', 'Betrieb10', 'Transformation21', 'Summe31']);
    await expectNoAxe(container);
    await userEvent.click(screen.getByRole('button', { name: TA.zelle('Transformation', 'Status kritisch', '1') }));
    expect(suche().o).toBe(id(901));
    const schublade = await screen.findByRole('dialog', { name: TA.einzelwerteTitel('Transformation') });
    expect(within(schublade).getByRole('link', { name: TA.oeffnen('2026-001', 'Vorhaben 1') })).toHaveAttribute('href', '/projekte/2026-001');
    expect(within(schublade).queryByText('Vorhaben 3')).toBeNull();
    await expectNoAxe(container);
  });

  it('Filter, Kennzahlen und Gruppierung in der Adresse; Chips und «Alle Filter zurücksetzen» (I-L1, I-N5)', async () => {
    const urls = stub();
    renderWithIam(<Page />, UE);
    await screen.findByRole('table');
    await userEvent.selectOptions(screen.getByLabelText(TA.filter.phase), 'P2');
    await userEvent.selectOptions(screen.getByLabelText(TA.gruppierung), 'status');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Budget (CHF)' }));
    expect(suche()).toEqual({ phase: 'P2', gruppierung: 'status', kennzahlen: 'projekte,kritisch,budget' });
    await waitFor(() => expect(urls.at(-1)!.searchParams.get('kennzahlen')).toBe('projekte,kritisch,budget'));
    expect(Object.fromEntries(urls.at(-1)!.searchParams)).toMatchObject({ phase: 'P2', gruppierung: 'status' });
    await userEvent.click(screen.getByRole('button', { name: TA.filter.zuruecksetzen }));
    expect(suche()).toEqual({ gruppierung: 'status', kennzahlen: 'projekte,kritisch,budget' });
    // die letzte Kennzahl lässt sich nicht abwählen
    for (const k of ['Projekte', 'Status kritisch']) await userEvent.click(screen.getByRole('checkbox', { name: k }));
    expect(screen.getByRole('checkbox', { name: 'Budget (CHF)' })).toBeDisabled();
  });

  it('Beträge nur mit Leserecht auf die Finanzen; ohne Recht nur der Hinweis', async () => {
    stub();
    const { unmount } = renderWithIam(<Page />, OHNE_FINANZEN);
    await screen.findByRole('table');
    expect(screen.queryByRole('checkbox', { name: 'Budget (CHF)' })).toBeNull();
    unmount();
    renderWithIam(<Page />, GREMIUM);
    expect(await screen.findByText(TA.keinRecht)).toBeInTheDocument();
    expect(screen.queryByRole('search')).toBeNull();
  });

  it('leer durch Filter (Z3) mit Zurücksetzen; Fehler (Z5) mit «Erneut versuchen»', async () => {
    stub(() => json({ ...ANTWORT, gruppen: [], einzelwerte: [], summe: { projekte: 0, kritisch: 0 } }));
    const { unmount } = renderWithIam(<Page initial={{ phase: 'P4' }} />, UE);
    expect(await screen.findByText(TA.leer)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: TA.filter.zuruecksetzen }).at(-1)!);
    expect(suche()).toEqual({});
    unmount();
    stub(() => json({ type: 'about:blank', title: 'Ungültige Angaben', status: 422, detail: 'Diese Portfolios gibt es nicht, oder sie sind nicht sichtbar.' }, 422));
    renderWithIam(<Page initial={{ portfolio: 'weg' }} />, UE);
    expect(await screen.findByText(/Diese Portfolios gibt es nicht/)).toBeInTheDocument();
  });

  it('Export als CSV über den Client mit den gewählten Filtern', async () => {
    const urls = stub(u => (u.searchParams.get('format') === 'csv'
      ? new Response('﻿Portfolio;Projekte\r\n', { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="auswertung-2026-10.csv"' } })
      : json(ANTWORT)));
    const klick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }));
    renderWithIam(<Page initial={{ phase: 'P2' }} />, UE);
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: TA.exportEinzelwerte }));
    expect(await screen.findByText(TA.exportiert('auswertung-2026-10.csv'))).toBeInTheDocument();
    expect(Object.fromEntries(urls.at(-1)!.searchParams)).toMatchObject({ format: 'csv', ebene: 'einzelwerte', phase: 'P2' });
    expect(klick).toHaveBeenCalled();
    klick.mockRestore();
  });

  it('Suchparameter: Ungültiges fällt weg, Listen ohne Doppel', () => {
    expect(validateAuswertungenSearch({ phase: 'P2,P9,P2', kennzahlen: 'gewinn', gruppierung: 'x', portfolio: 'Gross', periode: '2026-13', o: 'P2' }))
      .toEqual({ phase: 'P2', o: 'P2' });
  });
});
