/**
 * Feature «Projekte» gegen die nachgebildete API: Meine Projekte (UI-05) mit Zuständen und Filtern in der Adresse,
 * Projektakte mit Kopf, Reitern und Banner im Endzustand, Projektübersicht (UI-06) mit Projektorganisation, Bearbeiten
 * mit Prüfung, Wirkung und Konflikt (412), axe ohne Befund.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog, Me } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { T } from '../../ui/index.ts';
import { MeineProjektePage } from './MeineProjektePage.tsx';
import { ProjektAkte, type Reiter } from './ProjektAkte.tsx';
import { ProjektUebersicht } from './ProjektUebersicht.tsx';
import { validateProjekteSearch, type ProjekteSearch, type SetProjekteSearch } from './search.ts';
import { TP } from './texte.ts';

const ID = '00000000-0000-4000-8000-000000000001';
const SP = '00000000-0000-4000-8000-0000000000a1';
const PL = '00000000-0000-4000-8000-0000000000a2';
const KT = '00000000-0000-4000-8000-0000000000a3';
const projekt = (o: Record<string, unknown> = {}) => ({
  id: ID, nummer: '2026-014', name: 'Digitale Patientenaufnahme', portfolioId: '00000000-0000-4000-8000-0000000000f1',
  portfolio: { schluessel: 'transformation', name: 'Transformation', kategorie: 'A' }, orgEinheitId: null, handlungsfeldId: null,
  handlungsfeld: 'Patientenorientierung', phase: 'P1', phasenmodellId: null, lebenszyklus: 'aktiv', vertraulich: false,
  sponsor: SP, projektleitung: PL, controlling: null, rollen: ['pl'], version: 2, createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-02T08:00:00Z',
  can: { write: true, organisation: true }, ...o,
});
const organisation = (o: Record<string, unknown> = {}) => ({
  version: 1, can: { write: true },
  mitglieder: [{ personId: SP, funktion: 'sp', akv: 'Auftrag' }, { personId: PL, funktion: 'pl', akv: '' }, { personId: KT, funktion: 'kt', akv: 'Fachbereich' }],
  ...o,
});

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

const PL_ME: Partial<Me> = { roles: [], permissions: ['tenant:read', 'projekt:read'] };

function Liste({ initial = {}, onOpen = () => {} }: { initial?: ProjekteSearch; onOpen?(nr: string): void }) {
  const [search, set] = useState<ProjekteSearch>(initial);
  const setSearch = useCallback<SetProjekteSearch>(next => set(s => validateProjekteSearch({ ...s, ...next })), []);
  return <><output data-testid="adresse">{JSON.stringify(search)}</output><MeineProjektePage search={search} setSearch={setSearch} oeffnen={onOpen} /></>;
}

describe('Meine Projekte (UI-05)', () => {
  it('zeigt die Projektzeile mit Nummer, Projektleitung, Phase und eigener Rolle; nur laufende Projekte', async () => {
    const api = stub({ 'GET /v1/projekte': () => json({ items: [projekt()], nextCursor: null }) });
    const { container } = renderWithIam(<Liste />, PL_ME);
    expect(await screen.findByRole('button', { name: '2026-014 Digitale Patientenaufnahme öffnen' })).toBeInTheDocument();
    const zeile = screen.getByRole('row', { name: /2026-014/ });
    expect(within(zeile).getByText('Patientenorientierung')).toBeInTheDocument();
    expect(within(zeile).getByText(TP.funktion.pl)).toBeInTheDocument();
    expect(within(zeile).getByText('P1 Konzept und Planung')).toBeInTheDocument();
    const url = new URL(api.calls.find(c => c.url.includes('/v1/projekte'))!.url);
    expect(url.searchParams.getAll('lebenszyklus')).toEqual(['aktiv', 'sistiert']);
    await expectNoAxe(container);
  });

  it('leer beim ersten Mal erklärt, woher Projekte kommen (Z2); leer durch Filter mit Zurücksetzen (Z3)', async () => {
    stub({ 'GET /v1/projekte': () => json({ items: [], nextCursor: null }) });
    renderWithIam(<Liste />, PL_ME);
    expect(await screen.findByText(TP.leer)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(TP.filter.rolle), 'sponsor');
    expect(await screen.findByText(TP.leerGefiltert)).toBeInTheDocument();
    expect(screen.getByTestId('adresse')).toHaveTextContent('"rolle":"sponsor"');
    await userEvent.click(screen.getAllByRole('button', { name: T.liste.filterZuruecksetzen })[0]!);
    await waitFor(() => expect(screen.getByTestId('adresse')).toHaveTextContent('{}'));
  });

  it('Filter gehen an die API: Rolle als Funktion, Phase, beendete Projekte', async () => {
    const api = stub({ 'GET /v1/projekte': () => json({ items: [], nextCursor: null }) });
    renderWithIam(<Liste initial={{ rolle: 'projektleitung', phase: 'P2', stand: 'beendet' }} />, PL_ME);
    await screen.findByText(TP.leerGefiltert);
    const url = new URL(api.calls.find(c => c.url.includes('/v1/projekte'))!.url);
    expect([url.searchParams.get('rolle'), url.searchParams.get('phase'), url.searchParams.getAll('lebenszyklus')])
      .toEqual(['pl', 'P2', ['abgebrochen', 'abgeschlossen', 'zurueckgezogen']]);
  });

  it('Zeile öffnet die Schublade, von dort in die Projektakte', async () => {
    const onOpen = vi.fn();
    stub({ 'GET /v1/projekte': () => json({ items: [projekt()], nextCursor: null }) });
    renderWithIam(<Liste onOpen={onOpen} />, PL_ME);
    await userEvent.click(await screen.findByRole('button', { name: '2026-014 Digitale Patientenaufnahme öffnen' }));
    const drawer = await screen.findByRole('dialog', { name: '2026-014 · Digitale Patientenaufnahme' });
    expect(screen.getByTestId('adresse')).toHaveTextContent('"o":"2026-014"');
    await userEvent.click(within(drawer).getByRole('button', { name: TP.oeffnen }));
    expect(onOpen).toHaveBeenCalledWith('2026-014');
  });

  it('Fehler der API mit erneut versuchen (Z5)', async () => {
    let n = 0;
    stub({ 'GET /v1/projekte': () => (n++ === 0 ? json({ title: 'Dienst nicht verfügbar', status: 503 }, 503) : json({ items: [projekt()], nextCursor: null })) });
    renderWithIam(<Liste />, PL_ME);
    await userEvent.click(await screen.findByRole('button', { name: T.common.retry }));
    expect(await screen.findByRole('button', { name: /2026-014/ })).toBeInTheDocument();
  });
});

describe('Projektakte und Projektübersicht (UI-06)', () => {
  const akte = (reiter: Reiter[] = [{ pfad: '', label: TP.akte.uebersicht }]) => (
    <ProjektAkte nummer="2026-014" reiter={reiter}><ProjektUebersicht nummer="2026-014" /></ProjektAkte>
  );

  it('Kopf, Phasenleiste und Projektorganisation; Reiter erst ab zwei', async () => {
    stub({
      'GET /v1/projekte': () => json({ items: [projekt()], nextCursor: null }),
      [`GET /v1/projekte/${ID}/organisation`]: () => json(organisation(), 200, { ETag: 'W/"1"' }),
    });
    const { container } = renderWithIam(akte(), PL_ME);
    expect(await screen.findByRole('heading', { level: 1, name: '2026-014 Digitale Patientenaufnahme' })).toBeInTheDocument();
    const phasen = screen.getByRole('list', { name: TP.uebersicht.phasen });
    expect(within(phasen).getAllByRole('listitem').map(li => li.getAttribute('aria-current'))).toEqual([null, 'step', null, null, null]);
    expect(await screen.findByText(TP.funktionLang.kt)).toBeInTheDocument();
    expect(screen.getByText(/Fachbereich/)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: TP.akte.reiter })).not.toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('weitere Reiter der Pakete erscheinen mit Recht', async () => {
    stub({
      'GET /v1/projekte': () => json({ items: [projekt()], nextCursor: null }),
      [`GET /v1/projekte/${ID}/organisation`]: () => json(organisation()),
    });
    renderWithIam(akte([{ pfad: '', label: TP.akte.uebersicht }, { pfad: 'bericht', label: 'Bericht', recht: 'projekt:read' }, { pfad: 'vertrag', label: 'Vertrag', recht: 'vertrag:write' }]), PL_ME);
    const nav = await screen.findByRole('navigation', { name: TP.akte.reiter });
    expect(within(nav).getAllByRole('link').map(a => a.textContent)).toEqual([TP.akte.uebersicht, 'Bericht']);
  });

  it('unbekannt oder ohne Zugriff: dieselbe Meldung (Z10)', async () => {
    stub({ 'GET /v1/projekte': () => json({ items: [], nextCursor: null }) });
    renderWithIam(akte(), PL_ME);
    expect(await screen.findByText(TP.akte.nichtGefunden)).toBeInTheDocument();
  });

  it('Endzustand: Banner, nur lesen (Z8, Z9)', async () => {
    stub({
      'GET /v1/projekte': () => json({ items: [projekt({ lebenszyklus: 'abgeschlossen', can: { write: false, organisation: false } })], nextCursor: null }),
      [`GET /v1/projekte/${ID}/organisation`]: () => json(organisation({ can: { write: false } })),
    });
    renderWithIam(akte(), PL_ME);
    expect(await screen.findByText(TP.akte.beendet('abgeschlossen'))).toBeInTheDocument();
    await screen.findByText(TP.funktionLang.kt);
    expect(screen.queryByRole('button', { name: TP.org.bearbeiten })).not.toBeInTheDocument();
  });

  it('Projektorganisation bearbeiten: Prüfung am Feld, Wirkung, Konflikt (412) mit neu laden, Speichern mit If-Match', async () => {
    let version = 1;
    const api = stub({
      'GET /v1/projekte': () => json({ items: [projekt()], nextCursor: null }),
      [`GET /v1/projekte/${ID}/organisation`]: () => json(organisation({ version }), 200, { ETag: `W/"${version}"` }),
      [`PUT /v1/projekte/${ID}/organisation`]: req => (req.headers.get('If-Match') === 'W/"1"'
        ? json({ title: 'Version passt nicht', status: 412 }, 412)
        : json(organisation({ version: 3 }), 200, { ETag: 'W/"3"' })),
    });
    renderWithIam(akte(), PL_ME);
    await userEvent.click(await screen.findByRole('button', { name: TP.org.bearbeiten }));
    const drawer = await screen.findByRole('dialog', { name: TP.org.bearbeiten });
    // Kernteam → Projektleitung: zwei Projektleitungen sind gesperrt
    const funktionen = within(drawer).getAllByLabelText(TP.org.funktion);
    await userEvent.selectOptions(funktionen[2]!, 'pl');
    await userEvent.click(within(drawer).getByRole('button', { name: T.common.save }));
    expect(await within(drawer).findByText(TP.org.einzeln(TP.funktion.pl))).toBeInTheDocument();
    expect(funktionen[2]).toHaveFocus();
    expect(api.calls.some(c => c.method === 'PUT')).toBe(false);
    // Kernteam entfernen: die Wirkung nennt, wer die Rolle verliert
    await userEvent.click(within(drawer).getByRole('button', { name: TP.org.entfernen(3) }));
    expect(within(drawer).getByText(new RegExp(TP.org.verlieren))).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('button', { name: T.common.save }));
    expect(await within(drawer).findByText(TP.org.konflikt)).toBeInTheDocument();
    version = 2;
    await userEvent.click(within(drawer).getByRole('button', { name: T.common.reload }));
    await waitFor(() => expect(within(drawer).queryByText(TP.org.konflikt)).not.toBeInTheDocument());
    await userEvent.click(within(drawer).getByRole('button', { name: T.common.save }));
    expect(await screen.findByText(TP.org.gespeichert)).toBeInTheDocument();
    const puts = api.calls.filter(c => c.method === 'PUT');
    expect(puts.map(c => c.headers.get('If-Match'))).toEqual(['W/"1"', 'W/"2"']);
    expect(await puts[1]!.json()).toEqual({ mitglieder: [{ personId: SP, funktion: 'sp', akv: 'Auftrag' }, { personId: PL, funktion: 'pl', akv: '' }] });
  });
});
