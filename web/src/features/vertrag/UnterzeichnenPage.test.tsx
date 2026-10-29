/**
 * Unterzeichnen (UI-12, K2 Schritt 8) gegen die nachgebildete API: Zusammenfassung mit «1 von 2», Wirkung vor dem Klick
 * (I-R1 Stufe 3), Abnahme K2-1 (ab der geöffneten Aufgabe 1 Interaktion: «Unterzeichnen»), Vertretung (I-Z2), «Nicht
 * unterzeichnen» mit Pflichtbegründung, Konflikt (412), axe.
 */
import { screen, waitFor, within } from '@testing-library/react';
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

const projekt = { id: P, nummer: '2026-014', name: 'Digitale Patientenaufnahme', phase: 'P0', lebenszyklus: 'aktiv' };
const version = { id: V, projektId: P, nummer: '0.1', anlass: 'initial', zielphase: 'P1', stand: 'zur_unterzeichnung', baseline: false, baselineAt: null, basisVersionId: null,
  begruendung: '', eingereichtAt: '2026-10-20T08:00:00Z', version: 4, createdAt: '2026-10-20T08:00:00Z', updatedAt: '2026-10-20T08:00:00Z', can: { write: false, einreichen: false } };
const unterschrift = (personId: string, o: Record<string, unknown> = {}) => ({ personId, inVertretungVon: null, ergebnis: 'unterzeichnet', begruendung: '', at: '2026-10-21T09:00:00Z', ...o });
function pruefung(o: { anzahl?: number; offen?: unknown[]; stand?: string; version?: number; sp?: unknown; pl?: unknown } = {}) {
  const fs = [['sp', SP, o.sp ?? null], ['pl', PL, 'pl' in o ? o.pl : unterschrift(PL)]] as const;
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
    expect(await screen.findByText(`${TP.unterschriften} · ${TP.stand(1, 2)}`)).toBeInTheDocument();
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
    stub({ [`GET /v1/vertragsversionen/${V}/pruefung`]: () => json(pruefung({ pl: null }), 200, { ETag: 'W/"4"' }) });
    renderWithIam(<UnterzeichnenPage nummer="2026-014" />);
    expect(await screen.findByText(TP.wirkungWeitere('Projektleitung'))).toBeInTheDocument();
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

  it('Konflikt (412): Hinweis mit «Neu laden»; danach mit dem neuen Stand unterzeichnen (Z7)', async () => {
    let n = 0;
    const api = stub({
      [`GET /v1/vertragsversionen/${V}/pruefung`]: () => json(pruefung(), 200, { ETag: n ? 'W/"5"' : 'W/"4"' }),
      [`POST /v1/vertragsversionen/${V}/unterschriften`]: () => (n++ ? json(pruefung(), 200, { ETag: 'W/"6"' }) : json({ title: 'Inzwischen geändert', status: 412 }, 412)),
    });
    renderWithIam(<UnterzeichnenPage nummer="2026-014" />);
    await userEvent.click(await screen.findByRole('button', { name: TP.unterzeichnen }));
    expect(await screen.findByText(TP.konfliktUnterzeichnen)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TP.neuLaden }));
    await waitFor(() => expect(screen.queryByText(TP.konfliktUnterzeichnen)).toBeNull());
    await waitFor(() => expect(api.calls.filter(c => c.url.endsWith('/pruefung')).length).toBeGreaterThan(1));
    await userEvent.click(screen.getByRole('button', { name: TP.unterzeichnen }));
    await waitFor(() => expect(api.calls.filter(c => c.method === 'POST')).toHaveLength(2));
    expect(api.calls.filter(c => c.method === 'POST')[1]!.headers.get('If-Match')).toBe('W/"5"');
  });

  it('Konflikt (412) bei «Nicht unterzeichnen»: Hinweis im Dialog, die Begründung bleibt, danach mit neuem Stand (Z7)', async () => {
    let n = 0;
    const api = stub({
      [`GET /v1/vertragsversionen/${V}/pruefung`]: () => json(pruefung(), 200, { ETag: n ? 'W/"5"' : 'W/"4"' }),
      [`POST /v1/vertragsversionen/${V}/unterschriften`]: () => (n++ ? json(pruefung(), 200, { ETag: 'W/"6"' }) : json({ title: 'Inzwischen geändert', status: 412 }, 412)),
    });
    renderWithIam(<UnterzeichnenPage nummer="2026-014" />);
    await userEvent.click(await screen.findByRole('button', { name: TP.nichtUnterzeichnen }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(TP.begruendung), 'Kosten fehlen');
    await userEvent.click(within(dialog).getByRole('button', { name: TP.nichtUnterzeichnen }));
    expect(await within(dialog).findByText(TP.konfliktUnterzeichnen)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: TP.nichtUnterzeichnen })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('button', { name: TP.neuLaden }));
    await waitFor(() => expect(within(dialog).queryByText(TP.konfliktUnterzeichnen)).toBeNull());
    expect(within(dialog).getByLabelText(TP.begruendung)).toHaveValue('Kosten fehlen');
    await userEvent.click(within(dialog).getByRole('button', { name: TP.nichtUnterzeichnen }));
    await waitFor(() => expect(api.calls.filter(c => c.method === 'POST')).toHaveLength(2));
    expect(api.calls.filter(c => c.method === 'POST')[1]!.headers.get('If-Match')).toBe('W/"5"');
  });

  it('Neuladen scheitert: die Seite bleibt mit dem Hinweis stehen (Z5, Z7)', async () => {
    let n = 0;
    stub({
      [`GET /v1/vertragsversionen/${V}/pruefung`]: () => (n ? json({ title: 'Nicht erreichbar', status: 503 }, 503, { 'Content-Type': 'application/problem+json' }) : json(pruefung(), 200, { ETag: 'W/"4"' })),
      [`POST /v1/vertragsversionen/${V}/unterschriften`]: () => { n++; return json({ title: 'Inzwischen geändert', status: 412 }, 412); },
    });
    renderWithIam(<UnterzeichnenPage nummer="2026-014" />);
    await userEvent.click(await screen.findByRole('button', { name: TP.unterzeichnen }));
    await userEvent.click(await screen.findByRole('button', { name: TP.neuLaden }));
    await new Promise(r => setTimeout(r, 300));
    expect(screen.getByText(TP.konfliktUnterzeichnen)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TP.unterzeichnen })).toBeDisabled();
  });

  it('ohne offene Unterschrift keine Schaltfläche', async () => {
    stub({ [`GET /v1/vertragsversionen/${V}/pruefung`]: () => json(pruefung({ offen: [] }), 200, { ETag: 'W/"4"' }) });
    renderWithIam(<UnterzeichnenPage nummer="2026-014" />);
    expect(await screen.findByText(TP.keineOffene)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TP.unterzeichnen })).not.toBeInTheDocument();
  });
});
