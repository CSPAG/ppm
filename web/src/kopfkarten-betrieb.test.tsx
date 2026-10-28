/**
 * Kopfkarten für Finanzen (FI), Ressourcen (RM) und Administration (ADM: Schnittstellen, Zugänge) gegen die nachgebildete
 * API (informationsarchitektur.md «Startseite je Rolle»): Kennzahlen mit Direktaktion; ohne Anlass entfallen die Karten
 * der Administration; axe.
 */
import { screen, within } from '@testing-library/react';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import { FinanzenKopfKarte } from './features/finanzen/FinanzenKopfKarte.tsx';
import { RessourcenKopfKarte } from './features/ressourcen/RessourcenKopfKarte.tsx';
import { SchnittstellenKopfKarte } from './features/schnittstellen/SchnittstellenKopfKarte.tsx';
import { NeubesetzungKopfKarte } from './features/zugang/NeubesetzungKopfKarte.tsx';
import { expectNoAxe } from './test/axe.ts';
import { CATALOG_PPM, renderWithIam } from './test/render.tsx';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const stub = (routes: Parameters<typeof mockIamApi>[0]) => vi.stubGlobal('fetch', mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog }).fetch);
const projekt = (n: number, wesentlich: boolean) => ({ id: uuid(n), nummer: `2026-0${10 + n}`, name: `Projekt ${n}`, abweichung: { betrag: 1000, prozent: 5, wesentlich } });
const schnittstelle = (n: number, stand: string, fehler: string | null = null) => ({ id: uuid(n), name: `ERP ${n}`, letzterLauf: { stand, fehler } });

describe('Kopfkarten Finanzen, Ressourcen, Administration', () => {
  it('Finanzen: Prognose bei Budget, Projekte über der Toleranz mit «Abweichungen klären», Stand der Ist-Kosten (FI)', async () => {
    stub({ 'GET /v1/finanzen': () => json({ portfolio: null, projekte: [projekt(1, true), projekt(2, false), projekt(3, true)], summe: { budget: 12_000_000, prognose: 12_600_000, ist: 4_000_000, abweichung: 600_000 }, istStand: '2026-09', ohneProjekt: 0, can: {} }) });
    const { container } = renderWithIam(<article><FinanzenKopfKarte /></article>);
    expect(await screen.findByRole('heading', { name: 'Finanzen' })).toBeInTheDocument();
    expect(screen.getByText(/^Prognose .* bei Budget /)).toBeInTheDocument();
    expect(screen.getByText('2 Projekte über der Toleranz · Ist-Kosten bis September 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abweichungen klären' })).toHaveAttribute('href', '/portfolio/finanzen/abweichungen');
    await expectNoAxe(container);
  });

  it('Ressourcen: offene Bedarfe, Konflikte und Engpässe der nächsten drei Monate mit «Bedarf decken» (RM)', async () => {
    stub({
      'GET /v1/bedarfe': () => json({ items: [], nextCursor: null, anzahl: { offen: 3, teilweise: 1, gedeckt: 5, ungedeckt: 2 }, can: {} }),
      'GET /v1/zuteilungen/konflikte': () => json({ von: '2026-10', bis: '2026-12', items: [{}, {}], prioritaetVorhanden: true, can: {} }),
      'GET /v1/auslastung': () => json({ von: '2026-10', bis: '2026-12', monate: [], szenario: null, rollen: [], projekte: [], engpaesse: [{}] }),
    });
    const { container } = renderWithIam(<article><RessourcenKopfKarte /></article>);
    expect(await screen.findByText('4 offene Bedarfe · 2 ungedeckt · 2 Konflikte')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '1 Engpass in den nächsten drei Monaten' })).toHaveAttribute('href', '/portfolio/ressourcen/auslastung');
    expect(screen.getByRole('link', { name: 'Bedarf decken' })).toHaveAttribute('href', '/portfolio/ressourcen/bedarf');
    await expectNoAxe(container);
  });

  it('Schnittstellen: nur fehlgeschlagene Läufe mit Fehler und Sprung zur Schnittstelle; ohne Fehler entfällt die Karte (ADM)', async () => {
    stub({ 'GET /v1/schnittstellen': () => json({ items: [schnittstelle(1, 'fehlgeschlagen', 'Zeitüberschreitung'), schnittstelle(2, 'erfolgreich')], katalog: [] }) });
    const { container, unmount } = renderWithIam(<article><SchnittstellenKopfKarte /></article>);
    expect(await screen.findByText('1 Lauf fehlgeschlagen')).toBeInTheDocument();
    const z = screen.getAllByRole('listitem');
    expect(z).toHaveLength(1);
    expect(within(z[0]!).getByRole('link', { name: 'Lauf «ERP 1» fehlgeschlagen' })).toHaveAttribute('href', `/administration/schnittstellen?o=${uuid(1)}`);
    expect(within(z[0]!).getByText('Zeitüberschreitung')).toBeInTheDocument();
    await expectNoAxe(container);
    unmount();
    stub({ 'GET /v1/schnittstellen': () => json({ items: [schnittstelle(2, 'erfolgreich')], katalog: [] }) });
    const leer = renderWithIam(<article><SchnittstellenKopfKarte /></article>);
    await vi.waitFor(() => expect(leer.container.querySelector('article')).toBeEmptyDOMElement());
  });

  it('Zugänge: offene Neubesetzungen je Person mit Sprung zur Neubesetzung (ADM)', async () => {
    stub({ 'GET /v1/neubesetzungen': () => json({ items: [
      { id: uuid(7), person: { id: uuid(8), name: 'Anna Muster' }, entzogenAt: '2026-10-20T08:00:00Z', entzogenVon: null, rollen: 3, offeneRollen: 2, erledigt: false },
      { id: uuid(9), person: { id: uuid(10), name: 'Bruno Beispiel' }, entzogenAt: '2026-10-01T08:00:00Z', entzogenVon: null, rollen: 1, offeneRollen: 0, erledigt: true },
    ], nextCursor: null }) });
    renderWithIam(<article><NeubesetzungKopfKarte /></article>);
    expect(await screen.findByText('1 Person mit Rollen zum Neubesetzen')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rollen von Anna Muster neu besetzen' })).toHaveAttribute('href', `/administration/neubesetzungen/${uuid(7)}`);
  });
});
