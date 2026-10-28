/**
 * Änderung entscheiden (UI-09, K2 Schritt 9; UC-007 Schritt 4, A1, A2) gegen die nachgebildete API: Freigabe mit Wirkung
 * davor; eine Änderung an den Kosten kann der SP nicht freigeben, nur an den PRAT unterstützen (K2-Abnahme); Ablehnen mit
 * Pflichtbegründung; axe.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { AenderungPage } from './AenderungPage.tsx';
import { TA } from './AenderungTexte.ts';

const P = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-0000000000b1';
const V = '00000000-0000-4000-8000-0000000000c2';
const HINWEIS = 'Freigabe durch den PRAT: Diese Änderung betrifft Budget und Ressourcen. Du kannst sie unterstützen; entscheiden wird der PRAT.';

const projekt = { id: P, nummer: '2026-014', name: 'Digitale Patientenaufnahme', phase: 'P1', lebenszyklus: 'aktiv' };
const version = (id: string, nummer: string, o: Record<string, unknown> = {}) => ({
  id, projektId: P, nummer, anlass: 'aenderung', zielphase: 'P1', stand: 'in_pruefung', baseline: false, baselineAt: null, basisVersionId: B,
  begruendung: 'Lizenzkosten gestiegen', eingereichtAt: '2026-10-27T08:00:00Z', version: 6, createdAt: '2026-10-20T08:00:00Z', updatedAt: '2026-10-27T08:00:00Z',
  can: { write: false, einreichen: false }, ...o,
});
function aenderung(o: { prat?: boolean; stand?: string; entscheid?: unknown; version?: number } = {}) {
  const prat = o.prat ?? false;
  const offen = (o.stand ?? 'in_pruefung') === 'in_pruefung';
  return {
    versionId: V, projektId: P, nummer: '1.1', basisVersionId: B, basisNummer: '1.0', stand: o.stand ?? 'in_pruefung', begruendung: 'Lizenzkosten gestiegen',
    eingereichtAt: '2026-10-27T08:00:00Z', version: o.version ?? 6, entscheid: o.entscheid ?? null,
    wirkung: prat ? { prat: true, dimensionen: ['budget', 'ressourcen'], kapitel: [9], hinweis: HINWEIS } : { prat: false, dimensionen: [], kapitel: [], hinweis: null },
    can: { einreichen: false, freigeben: offen && !prat, ablehnen: offen, anPrat: offen && prat },
  };
}
const haupt = {
  versionId: V, basisVersionId: B, andere: '', version: 6, can: { write: false },
  rubriken: [
    { rubrik: 'scope', label: 'Scope', erzeugt: [], text: null },
    { rubrik: 'zeitplan', label: 'Zeitplan', erzeugt: [], text: null },
    { rubrik: 'ressourcen_budget', label: 'Ressourcen/Budget', erzeugt: ['Budget P2: CHF 2,40 Mio. statt CHF 2,10 Mio. (+14 %)'], text: null },
    { rubrik: 'annahmen', label: 'Annahmen', erzeugt: [], text: null },
    { rubrik: 'key_risiken', label: 'Key-Risiken', erzeugt: [], text: null },
  ],
};

function stub(a = aenderung(), routes: Parameters<typeof mockIamApi>[0] = {}) {
  const api = mockIamApi({
    'GET /v1/projekte': () => json({ items: [projekt], nextCursor: null }),
    [`GET /v1/projekte/${P}/vertrag`]: () => json({ projektId: P, versionen: [version(V, '1.1'), version(B, '1.0', { anlass: 'initial', stand: 'abgenommen', baseline: true, baselineAt: '2026-09-01T08:00:00Z' })], entwurf: V, baseline: B, can: { entwerfen: [] } }),
    [`GET /v1/vertragsversionen/${V}/aenderung`]: () => json(a, 200, { ETag: `W/"${a.version}"` }),
    [`GET /v1/vertragsversionen/${V}/hauptaenderungen`]: () => json(haupt, 200, { ETag: 'W/"6"' }),
    ...routes,
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

describe('Änderung entscheiden', () => {
  it('Änderung an den Kosten: keine Freigabe, nur «Antrag an den PRAT unterstützen» mit Hinweis (K2-Abnahme)', async () => {
    const api = stub(aenderung({ prat: true }), {
      [`POST /v1/vertragsversionen/${V}/aenderung/entscheiden`]: () => json(aenderung({ prat: true, stand: 'traktandiert', version: 7, entscheid: { ergebnis: 'an_prat', begruendung: '', at: '2026-10-28T08:00:00Z', personId: null } }), 200, { ETag: 'W/"7"' }),
    });
    const { container } = renderWithIam(<AenderungPage nummer="2026-014" />);
    expect(await screen.findByText(HINWEIS)).toBeInTheDocument();
    expect(screen.getByText('Lizenzkosten gestiegen')).toBeInTheDocument();
    expect(await screen.findByText('Budget P2: CHF 2,40 Mio. statt CHF 2,10 Mio. (+14 %)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TA.freigeben })).not.toBeInTheDocument();
    await expectNoAxe(container);

    await userEvent.click(screen.getByRole('button', { name: TA.anPrat }));
    expect(await screen.findByText(TA.toastAnPrat)).toBeInTheDocument();
    const post = api.calls.find(c => c.method === 'POST')!;
    expect(post.headers.get('If-Match')).toBe('W/"6"');
    expect(await post.json()).toEqual({ ergebnis: 'an_prat' });
    expect(await screen.findByText(TA.traktandiert)).toBeInTheDocument();
    // «Ganzen Vertrag ansehen» zeigt genau diese Version, auch nach einem Entscheid
    expect(screen.getByRole('link', { name: TA.ganzerVertrag })).toHaveAttribute('href', `/projekte/2026-014/vertrag?version=${V}`);
  });

  it('ohne Wirkung: «Änderung freigeben» mit Wirkung davor, bestätigt durch den Server', async () => {
    const api = stub(aenderung(), {
      [`POST /v1/vertragsversionen/${V}/aenderung/entscheiden`]: () => json(aenderung({ stand: 'abgenommen', version: 8, entscheid: { ergebnis: 'freigegeben', begruendung: '', at: '2026-10-28T08:00:00Z', personId: null } }), 200, { ETag: 'W/"8"' }),
    });
    renderWithIam(<AenderungPage nummer="2026-014" />);
    expect(await screen.findByText(TA.freigebenWirkung('1.1'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TA.anPrat })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TA.freigeben }));
    expect(await screen.findByText(TA.toastFreigegeben('1.1'))).toBeInTheDocument();
    expect(await api.calls.find(c => c.method === 'POST')!.json()).toEqual({ ergebnis: 'freigegeben' });
  });

  it('Konflikt (412) beim Ablehnen: «Neu laden» im Dialog, die Begründung bleibt, danach mit neuem Stand (Z7)', async () => {
    let n = 0;
    const api = stub(aenderung(), {
      [`GET /v1/vertragsversionen/${V}/aenderung`]: () => json(aenderung({ version: n ? 7 : 6 }), 200, { ETag: n ? 'W/"7"' : 'W/"6"' }),
      [`POST /v1/vertragsversionen/${V}/aenderung/entscheiden`]: () => (n++
        ? json(aenderung({ stand: 'abgelehnt', version: 8, entscheid: { ergebnis: 'abgelehnt', begruendung: 'Nicht im Budget', at: '2026-10-28T08:00:00Z', personId: null } }), 200, { ETag: 'W/"8"' })
        : json({ title: 'Inzwischen geändert', status: 412 }, 412)),
    });
    renderWithIam(<AenderungPage nummer="2026-014" />);
    await userEvent.click(await screen.findByRole('button', { name: TA.ablehnen }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(TA.begruendung), 'Nicht im Budget');
    await userEvent.click(within(dialog).getByRole('button', { name: TA.ablehnen }));
    expect(await within(dialog).findByText(TA.konflikt)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: TA.neuLaden }));
    await waitFor(() => expect(within(dialog).queryByText(TA.konflikt)).toBeNull());
    expect(within(dialog).getByLabelText(TA.begruendung)).toHaveValue('Nicht im Budget');
    await waitFor(() => expect(api.calls.filter(c => c.url.endsWith('/aenderung') && c.method === 'GET').length).toBeGreaterThan(1));
    await userEvent.click(within(dialog).getByRole('button', { name: TA.ablehnen }));
    expect(await screen.findByText(TA.toastAbgelehnt)).toBeInTheDocument();
    expect(api.calls.filter(c => c.method === 'POST')[1]!.headers.get('If-Match')).toBe('W/"7"');
  });

  it('Ablehnen nur mit Begründung (UC-007 A2)', async () => {
    const api = stub(aenderung(), {
      [`POST /v1/vertragsversionen/${V}/aenderung/entscheiden`]: () => json(aenderung({ stand: 'abgelehnt', version: 7, entscheid: { ergebnis: 'abgelehnt', begruendung: 'Nicht im Budget', at: '2026-10-28T08:00:00Z', personId: null } }), 200, { ETag: 'W/"7"' }),
    });
    renderWithIam(<AenderungPage nummer="2026-014" />);
    await userEvent.click(await screen.findByRole('button', { name: TA.ablehnen }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(screen.getAllByRole('button', { name: TA.ablehnen }).at(-1)!);
    expect(await screen.findByText(TA.ablehnenFehlt)).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
    await userEvent.type(screen.getByLabelText(TA.begruendung), 'Nicht im Budget');
    await userEvent.click(screen.getAllByRole('button', { name: TA.ablehnen }).at(-1)!);
    expect(await screen.findByText(TA.toastAbgelehnt)).toBeInTheDocument();
    expect(dialog).not.toBeInTheDocument();
    expect(await api.calls.find(c => c.method === 'POST')!.json()).toEqual({ ergebnis: 'abgelehnt', begruendung: 'Nicht im Budget' });
  });

  it('nicht eingereicht: kein Entscheid möglich', async () => {
    stub(aenderung({ stand: 'in_arbeit' }));
    renderWithIam(<AenderungPage nummer="2026-014" />);
    expect(await screen.findByText(TA.inArbeit)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TA.ablehnen })).not.toBeInTheDocument();
  });
});
