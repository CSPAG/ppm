/**
 * Seite «Szenarien» (UI-22, AP-E5-3; BC PP.03.01–03, UC-008 Schritte 5–6, K5) gegen die nachgebildete API: leer (Z2) mit
 * «Szenario anlegen», Rangliste mit Wasserlinie und Regeltext, Engpässe mit Rollenbezeichnung, Umordnen mit Alt+↓
 * (sichtbar sofort, K5-1) mit Ansage, nur lesen (Gremium), Vergleich und «Als Antrag wählen» mit Vorlage; Antrag ans
 * Gremium (AP-E5-5, K5 Schritt 7): Folgeentscheid je laufendem Projekt unter der Wasserlinie, Sperre ohne Folgeentscheid,
 * «Für das Gremium traktandieren».
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
import { SzenarioPage } from './SzenarioPage.tsx';
import type { SetSzenarioSearch, SzenarioSearch } from './SzenarioSearch.ts';
import { TS } from './SzenarioTexte.ts';
import { TE } from './EntscheidTexte.ts';

const UE = { roles: ['ue'], permissions: ['tenant:read', 'stammdaten:read', 'portfolio:read', 'projekt:read', 'priorisierung:read', 'priorisierung:write', 'finanzen:read'] as AppPermission[] };
const GREMIUM = { roles: ['gremium'], permissions: ['tenant:read', 'portfolio:read'] as AppPermission[], somewhere: ['priorisierung:read', 'projekt:read'] as AppPermission[] };

const PF = { id: '00000000-0000-4000-8000-0000000000a1', kategorie: 'A', schluessel: 'transformation', name: 'Transformation', pflichten: true, version: 1 };
const SA = '00000000-0000-4000-8000-0000000000b1';
const SB = '00000000-0000-4000-8000-0000000000b2';
const P = [1, 2, 3].map(i => ({ id: `00000000-0000-4000-8000-00000000010${i}`, nummer: `2026-00${i}`, name: `Projekt ${i}`, kosten: [500000, 300000, 400000][i - 1]! }));

/** Rechnung wie der Server, vereinfacht: Wasserlinie nach Budget 1 Mio. */
function rechnen(id: string, name: string, stand: string, reihe: { projektId: string; aktiv: boolean; startMonat: string | null }[], version: number, write: boolean) {
  let summe = 0;
  let bei: number | null = null;
  const positionen = reihe.map((r, i) => {
    const p = P.find(x => x.id === r.projektId)!;
    if (r.aktiv) summe += p.kosten;
    const ueber = !r.aktiv ? null : bei === null && summe <= 1_000_000;
    if (r.aktiv && ueber === false && bei === null) bei = i + 1;
    return {
      projektId: p.id, nummer: p.nummer, name: p.name, phase: 'P1', rang: i + 1, aktiv: r.aktiv, startMonat: r.startMonat, startGeplant: '2027-01',
      kosten: p.kosten, kostenKumuliert: r.aktiv ? summe : null, fteMonate: 3, groesse: null, nutzen: 'hoch', risiko: 'tief', strategiebeitrag: 'hoch',
      bewertet: i < 2, ueberWasserlinie: ueber, neu: false,
      warnungen: p.nummer === '2026-003' ? [{ art: 'bedarf_geaendert', text: 'Bedarf geändert am 12.11.2026.' }] : [],
    };
  });
  return {
    id, portfolioId: PF.id, name, stand, version, createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-01T10:00:00Z', beantragtAt: null,
    modell: { id: '00000000-0000-4000-8000-0000000000d1', nummer: 1 }, kostenSichtbar: true, positionen,
    rechnung: {
      wasserlinie: { beiRang: bei, grund: bei ? 'budget' : null, text: null, kapazitaet: null },
      budget: { rahmen: 1_000_000, bedarf: summe },
      engpaesse: [{ rolle: 'pl', quartal: '2027-Q1', monat: '2027-02', bedarf: 2.5, angebot: 2, projekte: 3 }],
      unter: positionen.filter(p => p.ueberWasserlinie === false).length, hinweise: [],
    },
    vorlage: null as unknown, can: { write: write && stand === 'entwurf' },
  };
}

function server(o: { leer?: boolean; write?: boolean; antragA?: boolean } = {}) {
  const write = o.write ?? true;
  const stand = new Map<string, { name: string; stand: string; version: number; reihe: { projektId: string; aktiv: boolean; startMonat: string | null }[]; vorlage: unknown }>();
  if (!o.leer) {
    stand.set(SA, { name: 'A: Ist-Stand', stand: o.antragA ? 'beantragt' : 'entwurf', version: 1, reihe: P.map(p => ({ projektId: p.id, aktiv: true, startMonat: null })), vorlage: null });
    stand.set(SB, { name: 'B: ohne 2', stand: 'entwurf', version: 1, reihe: P.map(p => ({ projektId: p.id, aktiv: p.nummer !== '2026-002', startMonat: null })), vorlage: null });
  }
  const aus = (id: string) => { const x = stand.get(id)!; return { ...rechnen(id, x.name, x.stand, x.reihe, x.version, write), vorlage: x.vorlage }; };
  const puts: { ifMatch: string | null; body: { positionen: { projektId: string }[] } }[] = [];
  const posts: { url: string; body: unknown }[] = [];
  const folgen = new Map<string, { folge: string; begruendung: string }>();
  const ifMatches: (string | null)[] = [];
  let traktandiert = false;
  const entscheid = (id: string) => {
    const x = stand.get(id)!;
    const unter = aus(id).positionen.filter(p => p.ueberWasserlinie === false)
      .map(p => ({ projektId: p.projektId, nummer: p.nummer, name: p.name, phase: p.phase, folge: folgen.get(p.projektId)?.folge ?? null, begruendung: folgen.get(p.projektId)?.begruendung ?? '' }));
    const fehlt = unter.filter(u => !u.folge).map(u => u.nummer);
    const pruefung = [
      ...(fehlt.length ? [`Folgeentscheid fehlt: 1 laufendes Projekt liegt unter der Wasserlinie ohne Antrag zurückstellen, sistieren oder abbrechen (${fehlt.join(', ')}). Ergänze den Folgeentscheid im Szenario.`] : []),
      ...(x.stand !== 'beantragt' ? ['Antrag: nicht gewählt.'] : []),
    ];
    return { szenarioId: id, stand: x.stand, traktandiert, unterWasserlinie: unter, traktandierbar: !pruefung.length, pruefung, can: { write: write && (x.stand === 'entwurf' || x.stand === 'beantragt') } };
  };
  const vergleich = (ids: string[]) => ({
    portfolioId: PF.id,
    projekte: P.map(p => ({ id: p.id, nummer: p.nummer, name: p.name, unterschiedlich: p.nummer === '2026-002' })),
    szenarien: ids.map(id => {
      const s = aus(id);
      return {
        id, name: s.name, stand: s.stand, kosten: 800000, budget: s.rechnung.budget, nutzen: { hoch: 2, tief: 0, grenze: 0, offen: 0 }, risiko: { hoch: 0, tief: 2, grenze: 0, offen: 0 },
        strategiebeitrag: { hoch: 2, mittel: 0, tief: 0, offen: 0 },
        ueber: s.positionen.filter(p => p.ueberWasserlinie).map(p => p.projektId), unter: s.positionen.filter(p => p.ueberWasserlinie === false).map(p => p.projektId),
        wasserlinie: s.rechnung.wasserlinie, engpaesse: s.rechnung.engpaesse,
      };
    }),
    hinweise: [],
  });
  const api = mockIamApi({
    'GET /v1/portfolios': () => json({ items: [PF], nextCursor: null }),
    'GET /v1/codetabellen/ressourcenrolle/werte': () => json({ items: [{ id: 'r1', codetabelle: 'ressourcenrolle', schluessel: 'pl', label: 'Projektleitung', position: 1, aktiv: true }], nextCursor: null }),
    [`GET /v1/portfolios/${PF.id}/szenarien`]: () => json({
      items: [...stand.entries()].filter(([, x]) => x.stand !== 'verworfen').map(([id, x]) => ({ id, name: x.name, stand: x.stand, version: x.version, createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-01T10:00:00Z', beantragtAt: null })),
      can: { write },
    }),
    [`POST /v1/portfolios/${PF.id}/szenarien`]: async req => {
      const body = await req.json() as { name: string };
      posts.push({ url: req.url, body });
      stand.set(SA, { name: body.name, stand: 'entwurf', version: 1, reihe: P.map(p => ({ projektId: p.id, aktiv: true, startMonat: null })), vorlage: null });
      return json(aus(SA), 201);
    },
    'GET /v1/szenarien/vergleich': req => json(vergleich(new URL(req.url).searchParams.get('ids')!.split(','))),
    [`GET /v1/szenarien/${SA}`]: () => json(aus(SA)),
    [`GET /v1/szenarien/${SB}`]: () => json(aus(SB)),
    [`PUT /v1/szenarien/${SA}/positionen`]: async req => {
      const body = await req.json() as { positionen: { projektId: string; aktiv?: boolean; startMonat?: string | null }[] };
      puts.push({ ifMatch: req.headers.get('if-match'), body });
      const x = stand.get(SA)!;
      x.reihe = body.positionen.map(p => ({ projektId: p.projektId, aktiv: p.aktiv ?? true, startMonat: p.startMonat ?? null }));
      x.version++;
      return json(aus(SA));
    },
    [`GET /v1/szenarien/${SA}/entscheid`]: () => json(entscheid(SA)),
    [`GET /v1/szenarien/${SB}/entscheid`]: () => json(entscheid(SB)),
    [`PUT /v1/szenarien/${SA}/folgen`]: async req => {
      ifMatches.push(req.headers.get('if-match'));
      const body = await req.json() as { folgen: { projektId: string; folge: string; begruendung?: string }[] };
      posts.push({ url: req.url, body });
      folgen.clear();
      for (const f of body.folgen) folgen.set(f.projektId, { folge: f.folge, begruendung: f.begruendung ?? '' });
      stand.get(SA)!.version++;
      return json(entscheid(SA));
    },
    [`POST /v1/szenarien/${SA}/traktandieren`]: req => {
      ifMatches.push(req.headers.get('if-match'));
      posts.push({ url: req.url, body: null });
      traktandiert = true;
      stand.get(SA)!.version++;
      return json({ traktandumId: '00000000-0000-4000-8000-0000000000e1', titel: 'Priorisierung Transformation: Szenario «A: Ist-Stand»', antrag: '…' });
    },
    [`POST /v1/szenarien/${SB}/beantragen`]: async req => {
      const body = await req.json() as { vergleich: string[] };
      posts.push({ url: req.url, body });
      const x = stand.get(SB)!;
      x.stand = 'beantragt'; x.version++;
      x.vorlage = { erstelltAt: '2026-11-13T09:00:00Z', vergleich: vergleich([SB, ...body.vergleich]), nichtBewertet: ['2026-003'] };
      return json(aus(SB));
    },
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return { puts, posts, ifMatches };
}

function Page({ initial = {} }: { initial?: SzenarioSearch }) {
  const [search, set] = useState<SzenarioSearch>(initial);
  const setSearch = useCallback<SetSzenarioSearch>(next => set(s => Object.fromEntries(Object.entries({ ...s, ...next }).filter(([, v]) => v !== undefined)) as SzenarioSearch), []);
  return <SzenarioPage search={search} setSearch={setSearch} navigieren={() => {}} />;
}

const reihenfolge = () => within(screen.getByRole('table', { name: TS.liste })).getAllByRole('rowheader').map(h => h.textContent!.slice(0, 8));

describe('Szenarien', () => {
  it('leer (Z2): Hinweis und «Szenario anlegen» kopiert den Ist-Stand (axe ohne Befund)', async () => {
    const s = server({ leer: true });
    const { container } = renderWithIam(<Page />, UE);
    expect(await screen.findByText(TS.leer)).toBeInTheDocument();
    await expectNoAxe(container);
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: TS.anlegen })[0]!);
    const dialog = await screen.findByRole('dialog', { name: TS.anlegen });
    const name = within(dialog).getByLabelText(TS.name);
    expect(name).toHaveValue('Szenario A');
    await user.clear(name);
    await user.click(within(dialog).getByRole('button', { name: TS.anlegen }));
    expect(within(dialog).getByText(TS.nameFehlt)).toBeInTheDocument();
    await user.type(name, 'A: Ist-Stand');
    await user.click(within(dialog).getByRole('button', { name: TS.anlegen }));
    await waitFor(() => expect(s.posts).toHaveLength(1));
    expect(await screen.findByText(TS.banner('A: Ist-Stand'))).toBeInTheDocument();
  });

  it('Rangliste mit Wasserlinie, Regeltext, Engpässen und Warnung am Projekt (axe ohne Befund)', async () => {
    server();
    const { container } = renderWithIam(<Page />, UE);
    const tab = await screen.findByRole('table', { name: TS.liste });
    expect(reihenfolge()).toEqual(['2026-001', '2026-002', '2026-003']);
    // Regel mit Ist-Wert im Hinweis (Stufe vorangestellt) und an der Wasserlinie
    const regel = TS.budget(1_200_000, 1_000_000, 'Transformation', 1);
    expect(screen.getAllByText((_, el) => el?.tagName === 'P' && el.textContent!.endsWith(regel))).toHaveLength(1);
    expect(within(tab).getByText(regel.replace(/\s+/g, ' '))).toBeInTheDocument();
    const zeilen = within(tab).getAllByRole('row');
    expect(zeilen[3]).toHaveTextContent(TS.wasserlinie);
    expect(zeilen[4]).toHaveTextContent(TS.unterWasserlinie);
    expect(within(tab).getByText('Bedarf geändert am 12.11.2026.')).toBeInTheDocument();
    expect(screen.getByText(/Q1 2027: 2,5\sFTE Projektleitung statt höchstens 2,0\sFTE\. Betroffen: 3 Projekte\./)).toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('K5-1: Alt+↓ verschiebt sofort, speichert mit If-Match und sagt den neuen Rang an', async () => {
    const s = server();
    renderWithIam(<Page />, UE);
    await screen.findByRole('table', { name: TS.liste });
    const user = userEvent.setup();
    screen.getByRole('button', { name: TS.runter('2026-001') }).focus();
    const t0 = performance.now();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(reihenfolge()).toEqual(['2026-002', '2026-001', '2026-003']);
    expect(performance.now() - t0).toBeLessThan(200);
    await waitFor(() => expect(s.puts).toHaveLength(1));
    expect(s.puts[0]!.ifMatch).toBe('W/"1"');
    expect(s.puts[0]!.body.positionen.map(p => p.projektId)).toEqual([P[1]!.id, P[0]!.id, P[2]!.id]);
    expect(await screen.findByText(TS.verschoben('2026-001', 2, true))).toBeInTheDocument();
    // Start setzen (Monat) speichert ebenfalls
    const start = screen.getByLabelText(TS.startLabel('2026-003'));
    await user.type(start, '2027-06');
    await waitFor(() => expect(s.puts.length).toBeGreaterThanOrEqual(2));
  });

  it('Gremium liest nur: keine Knöpfe zum Umordnen, Hinweis', async () => {
    server({ write: false });
    renderWithIam(<Page />, GREMIUM);
    await screen.findByRole('table', { name: TS.liste });
    expect(screen.getByText(TS.nurLesen)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TS.runter('2026-001') })).toBeNull();
    expect(screen.queryByRole('button', { name: TS.anlegen })).toBeNull();
  });

  it('Vergleich mit Unterschieden; «Als Antrag wählen» zeigt die Vorlage mit Warnung zur Bewertung (axe ohne Befund)', async () => {
    const s = server();
    const { container } = renderWithIam(<Page initial={{ vergleich: `${SA},${SB}` }} />, UE);
    const tab = await screen.findByRole('table', { name: TS.vergleich });
    expect(within(tab).getAllByRole('columnheader').map(h => h.textContent)).toEqual([TS.kennzahl, `A: Ist-Stand${TS.alsAntrag}`, `B: ohne 2${TS.alsAntrag}`]);
    expect(within(screen.getByRole('table', { name: TS.projekteSeite })).getByText(TS.anders)).toBeInTheDocument();
    await expectNoAxe(container);
    const user = userEvent.setup();
    await user.click(within(tab).getAllByRole('button', { name: TS.alsAntrag })[1]!);
    const dialog = await screen.findByRole('dialog', { name: TS.alsAntragFrage('B: ohne 2') });
    expect(dialog).toHaveTextContent(TS.alsAntragWirkung(2));
    await user.click(within(dialog).getByRole('button', { name: TS.alsAntrag }));
    await waitFor(() => expect(s.posts).toHaveLength(1));
    expect(s.posts[0]!.body).toEqual({ vergleich: [SA] });
    expect(await screen.findByText(TS.nichtBewertet(['2026-003']))).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Entscheidungsvorlage \(Vorschau\)/ })).toBeInTheDocument();
  });

  it('Antrag ans Gremium: Sperre ohne Folgeentscheid, Folgeentscheid speichern, traktandieren (axe ohne Befund)', async () => {
    const s = server({ antragA: true });
    const { container } = renderWithIam(<Page initial={{ s: SA }} />, UE);
    const region = await screen.findByRole('region', { name: TE.folgenTitel });
    const zeile = within(region).getByRole('row', { name: /2026-003/ });
    expect(zeile).toHaveTextContent('P1');
    expect(screen.getByText(/Folgeentscheid fehlt: .*\(2026-003\)\. Ergänze den Folgeentscheid im Szenario\./)).toBeInTheDocument();
    const knopf = screen.getByRole('button', { name: TE.traktandieren });
    expect(knopf).toBeDisabled();
    await expectNoAxe(container);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(TE.folgeLabel('2026-003')), 'sistieren');
    await user.type(screen.getByLabelText(TE.begruendungLabel('2026-003')), 'Budget');
    expect(knopf).toBeDisabled();
    await user.click(screen.getByRole('button', { name: TE.speichern }));
    await waitFor(() => expect(s.posts).toHaveLength(1));
    expect(s.posts[0]!.body).toEqual({ folgen: [{ projektId: P[2]!.id, folge: 'sistieren', begruendung: 'Budget' }] });
    expect(s.ifMatches[0]).toBe('W/"1"');
    const neu = await screen.findByRole('button', { name: TE.traktandieren });
    await waitFor(() => expect(neu).toBeEnabled());
    expect(screen.queryByText(/Folgeentscheid fehlt/)).toBeNull();
    await user.click(neu);
    await waitFor(() => expect(s.posts).toHaveLength(2));
    expect(s.ifMatches[1]).toBe('W/"2"');
    expect(await screen.findByText(TE.traktandiert('Priorisierung Transformation: Szenario «A: Ist-Stand»'))).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: TE.aktualisieren })).toBeInTheDocument();
    expect(screen.getByText(TE.istTraktandiert)).toBeInTheDocument();
  });

  it('Antrag ans Gremium nur lesen (Gremium): Folgeentscheid als Text, kein Traktandieren', async () => {
    server({ write: false, antragA: true });
    renderWithIam(<Page initial={{ s: SA }} />, GREMIUM);
    const region = await screen.findByRole('region', { name: TE.folgenTitel });
    expect(within(region).getByText(TE.offen)).toBeInTheDocument();
    expect(screen.getByText(TE.nurLesen)).toBeInTheDocument();
    expect(screen.queryByLabelText(TE.folgeLabel('2026-003'))).toBeNull();
    expect(screen.queryByRole('button', { name: TE.traktandieren })).toBeNull();
  });
});
