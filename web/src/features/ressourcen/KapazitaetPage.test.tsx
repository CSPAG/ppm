/**
 * Seite «Kapazität» (UI-24, AP-E5-4; BC RK.01.01, UC-009 Schritt 2) gegen die nachgebildete API: Raster Rolle × Monat,
 * automatisches Speichern mit Version je Zelle, Entfernen, Rückgängig, Tastatur, Konflikt (412, Z7), ungültige Eingabe,
 * nur lesen (Z8), keine Rollen (Z2), Kapazität laut HR-System (RK.01.02, Annahme AP-E7-2) und Q-L5: 50 × 31 Zellen
 * virtualisiert und flüssig (Messung).
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppPermission } from '../../auth/permissions.ts';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { KapazitaetPage } from './KapazitaetPage.tsx';
import { fenster, fteAusEingabe } from './raster.ts';
import type { KapazitaetSearch, SetKapazitaetSearch } from './search.ts';
import { TR } from './texte.ts';
import { monate } from './zeitraum.ts';

const RM = { roles: ['rm'], permissions: ['tenant:read', 'stammdaten:read', 'portfolio:read', 'projekt:read', 'ressource:read', 'ressource:write', 'auswertung:read'] as AppPermission[] };
const UE = { roles: ['ue'], permissions: ['tenant:read', 'stammdaten:read', 'portfolio:read', 'projekt:read', 'ressource:read'] as AppPermission[] };

const wert = (schluessel: string, label: string, aktiv = true, i = 0) => ({ id: `w${i}`, codetabelle: 'ressourcenrolle', schluessel, label, position: i, aktiv });
const ROLLEN = [wert('projektleitung', 'Projektleitung', true, 1), wert('ctl', 'CTL', true, 2), wert('alt', 'Alte Rolle', false, 3)];

function Page({ initial = { von: '2027-04', bis: '2027-06' } }: { initial?: KapazitaetSearch }) {
  const [search, set] = useState<KapazitaetSearch>(initial);
  const setSearch = useCallback<SetKapazitaetSearch>(next => set(s => Object.fromEntries(Object.entries({ ...s, ...next }).filter(([, v]) => v !== undefined)) as KapazitaetSearch), []);
  return <KapazitaetPage search={search} setSearch={setSearch} navigieren={() => {}} />;
}

/** Nachgebildete API mit Zustand: Angebot je Zelle mit Version, 412 wie der Server. */
function server(o: { zellen?: { rolle: string; monat: string; fte: number; version: number }[]; rollen?: ReturnType<typeof wert>[]; write?: boolean; hr?: { rolle: string; monat: string; fte: number; abwesend: number; personen: number }[] } = {}) {
  const zellen = new Map((o.zellen ?? []).map(z => [`${z.rolle}|${z.monat}`, { ...z }]));
  const puts: unknown[] = [];
  const api = mockIamApi({
    'GET /v1/codetabellen/ressourcenrolle/werte': () => json({ items: o.rollen ?? ROLLEN, nextCursor: null }),
    'GET /v1/kapazitaet': req => {
      const u = new URL(req.url);
      return json({ von: u.searchParams.get('von'), bis: u.searchParams.get('bis'), zellen: [...zellen.values()], can: { write: o.write ?? true } });
    },
    'GET /v1/kapazitaet/hr': req => {
      const u = new URL(req.url);
      return json({ von: u.searchParams.get('von'), bis: u.searchParams.get('bis'), zellen: o.hr ?? [], uebernommenAt: o.hr?.length ? '2026-10-01T06:00:00Z' : null });
    },
    'PUT /v1/kapazitaet': async req => {
      const body = await req.json() as { zellen: { rolle: string; monat: string; fte: number | null; version?: number }[] };
      puts.push(body);
      for (const c of body.zellen) {
        const vorher = zellen.get(`${c.rolle}|${c.monat}`);
        if ((vorher && c.version !== vorher.version) || (!vorher && c.version !== undefined)) return json({ type: 'about:blank', title: 'Veraltet', status: 412, currentVersion: vorher?.version ?? 0 }, 412);
      }
      const out = body.zellen.map(c => {
        const key = `${c.rolle}|${c.monat}`;
        if (c.fte === null) { zellen.delete(key); return { rolle: c.rolle, monat: c.monat, fte: null, version: null }; }
        const z = { rolle: c.rolle, monat: c.monat, fte: c.fte, version: (zellen.get(key)?.version ?? 0) + 1 };
        zellen.set(key, z);
        return z;
      });
      return json({ zellen: out });
    },
    'GET /v1/auslastung': () => json({}),
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return { api, zellen, puts };
}

const speicherstand = () => document.querySelector('.res-status')!;
const zelle = (rolle: string, monat: string) => screen.getByRole('textbox', { name: TR.zelleEingabe(rolle, monat) });

afterEach(() => { vi.useRealTimers(); });

describe('Kapazität: Eingabe', () => {
  it('liest Komma und Punkt, leer entfernt, sonst ungültig', () => {
    expect(['5', '0,5', '1.25', ' 2 ', '', '1000', '-1', '1,234', 'abc', '1001'].map(fteAusEingabe)).toEqual([5, 0.5, 1.25, 2, null, 1000, undefined, undefined, undefined, undefined]);
  });
  it('Fenster der Virtualisierung', () => {
    expect(fenster(50, 0, 360)).toEqual({ von: 0, bis: 15 });
    expect(fenster(50, 36 * 40, 360)).toEqual({ von: 35, bis: 50 });
    expect(fenster(3, 0, 0)).toEqual({ von: 0, bis: 3 });
  });
});

describe('Kapazität', () => {
  it('zeigt das Raster mit aktiven Rollen und deaktivierten mit Angebot (axe ohne Befund)', async () => {
    server({ zellen: [{ rolle: 'projektleitung', monat: '2027-04', fte: 5, version: 1 }, { rolle: 'alt', monat: '2027-05', fte: 0.5, version: 2 }] });
    const { container } = renderWithIam(<Page />, RM);
    const raster = await screen.findByRole('table', { name: TR.rasterLabel });
    expect(within(raster).getAllByRole('rowheader').map(h => h.textContent)).toEqual(['Projektleitung', 'CTL', `Alte Rolle (${TR.deaktiviert})`]);
    expect(zelle('Projektleitung', 'April 2027')).toHaveValue('5');
    expect(zelle('Alte Rolle', 'Mai 2027')).toHaveValue('0,5');
    expect(zelle('CTL', 'Juni 2027')).toHaveValue('');
    await expectNoAxe(container);
  });

  it('speichert automatisch nach einer Pause, mit Version je Zelle; leer entfernt; «Gespeichert» angesagt', async () => {
    const s = server({ zellen: [{ rolle: 'projektleitung', monat: '2027-04', fte: 5, version: 1 }] });
    renderWithIam(<Page />, RM);
    await screen.findByRole('table', { name: TR.rasterLabel });
    const user = userEvent.setup();
    await user.clear(zelle('Projektleitung', 'April 2027'));
    await user.type(zelle('Projektleitung', 'April 2027'), '6,5');
    await user.type(zelle('CTL', 'April 2027'), '1');
    expect(speicherstand()).toHaveTextContent(TR.ungespeichert(2));
    await waitFor(() => expect(s.puts).toHaveLength(1), { timeout: 3000 });
    expect(s.puts[0]).toEqual({ zellen: [{ rolle: 'projektleitung', monat: '2027-04', fte: 6.5, version: 1 }, { rolle: 'ctl', monat: '2027-04', fte: 1 }] });
    await waitFor(() => expect(speicherstand()).toHaveTextContent(`${TR.gespeichert} ${TR.gerade}`));
    // entfernen mit der neuen Version
    await user.clear(zelle('Projektleitung', 'April 2027'));
    await waitFor(() => expect(s.puts).toHaveLength(2), { timeout: 3000 });
    expect(s.puts[1]).toEqual({ zellen: [{ rolle: 'projektleitung', monat: '2027-04', fte: null, version: 2 }] });
    await waitFor(() => expect(s.zellen.has('projektleitung|2027-04')).toBe(false));
  });

  it('ungültige Eingabe wird nicht gespeichert und am Feld markiert', async () => {
    const s = server();
    renderWithIam(<Page />, RM);
    await screen.findByRole('table', { name: TR.rasterLabel });
    await userEvent.type(zelle('CTL', 'Mai 2027'), '-2');
    expect(zelle('CTL', 'Mai 2027')).toHaveAttribute('aria-invalid', 'true');
    expect(await screen.findByText(TR.ungueltig)).toBeInTheDocument();
    await new Promise(r => setTimeout(r, 1000));
    expect(s.puts).toHaveLength(0);
  });

  it('Tastatur: Pfeile und Eingabetaste wechseln die Zeile; Strg+Z macht rückgängig, Strg+Umschalt+Z wiederholt', async () => {
    server({ zellen: [{ rolle: 'projektleitung', monat: '2027-05', fte: 5, version: 1 }] });
    renderWithIam(<Page />, RM);
    await screen.findByRole('table', { name: TR.rasterLabel });
    const user = userEvent.setup();
    await user.click(zelle('Projektleitung', 'Mai 2027'));
    await user.keyboard('{ArrowDown}');
    expect(zelle('CTL', 'Mai 2027')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(zelle('Projektleitung', 'Mai 2027')).toHaveFocus();
    await user.clear(zelle('Projektleitung', 'Mai 2027'));
    await user.type(zelle('Projektleitung', 'Mai 2027'), '7');
    await user.keyboard('{Enter}');
    expect(zelle('CTL', 'Mai 2027')).toHaveFocus();
    await user.keyboard('{Control>}z{/Control}');
    expect(zelle('Projektleitung', 'Mai 2027')).toHaveValue('5');
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(zelle('Projektleitung', 'Mai 2027')).toHaveValue('7');
    expect(screen.getByRole('button', { name: TR.rueckgaengig })).toBeEnabled();
  });

  it('Konflikt (412, Z7): Hinweis, «Neu laden» behält die Eingabe und speichert sie mit der neuen Version', async () => {
    const s = server({ zellen: [{ rolle: 'ctl', monat: '2027-04', fte: 1, version: 1 }] });
    renderWithIam(<Page />, RM);
    await screen.findByRole('table', { name: TR.rasterLabel });
    s.zellen.set('ctl|2027-04', { rolle: 'ctl', monat: '2027-04', fte: 2, version: 2 });   // jemand anderes ändert
    const user = userEvent.setup();
    await user.clear(zelle('CTL', 'April 2027'));
    await user.type(zelle('CTL', 'April 2027'), '3');
    expect(await screen.findByText(TR.konflikt, {}, { timeout: 3000 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: TR.neuLaden }));
    expect(zelle('CTL', 'April 2027')).toHaveValue('3');
    await waitFor(() => expect(s.zellen.get('ctl|2027-04')).toMatchObject({ fte: 3, version: 3 }), { timeout: 3000 });
    expect(screen.queryByText(TR.konflikt)).not.toBeInTheDocument();
  });

  it('nur lesen (Z8) ohne ressource:write: keine Eingabefelder, Hinweis', async () => {
    server({ write: false, zellen: [{ rolle: 'ctl', monat: '2027-04', fte: 1.5, version: 1 }] });
    const { container } = renderWithIam(<Page />, UE);
    const raster = await screen.findByRole('table', { name: TR.rasterLabel });
    expect(within(raster).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(raster).getByText('1,5')).toBeInTheDocument();
    expect(screen.getByText(TR.nurLesen)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TR.rueckgaengig })).not.toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('Kapazität laut HR (RK.01.02): grau mit «HR» in Zellen ohne Angebot, das Festgelegte hat Vorrang; Rolle nur aus HR als Zeile (axe ohne Befund)', async () => {
    const s = server({
      zellen: [{ rolle: 'ctl', monat: '2027-04', fte: 3, version: 1 }],
      hr: [
        { rolle: 'ctl', monat: '2027-04', fte: 1.5, abwesend: 0, personen: 2 },
        { rolle: 'ctl', monat: '2027-05', fte: 1.75, abwesend: 0.25, personen: 2 },
        { rolle: 'neu', monat: '2027-04', fte: 1, abwesend: 0, personen: 1 },
      ],
    });
    const { container } = renderWithIam(<Page />, RM);
    const raster = await screen.findByRole('table', { name: TR.rasterLabel });
    await waitFor(() => expect(within(raster).getAllByRole('rowheader').map(h => h.textContent)).toContain(`neu (${TR.deaktiviert})`));
    expect(screen.getByText(/Kapazität laut HR-System/)).toBeInTheDocument();
    // festgelegt: Wert, nicht grau (HR erst als Platzhalter, wenn die Zelle geleert wird)
    expect(zelle('CTL', 'April 2027')).toHaveValue('3');
    expect(zelle('CTL', 'April 2027')).not.toHaveClass('res-hr');
    // ohne Angebot: HR-Wert als Platzhalter, im Namen angesagt, Einzelheiten im Titel
    const mai = screen.getByRole('textbox', { name: TR.zelleEingabe('CTL', 'Mai 2027') + TR.hrLabel('1,75') });
    expect(mai).toHaveValue('');
    expect(mai).toHaveAttribute('placeholder', `1,75 ${TR.hrMarke}`);
    expect(mai.getAttribute('title')).toContain('2 Personen');
    await expectNoAxe(container);
    // eintragen übersteuert HR und wird gespeichert
    await userEvent.type(mai, '2');
    await waitFor(() => expect(s.puts).toHaveLength(1), { timeout: 3000 });
    expect(s.puts[0]).toEqual({ zellen: [{ rolle: 'ctl', monat: '2027-05', fte: 2 }] });
  });

  it('Kapazität laut HR nur lesen (Z8): Wert grau mit «HR», angesagt', async () => {
    server({ write: false, hr: [{ rolle: 'ctl', monat: '2027-06', fte: 0.5, abwesend: 0, personen: 1 }] });
    const { container } = renderWithIam(<Page />, UE);
    const raster = await screen.findByRole('table', { name: TR.rasterLabel });
    await waitFor(() => expect(within(raster).getByText(TR.hrMarke)).toBeInTheDocument());
    expect(within(raster).getByText('0,5')).toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('ohne Rollen in der Codetabelle (Z2): erklärt, wo sie angelegt werden', async () => {
    server({ rollen: [] });
    renderWithIam(<Page />, RM);
    expect(await screen.findByText(TR.keineRollen)).toBeInTheDocument();
  });

  it('Q-L5: 50 × 31 Zellen virtualisiert, Aufbau und Bildlauf flüssig (Messung)', async () => {
    const rollen = Array.from({ length: 50 }, (_, i) => wert(`rolle_${i}`, `Rolle ${String(i).padStart(2, '0')}`, true, i));
    const ms = monate('2027-01', '2029-07');
    expect(ms).toHaveLength(31);
    server({ rollen, zellen: rollen.flatMap(r => ms.map(m => ({ rolle: r.schluessel, monat: m, fte: 1, version: 1 }))) });
    const t0 = performance.now();
    renderWithIam(<Page initial={{ von: '2027-01', bis: '2029-07' }} />, RM);
    const raster = await screen.findByRole('table', { name: TR.rasterLabel });
    const aufbau = performance.now() - t0;
    const zeilen = () => within(raster).getAllByRole('rowheader');
    expect(raster).toHaveAttribute('aria-rowcount', '51');
    expect(zeilen().length).toBeLessThan(30);
    expect(within(raster).getAllByRole('textbox').length).toBe(zeilen().length * 31);
    // ans Ende blättern: die letzten Zeilen erscheinen, die ersten fallen weg
    const scroller = raster.parentElement!;
    const t1 = performance.now();
    act(() => { scroller.scrollTop = 36 * 45; fireEvent.scroll(scroller); });
    const blaettern = performance.now() - t1;
    expect(zeilen().map(z => z.textContent)).toContain('Rolle 49');
    expect(zeilen().map(z => z.textContent)).not.toContain('Rolle 00');
    // Grenzen für jsdom (langsamer als ein Browser): Aufbau inkl. Laden < 2 s, Bildlauf < 200 ms (Q-L2)
    expect(aufbau).toBeLessThan(2000);
    expect(blaettern).toBeLessThan(200);
  });
});
