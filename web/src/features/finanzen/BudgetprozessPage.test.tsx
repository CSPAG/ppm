/**
 * Budgetprozess (UI-28, Assistent; AP-E7-4; BC PC.01.05; UC-010 Schritte 5–6) gegen die nachgebildete API: Jahr wählen,
 * Jahresbedarf prüfen und korrigieren (If-Match, ungültige Beträge), Phasen ohne Termine genannt, Zusammenfassung der
 * Wirkung vor dem Übergeben mit Bestätigung, danach übergeben und unveränderlich; GL nur lesen, ohne Recht kein Inhalt.
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
import { BudgetprozessPage } from './BudgetprozessPage.tsx';
import type { BudgetSearch, SetBudgetSearch } from './search.ts';

const FI = { roles: ['fi'], permissions: ['tenant:read', 'projekt:read', 'finanzen:read', 'finanzen:write'] as AppPermission[] };
const GL = { roles: ['gl'], permissions: ['tenant:read', 'projekt:read', 'finanzen:read'] as AppPermission[] };
const PL = { roles: ['pl'], permissions: ['tenant:read'] as AppPermission[], somewhere: ['finanzen:read'] as AppPermission[] };
const A = '00000000-0000-4000-8000-000000000101';
const B = '00000000-0000-4000-8000-000000000102';

function Page({ initial = {} }: { initial?: BudgetSearch }) {
  const [search, set] = useState<BudgetSearch>(initial);
  const setSearch = useCallback<SetBudgetSearch>(next => set(s => Object.fromEntries(Object.entries({ ...s, ...next }).filter(([, v]) => v !== undefined)) as BudgetSearch), []);
  return <><BudgetprozessPage search={search} setSearch={setSearch} navigieren={() => {}} heute={new Date('2026-10-28T10:00:00Z')} /><output data-testid="s">{JSON.stringify(search)}</output></>;
}

function server(write = true, o: { konfliktEinmal?: boolean; exportKonfliktEinmal?: boolean } = {}) {
  let konflikt = o.konfliktEinmal ?? false;
  let exportKonflikt = o.exportKonfliktEinmal ?? false;
  let stand: 'neu' | 'entwurf' | 'uebergeben' = 'neu';
  let version = 0;
  let korr: Record<string, { capex: number | null; opex: number | null; bemerkung: string }> = {};
  const aufrufe: { methode: string; ifMatch: string | null; body?: unknown }[] = [];
  const uebergabe = () => {
    const pos = [
      { projektId: A, nummer: '2026-001', name: 'Projekt 1', portfolioId: A, berechnet: { capex: 0, opex: 24794.52 }, ohneTermine: [] as string[] },
      { projektId: B, nummer: '2026-002', name: 'Projekt 2', portfolioId: A, berechnet: { capex: 0, opex: 0 }, ohneTermine: ['P1'] },
    ].map(p => {
      const k = korr[p.projektId];
      return { ...p, korrektur: k ?? null, wert: { capex: k?.capex ?? p.berechnet.capex, opex: k?.opex ?? p.berechnet.opex } };
    });
    return { jahr: 2027, stand, version, uebergebenAt: stand === 'uebergeben' ? '2026-10-28T11:00:00Z' : null, positionen: pos,
      vertraulich: write ? null : { anzahl: 1, capex: 0, opex: 50000 }, summe: { capex: pos.reduce((s, p) => s + p.wert.capex, 0), opex: Math.round(pos.reduce((s, p) => s + p.wert.opex, 0) * 100) / 100 + (write ? 0 : 50000) }, can: { write: write && stand !== 'uebergeben' } };
  };
  const api = mockIamApi({
    'GET /v1/budgetuebergaben/2027': () => json(uebergabe()),
    'PUT /v1/budgetuebergaben/2027': async req => {
      const body = await req.json() as { korrekturen: { projektId: string; capex: number | null; opex: number | null; bemerkung: string }[] };
      aufrufe.push({ methode: 'PUT', ifMatch: req.headers.get('if-match'), body });
      if (konflikt) {
        // dazwischen korrigiert jemand anderes Projekt 1
        konflikt = false;
        korr = { [A]: { capex: 5000, opex: null, bemerkung: 'Von Paula' } };
        stand = 'entwurf';
        version += 1;
        return json({ title: 'Inzwischen geändert', status: 412 }, 412);
      }
      korr = Object.fromEntries(body.korrekturen.filter(k => k.capex !== null || k.opex !== null).map(k => [k.projektId, { capex: k.capex, opex: k.opex, bemerkung: k.bemerkung }]));
      stand = 'entwurf';
      version += 1;
      return json(uebergabe());
    },
    'POST /v1/budgetuebergaben/2027/export': req => {
      aufrufe.push({ methode: 'POST', ifMatch: req.headers.get('if-match') });
      if (exportKonflikt) {
        exportKonflikt = false;
        korr = { [A]: { capex: 5000, opex: null, bemerkung: 'Von Paula' } };
        version += 1;
        return json({ title: 'Inzwischen geändert', status: 412 }, 412);
      }
      stand = 'uebergeben';
      version += 1;
      return json(uebergabe());
    },
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return { aufrufe };
}

describe('Budgetprozess', () => {
  it('Jahr wählen, korrigieren, Zusammenfassung, übergeben (axe ohne Befund)', async () => {
    const s = server();
    const { container } = renderWithIam(<Page />, FI);
    expect(await screen.findByRole('heading', { name: 'Schritt 1 von 3: Jahr wählen' })).toBeInTheDocument();
    expect(screen.getByLabelText('Jahr des Budgets')).toHaveValue('2027');
    await expectNoAxe(container);
    await userEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(await screen.findByRole('heading', { name: 'Schritt 2 von 3: Jahresbedarf prüfen' })).toHaveFocus();
    expect(screen.getByText(/1 Projekt hat Kosten in Phasen ohne Termine/)).toBeInTheDocument();
    expect(screen.getByText('ohne Termine: P1 (zählt nicht)')).toBeInTheDocument();

    const opexB = screen.getByRole('textbox', { name: 'Korrektur OPEX für 2026-002 Projekt 2' });
    await userEvent.type(opexB, '8x');
    expect(screen.getByRole('alert')).toHaveTextContent('Betrag in CHF, 0 oder mehr.');
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeDisabled();
    await userEvent.clear(opexB);
    await userEvent.type(opexB, '8000');
    await userEvent.type(screen.getByRole('textbox', { name: 'Bemerkung zur Korrektur für 2026-002 Projekt 2' }), 'Termine folgen');
    await expectNoAxe(container);
    await userEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(await screen.findByRole('heading', { name: 'Schritt 3 von 3: Übergeben' })).toBeInTheDocument();
    expect(s.aufrufe[0]).toEqual({ methode: 'PUT', ifMatch: 'W/"0"', body: { korrekturen: [
      { projektId: A, capex: null, opex: null, bemerkung: '' }, { projektId: B, capex: null, opex: 8000, bemerkung: 'Termine folgen' },
    ] } });
    expect(screen.getByText(/^Jahresbedarf 2027: CAPEX CHF.0, OPEX CHF.32.795 für 2 Projekte\.$/, { selector: 'p' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Übergeben' }));
    const dlg = await screen.findByRole('dialog', { name: 'Jahresbedarf 2027 an den Budgetprozess übergeben?' });
    expect(dlg).toHaveTextContent('lässt sich nicht mehr ändern');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Übergeben' }));
    await waitFor(() => expect(s.aufrufe[1]).toEqual({ methode: 'POST', ifMatch: 'W/"1"' }));
    expect(await screen.findByText(/Übergeben am/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Übergeben' })).toBeNull();
    expect(screen.getByRole('button', { name: /Als CSV herunterladen/ })).toBeInTheDocument();
  });

  it('Konflikt (412): «Neu laden» behält die eigenen Korrekturen und übernimmt die der anderen (Z7)', async () => {
    const s = server(true, { konfliktEinmal: true });
    renderWithIam(<Page initial={{ jahr: '2027', schritt: '2' }} />, FI);
    const opexB = await screen.findByRole('textbox', { name: 'Korrektur OPEX für 2026-002 Projekt 2' });
    await userEvent.type(opexB, '8000');
    await userEvent.click(screen.getByRole('button', { name: 'Korrekturen speichern' }));
    expect(await screen.findByText(/Lade neu und speichere danach nochmals; deine Korrekturen bleiben erhalten/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Neu laden' }));
    await waitFor(() => expect(screen.queryByText(/deine Korrekturen bleiben erhalten/)).toBeNull());
    expect(screen.getByRole('textbox', { name: 'Korrektur OPEX für 2026-002 Projekt 2' })).toHaveValue('8000');
    expect(screen.getByRole('textbox', { name: 'Korrektur CAPEX für 2026-001 Projekt 1' })).toHaveValue('5000');
    await userEvent.click(screen.getByRole('button', { name: 'Korrekturen speichern' }));
    await waitFor(() => expect(s.aufrufe).toHaveLength(2));
    expect(s.aufrufe[1]).toEqual({ methode: 'PUT', ifMatch: 'W/"1"', body: { korrekturen: [
      { projektId: A, capex: 5000, opex: null, bemerkung: 'Von Paula' }, { projektId: B, capex: null, opex: 8000, bemerkung: '' },
    ] } });
  });

  it('nach dem Speichern gilt die Form des Servers («8\'000» → «8000»), nichts bleibt ungespeichert', async () => {
    const s = server();
    renderWithIam(<Page initial={{ jahr: '2027', schritt: '2' }} />, FI);
    const opexB = await screen.findByRole('textbox', { name: 'Korrektur OPEX für 2026-002 Projekt 2' });
    await userEvent.type(opexB, "8'000");
    await userEvent.type(screen.getByRole('textbox', { name: 'Bemerkung zur Korrektur für 2026-002 Projekt 2' }), ' Termine folgen ');
    await userEvent.click(screen.getByRole('button', { name: 'Korrekturen speichern' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Korrekturen speichern' })).toBeNull());
    expect(screen.getByRole('textbox', { name: 'Korrektur OPEX für 2026-002 Projekt 2' })).toHaveValue('8000');
    expect(screen.getByRole('textbox', { name: 'Bemerkung zur Korrektur für 2026-002 Projekt 2' })).toHaveValue('Termine folgen');
    expect(s.aufrufe).toHaveLength(1);
  });

  it('Konflikt (412) beim Übergeben: «Neu laden» an Ort und Stelle, Übergeben bis dahin gesperrt (Z7)', async () => {
    const s = server(true, { exportKonfliktEinmal: true });
    renderWithIam(<Page initial={{ jahr: '2027', schritt: '3' }} />, FI);
    await userEvent.click(await screen.findByRole('button', { name: 'Übergeben' }));
    const dlg = await screen.findByRole('dialog', { name: 'Jahresbedarf 2027 an den Budgetprozess übergeben?' });
    await userEvent.click(within(dlg).getByRole('button', { name: 'Übergeben' }));
    expect(await screen.findByText(/Lade neu und prüfe die Summe, bevor du übergibst/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Übergeben' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Neu laden' }));
    await waitFor(() => expect(screen.queryByText(/prüfe die Summe/)).toBeNull());
    expect(screen.getByText(/CAPEX CHF.5.000/, { selector: 'p' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Übergeben' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Übergeben' }));
    await waitFor(() => expect(s.aufrufe.map(a => a.ifMatch)).toEqual(['W/"0"', 'W/"1"']));
  });

  it('GL liest den Jahresbedarf ohne Eingaben; ohne Recht an der Organisation kein Inhalt', async () => {
    server(false);
    const { unmount } = renderWithIam(<Page initial={{ jahr: '2027', schritt: '2' }} />, GL);
    expect(await screen.findByText(/übergeben wird er von Finanzen/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('rowheader', { name: /1 vertrauliches Projekt/ }).closest('tr')).toHaveTextContent(/CHF.50.000/);
    unmount();
    renderWithIam(<Page />, PL);
    expect(await screen.findByText(/Den Jahresbedarf aller Projekte sehen Personen/)).toBeInTheDocument();
  });
});
