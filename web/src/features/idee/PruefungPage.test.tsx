/**
 * Ideenpool und Prüfung (AP-E4-2, K4) gegen die nachgebildete API: Pool mit Stand und Wartezeit, Funnel mit Listen-
 * Alternative; Prüfansicht mit Leitfragen, Raster (PUT mit If-Match, Vorschlag mit Herleitung), Hinweis bei abweichender
 * Kategorie, Zurückweisen nur mit Begründung, Zusammenführen aus den ähnlichen Ideen, Lesemodus ohne `idee:write`.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import type { AppPermission } from '../../auth/permissions.ts';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { IdeePage } from './IdeeSeiten.tsx';
import { IdeenBereich } from './PoolSeite.tsx';
import { TP } from './PruefungTexte.ts';
import { TI } from './texte.ts';

const ID = '00000000-0000-4000-8000-0000000000a1';
const ID2 = '00000000-0000-4000-8000-0000000000a2';
const HF = '00000000-0000-4000-8000-0000000000f1';
const AS = '00000000-0000-4000-8000-0000000000e1';
const PA = '00000000-0000-4000-8000-0000000000c1';
const UE: AppPermission[] = ['tenant:read', 'stammdaten:read', 'phasenmodell:read', 'portfolio:read', 'idee:create', 'idee:read', 'idee:write'];
const ALS_UE = { roles: ['ue'], permissions: UE };
const ALS_GREMIUM = { roles: ['gremium'], permissions: ['tenant:read', 'stammdaten:read', 'phasenmodell:read', 'portfolio:read', 'idee:read'] as AppPermission[] };

const auswahl = { handlungsfelder: [{ id: HF, label: 'Patientenorientierung', leitsatz: '', ziele: [] }], bereiche: [], herkunft: [] };
const zeile = (o: Record<string, unknown> = {}) => ({
  id: ID, nummer: 7, titel: 'Digitale Aufnahme', stand: 'eingereicht', standAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), eingereichtAt: '2026-10-01T08:00:00Z',
  erfasstVon: AS, handlungsfeldId: HF, bereiche: [], herkunft: null, kategorie: null, rueckfragenOffen: 0, ...o,
});
const idee = (o: Record<string, unknown> = {}) => ({
  id: ID, nummer: 7, stand: 'in_pruefung', standAt: '2026-10-03T08:00:00Z', eingereichtAt: '2026-10-01T08:00:00Z', erfasstVon: AS, eigene: false,
  titel: 'Digitale Aufnahme', ausgangslage: 'Papier', zielsetzung: 'Ohne Papier', handlungsfeldId: HF, strategischesZielId: null, bereiche: [],
  nutzen: 'hoch', nutzenText: '', aufwand: 'mittel', aufwandText: '', relevanz: 'hoch', relevanzText: '', herkunft: null, fuehrendeIdeeId: null,
  begruendung: '', rueckfragen: [], version: 3, createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-03T08:00:00Z',
  can: { bearbeiten: false, einreichen: false, loeschen: false }, ...o,
});
const KRIT = ['relevanz', 'direktionen', 'abhaengigkeiten', 'priorisierung', 'change'];
const pruefung = (o: Record<string, unknown> = {}) => ({
  leitfragen: [{ position: 0, wertestrom: 'nutzen', frage: 'Ist die Idee strategisch relevant?', antwort: '' }],
  vorgesehenerSponsor: null,
  raster: KRIT.map(k => ({ kriterium: k, einschaetzung: k === 'change' ? null : 'hoch' })),
  vorschlag: null, kategorie: null, kategorieBegruendung: '', portfolioId: null, zustaendig: null,
  can: { pruefen: true, abschliessen: true }, ...o,
});

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi({
    'GET /v1/ideen/auswahl': () => json(auswahl),
    'GET /v1/portfolios': () => json({ items: [{ id: PA, kategorie: 'A', schluessel: 'a', name: 'Transformation', pflichten: true, orgEinheitId: null, version: 1, createdAt: '', createdBy: null, updatedAt: '', updatedBy: null }], nextCursor: null }),
    ...routes,
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}
const gehe = vi.fn<(p: string) => void>();

describe('Ideenpool', () => {
  it('zeigt eingereichte Ideen mit Stand und Wartezeit; Funnel mit Listen-Alternative', async () => {
    stub({
      'GET /v1/ideen/pool': () => json({ items: [zeile(), zeile({ id: ID2, nummer: 8, titel: 'Ergänzen', stand: 'in_ergaenzung' })], nextCursor: null }),
      'GET /v1/ideen/pool/funnel': () => json({ stufen: [{ stand: 'eingereicht', anzahl: 1 }, { stand: 'in_ergaenzung', anzahl: 1 }], letzteEinreichung: '2026-10-01T08:00:00Z' }),
    });
    const set = vi.fn();
    const { container, unmount } = renderWithIam(<IdeenBereich search={{}} setSearch={set} gehe={gehe} />, ALS_UE);
    expect(await screen.findByRole('heading', { name: TP.pool })).toBeInTheDocument();
    expect((await screen.findAllByText(TP.wartetSeit(3))).length).toBe(2);
    expect(screen.getByText(/wartet auf Antragsteller:in/)).toBeInTheDocument();
    await expectNoAxe(container);
    await userEvent.click(screen.getByRole('button', { name: TP.ansichten.funnel }));
    expect(set).toHaveBeenCalledWith({ ansicht: 'funnel' });
    unmount();
    const funnel = renderWithIam(<IdeenBereich search={{ ansicht: 'funnel' }} setSearch={set} gehe={gehe} />, ALS_UE);
    expect(await screen.findByRole('button', { name: `${TI.stand.eingereicht}: ${TP.anzahl(1)}` })).toBeInTheDocument();
    await expectNoAxe(funnel.container);
  });

  it('leer: «Keine Ideen zu prüfen.» mit Datum der letzten Einreichung', async () => {
    stub({
      'GET /v1/ideen/pool': () => json({ items: [], nextCursor: null }),
      'GET /v1/ideen/pool/funnel': () => json({ stufen: [], letzteEinreichung: '2026-10-01T08:00:00Z' }),
    });
    renderWithIam(<IdeenBereich search={{}} setSearch={vi.fn()} gehe={gehe} />, ALS_UE);
    expect(await screen.findByText(new RegExp(`^${TP.leer}`))).toBeInTheDocument();
  });
});

describe('Idee prüfen', () => {
  const lesen = (i: () => ReturnType<typeof idee>, p: () => ReturnType<typeof pruefung>) => ({
    'GET /v1/ideen': () => json({ items: [{ ...zeile(), stand: i().stand }], nextCursor: null }),
    [`GET /v1/ideen/${ID}`]: () => json(i(), 200, { ETag: `W/"${i().version}"` }),
    [`GET /v1/ideen/${ID}/pruefung`]: () => json(p(), 200, { ETag: `W/"${i().version}"` }),
    [`GET /v1/ideen/${ID}/aehnliche`]: () => json({ items: [{ idee: zeile({ id: ID2, nummer: 8, titel: 'Ähnlich' }), gleichesHandlungsfeld: true, gemeinsameBereiche: 0 }] }),
  });

  it('Raster mit Vorschlag, Hinweis bei abweichender Kategorie, Zuordnen mit If-Match', async () => {
    let p = pruefung();
    const api = stub({
      ...lesen(() => idee(), () => p),
      [`PUT /v1/ideen/${ID}/raster`]: () => { p = pruefung({ raster: KRIT.map(k => ({ kriterium: k, einschaetzung: k === 'change' ? 'mittel' : 'hoch' })), vorschlag: { kategorie: 'A', hoch: 4, mittel: 1, tief: 0 } }); return json(p, 200, { ETag: 'W/"4"' }); },
      [`POST /v1/ideen/${ID}/kategorie`]: () => { p = pruefung({ ...p, kategorie: 'B', portfolioId: PA, zustaendig: { kuerzel: 'glpa', name: 'GLPA' } }); return json(p, 200, { ETag: 'W/"5"' }); },
    });
    const { container } = renderWithIam(<IdeePage nummer={7} search={{}} setSearch={vi.fn()} gehe={gehe} />, ALS_UE);
    expect(await screen.findByText('Ist die Idee strategisch relevant?')).toBeInTheDocument();
    expect(await screen.findByText(TP.aehnlicheHinweis(1, 'Patientenorientierung'), { exact: false })).toBeInTheDocument();
    await expectNoAxe(container);
    await userEvent.click(within(screen.getByRole('radiogroup', { name: TP.kriterien.change })).getByRole('radio', { name: 'mittel' }));
    expect(await screen.findByText(TP.vorschlag({ kategorie: 'A', hoch: 4, mittel: 1, tief: 0 }))).toBeInTheDocument();
    const put = api.calls.find(c => c.method === 'PUT')!;
    expect(put.headers.get('If-Match')).toBe('W/"3"');
    expect(await put.json()).toEqual({ raster: [{ kriterium: 'change', einschaetzung: 'mittel' }] });
    await userEvent.click(screen.getByRole('radio', { name: TP.kategorien.B }));
    expect(screen.getByText(/Sie haben B gewählt; halten Sie den Grund fest/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TP.zuordnen }));
    await waitFor(() => expect(api.calls.some(c => c.url.endsWith('/kategorie'))).toBe(true));
    expect(await screen.findByText(TP.wirkung('B', 'GLPA'), { exact: false })).toBeInTheDocument();
    expect(api.calls.find(c => c.url.endsWith('/kategorie'))!.headers.get('If-Match')).toBe('W/"4"');
  });

  it('Zurückweisen sperrt ohne Begründung und sendet sie danach', async () => {
    const api = stub({ ...lesen(() => idee(), () => pruefung()), [`POST /v1/ideen/${ID}/zurueckweisen`]: () => json(pruefung({ can: { pruefen: false, abschliessen: false } }), 200, { ETag: 'W/"4"' }) });
    renderWithIam(<IdeePage nummer={7} search={{}} setSearch={vi.fn()} gehe={gehe} />, ALS_UE);
    await userEvent.click(await screen.findByRole('button', { name: TP.zurueckweisen }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: TP.zurueckweisen }));
    expect(within(dialog).getByText(TP.begruendungFehlt(TP.person))).toBeInTheDocument();
    expect(api.calls.some(c => c.url.endsWith('/zurueckweisen'))).toBe(false);
    await userEvent.type(within(dialog).getByLabelText(TP.begruendung), 'Kein strategischer Bezug');
    await userEvent.click(within(dialog).getByRole('button', { name: TP.zurueckweisen }));
    await waitFor(() => expect(api.calls.some(c => c.url.endsWith('/zurueckweisen'))).toBe(true));
    expect(await api.calls.find(c => c.url.endsWith('/zurueckweisen'))!.json()).toEqual({ begruendung: 'Kein strategischer Bezug' });
  });

  it('Zusammenführen aus den ähnlichen Ideen: die gewählte führende bleibt, die andere wird geschlossen', async () => {
    const api = stub({
      ...lesen(() => idee(), () => pruefung()),
      [`GET /v1/ideen/${ID2}/pruefung`]: () => json(pruefung(), 200, { ETag: 'W/"2"' }),
      [`POST /v1/ideen/${ID2}/zusammenfuehren`]: () => json(pruefung(), 200),
    });
    renderWithIam(<IdeePage nummer={7} search={{}} setSearch={vi.fn()} gehe={gehe} />, ALS_UE);
    await userEvent.click(await screen.findByRole('button', { name: TP.zusammenfuehrenMit(8) }));
    const dialog = screen.getByRole('dialog', { name: TP.zusammenfuehrenFrage });
    expect(within(dialog).getByText(TP.zusammenfuehrenVorschau(8, 7))).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: TP.zusammenfuehren }));
    await waitFor(() => expect(api.calls.some(c => c.url.endsWith(`${ID2}/zusammenfuehren`))).toBe(true));
    const post = api.calls.find(c => c.url.endsWith(`${ID2}/zusammenfuehren`))!;
    expect(post.headers.get('If-Match')).toBe('W/"2"');
    expect(await post.json()).toEqual({ fuehrendeIdeeId: ID });
  });

  it('Gremium (nur idee:read) sieht die Prüfung lesend, ohne ähnliche Ideen und ohne Aktionen', async () => {
    stub(lesen(() => idee(), () => pruefung({ can: { pruefen: false, abschliessen: false } })));
    const { container } = renderWithIam(<IdeePage nummer={7} search={{}} setSearch={vi.fn()} gehe={gehe} />, ALS_GREMIUM);
    expect(await screen.findByText(TP.nurLesen)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TP.zurueckweisen })).toBeNull();
    expect(screen.queryByRole('heading', { name: TP.aehnliche })).toBeNull();
    await expectNoAxe(container);
  });
});
