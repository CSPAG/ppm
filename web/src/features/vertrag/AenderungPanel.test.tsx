/**
 * Änderungsantrag in der Projektakte (UI-09, K2 Schritte 1, 5, 6; UC-007 Schritte 1–3): «Änderung beantragen» nur mit
 * Begründung; Seitenpanel mit Hauptänderungen (umformulieren mit If-Match) und «Änderung einreichen» mit Wirkung davor.
 */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { AenderungBeantragen, AenderungPanel } from './AenderungPanel.tsx';
import { TA } from './AenderungTexte.ts';
import type { Version } from './api.ts';

const P = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-0000000000b1';
const V = '00000000-0000-4000-8000-0000000000c2';

const version = { id: V, projektId: P, nummer: '1.1', anlass: 'aenderung', zielphase: 'P1', stand: 'in_arbeit', baseline: false, baselineAt: null, basisVersionId: B,
  begruendung: 'Lizenzkosten gestiegen', eingereichtAt: null, version: 3, createdAt: '2026-10-20T08:00:00Z', updatedAt: '2026-10-27T08:00:00Z', can: { write: true, einreichen: false } } as Version;
const aenderung = (stand = 'in_arbeit', v = 3) => ({
  versionId: V, projektId: P, nummer: '1.1', basisVersionId: B, basisNummer: '1.0', stand, begruendung: 'Lizenzkosten gestiegen', eingereichtAt: null, version: v, entscheid: null,
  wirkung: { prat: true, dimensionen: ['budget'], kapitel: [9], hinweis: 'x' }, can: { einreichen: stand === 'in_arbeit', freigeben: false, ablehnen: false, anPrat: false },
});
const haupt = (o: { text?: string | null; v?: number } = {}) => ({
  versionId: V, basisVersionId: B, andere: '', version: o.v ?? 3, can: { write: true },
  rubriken: ['scope', 'zeitplan', 'ressourcen_budget', 'annahmen', 'key_risiken'].map(r => ({
    rubrik: r, label: r, erzeugt: r === 'zeitplan' ? ['Meilenstein «Go-live»: Termin 1.6.2027 statt 1.3.2027'] : [], text: r === 'zeitplan' ? o.text ?? null : null,
  })),
});

function stub(routes: Parameters<typeof mockIamApi>[0] = {}) {
  const api = mockIamApi({
    [`GET /v1/projekte/${P}/vertrag`]: () => json({ projektId: P, versionen: [], entwurf: null, baseline: B, can: { entwerfen: ['aenderung'] } }),
    [`GET /v1/vertragsversionen/${V}/aenderung`]: () => json(aenderung(), 200, { ETag: 'W/"3"' }),
    [`GET /v1/vertragsversionen/${V}/hauptaenderungen`]: () => json(haupt(), 200, { ETag: 'W/"3"' }),
    ...routes,
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

describe('Änderungsantrag der Projektleitung', () => {
  it('«Änderung beantragen» verlangt eine Begründung und legt den Entwurf an (UC-007 Schritt 1)', async () => {
    const api = stub({
      [`POST /v1/projekte/${P}/vertrag/entwuerfe`]: () => json({ version: { ...version }, kapitel: [] }, 201, { ETag: 'W/"1"' }),
    });
    const onAngelegt = vi.fn();
    renderWithIam(<AenderungBeantragen projektId={P} onAngelegt={onAngelegt} />);
    await userEvent.click(await screen.findByRole('button', { name: TA.beantragen }));
    await userEvent.click(screen.getByRole('button', { name: TA.anlegen }));
    expect(await screen.findByText(TA.begruendungFehlt)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(TA.begruendung), 'Lizenzkosten gestiegen');
    await userEvent.click(screen.getByRole('button', { name: TA.anlegen }));
    await vi.waitFor(() => expect(onAngelegt).toHaveBeenCalled());
    expect(await api.calls.find(c => c.method === 'POST')!.json()).toEqual({ anlass: 'aenderung', begruendung: 'Lizenzkosten gestiegen' });
  });

  it('Seitenpanel: Hauptänderungen umformulieren und «Änderung einreichen» mit Wirkung davor', async () => {
    const api = stub({
      [`PUT /v1/vertragsversionen/${V}/hauptaenderungen`]: () => json(haupt({ text: 'Go-live drei Monate später', v: 4 }), 200, { ETag: 'W/"4"' }),
      [`POST /v1/vertragsversionen/${V}/aenderung/einreichen`]: () => json(aenderung('in_pruefung', 5), 200, { ETag: 'W/"5"' }),
    });
    const { container } = renderWithIam(<AenderungPanel projektId={P} nummer="2026-014" version={version} speichern={async () => true} />);
    expect(await screen.findByText('Meilenstein «Go-live»: Termin 1.6.2027 statt 1.3.2027')).toBeInTheDocument();
    expect(screen.getByText(TA.wirkungPrat)).toBeInTheDocument();
    await expectNoAxe(container);

    await userEvent.click(screen.getByRole('button', { name: TA.umformulieren(TA.hauptaenderungen) }));
    const feld = screen.getByLabelText(TA.rubrik.zeitplan);
    await userEvent.clear(feld);
    await userEvent.type(feld, 'Go-live drei Monate später');
    await userEvent.click(screen.getByRole('button', { name: TA.speichern }));
    expect(await screen.findByText('Go-live drei Monate später')).toBeInTheDocument();
    const put = api.calls.find(c => c.method === 'PUT')!;
    expect(put.headers.get('If-Match')).toBe('W/"3"');
    const body = await put.json();
    expect(body.rubriken).toEqual({ scope: null, zeitplan: 'Go-live drei Monate später', ressourcen_budget: null, annahmen: null, key_risiken: null });

    await userEvent.click(screen.getByRole('button', { name: TA.einreichen }));
    expect(await screen.findByText(TA.einreichenWirkung)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: TA.einreichen }).at(-1)!);
    expect(await screen.findByText(TA.eingereicht)).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST' && c.url.endsWith('/aenderung/einreichen'))).toBe(true);
  });
});
