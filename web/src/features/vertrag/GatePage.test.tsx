/**
 * Gate-Modus (UI-08, K2 Schritte 1–4) gegen die nachgebildete API: Entwurf mit Wirkung anlegen (UC-003 Schritt 2),
 * Leitfragen je Wertestrom mit Fortschritt und Warnung, Speichern beim Verlassen mit If-Match (I-R3), «trifft nicht
 * zu» nur mit Begründung, Konflikt (412), Sperre ab «in Prüfung» (Z8), Nutzenprüfung ab P3 (UC-003 A2), axe.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { GatePage } from './GatePage.tsx';
import { TG } from './GateTexte.ts';

const P = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-0000000000b1';
const V = '00000000-0000-4000-8000-0000000000c2';
const F1 = '00000000-0000-4000-8000-0000000000f1';
const F2 = '00000000-0000-4000-8000-0000000000f2';
const K1 = '00000000-0000-4000-8000-0000000000e1';
const projekt = { id: P, nummer: '2026-014', name: 'Digitale Patientenaufnahme', phase: 'P1', lebenszyklus: 'aktiv' };
const version = (o: Record<string, unknown>) => ({
  id: V, projektId: P, nummer: '2.0', anlass: 'gate', zielphase: 'P2', stand: 'in_arbeit', baseline: false, baselineAt: null, basisVersionId: B,
  begruendung: '', eingereichtAt: null, version: 1, createdAt: '2026-10-20T08:00:00Z', updatedAt: '2026-10-20T08:00:00Z', can: { write: true, einreichen: true }, ...o,
});
const baseline = version({ id: B, nummer: '0.1', anlass: 'initial', zielphase: 'P1', stand: 'abgenommen', baseline: true, baselineAt: '2026-03-12T10:00:00Z', basisVersionId: null });
const frage = (id: string, wertestrom: string, text: string, antwort: unknown = null) => ({ id, wertestrom, text, antwort });
function gate(o: Record<string, unknown> = {}) {
  return {
    versionId: V, nummer: '2.0', stand: 'in_arbeit',
    gate: { code: 'P1_P2', label: 'P1–P2', von: 'P1', nach: 'P2' },
    gremienweg: { gremium: { kuerzel: 'prat', name: 'Programmausschuss' }, zusaetzlich: null, viaSns: false },
    leitfragen: [frage(F1, 'nutzen', 'Stimmt das Kosten/Nutzen-Verhältnis?'), frage(F2, 'klinik', 'Ist die Lösung klinisch umsetzbar?')],
    fortschritt: { beantwortet: 0, gesamt: 2 },
    lieferergebnisse: [{ phase: 'P1', art: 'lieferergebnis', text: 'Projektvertrag P2', erreichtAm: '2026-10-01' }, { phase: 'P1', art: 'lieferergebnis', text: 'Business Case', erreichtAm: null }],
    nutzen: null, entscheid: null, can: { antworten: true, nutzen: false }, ...o,
  };
}

function stub(routes: Parameters<typeof mockIamApi>[0] = {}, o: { entwurf?: boolean } = {}) {
  const mitEntwurf = o.entwurf ?? true;
  const api = mockIamApi({
    'GET /v1/projekte': () => json({ items: [projekt], nextCursor: null }),
    [`GET /v1/projekte/${P}/vertrag`]: () => json({
      projektId: P, versionen: mitEntwurf ? [version({}), baseline] : [baseline], entwurf: mitEntwurf ? V : null, baseline: B, can: { entwerfen: mitEntwurf ? [] : ['gate'] },
    }),
    [`GET /v1/vertragsversionen/${V}/gate`]: () => json(gate()),
    [`GET /v1/vertragsversionen/${V}/pflichtangaben`]: () => json({ versionId: V, zielphase: 'P2', vollstaendig: false, angaben: [
      { kapitel: 9, feld: 'personal', text: 'Personal in FTE', quelle: { art: 'gate', code: 'P1_P2' }, erfuellt: false, grund: 'Grösse statt FTE' },
    ] }),
    'GET /v1/codetabellen/wertestrom/werte': () => json({ items: [
      { id: 'w1', codetabelle: 'wertestrom', schluessel: 'nutzen', label: 'Nutzen', position: 0, aktiv: true, version: 1, createdAt: '', createdBy: null, updatedAt: '', updatedBy: null },
      { id: 'w2', codetabelle: 'wertestrom', schluessel: 'klinik', label: 'Klinik', position: 2, aktiv: true, version: 1, createdAt: '', createdBy: null, updatedAt: '', updatedBy: null },
    ], nextCursor: null }),
    ...routes,
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}
const antwort = (text: string, zutreffend = true, version = 1) => ({ text, zutreffend, version, updatedAt: '2026-10-21T09:00:00Z', updatedBy: null });

describe('Gate-Modus', () => {
  it('ohne Entwurf: Wirkung und «Entwurf für Phase P2 anlegen» (UC-003 Schritt 2)', async () => {
    const api = stub({ [`POST /v1/projekte/${P}/vertrag/entwuerfe`]: () => json({ version: version({}), kapitel: [] }, 201, { ETag: 'W/"1"' }) }, { entwurf: false });
    const { container } = renderWithIam(<GatePage nummer="2026-014" />);
    const knopf = await screen.findByRole('button', { name: TG.anlegen('P2') });
    expect(screen.getByText(/Übernimmt Version 0\.1 \(Baseline seit .+\) als Entwurf 2\.0\./)).toBeInTheDocument();
    await expectNoAxe(container);
    await userEvent.click(knopf);
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    expect(await api.calls.find(c => c.method === 'POST')!.json()).toEqual({ anlass: 'gate' });
  });

  it('Leitfragen je Wertestrom; Antwort speichert beim Verlassen mit If-Match; Fortschritt und fehlende Angaben', async () => {
    const api = stub({ [`PUT /v1/vertragsversionen/${V}/gate/leitfragen/${F1}`]: () => json(frage(F1, 'nutzen', 'Stimmt das Kosten/Nutzen-Verhältnis?', antwort('Business Case positiv')), 200, { ETag: 'W/"1"' }) });
    const { container } = renderWithIam(<GatePage nummer="2026-014" />);
    expect(await screen.findByText(TG.leitfragenFortschritt(0, 2))).toBeInTheDocument();
    expect(screen.getByText(TG.unbeantwortet(2, 2, 'Nutzen 1, Klinik 1'))).toBeInTheDocument();
    expect(screen.getByText(TG.zusammenfassung('0 von 2', '1 von 2', 1))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: TG.zurAngabe('Personal in FTE', 9) })).toHaveAttribute('href', '/projekte/2026-014/vertrag?version=entwurf&kapitel=9');
    await expectNoAxe(container);

    const feld = screen.getByLabelText('Stimmt das Kosten/Nutzen-Verhältnis?');
    await userEvent.type(feld, 'Business Case positiv');
    fireEvent.blur(feld);
    await waitFor(() => expect(api.calls.some(c => c.method === 'PUT')).toBe(true));
    const put = api.calls.find(c => c.method === 'PUT')!;
    expect(put.headers.get('If-Match')).toBe('W/"0"');
    expect(await put.json()).toEqual({ antwort: 'Business Case positiv', zutreffend: true });
    expect(await screen.findByText(TG.gespeichert)).toBeInTheDocument();
    expect(screen.getByText(TG.leitfragenFortschritt(1, 2))).toBeInTheDocument();
  });

  it('Fehler der Pflichtangaben erscheint als Fehler mit «Erneut versuchen», nicht als «vollständig» (Z5)', async () => {
    let ok = false;
    stub({ [`GET /v1/vertragsversionen/${V}/pflichtangaben`]: () => ok
      ? json({ versionId: V, zielphase: 'P2', vollstaendig: true, angaben: [] })
      : json({ type: 'about:blank', title: 'Interner Fehler', status: 500 }, 500, { 'Content-Type': 'application/problem+json' }) });
    renderWithIam(<GatePage nummer="2026-014" />);
    expect(await screen.findByText(`${TG.angaben} konnte nicht geladen werden.`)).toBeInTheDocument();
    expect(screen.queryByText(TG.angabenVollstaendig)).toBeNull();
    ok = true;
    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText(TG.angabenVollstaendig)).toBeInTheDocument();
  });

  it('«trifft nicht zu» nur mit Begründung', async () => {
    const api = stub();
    renderWithIam(<GatePage nummer="2026-014" />);
    const box = (await screen.findAllByRole('checkbox', { name: TG.trifftNichtZu }))[1]!;
    await userEvent.click(box);
    expect(await screen.findByText(TG.begruendungFehlt)).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'PUT')).toBe(false);
  });

  it('Konflikt (412): Hinweis mit «Neu laden»', async () => {
    stub({ [`PUT /v1/vertragsversionen/${V}/gate/leitfragen/${F1}`]: () => json({ title: 'Inzwischen geändert', status: 412 }, 412) });
    renderWithIam(<GatePage nummer="2026-014" />);
    const feld = await screen.findByLabelText('Stimmt das Kosten/Nutzen-Verhältnis?');
    await userEvent.type(feld, 'x');
    fireEvent.blur(feld);
    expect(await screen.findByText(TG.konflikt)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TG.neuLaden })).toBeInTheDocument();
  });

  it('in Prüfung: nur lesbar (Z8)', async () => {
    stub({ [`GET /v1/vertragsversionen/${V}/gate`]: () => json(gate({
      stand: 'in_pruefung', can: { antworten: false, nutzen: false },
      leitfragen: [frage(F1, 'nutzen', 'Stimmt das Kosten/Nutzen-Verhältnis?', antwort('Ja')), frage(F2, 'klinik', 'Ist die Lösung klinisch umsetzbar?', antwort('Finanzierung 2027', false))],
      fortschritt: { beantwortet: 2, gesamt: 2 },
    })) });
    renderWithIam(<GatePage nummer="2026-014" />);
    expect(await screen.findByText(TG.gesperrt('in Prüfung'))).toBeInTheDocument();
    expect(screen.getByText(`${TG.trifftNichtZu}: Finanzierung 2027`)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('Nutzenprüfung am Gate P2–P3: Werte je KPI und Beurteilung (UC-003 A2)', async () => {
    const nutzen = { beurteilung: '', werte: [], version: 0, kpis: [{ id: K1, text: 'Wartezeit Aufnahme', einheit: 'min', zielwert: '15' }] };
    const g = gate({ gate: { code: 'P2_P3', label: 'P2–P3', von: 'P2', nach: 'P3' }, can: { antworten: true, nutzen: true }, nutzen });
    const api = stub({
      [`GET /v1/vertragsversionen/${V}/gate`]: () => json(g),
      [`PUT /v1/vertragsversionen/${V}/gate/nutzen`]: () => json({ ...g, nutzen: { ...nutzen, version: 1 } }, 200, { ETag: 'W/"1"' }),
    });
    const { container } = renderWithIam(<GatePage nummer="2026-014" />);
    await userEvent.type(await screen.findByLabelText(`${TG.erreichterWert}: Wartezeit Aufnahme`), '18');
    await userEvent.type(screen.getByLabelText(TG.beurteilung), 'Ziel knapp verfehlt');
    await expectNoAxe(container);
    await userEvent.click(screen.getByRole('button', { name: TG.nutzenSpeichern }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'PUT')).toBe(true));
    const put = api.calls.find(c => c.method === 'PUT')!;
    expect(put.headers.get('If-Match')).toBe('W/"0"');
    expect(await put.json()).toEqual({ beurteilung: 'Ziel knapp verfehlt', werte: [{ kpiId: K1, wert: '18', bemerkung: '' }] });
    expect(await screen.findByText(TG.nutzenGespeichert)).toBeInTheDocument();
  });

  it('Nutzenprüfung mit Konflikt (412): «Neu laden» behält die Werte, gespeichert wird mit der neuen Version (Z7)', async () => {
    const nutzen = { beurteilung: '', werte: [], version: 0, kpis: [{ id: K1, text: 'Wartezeit Aufnahme', einheit: 'min', zielwert: '15' }] };
    let n = 0;
    const g = (v: number) => gate({ gate: { code: 'P2_P3', label: 'P2–P3', von: 'P2', nach: 'P3' }, can: { antworten: true, nutzen: true }, nutzen: { ...nutzen, version: v } });
    const api = stub({
      [`GET /v1/vertragsversionen/${V}/gate`]: () => json(g(n ? 4 : 0)),
      [`PUT /v1/vertragsversionen/${V}/gate/nutzen`]: () => (n++ ? json(g(5)) : json({ title: 'Inzwischen geändert', status: 412 }, 412)),
    });
    renderWithIam(<GatePage nummer="2026-014" />);
    await userEvent.type(await screen.findByLabelText(`${TG.erreichterWert}: Wartezeit Aufnahme`), '18');
    await userEvent.click(screen.getByRole('button', { name: TG.nutzenSpeichern }));
    expect(await screen.findByText(TG.konfliktNutzen)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TG.neuLaden }));
    await waitFor(() => expect(screen.queryByText(TG.konfliktNutzen)).toBeNull());
    expect(screen.getByLabelText(`${TG.erreichterWert}: Wartezeit Aufnahme`)).toHaveValue('18');
    await waitFor(() => expect(api.calls.filter(c => c.url.endsWith('/gate') && c.method === 'GET').length).toBeGreaterThan(1));
    await userEvent.click(screen.getByRole('button', { name: TG.nutzenSpeichern }));
    expect(await screen.findByText(TG.nutzenGespeichert)).toBeInTheDocument();
    expect(api.calls.filter(c => c.method === 'PUT')[1]!.headers.get('If-Match')).toBe('W/"4"');
  });
});
