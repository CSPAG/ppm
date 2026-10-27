/**
 * Register in der Projektübersicht (UI-06, AP-E0-6) gegen die nachgebildete API: Meilensteine mit Baseline und Stand,
 * Risiken, Kosten nur mit `finanzen:read` (A-33, ohne Recht keine Anfrage und kein Abschnitt), Abhängigkeiten in beide
 * Richtungen (das andere Projekt nur, wenn sichtbar), Fehler je Abschnitt mit «Erneut versuchen», axe ohne Befund.
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog, Me } from '@vollholz/iam-web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { T } from '../../ui/index.ts';
import { RegisterUebersicht } from './RegisterUebersicht.tsx';
import { TR } from './register-texte.ts';

const ID = '00000000-0000-4000-8000-000000000001';
const kopf = (i: number) => ({ id: `00000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`, projektId: ID, version: 1, createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-01T08:00:00Z', can: { write: false } });
const liste = (items: unknown[]) => json({ items, nextCursor: null, can: { write: false } });

const MEILENSTEINE = [
  { ...kopf(1), phase: 'P1', art: 'meilenstein', text: 'Konzept abgenommen', adressat: '', ziel: '', terminBaseline: '2026-11-30', terminAktuell: '2026-12-15', erreichtAm: null, abnahme: 'gremium', abgenommenAm: null },
  { ...kopf(2), phase: 'P1', art: 'kommunikation', text: 'Info-Anlass', adressat: 'Pflege', ziel: 'Akzeptanz', terminBaseline: null, terminAktuell: '2020-01-10', erreichtAm: null, abnahme: 'keine', abgenommenAm: null },
  { ...kopf(3), phase: 'P0', art: 'lieferergebnis', text: 'Business Case initial', adressat: '', ziel: '', terminBaseline: '2026-09-01', terminAktuell: '2026-09-01', erreichtAm: '2026-08-28', abnahme: 'keine', abgenommenAm: null },
];
const RISIKEN = [
  { ...kopf(4), projektId: ID, portfolioId: null, text: 'Lieferverzug Hardware', wahrscheinlichkeit: 'mittel', auswirkung: 'hoch', massnahme: 'Zweitlieferant', massnahmeStand: 'offen', verantwortlich: '' },
];
const KOSTEN = [
  { ...kopf(5), phase: 'P1', art: 'capex', text: 'Server', lieferant: '', offerte: '', budgetBaseline: 100000, prognose: 120000, ist: null },
  { ...kopf(6), phase: 'P2', art: 'opex', text: 'Lizenzen', lieferant: '', offerte: '', budgetBaseline: null, prognose: 30000, ist: null },
];
const ABHAENGIGKEITEN = [
  { ...kopf(7), zuProjektId: kopf(8).id, richtung: 'ausgehend', text: 'Schnittstelle Labor', ansprechperson: 'L. Brunner', anderesProjekt: { id: kopf(8).id, nummer: '2026-002', name: 'Laborsystem' } },
  { ...kopf(9), projektId: kopf(10).id, zuProjektId: ID, richtung: 'eingehend', text: 'Gemeinsame Daten', ansprechperson: '', anderesProjekt: null },
];

function stub(o: { kosten?: () => Response; meilensteine?: () => Response } = {}) {
  const api = mockIamApi({
    [`GET /v1/projekte/${ID}/meilensteine`]: o.meilensteine ?? (() => liste(MEILENSTEINE)),
    [`GET /v1/projekte/${ID}/risiken`]: () => liste(RISIKEN),
    [`GET /v1/projekte/${ID}/kosten`]: o.kosten ?? (() => liste(KOSTEN)),
    [`GET /v1/projekte/${ID}/abhaengigkeiten`]: () => liste(ABHAENGIGKEITEN),
    [`GET /v1/projekte/${ID}/kpis`]: () => liste([{ ...kopf(11), art: 'klinisch', text: 'Wartezeit', einheit: 'Tage', zielwert: '5' }]),
    [`GET /v1/projekte/${ID}/stakeholder`]: () => liste([]),
    [`GET /v1/projekte/${ID}/ressourcenbedarf`]: () => liste([]),
    [`GET /v1/projekte/${ID}/meldungen`]: () => liste([{ id: kopf(12).id, projektId: ID, stelle: 'dti', text: 'Arbeitsplätze', gemeldetAt: '2026-11-14T09:00:00Z', gemeldetBy: null }]),
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

const PL_ME: Partial<Me> = { roles: [], permissions: ['tenant:read', 'projekt:read', 'finanzen:read'] };
const KT_ME: Partial<Me> = { roles: [], permissions: ['tenant:read', 'projekt:read'] };

afterEach(() => { vi.unstubAllGlobals(); });

describe('Register in der Projektübersicht (UI-06, AP-E0-6)', () => {
  it('Meilensteine mit Termin, Baseline und Stand; Risiken; Kosten nach CAPEX/OPEX; weitere Register', async () => {
    stub();
    const { container } = renderWithIam(<RegisterUebersicht projektId={ID} />, PL_ME);
    const ms = await screen.findByRole('table', { name: TR.meilensteine.tabelle });
    const konzept = within(ms).getByRole('row', { name: /Konzept abgenommen/ });
    expect(within(konzept).getByText(/Baseline/)).toBeInTheDocument();
    expect(within(within(ms).getByRole('row', { name: /Info-Anlass/ })).getByText(TR.meilensteine.ueberfaellig)).toBeInTheDocument();
    expect(within(ms).getByText(/Pflege/)).toBeInTheDocument();
    expect(within(within(ms).getByRole('row', { name: /Business Case/ })).getByText(/^erreicht/)).toBeInTheDocument();

    const ri = await screen.findByRole('table', { name: TR.risiken.tabelle });
    expect(within(ri).getByRole('row', { name: /Lieferverzug/ })).toHaveTextContent('hoch');

    const ko = await screen.findByRole('table', { name: TR.kosten.tabelle });
    const total = within(ko).getByRole('row', { name: /Total/ });
    expect(total).toHaveTextContent(/CHF\s100'000/);
    expect(total).toHaveTextContent(/CHF\s150'000/);
    expect(within(total).getByText(TR.kosten.nichtVerfuegbar)).toBeInTheDocument();

    expect(await screen.findByText(/ICT \(DTI\), gemeldet/)).toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('ohne finanzen:read: keine Anfrage nach Kosten und kein Abschnitt (A-33)', async () => {
    const api = stub({ kosten: () => { throw new Error('Kosten dürfen nicht angefragt werden'); } });
    renderWithIam(<RegisterUebersicht projektId={ID} />, KT_ME);
    await screen.findByRole('table', { name: TR.meilensteine.tabelle });
    expect(screen.queryByRole('heading', { name: TR.kosten.titel })).not.toBeInTheDocument();
    expect(api.calls.some((c: { url: string }) => c.url.includes('/kosten'))).toBe(false);
  });

  it('403 auf Kosten (Recht nur in einem anderen Projekt): Abschnitt entfällt', async () => {
    stub({ kosten: () => json({ type: 'about:blank', title: 'Keine Berechtigung', status: 403 }, 403, { 'content-type': 'application/problem+json' }) });
    renderWithIam(<RegisterUebersicht projektId={ID} />, PL_ME);
    await screen.findByRole('table', { name: TR.risiken.tabelle });
    await screen.findByText(TR.abhaengigkeiten.ausgehend);
    expect(screen.queryByRole('heading', { name: TR.kosten.titel })).not.toBeInTheDocument();
  });

  it('Abhängigkeiten in beide Richtungen; ein unsichtbares Projekt bleibt ungenannt', async () => {
    stub();
    renderWithIam(<RegisterUebersicht projektId={ID} />, KT_ME);
    expect(await screen.findByText(TR.abhaengigkeiten.ausgehend)).toBeInTheDocument();
    expect(screen.getByText('2026-002')).toBeInTheDocument();
    expect(screen.getByText(TR.abhaengigkeiten.eingehend)).toBeInTheDocument();
    expect(screen.getByText(TR.abhaengigkeiten.unsichtbar)).toBeInTheDocument();
  });

  it('leer und Fehler je Abschnitt mit «Erneut versuchen» (Z2, Z5)', async () => {
    let n = 0;
    stub({ meilensteine: () => (n++ === 0 ? json({ title: 'Fehler', status: 500 }, 500) : liste([])) });
    renderWithIam(<RegisterUebersicht projektId={ID} />, KT_ME);
    await userEvent.click(await screen.findByRole('button', { name: T.common.retry }));
    expect(await screen.findByText(TR.meilensteine.leer)).toBeInTheDocument();
  });
});
