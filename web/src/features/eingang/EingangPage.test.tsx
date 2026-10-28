/**
 * Startseite «Eingang» (UI-01) gegen die nachgebildete API: «Zu tun» nach Frist mit Direktaktion, Vertretungsvermerk,
 * Filter frist, Erledigen von Hand, Mitteilungen, Zustände Z2/Z3/Z5, axe.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { T } from '../../ui/index.ts';
import { EingangPage } from './EingangPage.tsx';
import type { EingangSearch, SetEingangSearch } from './search.ts';
import { E } from './texte.ts';
import type { KopfKarte } from './kopf.ts';

const tag = (n: number) => { const d = new Date(Date.now() + n * 86_400_000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ANNA = { id: '00000000-0000-4000-8000-0000000000aa', name: 'Anna Muster' };

const aufgabe = (o: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-000000000001', art: 'statusbericht.erstellen', titel: 'Statusbericht Oktober erstellen', kontext: '2026-014 · als PL',
  link: '/projekte/2026-014/bericht', frist: tag(3), fristArt: 'kalendertage', bezug: { typ: 'statusbericht', id: 'x' }, empfaenger: 'person',
  vertretung: null, createdAt: '2026-10-18T06:00:00Z', can: { erledigen: false }, ...o,
});
const leer = { 'GET /v1/mitteilungen': () => json({ items: [], nextCursor: null, ungelesen: 0 }), 'GET /v1/stellvertretungen': () => json({ items: [] }) };

function Page({ initial = {}, gehe = () => {}, kopfkarten }: { initial?: EingangSearch; gehe?(p: string): void; kopfkarten?: readonly KopfKarte[] }) {
  const [search, set] = useState<EingangSearch>(initial);
  const setSearch = useCallback<SetEingangSearch>(next => set(s => {
    const m: Record<string, unknown> = { ...s, ...next };
    return Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined)) as EingangSearch;
  }), []);
  return <EingangPage search={search} setSearch={setSearch} gehe={gehe} kopfkarten={kopfkarten} />;
}

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi({ ...leer, ...routes }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

describe('Eingang', () => {
  it('zeigt Kopf und «Zu tun» mit Frist, Kontext, Vertretung und Direktaktion; Öffnen führt zum Link', async () => {
    stub({
      'GET /v1/eingang/anzahl': () => json({ offen: 2, ueberfaellig: 1, naechsteFrist: tag(3) }),
      'GET /v1/eingang': () => json({ items: [
        aufgabe({ id: '00000000-0000-4000-8000-000000000002', titel: 'Projektvertrag unterzeichnen', frist: tag(-2), link: '/projekte/2026-014/vertrag', vertretung: { person: ANNA, bis: tag(5) } }),
        aufgabe(),
      ], nextCursor: null }),
      'GET /v1/stellvertretungen': () => json({ items: [{ id: '00000000-0000-4000-8000-0000000000s1', vertretene: ANNA, vertreter: { id: '00000000-0000-4000-8000-0000000000bb', name: 'Beat' }, von: tag(-1), bis: tag(5), unterschriften: true, aktiv: true, richtung: 'fuer_andere', createdAt: '2026-10-01T00:00:00Z', can: { beenden: false } }] }),
    });
    const gehe = vi.fn();
    const { container } = renderWithIam(<Page gehe={gehe} />);
    expect(await screen.findByText(E.kopf.offen(2))).toBeInTheDocument();
    expect(screen.getByText(`· ${E.kopf.ueberfaellig(1)}`)).toBeInTheDocument();
    expect(await screen.findByText(/Du vertrittst Anna Muster/)).toBeInTheDocument();
    const liste = (await screen.findByRole('link', { name: 'Projektvertrag unterzeichnen' })).closest('ul')!;
    const zeilen = within(liste).getAllByRole('listitem');
    expect(within(zeilen[0]!).getByText(/überfällig seit/)).toBeInTheDocument();
    expect(within(zeilen[0]!).getByText(E.zuTun.inVertretung('Anna Muster'))).toBeInTheDocument();
    expect(within(zeilen[1]!).getByText('2026-014 · als PL')).toBeInTheDocument();
    await userEvent.click(within(zeilen[1]!).getByRole('link', { name: E.zuTun.oeffnenAria('Statusbericht Oktober erstellen') }));
    expect(gehe).toHaveBeenCalledWith('/projekte/2026-014/bericht');
    await expectNoAxe(container);
  });

  it('Kopfkarten der Module erscheinen nach Recht (src/kopfkarten.ts)', async () => {
    stub({ 'GET /v1/eingang/anzahl': () => json({ offen: 0, ueberfaellig: 0, naechsteFrist: null }), 'GET /v1/eingang': () => json({ items: [], nextCursor: null }) });
    const karten: KopfKarte[] = [
      { id: 'mit', recht: 'handlungsfeld:read', Karte: () => <p>Karte mit Recht</p> },
      { id: 'ohne', recht: 'webhook:admin', Karte: () => <p>Karte ohne Recht</p> },
    ];
    renderWithIam(<Page kopfkarten={karten} />);
    expect(await screen.findByText('Karte mit Recht')).toBeInTheDocument();
    expect(screen.queryByText('Karte ohne Recht')).not.toBeInTheDocument();
  });

  it('leer beim ersten Mal und leer durch Filter mit «Filter zurücksetzen»', async () => {
    const api = stub({
      'GET /v1/eingang/anzahl': () => json({ offen: 0, ueberfaellig: 0, naechsteFrist: null }),
      'GET /v1/eingang': () => json({ items: [], nextCursor: null }),
    });
    renderWithIam(<Page initial={{ filter: 'frist' }} />);
    expect(await screen.findByText(E.zuTun.leerFrist)).toBeInTheDocument();
    expect(api.calls.some(c => c.url.includes('filter=frist'))).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: T.liste.filterZuruecksetzen }));
    expect(await screen.findByText(E.zuTun.leer)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: E.zuTun.alle })).toHaveAttribute('aria-pressed', 'true');
  });

  it('erledigt manuelle Aufgaben von Hand', async () => {
    let offen = true;
    const api = stub({
      'GET /v1/eingang/anzahl': () => json({ offen: offen ? 1 : 0, ueberfaellig: 0, naechsteFrist: null }),
      'GET /v1/eingang': () => json({ items: offen ? [aufgabe({ titel: 'Unterlagen lesen', frist: null, fristArt: null, can: { erledigen: true } })] : [], nextCursor: null }),
      'POST /v1/eingang/aufgaben/00000000-0000-4000-8000-000000000001/erledigen': () => { offen = false; return json(aufgabe({ can: { erledigen: false } })); },
      'POST /v1/eingang/aufgaben/00000000-0000-4000-8000-000000000001/wieder-oeffnen': () => { offen = true; return json(aufgabe({ titel: 'Unterlagen lesen', can: { erledigen: true } })); },
    });
    renderWithIam(<Page />);
    await userEvent.click(await screen.findByRole('button', { name: E.zuTun.erledigtAria('Unterlagen lesen') }));
    expect(await screen.findByText(E.zuTun.leer)).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST' && c.headers.get('idempotency-key'))).toBe(true);
    // Rückgängig im Toast öffnet die Aufgabe wieder (I-R1 Stufe 1)
    await userEvent.click(screen.getByRole('button', { name: E.zuTun.rueckgaengig }));
    expect(await screen.findByText(E.zuTun.wiederOffen('Unterlagen lesen'))).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: E.zuTun.erledigtAria('Unterlagen lesen') })).toBeInTheDocument();
  });

  it('Mitteilungen: ungelesen markiert, als gelesen markieren', async () => {
    let gelesen = false;
    stub({
      'GET /v1/eingang/anzahl': () => json({ offen: 0, ueberfaellig: 0, naechsteFrist: null }),
      'GET /v1/eingang': () => json({ items: [], nextCursor: null }),
      'GET /v1/mitteilungen': () => json({ items: [{ id: '00000000-0000-4000-8000-0000000000m1', text: 'Deine Idee wurde zurückgewiesen.', link: null, bezug: { typ: 'idee', id: '7' }, gelesenAt: gelesen ? '2026-10-27T10:00:00Z' : null, createdAt: '2026-10-27T09:00:00Z' }], nextCursor: null, ungelesen: gelesen ? 0 : 1 }),
      'POST /v1/mitteilungen/00000000-0000-4000-8000-0000000000m1/gelesen': () => { gelesen = true; return new Response(null, { status: 204 }); },
    });
    renderWithIam(<Page />);
    expect(await screen.findByText(E.mitteilungen.ungelesen(1))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: E.mitteilungen.gelesenAria('Deine Idee wurde zurückgewiesen.') }));
    await waitFor(() => expect(screen.queryByText(E.mitteilungen.ungelesen(1))).not.toBeInTheDocument());
  });

  it('Fehler der API mit «Erneut versuchen» (Z5), der Rest der Seite bleibt', async () => {
    stub({
      'GET /v1/eingang/anzahl': () => json({ offen: 0, ueberfaellig: 0, naechsteFrist: null }),
      'GET /v1/eingang': () => json({ type: 'about:blank', title: 'Dienst nicht verfügbar', status: 503 }, 503),
    });
    renderWithIam(<Page />);
    expect(await screen.findByRole('button', { name: T.common.retry })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: E.mitteilungen.titel })).toBeInTheDocument();
  });
});
