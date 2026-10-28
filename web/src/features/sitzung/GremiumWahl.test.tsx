/**
 * Gremium im Kopf des Arbeitsraums Gremien (IA «Kontext im Kopf», `/gremien/prat`; I-N2, I-N5): Wahl nur unter den
 * sichtbaren Gremien, eindeutig in der Adresse; mit einem Gremium ohne Wahl gesetzt; die Wahl gilt für Sitzungen und
 * Entscheide (gemerkt); unbekanntes Kürzel erklärt sich (Z10); ein Sprung auf eine Auflage bleibt ungefiltert.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog, Me } from '@vollholz/iam-web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { EntscheidePage } from './EntscheidePage.tsx';
import { gemerktesGremium, gremiumMerken } from './GremiumWahl.tsx';
import { SitzungenPage } from './SitzungenPage.tsx';
import { TS } from './texte.ts';

const PF = '00000000-0000-4000-8000-0000000000c1';
const gremium = (n: number, kuerzel: string, name: string) => ({
  id: `00000000-0000-4000-8000-0000000000b${n}`, portfolioId: PF, kuerzel, name, art: 'entscheidend', rhythmus: '', version: 1,
  createdAt: '', createdBy: null, updatedAt: '', updatedBy: null, can: { admin: false },
});
const PRAT = gremium(1, 'prat', 'Programmausschuss');
const GLPA = gremium(2, 'glpa', 'Geschäftsleitung Portfolioausschuss');
const UE: Partial<Me> = { roles: ['ue'], permissions: ['tenant:read', 'portfolio:read', 'projekt:read', 'sitzung:read', 'sitzung:write'] };

function stub(gremien: unknown[]) {
  const termine = (g: { id: string; kuerzel: string; name: string }) => () => json({ gremium: { id: g.id, kuerzel: g.kuerzel, name: g.name }, items: [{ datum: '2026-11-18', id: null, stand: 'geplant', traktanden: 0, versendetAt: null }], nextCursor: null, can: { write: true } });
  const api = mockIamApi({
    'GET /v1/projekte': () => json({ items: [], nextCursor: null }),
    'GET /v1/gremien': () => json({ items: gremien, nextCursor: null }),
    'GET /v1/gremien/prat/sitzungen': termine(PRAT),
    'GET /v1/gremien/glpa/sitzungen': termine(GLPA),
    'GET /v1/entscheide': () => json({ items: [], mehr: false }),
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

afterEach(() => { localStorage.clear(); });

describe('Gremium im Kopf (IA «Kontext im Kopf»)', () => {
  it('Wahl im Kopf nur unter den sichtbaren Gremien, eindeutig in der Adresse; die Wahl wird gemerkt', async () => {
    stub([PRAT, GLPA]);
    const gehe = vi.fn();
    const { container } = renderWithIam(<SitzungenPage gehe={gehe} />, UE);
    const wahl = await screen.findByLabelText(TS.gremium);
    expect([...(wahl as HTMLSelectElement).options].map(o => o.text)).toEqual([TS.alleGremien, 'PRAT · Programmausschuss', 'GLPA · Geschäftsleitung Portfolioausschuss']);
    expect(wahl).toHaveValue('');
    // ohne Gremium in der Adresse: alle
    expect(await screen.findByRole('heading', { name: /^PRAT/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^GLPA/ })).toBeInTheDocument();
    await expectNoAxe(container);
    await userEvent.selectOptions(wahl, 'glpa');
    expect(gehe).toHaveBeenCalledWith('/gremien/glpa/sitzungen');
    expect(gemerktesGremium()).toBe('glpa');
  });

  it('Gremium aus der Adresse: nur dessen Sitzungen, Wahl steht im Kopf', async () => {
    stub([PRAT, GLPA]);
    renderWithIam(<SitzungenPage kuerzel="glpa" gehe={vi.fn()} />, UE);
    expect(await screen.findByRole('heading', { name: /^GLPA/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^PRAT/ })).toBeNull();
    expect(screen.getByLabelText(TS.gremium)).toHaveValue('glpa');
    expect(gemerktesGremium()).toBe('glpa');
  });

  it('mit nur einem Gremium ohne Wahl gesetzt; das gemerkte Gremium gilt beim Einstieg ohne Gremium', async () => {
    stub([PRAT]);
    const gehe = vi.fn();
    const { unmount } = renderWithIam(<SitzungenPage gehe={gehe} />, UE);
    await waitFor(() => expect(gehe).toHaveBeenCalledWith('/gremien/prat/sitzungen', { replace: true }));
    unmount();

    renderWithIam(<SitzungenPage kuerzel="prat" gehe={vi.fn()} />, UE);
    expect(await screen.findByText('PRAT · Programmausschuss')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: TS.gremium })).toBeNull();

    stub([PRAT, GLPA]);
    gremiumMerken('glpa');
    const gehe2 = vi.fn();
    renderWithIam(<SitzungenPage gehe={gehe2} />, UE);
    await waitFor(() => expect(gehe2).toHaveBeenCalledWith('/gremien/glpa/sitzungen', { replace: true }));
  });

  it('unbekanntes oder nicht sichtbares Gremium erklärt sich, mit Weg zu allen (Z10)', async () => {
    stub([PRAT, GLPA]);
    const gehe = vi.fn();
    gremiumMerken('xyz');
    renderWithIam(<SitzungenPage kuerzel="xyz" gehe={gehe} />, UE);
    expect(await screen.findByText(TS.gremiumUnbekannt)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TS.zuAllenGremien }));
    expect(gehe).toHaveBeenCalledWith('/gremien/sitzungen');
    expect(gemerktesGremium()).toBe('');
  });

  it('Entscheide übernehmen das gewählte Gremium; ein Sprung auf eine Auflage bleibt ungefiltert', async () => {
    stub([PRAT, GLPA]);
    gremiumMerken('glpa');
    const setSearch = vi.fn();
    const { unmount } = renderWithIam(<EntscheidePage search={{}} setSearch={setSearch} />, UE);
    await waitFor(() => expect(setSearch).toHaveBeenCalledWith({ gremium: 'glpa' }, { replace: true }));
    unmount();

    const setSearch2 = vi.fn();
    renderWithIam(<EntscheidePage search={{ auflage: '00000000-0000-4000-8000-0000000000f1' }} setSearch={setSearch2} />, UE);
    expect(await screen.findByLabelText(TS.gremium)).toHaveValue('');
    expect(setSearch2).not.toHaveBeenCalledWith(expect.objectContaining({ gremium: 'glpa' }), expect.anything());

    // Wahl im Kopf der Entscheide setzt `?gremium=`
    await userEvent.selectOptions(screen.getByLabelText(TS.gremium), 'prat');
    expect(setSearch2).toHaveBeenCalledWith({ gremium: 'prat', e: undefined, auflage: undefined }, { replace: true });
  });
});
