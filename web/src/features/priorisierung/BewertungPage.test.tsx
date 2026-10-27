/**
 * Seite «Bewertung» (UI-20, AP-E5-1; BC PP.02.01, UC-008 Schritte 1–2) gegen die nachgebildete API: Raster mit
 * Fortschritt, K5-2 (15 Projekte × 7 Kriterien nur mit Tastatur, Messung der Tastendrücke), automatisches Speichern mit
 * Version je Zelle, Rückgängig, Konflikt (412), Kommentar in der Schublade, frühere Modellversion lesend (G11), ohne
 * Modell (Z2), nur lesen (Z8).
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
import { BewertungPage } from './BewertungPage.tsx';
import type { BewertungSearch, SetBewertungSearch } from './search.ts';
import { TP } from './texte.ts';

const UE = { roles: ['ue'], permissions: ['tenant:read', 'stammdaten:read', 'portfolio:read', 'projekt:read', 'priorisierung:read', 'priorisierung:write'] as AppPermission[] };
const GREMIUM = { roles: ['gremium'], permissions: ['tenant:read', 'portfolio:read'] as AppPermission[], somewhere: ['priorisierung:read', 'projekt:read'] as AppPermission[] };

const PF = { id: '00000000-0000-4000-8000-0000000000a1', kategorie: 'A', schluessel: 'transformation', name: 'Transformation', pflichten: true, version: 1 };
const M1 = '00000000-0000-4000-8000-0000000000d1';
const M2 = '00000000-0000-4000-8000-0000000000d2';
const KRIT = ['Strategiebeitrag', 'Transformationsrelevanz', 'Betroffene Bereiche', 'Komplexität und Abhängigkeiten', 'Finanzierungsbedarf', 'Ressourcenverfügbarkeit', 'Kommunikations- und Change-Aufwand'];
const kriterien = KRIT.map((text, position) => ({ schluessel: `k${position}`, text, beschreibung: '', dimension: position < 3 ? 'nutzen' : 'risiko', position }));
const modellKurz = (id: string, nummer: number, aktuell: boolean) => ({
  id, nummer, stand: 'in_kraft', aktuell, beschreibung: '', beschluss: 'PRAT', inKraftAt: '2026-11-12T10:00:00Z', inKraftBy: null, version: 3, createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-12T10:00:00Z',
});
const projekt = (i: number) => ({ id: `00000000-0000-4000-8000-${String(100 + i).padStart(12, '0')}`, nummer: `2026-${String(i + 1).padStart(3, '0')}`, name: `Projekt ${i + 1}`, phase: 'P1', lebenszyklus: 'aktiv', bewertet: 0 });

function Page({ initial = {} }: { initial?: BewertungSearch }) {
  const [search, set] = useState<BewertungSearch>(initial);
  const setSearch = useCallback<SetBewertungSearch>(next => set(s => Object.fromEntries(Object.entries({ ...s, ...next }).filter(([, v]) => v !== undefined)) as BewertungSearch), []);
  return <><BewertungPage search={search} setSearch={setSearch} navigieren={() => {}} /><output data-testid="o">{search.o ?? ''}</output></>;
}

/** Nachgebildete API mit Zustand: Bewertungen mit Version je Zelle, 412 wie der Server. */
function server(o: { projekte?: number; ohneModell?: boolean; write?: boolean; frueher?: boolean } = {}) {
  const projekte = Array.from({ length: o.projekte ?? 3 }, (_, i) => projekt(i));
  const bew = new Map<string, { projektId: string; kriterium: string; einschaetzung: string; kommentar: string; version: number }>();
  const puts: { zellen: { projektId: string; kriterium: string; einschaetzung: string | null; kommentar?: string; version?: number }[] }[] = [];
  const api = mockIamApi({
    'GET /v1/portfolios': () => json({ items: [PF], nextCursor: null }),
    'GET /v1/bewertungsmodelle': () => json({ items: o.frueher ? [modellKurz(M2, 2, true), modellKurz(M1, 1, false)] : [modellKurz(M1, 1, true)], can: { create: true } }),
    [`GET /v1/portfolios/${PF.id}/bewertungen`]: req => {
      const modell = new URL(req.url).searchParams.get('modell');
      const alt = modell === M1 && o.frueher;
      return json({
        portfolio: { id: PF.id, schluessel: PF.schluessel, name: PF.name, kategorie: 'A' },
        modell: o.ohneModell ? null : { ...modellKurz(alt || !o.frueher ? M1 : M2, alt || !o.frueher ? 1 : 2, !alt), kriterien },
        projekte, bewertungen: alt ? [{ projektId: projekte[0]!.id, kriterium: 'k0', einschaetzung: 'hoch', kommentar: '', version: 1 }] : [...bew.values()],
        fortschritt: { bewertet: 0, gesamt: projekte.length }, can: { write: (o.write ?? true) && !alt && !o.ohneModell },
      });
    },
    [`PUT /v1/portfolios/${PF.id}/bewertungen`]: async req => {
      const body = await req.json() as (typeof puts)[number];
      puts.push(body);
      for (const c of body.zellen) {
        const v = bew.get(`${c.projektId}|${c.kriterium}`);
        if ((v && c.version !== v.version) || (!v && c.version !== undefined)) return json({ type: 'about:blank', title: 'Veraltet', status: 412, currentVersion: v?.version ?? 0 }, 412);
      }
      return json({
        zellen: body.zellen.map(c => {
          const key = `${c.projektId}|${c.kriterium}`;
          if (c.einschaetzung === null) { bew.delete(key); return { projektId: c.projektId, kriterium: c.kriterium, einschaetzung: null, kommentar: '', version: null }; }
          const z = { projektId: c.projektId, kriterium: c.kriterium, einschaetzung: c.einschaetzung, kommentar: c.kommentar ?? bew.get(key)?.kommentar ?? '', version: (bew.get(key)?.version ?? 0) + 1 };
          bew.set(key, z);
          return z;
        }),
      });
    },
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return { api, bew, puts, projekte };
}

const zelle = (p: number, kText: string) => screen.getByRole('button', { name: new RegExp(`^2026-${String(p).padStart(3, '0')} Projekt ${p}, ${kText}: `) });

describe('Bewertung', () => {
  it('zeigt das Raster Projekte × Kriterien mit Zuordnung und Fortschritt (axe ohne Befund)', async () => {
    server();
    const { container } = renderWithIam(<Page />, UE);
    const raster = await screen.findByRole('table', { name: TP.rasterLabel });
    expect(within(raster).getAllByRole('columnheader').map(h => h.textContent)).toEqual([TP.projekt, ...KRIT.map((t, i) => `${t}${i < 3 ? 'Nutzen' : 'Risiko'}`)]);
    expect(within(raster).getAllByRole('rowheader')).toHaveLength(3);
    expect(screen.getByText(/0 von 3 Projekten bewertet · Modell 1/)).toBeInTheDocument();
    expect(zelle(1, 'Strategiebeitrag')).toHaveAccessibleName(`2026-001 Projekt 1, Strategiebeitrag: ${TP.offen}`);
    // genau eine Zelle im Tab-Ablauf (roving tabindex)
    expect(within(raster).getAllByRole('button').filter(b => b.tabIndex === 0)).toHaveLength(1 + 3);
    await expectNoAxe(container);
  });

  it('K5-2: 15 Projekte × 7 Kriterien nur mit Tastatur bewerten; gespeichert in einem Aufruf je Pause', async () => {
    const s = server({ projekte: 15 });
    renderWithIam(<Page />, UE);
    await screen.findByRole('table', { name: TP.rasterLabel });
    const user = userEvent.setup();
    // in das Raster tabben: Portfolio-Auswahl, dann die erste Projektzeile … bis zur ersten Zelle
    zelle(1, 'Strategiebeitrag').focus();
    let tasten = 0;
    const t0 = performance.now();
    for (let p = 0; p < 15; p++) {
      for (let c = 0; c < 7; c++) {
        await user.keyboard(String(((p + c) % 3) + 1)); tasten++;
        if (c < 6) { await user.keyboard('{ArrowRight}'); tasten++; }
      }
      if (p < 14) { await user.keyboard('{ArrowDown}{Home}'); tasten += 2; }
    }
    const dauer = performance.now() - t0;
    expect(document.activeElement).toBe(zelle(15, 'Kommunikations- und Change-Aufwand'));
    expect(screen.getByText(/15 von 15 Projekten bewertet/)).toBeInTheDocument();
    // 105 Einschätzungen mit 223 Tastendrücken, ohne Maus (Zielgrösse ≤ 10 Min. im Aufgabentest)
    expect(tasten).toBe(105 + 90 + 28);
    expect(dauer).toBeLessThan(60_000);
    await waitFor(() => expect(s.bew.size).toBe(105), { timeout: 5000 });
    expect(zelle(2, 'Strategiebeitrag')).toHaveAccessibleName('2026-002 Projekt 2, Strategiebeitrag: mittel');
    expect(s.puts.length).toBeLessThanOrEqual(3);
  }, 120_000);

  it('Klick wechselt tief → mittel → hoch → leer; Version je Zelle; Rückgängig mit Strg+Z; «Gespeichert» angesagt', async () => {
    const s = server();
    renderWithIam(<Page />, UE);
    await screen.findByRole('table', { name: TP.rasterLabel });
    const user = userEvent.setup();
    await user.click(zelle(1, 'Finanzierungsbedarf'));
    await user.click(zelle(1, 'Finanzierungsbedarf'));
    expect(zelle(1, 'Finanzierungsbedarf')).toHaveAccessibleName(/: mittel$/);
    await waitFor(() => expect(s.puts).toHaveLength(1), { timeout: 3000 });
    expect(s.puts[0]).toEqual({ zellen: [{ projektId: s.projekte[0]!.id, kriterium: 'k4', einschaetzung: 'mittel', kommentar: '' }] });
    await waitFor(() => expect(document.querySelector('.pr-status')).toHaveTextContent(`${TP.gespeichert} ${TP.gerade}`));
    await user.keyboard('3');
    await waitFor(() => expect(s.puts).toHaveLength(2), { timeout: 3000 });
    expect(s.puts[1]!.zellen[0]).toMatchObject({ einschaetzung: 'hoch', version: 1 });
    await user.keyboard('{Control>}z{/Control}');
    expect(zelle(1, 'Finanzierungsbedarf')).toHaveAccessibleName(/: mittel$/);
    await user.keyboard('{Delete}');
    await waitFor(() => expect(s.bew.has(`${s.projekte[0]!.id}|k4`)).toBe(false), { timeout: 3000 });
  });

  it('Konflikt (412, Z7): Hinweis; «Neu laden» behält die Eingabe und speichert sie mit der neuen Version', async () => {
    const s = server();
    renderWithIam(<Page />, UE);
    await screen.findByRole('table', { name: TP.rasterLabel });
    s.bew.set(`${s.projekte[1]!.id}|k0`, { projektId: s.projekte[1]!.id, kriterium: 'k0', einschaetzung: 'tief', kommentar: '', version: 4 });
    zelle(2, 'Strategiebeitrag').focus();
    await userEvent.keyboard('3');
    expect(await screen.findByText(TP.konflikt, {}, { timeout: 3000 })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TP.neuLaden }));
    await waitFor(() => expect(s.bew.get(`${s.projekte[1]!.id}|k0`)).toMatchObject({ einschaetzung: 'hoch', version: 5 }), { timeout: 3000 });
  });

  it('Eingabetaste öffnet das Projekt in der Schublade; Kommentar zur Einschätzung', async () => {
    const s = server();
    renderWithIam(<Page />, UE);
    await screen.findByRole('table', { name: TP.rasterLabel });
    zelle(3, 'Strategiebeitrag').focus();
    await userEvent.keyboard('2{Enter}');
    expect(screen.getByTestId('o')).toHaveTextContent('2026-003');
    const drawer = await screen.findByRole('dialog', { name: '2026-003 Projekt 3' });
    const gruppe = within(drawer).getByRole('radiogroup', { name: 'Strategiebeitrag' });
    expect(within(gruppe).getByRole('radio', { name: 'mittel' })).toHaveAttribute('aria-checked', 'true');
    const kommentare = within(drawer).getAllByLabelText(/^Kommentar/);
    expect(kommentare[1]).toBeDisabled();
    await userEvent.type(kommentare[0]!, 'Kernvorhaben');
    await userEvent.tab();
    await waitFor(() => expect(s.bew.get(`${s.projekte[2]!.id}|k0`)).toMatchObject({ einschaetzung: 'mittel', kommentar: 'Kernvorhaben' }), { timeout: 3000 });
    await expectNoAxe(drawer);
  });

  it('frühere Modellversion lesend (G11); ohne Modell in Kraft (Z2); Gremium nur lesen (Z8)', async () => {
    server({ frueher: true });
    const { unmount } = renderWithIam(<Page initial={{ modell: '1' }} />, UE);
    expect(await screen.findByText(TP.frueherLesen(1))).toBeInTheDocument();
    expect(zelle(1, 'Strategiebeitrag')).toHaveAccessibleName(/: hoch$/);
    expect(screen.queryByRole('button', { name: TP.rueckgaengig })).not.toBeInTheDocument();
    unmount();

    server({ ohneModell: true });
    const u2 = renderWithIam(<Page />, UE);
    expect(await screen.findByText(TP.keinModell)).toBeInTheDocument();
    u2.unmount();

    server({ write: false });
    const { container } = renderWithIam(<Page />, GREMIUM);
    expect(await screen.findByText(TP.nurLesen)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: TP.tabs.modell })).not.toBeInTheDocument();
    await expectNoAxe(container);
  });
});
