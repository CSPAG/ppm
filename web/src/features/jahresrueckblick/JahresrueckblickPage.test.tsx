/**
 * Jahresrückblick (UI-37; UC-013 Schritte 1–4, A1; AP-E7-5) gegen die nachgebildete API: Kennzahlen mit Sprung zu den
 * Einzelwerten, erstes Speichern ohne If-Match, danach mit, Traktandieren mit Wirkung vorher und gesperrtem Rückblick,
 * Lessons Learned anfordern, Konflikt (412) lädt neu, Gremium liest nur, ohne Recht.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog, Me } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { JahresrueckblickPage } from './JahresrueckblickPage.tsx';
import { TJ } from './JahresrueckblickTexte.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const UE: Partial<Me> = { roles: ['ue'], permissions: ['tenant:read', 'ziel:read', 'quartalsbericht:write', 'projekt:read'] };
const GREMIUM: Partial<Me> = { roles: ['gremium'], permissions: ['tenant:read', 'ziel:read', 'sitzung:read'] };

const projekt = (n: number, nummer: string, name: string, lebenszyklus: string, seit: string | null) =>
  ({ id: id(n), nummer, name, portfolio: 'Transformation', phase: 'P4', lebenszyklus, seit });

const AUSWERTUNG = {
  zielerreichung: { gesamt: 2, mitStand: 1, ziele: [
    { typ: 'strategisch', id: id(1), nummer: '1.1', text: 'Wartezeit senken', metrik: 'Median', zielwert: '−10 %', stand: '−4 %', beurteilung: 'auf Kurs', quartal: '2026-Q3' },
    { typ: 'strategisch', id: id(2), nummer: '1.2', text: 'Ohne Stand', metrik: '', zielwert: '', stand: null, beurteilung: '', quartal: null },
  ] },
  vorhaben: {
    abgeschlossen: [projekt(10, '2026-001', 'Neues KIS', 'abgeschlossen', '2026-06-15'), projekt(11, '2026-002', 'Portal', 'abgeschlossen', '2026-09-30')],
    abgebrochen: [],
    laufend: [projekt(12, '2026-003', 'Labor', 'aktiv', null)],
  },
  lessonsLearned: {
    eintraege: [{ id: id(20), projekt: { id: id(11), nummer: '2026-002', name: 'Portal' }, text: 'Früh mit dem Betrieb planen', kategorie: 'Übergabe' }],
    ohne: [projekt(10, '2026-001', 'Neues KIS', 'abgeschlossen', '2026-06-15')],
  },
};

type R = Record<string, unknown> & { version: number; stand: string; erkenntnisse: string; massnahmen: string; can: { bearbeiten: boolean; traktandieren: boolean } };

function server(start: Partial<R> = {}, o: { schreiben?: boolean; konflikt?: boolean } = {}) {
  const schreiben = o.schreiben ?? true;
  const r: R = {
    jahr: 2026, stand: 'offen', erkenntnisse: '', massnahmen: '', rueckmeldung: '', traktandiertAt: null, ausgewertetAt: null, version: 0,
    auswertung: AUSWERTUNG, can: { bearbeiten: schreiben, traktandieren: schreiben }, ...start,
  };
  const calls: { method: string; pfad: string; ifMatch: string | null; body?: unknown }[] = [];
  let gets = 0;
  const antwort = () => json(r, 200, { etag: `W/"${r.version}"` });
  const api = mockIamApi({}, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const pfad = new URL(req.url).pathname;
    if (req.method === 'GET' && pfad === '/v1/jahresrueckblicke/2026') { gets += 1; return antwort(); }
    if (req.method === 'PUT' && pfad === '/v1/jahresrueckblicke/2026') {
      const body = await req.json() as { erkenntnisse: string; massnahmen: string };
      calls.push({ method: 'PUT', pfad, ifMatch: req.headers.get('if-match'), body });
      if (o.konflikt) return json({ type: 'about:blank', title: 'Fassung veraltet', status: 412 }, 412, { 'content-type': 'application/problem+json' });
      Object.assign(r, { ...body, stand: r.stand === 'offen' ? 'in_arbeit' : r.stand, version: r.version + 1 });
      return antwort();
    }
    if (req.method === 'POST' && pfad === '/v1/jahresrueckblicke/2026/traktandieren') {
      calls.push({ method: 'POST', pfad, ifMatch: null });
      Object.assign(r, { stand: 'traktandiert', traktandiertAt: '2026-11-03T08:00:00Z', version: r.version + 1, can: { bearbeiten: false, traktandieren: false } });
      return antwort();
    }
    if (req.method === 'POST' && pfad === '/v1/jahresrueckblicke/2026/lessons-learned/anfordern') {
      calls.push({ method: 'POST', pfad, ifMatch: null });
      return json({ vorhaben: 1, aufgaben: 1 });
    }
    return api.fetch(req);
  });
  return { r, calls, gets: () => gets };
}

describe('Jahresrückblick', () => {
  it('UE: Kennzahlen mit Sprungmarken, erstes Speichern ohne If-Match, Traktandieren mit Wirkung vorher; ohne axe-Befund', async () => {
    const s = server();
    const { container } = renderWithIam(<JahresrueckblickPage jahr={2026} jahrWechseln={() => {}} />, UE);
    const kz = await screen.findByRole('list', { name: TJ.kennzahl.kennzahlen });
    expect(within(kz).getByRole('link', { name: TJ.kennzahl.ziele(1, 2) })).toHaveAttribute('href', '#jr-zielerreichung');
    expect(within(kz).getByRole('link', { name: TJ.kennzahl.ohne(1) })).toHaveAttribute('href', '#jr-ohne');
    expect(screen.getByRole('table', { name: TJ.vorhaben.abgeschlossen })).toHaveTextContent('2026-001 Neues KIS');
    expect(within(screen.getByRole('table', { name: TJ.tabelle.lessons })).getByRole('link', { name: '2026-002 Portal' })).toHaveAttribute('href', '/projekte/2026-002/abschluss');
    expect(screen.getByText('−4 % (Q3 2026)')).toBeInTheDocument();
    // noch nichts gespeichert: Traktandieren erst nach dem Speichern, kein Dokument
    expect(screen.getByRole('button', { name: TJ.traktandieren })).toBeDisabled();
    expect(screen.getByText(TJ.traktandierenVorher)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: TJ.dokument })).not.toBeInTheDocument();
    await expectNoAxe(container);

    // ein neuer Rückblick lässt sich auch leer speichern; ungespeicherte Eingaben sperren «Lessons Learned anfordern»
    expect(screen.getByRole('button', { name: TJ.speichern })).toBeEnabled();
    expect(screen.getByRole('button', { name: TJ.anfordern })).toBeEnabled();
    await userEvent.type(screen.getByRole('textbox', { name: TJ.erkenntnisse }), 'Zu viele Vorhaben parallel');
    expect(screen.getByRole('button', { name: TJ.anfordern })).toBeDisabled();
    expect(screen.getByText(TJ.anfordernVorher)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TJ.speichern }));
    await waitFor(() => expect(s.calls[0]).toMatchObject({ method: 'PUT', ifMatch: null, body: { erkenntnisse: 'Zu viele Vorhaben parallel', massnahmen: '' } }));
    await userEvent.type(await screen.findByRole('textbox', { name: TJ.massnahmen }), 'WIP-Limite');
    expect(screen.getByRole('button', { name: TJ.traktandieren })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: TJ.speichern }));
    await waitFor(() => expect(s.calls[1]).toMatchObject({ method: 'PUT', ifMatch: 'W/"1"' }));
    expect(await screen.findByRole('group', { name: TJ.dokument })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole('button', { name: TJ.traktandieren })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: TJ.traktandieren }));
    const d = await screen.findByRole('dialog', { name: TJ.dialog.titel(2026) });
    expect(within(d).getByText(TJ.dialog.text)).toBeInTheDocument();
    await userEvent.click(within(d).getByRole('button', { name: TJ.traktandieren }));
    await waitFor(() => expect(s.calls.some(c => c.pfad.endsWith('/traktandieren'))).toBe(true));
    expect(await screen.findByText(/Dem PRAT vorgelegt am/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('Zu viele Vorhaben parallel')).toBeInTheDocument();
  });

  it('UE: Lessons Learned anfordern (A1) mit Wirkung vorher', async () => {
    const s = server({ stand: 'in_arbeit', version: 1, erkenntnisse: 'x' });
    renderWithIam(<JahresrueckblickPage jahr={2026} jahrWechseln={() => {}} />, UE);
    expect(await screen.findByText(TJ.anfordernWirkung(1))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TJ.anfordern }));
    await waitFor(() => expect(s.calls.map(c => c.pfad)).toEqual(['/v1/jahresrueckblicke/2026/lessons-learned/anfordern']));
  });

  it('Konflikt (412): neu laden statt überschreiben', async () => {
    const s = server({ stand: 'in_arbeit', version: 3, erkenntnisse: 'alt' }, { konflikt: true });
    renderWithIam(<JahresrueckblickPage jahr={2026} jahrWechseln={() => {}} />, UE);
    const feld = await screen.findByRole('textbox', { name: TJ.erkenntnisse });
    await userEvent.type(feld, ' neu');
    await userEvent.click(screen.getByRole('button', { name: TJ.speichern }));
    await waitFor(() => expect(s.calls[0]?.ifMatch).toBe('W/"3"'));
    await waitFor(() => expect(s.gets()).toBe(2));
  });

  it('Gremium: liest Auswertung und Erkenntnisse, keine Handlungen; Jahr wechseln', async () => {
    server({ stand: 'ausgewertet', version: 2, erkenntnisse: 'Zu viele Vorhaben', ausgewertetAt: '2026-12-10T10:00:00Z', traktandiertAt: '2026-11-03T08:00:00Z' }, { schreiben: false });
    const wechseln = vi.fn();
    const { container } = renderWithIam(<JahresrueckblickPage jahr={2026} jahrWechseln={wechseln} />, GREMIUM);
    expect(await screen.findByText('Zu viele Vorhaben')).toBeInTheDocument();
    expect(screen.getByText(TJ.nurLesen)).toBeInTheDocument();
    expect(screen.getByText(/Im PRAT verabschiedet am/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TJ.traktandieren })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TJ.anfordern })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: TJ.dokument })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Vorheriges Jahr/ }));
    expect(wechseln).toHaveBeenCalledWith(2025);
    await expectNoAxe(container);
  });

  it('Mitglied des PRAT (A-67): vor dem Traktandieren Erklärung statt Daten', async () => {
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init);
      if (new URL(req.url).pathname === '/v1/jahresrueckblicke/2026') return json({ type: 'about:blank', title: 'Nicht gefunden', status: 404 }, 404, { 'content-type': 'application/problem+json' });
      return mockIamApi({}, { catalog: CATALOG_PPM as unknown as AuthzCatalog }).fetch(req);
    });
    renderWithIam(<JahresrueckblickPage jahr={2026} jahrWechseln={() => {}} />, { roles: [], permissions: ['tenant:read'], somewhere: ['sitzung:read', 'ziel:read'] });
    expect(await screen.findByText(TJ.nochNichtTraktandiert(2026))).toBeInTheDocument();
  });

  it('Gremium eines anderen Portfolios (403): Erklärung statt Wartezustand', async () => {
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init);
      if (new URL(req.url).pathname === '/v1/jahresrueckblicke/2026') return json({ type: 'about:blank', title: 'Kein Recht', status: 403 }, 403, { 'content-type': 'application/problem+json' });
      return mockIamApi({}, { catalog: CATALOG_PPM as unknown as AuthzCatalog }).fetch(req);
    });
    renderWithIam(<JahresrueckblickPage jahr={2026} jahrWechseln={() => {}} />, { roles: [], permissions: ['tenant:read'], somewhere: ['sitzung:read', 'ziel:read'] });
    expect(await screen.findByText(TJ.keinRecht)).toBeInTheDocument();
    expect(screen.queryByText(TJ.nochNichtTraktandiert(2026))).not.toBeInTheDocument();
  });

  it('ohne Recht: Erklärung statt Daten', () => {
    server();
    renderWithIam(<JahresrueckblickPage jahr={2026} jahrWechseln={() => {}} />, { roles: [], permissions: ['tenant:read'] });
    expect(screen.getByText(TJ.keinRecht)).toBeInTheDocument();
  });
});
