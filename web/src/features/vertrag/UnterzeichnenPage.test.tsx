/**
 * Unterzeichnen (UI-12, K2 Schritt 8) gegen die nachgebildete API: Zusammenfassung mit «2 von 3», Wirkung vor dem Klick
 * (I-R1 Stufe 3), Abnahme K2-1 (ab der geöffneten Aufgabe 1 Interaktion: «Unterzeichnen»), Vertretung (I-Z2), «Nicht
 * unterzeichnen» mit Pflichtbegründung, Konflikt (412), axe.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { TP } from './PruefenTexte.ts';
import { UnterzeichnenPage } from './UnterzeichnenPage.tsx';

const P = '00000000-0000-4000-8000-000000000001';
const V = '00000000-0000-4000-8000-0000000000c1';
const SP = '00000000-0000-4000-8000-0000000000a1';
const PL = '00000000-0000-4000-8000-0000000000a2';
const CTL = '00000000-0000-4000-8000-0000000000a3';

const projekt = { id: P, nummer: '2026-014', name: 'Digitale Patientenaufnahme', phase: 'P0', lebenszyklus: 'aktiv' };
const version = { id: V, projektId: P, nummer: '0.1', anlass: 'initial', zielphase: 'P1', stand: 'zur_unterzeichnung', baseline: false, baselineAt: null, basisVersionId: null,
  begruendung: '', eingereichtAt: '2026-10-20T08:00:00Z', version: 4, createdAt: '2026-10-20T08:00:00Z', updatedAt: '2026-10-20T08:00:00Z', can: { write: false, einreichen: false } };
const unterschrift = (personId: string, o: Record<string, unknown> = {}) => ({ personId, inVertretungVon: null, ergebnis: 'unterzeichnet', begruendung: '', at: '2026-10-21T09:00:00Z', ...o });
function pruefung(o: { anzahl?: number; offen?: unknown[]; stand?: string; version?: number; sp?: unknown; pl?: unknown; ctl?: unknown } = {}) {
  const fs = [['sp', SP, o.sp ?? null], ['pl', PL, o.pl ?? unterschrift(PL)], ['ctl', CTL, o.ctl ?? unterschrift(CTL)]] as const;
  return {
    versionId: V, nummer: '0.1', stand: o.stand ?? 'zur_unterzeichnung', version: o.version ?? 4,
    qualityChecks: [{ id: 'q1', ergebnis: 'bestaetigt', kommentare: [], at: '2026-10-20T10:00:00Z', personId: PL }],
    unterzeichnung: {
      qualityCheckId: 'q1', anzahl: o.anzahl ?? fs.filter(f => f[2]).length, vollstaendig: fs.every(f => f[2]),
      funktionen: fs.map(([funktion, person, u]) => ({ funktion, personen: [person], unterschrift: u })),
    },
    can: { qualityCheck: false, unterzeichnen: o.offen ?? [{ funktion: 'sp', inVertretungVon: null }] },
  };
}

function stub(routes: Parameters<typeof mockIamApi>[0] = {}) {
  const api = mockIamApi({
    'GET /v1/projekte': () => json({ items: [projekt], nextCursor: null }),
    [`GET /v1/projekte/${P}/vertrag`]: () => json({ projektId: P, versionen: [version], entwurf: V, baseline: null, can: { entwerfen: [] } }),
    [`GET /v1/vertragsversionen/${V}/pruefung`]: () => json(pruefung(), 200, { ETag: 'W/"4"' }),
    ...routes,
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

describe('Unterzeichnen', () => {
  it('zeigt Stand und Wirkung; ein Klick unterzeichnet (K2-1), bestätigt durch den Server', async () => {
    const api = stub({
      [`POST /v1/vertragsversionen/${V}/unterschriften`]: () => json(pruefung({ sp: unterschrift(SP), offen: [], stand: 'unterzeichnet', version: 5 }), 200, { ETag: 'W/"5"' }),
    });
    const { container } = renderWithIam(<UnterzeichnenPage nummer="2026-014" />);
    expect(await screen.findByText(`${TP.unterschriften} · ${TP.stand(2)}`)).toBeInTheDocument();
    expect(screen.getByText(TP.wirkungLetzte)).toBeInTheDocument();
    expect(screen.getByText('Digitale Patientenaufnahme')).toBeInTheDocument();
    await expectNoAxe(container);

    const klicks: string[] = [];
    await userEvent.click(screen.getByRole('button', { name: TP.unterzeichnen }));
    klicks.push('unterzeichnen');
    expect(await screen.findByText(TP.toastVollstaendig)).toBeInTheDocument();
    expect(klicks.length).toBeLessThanOrEqual(3);
    const post = api.calls.find(c => c.method === 'POST')!;
    expect(post.headers.get('If-Match')).toBe('W/"4"');
    expect(await post.json()).toEqual({ ergebnis: 'unterzeichnet' });
    expect(await screen.findByText(TP.vollstaendig)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TP.unterzeichnen })).not.toBeInTheDocument();
  });

  it('nennt, wer danach noch fehlt', async () => {
    stub({ [`GET /v1/vertragsversionen/${V}/pruefung`]: () => json(pruefung({ ctl: null }), 200, { ETag: 'W/"4"' }) });
    renderWithIam(<UnterzeichnenPage nummer="2026-014" />);
    expect(await screen.findByText(TP.wirkungWeitere('CTL'))).toBeInTheDocument();
  });

  it('in Vertretung: Banner (I-Z2)', async () => {
    stub({ [`GET /v1/vertragsversionen/${V}/pruefung`]: () => json(pruefung({ offen: [{ funktion: 'sp', inVertretungVon: SP }] }), 200, { ETag: 'W/"4"' }) });
    renderWithIam(<UnterzeichnenPage nummer="2026-014" />);
    expect(await screen.findByText(TP.vertretungBanner)).toBeInTheDocument();
  });

  it('nicht unterzeichnen nur mit Begründung', async () => {
    const api = stub({
      [`POST /v1/vertragsversionen/${V}/unterschriften`]: () => json(pruefung({ sp: unterschrift(SP, { ergebnis: 'verweigert', begruendung: 'Kosten fehlen' }), offen: [], stand: 'in_arbeit' }), 200, { ETag: 'W/"5"' }),
    });
    renderWithIam(<UnterzeichnenPage nummer="2026-014" />);
    await userEvent.click(await screen.findByRole('button', { name: TP.nichtUnterzeichnen }));
    const dialog = await screen.findByRole('dialog', { name: TP.nichtFrage });
    await expectNoAxe(dialog);
    await userEvent.click(screen.getAllByRole('button', { name: TP.nichtUnterzeichnen }).at(-1)!);
    expect(await screen.findByText(TP.begruendungFehlt)).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
    await userEvent.type(screen.getByLabelText(TP.begruendung), 'Kosten fehlen');
    await userEvent.click(screen.getAllByRole('button', { name: TP.nichtUnterzeichnen }).at(-1)!);
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    expect(await api.calls.find(c => c.method === 'POST')!.json()).toEqual({ ergebnis: 'verweigert', begruendung: 'Kosten fehlen' });
    expect(await screen.findByText(TP.toastNicht)).toBeInTheDocument();
  });

  it('Konflikt (412): Hinweis statt Unterschrift', async () => {
    stub({ [`POST /v1/vertragsversionen/${V}/unterschriften`]: () => json({ title: 'Inzwischen geändert', status: 412 }, 412) });
    renderWithIam(<UnterzeichnenPage nummer="2026-014" />);
    await userEvent.click(await screen.findByRole('button', { name: TP.unterzeichnen }));
    expect(await screen.findByText(TP.konflikt)).toBeInTheDocument();
  });

  it('ohne offene Unterschrift keine Schaltfläche', async () => {
    stub({ [`GET /v1/vertragsversionen/${V}/pruefung`]: () => json(pruefung({ offen: [] }), 200, { ETag: 'W/"4"' }) });
    renderWithIam(<UnterzeichnenPage nummer="2026-014" />);
    expect(await screen.findByText(TP.keineOffene)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TP.unterzeichnen })).not.toBeInTheDocument();
  });
});
