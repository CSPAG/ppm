/**
 * Seite «Modell» (UI-19, AP-E5-1; BC PP.01.02, PP.01.03, UC-008 A1) gegen die nachgebildete API: Versionen mit Stand,
 * Entwurf anlegen, bearbeiten (Kriterien, Zuordnung, Budgetrahmen) mit If-Match, Prüfbericht, In-Kraft-Setzen mit Entscheid
 * (Sperre ohne Kriterien), verwerfen, Modell in Kraft gesperrt (Z9), leer (Z2).
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
import { betragAus } from './ModellDrawer.tsx';
import { ModellPage } from './ModellPage.tsx';
import type { ModellSearch, SetModellSearch } from './search.ts';
import { TP } from './texte.ts';

const UE = { roles: ['ue'], permissions: ['tenant:read', 'stammdaten:read', 'portfolio:read', 'projekt:read', 'priorisierung:read', 'priorisierung:write'] as AppPermission[] };
const PF = { id: '00000000-0000-4000-8000-0000000000a1', kategorie: 'A', schluessel: 'transformation', name: 'Transformation', pflichten: true, version: 1 };
const PFB = { id: '00000000-0000-4000-8000-0000000000a2', kategorie: 'B', schluessel: 'geschaeftsleitung', name: 'Geschäftsleitung', pflichten: true, version: 1 };

type Modell = {
  id: string; nummer: number; stand: string; aktuell: boolean; beschreibung: string; beschluss: string; inKraftAt: string | null; inKraftBy: string | null;
  version: number; createdAt: string; updatedAt: string; kriterien: { schluessel: string; text: string; beschreibung: string; dimension: string | null; position: number }[];
  budgetrahmen: { portfolioId: string; kategorie: string; betrag: number }[];
};
const kurz = ({ kriterien: _k, budgetrahmen: _b, ...m }: Modell) => m;
function pruefung(m: Modell) {
  const p: { stufe: string; text: string; pfad: string }[] = [];
  if (!m.kriterien.length) p.push({ stufe: 'sperre', text: 'Kriterien: keines statt mindestens eines. Erfassen Sie die Kriterien der Bewertung.', pfad: '/kriterien' });
  m.kriterien.forEach((k, i) => { if (!k.dimension) p.push({ stufe: 'hinweis', text: `Kriterium «${k.text}»: weder Nutzen noch Risiko zugeordnet.`, pfad: `/kriterien/${i}/dimension` }); });
  return p;
}

function server(start: Modell[] = []) {
  const modelle = new Map(start.map(m => [m.id, m]));
  const patches: unknown[] = [];
  const voll = (m: Modell) => ({ ...m, pruefung: m.stand === 'entwurf' ? pruefung(m) : [], can: { write: m.stand === 'entwurf' } });
  const mitEtag = (m: Modell) => json(voll(m), 200, { ETag: `W/"${m.version}"` });
  const api = mockIamApi({
    'GET /v1/portfolios': () => json({ items: [PF, PFB], nextCursor: null }),
    'GET /v1/bewertungsmodelle': () => json({ items: [...modelle.values()].sort((a, b) => b.nummer - a.nummer).map(kurz), can: { create: ![...modelle.values()].some(m => m.stand === 'entwurf') } }),
    'POST /v1/bewertungsmodelle': () => {
      const m: Modell = { id: `00000000-0000-4000-8000-00000000000${modelle.size + 1}`, nummer: modelle.size + 1, stand: 'entwurf', aktuell: false, beschreibung: '', beschluss: '', inKraftAt: null, inKraftBy: null, version: 1, createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-01T10:00:00Z',
        kriterien: [{ schluessel: 'strategiebeitrag', text: 'Strategiebeitrag', beschreibung: '', dimension: null, position: 0 }], budgetrahmen: [] };
      modelle.set(m.id, m);
      return json(voll(m), 201, { ETag: 'W/"1"' });
    },
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  // Routen mit ID: die Nachbildung des Baukastens kennt nur feste Pfade
  const dynamisch: [string, RegExp, (req: Request) => Response | Promise<Response>][] = [
    ['GET', /^\/v1\/bewertungsmodelle\/[0-9a-f-]{36}$/, req => mitEtag(modelle.get(new URL(req.url).pathname.split('/').pop()!)!)],
    ['PATCH', /^\/v1\/bewertungsmodelle\/[0-9a-f-]{36}$/, async req => {
      const m = modelle.get(new URL(req.url).pathname.split('/').pop()!)!;
      if (req.headers.get('if-match') !== `W/"${m.version}"`) return json({ type: 'about:blank', title: 'Veraltet', status: 412, currentVersion: m.version }, 412);
      const body = await req.json() as { kriterien: { schluessel?: string; text: string; dimension: string | null }[]; budgetrahmen: { portfolioId: string; betrag: number }[]; beschreibung: string };
      patches.push(body);
      Object.assign(m, {
        version: m.version + 1, beschreibung: body.beschreibung,
        kriterien: body.kriterien.map((k, position) => ({ schluessel: k.schluessel ?? k.text.toLowerCase(), text: k.text, beschreibung: '', dimension: k.dimension, position })),
        budgetrahmen: body.budgetrahmen.map(b => ({ ...b, kategorie: b.portfolioId === PF.id ? 'A' : 'B' })),
      });
      return mitEtag(m);
    }],
    ['POST', /^\/v1\/bewertungsmodelle\/[0-9a-f-]{36}\/in-kraft-setzen$/, async req => {
      const m = modelle.get(new URL(req.url).pathname.split('/')[3]!)!;
      const { beschluss } = await req.json() as { beschluss: string };
      Object.assign(m, { stand: 'in_kraft', aktuell: true, beschluss, inKraftAt: '2026-11-12T10:00:00Z', version: m.version + 1 });
      return mitEtag(m);
    }],
    ['DELETE', /^\/v1\/bewertungsmodelle\/[0-9a-f-]{36}$/, req => { modelle.delete(new URL(req.url).pathname.split('/').pop()!); return new Response(null, { status: 204 }); }],
  ];
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const pfad = new URL(req.url).pathname;
    const treffer = dynamisch.find(([m, re]) => m === req.method && re.test(pfad));
    return treffer ? Promise.resolve(treffer[2](req)) : api.fetch(req);
  });
  return { modelle, patches };
}

function Page({ initial = {} }: { initial?: ModellSearch }) {
  const [search, set] = useState<ModellSearch>(initial);
  const setSearch = useCallback<SetModellSearch>(next => set(s => Object.fromEntries(Object.entries({ ...s, ...next }).filter(([, v]) => v !== undefined)) as ModellSearch), []);
  return <><ModellPage search={search} setSearch={setSearch} navigieren={() => {}} /><output data-testid="o">{search.o ?? ''}</output></>;
}

describe('Bewertungsmodell', () => {
  it('Betrag aus der Eingabe', () => {
    expect(["12'000'000", '1500000.5', ' 0 ', '', '-1', 'abc', '1,25'].map(betragAus)).toEqual([12000000, 1500000.5, 0, null, undefined, undefined, 1.25]);
  });

  it('leer (Z2): Entwurf anlegen, bearbeiten mit Zuordnung und Budgetrahmen, in Kraft setzen mit Entscheid', async () => {
    const s = server();
    const { container } = renderWithIam(<Page />, UE);
    expect(await screen.findByText(TP.modellLeer)).toBeInTheDocument();
    await expectNoAxe(container);
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: TP.entwurfAnlegen })[0]!);
    expect(await screen.findByText(TP.angelegt)).toBeInTheDocument();
    expect(screen.getByTestId('o')).toHaveTextContent('1');
    const drawer = await screen.findByRole('dialog', { name: 'Modell 1' });
    expect(await within(drawer).findByText(/Strategiebeitrag»: weder Nutzen noch Risiko/)).toBeInTheDocument();

    await user.click(within(drawer).getByRole('button', { name: TP.bearbeiten }));
    await user.selectOptions(within(drawer).getByLabelText(TP.zuordnung), 'nutzen');
    await user.click(within(drawer).getByRole('button', { name: TP.kriteriumNeu }));
    await user.click(within(drawer).getByRole('button', { name: TP.speichern }));
    // leere Bezeichnung: Meldung am Feld, Fokus dort, nichts gesendet
    expect(within(drawer).getByText(TP.textFehlt)).toBeInTheDocument();
    expect(within(drawer).getByLabelText(`${TP.text} 2`)).toHaveFocus();
    expect(s.patches).toHaveLength(0);
    await user.type(within(drawer).getByLabelText(`${TP.text} 2`), 'Dringlichkeit');
    await user.selectOptions(within(drawer).getAllByLabelText(TP.zuordnung)[1]!, 'risiko');
    await user.click(within(drawer).getByRole('button', { name: TP.hoch_('Dringlichkeit') }));
    await user.type(within(drawer).getByLabelText('A · Transformation'), "12'000'000");
    await user.click(within(drawer).getByRole('button', { name: TP.speichern }));
    await waitFor(() => expect(s.patches).toHaveLength(1));
    expect(s.patches[0]).toEqual({
      beschreibung: '',
      kriterien: [{ text: 'Dringlichkeit', beschreibung: '', dimension: 'risiko' }, { schluessel: 'strategiebeitrag', text: 'Strategiebeitrag', beschreibung: '', dimension: 'nutzen' }],
      budgetrahmen: [{ portfolioId: PF.id, betrag: 12000000 }],
    });
    expect(await within(drawer).findByText(TP.keineBefunde)).toBeInTheDocument();
    expect(within(drawer).getByRole('cell', { name: /CHF\s12/ })).toBeInTheDocument();

    await user.click(within(drawer).getByRole('button', { name: TP.inKraftSetzen }));
    const dialog = await screen.findByRole('dialog', { name: TP.inKraftDialog(1) });
    await user.click(within(dialog).getByRole('button', { name: TP.inKraftSetzen }));
    expect(within(dialog).getByText(TP.beschlussFehlt)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(TP.beschlussLabel), 'PRAT 12.11.2026');
    await user.click(within(dialog).getByRole('button', { name: TP.inKraftSetzen }));
    expect(await screen.findByText(TP.inKraftToast)).toBeInTheDocument();
    expect(s.modelle.get('00000000-0000-4000-8000-000000000001')).toMatchObject({ stand: 'in_kraft', beschluss: 'PRAT 12.11.2026' });
    expect(await within(drawer).findByText(new RegExp(TP.modellNurLesen))).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: TP.bearbeiten })).not.toBeInTheDocument();
  });

  it('Sperre ohne Kriterien im Dialog; Entwurf verwerfen', async () => {
    server([{ id: '00000000-0000-4000-8000-000000000009', nummer: 2, stand: 'entwurf', aktuell: false, beschreibung: 'Neu', beschluss: '', inKraftAt: null, inKraftBy: null, version: 1, createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-01T10:00:00Z', kriterien: [], budgetrahmen: [] }]);
    renderWithIam(<Page initial={{ o: '2' }} />, UE);
    const drawer = await screen.findByRole('dialog', { name: 'Modell 2' });
    const user = userEvent.setup();
    await user.click(await within(drawer).findByRole('button', { name: TP.inKraftSetzen }));
    const dialog = await screen.findByRole('dialog', { name: TP.inKraftDialog(2) });
    expect(within(dialog).getByText(/keines statt mindestens eines/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: TP.inKraftSetzen })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /abbrechen/i }));
    await user.click(within(drawer).getByRole('button', { name: TP.verwerfen }));
    await user.click(within(await screen.findByRole('dialog', { name: TP.verwerfen })).getByRole('button', { name: TP.verwerfen }));
    expect(await screen.findByText(TP.verworfen)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('o')).toHaveTextContent(''));
  });

  it('Versionen mit Stand (gilt, abgelöst); unbekannte Nummer (Z10)', async () => {
    const m = (nummer: number, aktuell: boolean): Modell => ({ id: `00000000-0000-4000-8000-00000000000${nummer}`, nummer, stand: 'in_kraft', aktuell, beschreibung: '', beschluss: `PRAT ${nummer}`, inKraftAt: '2026-11-12T10:00:00Z', inKraftBy: null, version: 3, createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-12T10:00:00Z', kriterien: [], budgetrahmen: [] });
    server([m(1, false), m(2, true)]);
    const { container } = renderWithIam(<Page initial={{ o: '7' }} />, UE);
    const liste = await screen.findByRole('table', { name: TP.modelle });
    expect(within(liste).getAllByRole('row').slice(1).map(r => r.textContent)).toEqual([expect.stringMatching(/Modell 2.*in Kraft · gilt.*PRAT 2/), expect.stringMatching(/Modell 1.*abgelöst.*PRAT 1/)]);
    expect(within(await screen.findByRole('dialog', { name: TP.modellUnbekannt })).getAllByText(TP.modellUnbekannt).length).toBeGreaterThan(0);
    await expectNoAxe(container);
  });
});
