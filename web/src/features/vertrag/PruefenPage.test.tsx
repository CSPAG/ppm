/**
 * Quality-Check (UI-12, K2 Schritt 7) gegen die nachgebildete API: Kommentar je Kapitel, «Zurück an die
 * Projektleitung» nur mit Kommentar, «Quality-Check bestätigen» mit If-Match, Hinweis ohne Recht (Z8), axe.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { KAPITEL } from './felder.ts';
import { PruefenPage } from './PruefenPage.tsx';
import { TP } from './PruefenTexte.ts';

const P = '00000000-0000-4000-8000-000000000001';
const V = '00000000-0000-4000-8000-0000000000c1';
const projekt = { id: P, nummer: '2026-014', name: 'Digitale Patientenaufnahme', phase: 'P0', lebenszyklus: 'aktiv' };
const version = { id: V, projektId: P, nummer: '0.1', anlass: 'initial', zielphase: 'P1', stand: 'in_pruefung', baseline: false, baselineAt: null, basisVersionId: null,
  begruendung: '', eingereichtAt: '2026-10-20T08:00:00Z', version: 2, createdAt: '2026-10-20T08:00:00Z', updatedAt: '2026-10-20T08:00:00Z', can: { write: false, einreichen: false } };
const pruefung = (o: Record<string, unknown> = {}) => ({
  versionId: V, nummer: '0.1', stand: 'in_pruefung', version: 2, qualityChecks: [], unterzeichnung: null, can: { qualityCheck: true, unterzeichnen: [] }, ...o,
});

function stub(routes: Parameters<typeof mockIamApi>[0] = {}) {
  const api = mockIamApi({
    'GET /v1/projekte': () => json({ items: [projekt], nextCursor: null }),
    [`GET /v1/projekte/${P}/vertrag`]: () => json({ projektId: P, versionen: [version], entwurf: V, baseline: null, can: { entwerfen: [] } }),
    [`GET /v1/vertragsversionen/${V}/pruefung`]: () => json(pruefung(), 200, { ETag: 'W/"2"' }),
    [`GET /v1/vertragsversionen/${V}/pflichtangaben`]: () => json({ versionId: V, zielphase: 'P1', vollstaendig: true, angaben: [] }),
    ...routes,
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

describe('Quality-Check', () => {
  it('Rückmeldung nur mit Kommentar; Kommentare je Kapitel an den Server', async () => {
    const api = stub({ [`POST /v1/vertragsversionen/${V}/quality-check`]: () => json(pruefung({ stand: 'in_arbeit', version: 3, can: { qualityCheck: false, unterzeichnen: [] } }), 200, { ETag: 'W/"3"' }) });
    const { container } = renderWithIam(<PruefenPage nummer="2026-014" />);
    expect(await screen.findByText(TP.checkPflicht(0))).toBeInTheDocument();
    await expectNoAxe(container);
    await userEvent.click(screen.getByRole('button', { name: TP.zurueckgeben }));
    expect(await screen.findByText(TP.zurueckgebenFehlt)).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);

    await userEvent.type(screen.getByLabelText(TP.kommentar(9, KAPITEL[8]!.titel)), 'Personal in FTE fehlt');
    expect(screen.getByText(TP.kommentareAnzahl(1))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TP.zurueckgeben }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    const post = api.calls.find(c => c.method === 'POST')!;
    expect(post.headers.get('If-Match')).toBe('W/"2"');
    expect(await post.json()).toEqual({ ergebnis: 'rueckmeldung', kommentare: [{ kapitel: 9, text: 'Personal in FTE fehlt' }] });
    expect(await screen.findByText(TP.zurueckgegeben)).toBeInTheDocument();
  });

  it('bestätigen zeigt die Wirkung davor und sendet ohne Kommentare', async () => {
    const api = stub({ [`POST /v1/vertragsversionen/${V}/quality-check`]: () => json(pruefung({ stand: 'zur_unterzeichnung', version: 3, can: { qualityCheck: false, unterzeichnen: [] } }), 200, { ETag: 'W/"3"' }) });
    renderWithIam(<PruefenPage nummer="2026-014" />);
    expect(await screen.findByText(TP.bestaetigenWirkung)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TP.bestaetigen }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    expect(await api.calls.find(c => c.method === 'POST')!.json()).toEqual({ ergebnis: 'bestaetigt' });
    expect(await screen.findByText(TP.bestaetigt)).toBeInTheDocument();
  });

  it('Fehler der Pflichtangaben erscheint als Fehler, nicht als «vollständig» (Z5)', async () => {
    stub({ [`GET /v1/vertragsversionen/${V}/pflichtangaben`]: () => json({ type: 'about:blank', title: 'Interner Fehler', status: 500 }, 500, { 'Content-Type': 'application/problem+json' }) });
    renderWithIam(<PruefenPage nummer="2026-014" />);
    expect(await screen.findByText(`${TP.pflichtangaben} konnte nicht geladen werden.`)).toBeInTheDocument();
    expect(screen.queryByText(TP.checkPflicht(0))).toBeNull();
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument();
  });

  it('ohne Recht nur lesen (Z8)', async () => {
    stub({ [`GET /v1/vertragsversionen/${V}/pruefung`]: () => json(pruefung({ can: { qualityCheck: false, unterzeichnen: [] } }), 200, { ETag: 'W/"2"' }) });
    renderWithIam(<PruefenPage nummer="2026-014" />);
    expect(await screen.findByText(TP.nurUe)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TP.bestaetigen })).not.toBeInTheDocument();
  });

  it('Projektorganisation unvollständig (409): Sperre mit Ausweg', async () => {
    stub({ [`POST /v1/vertragsversionen/${V}/quality-check`]: () => json({ title: 'Konflikt', status: 409, detail: 'Die Projektorganisation ist unvollständig: Es fehlt CTL.' }, 409) });
    renderWithIam(<PruefenPage nummer="2026-014" />);
    await userEvent.click(await screen.findByRole('button', { name: TP.bestaetigen }));
    expect(await screen.findByText(new RegExp(TP.organisationFehlt.slice(0, 40)))).toBeInTheDocument();
  });
});
