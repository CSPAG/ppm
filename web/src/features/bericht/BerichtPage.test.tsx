/**
 * Statusbericht erfassen (UI-13, K1) gegen die nachgebildete API: Vorbelegung ohne Status und Trend, Seitenpanel mit
 * fehlenden Angaben und Sprung zur Stelle, automatisches Speichern mit If-Match, «kritisch» mit Pflichtfeldern,
 * Einreichen mit Rückgängig, nur lesbar nach dem Einreichen (Z8), Abweichung zur Baseline an der Meilensteinzeile,
 * Ist-Kosten fehlen (Z4), K1-1 (≤ 15 Interaktionen ohne Änderung an Registern), axe ohne Befund.
 */
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog, Me } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { BerichtPage } from './BerichtPage.tsx';
import { TB } from './texte.ts';

const ID = '00000000-0000-4000-8000-000000000001';
const PERIODE = '2026-10';
const URL_B = `/v1/projekte/${ID}/berichte/${PERIODE}`;
const DIMS = ['inhalt', 'termin', 'ressourcen', 'budget'] as const;
const abw = (stufe: string | null) => Object.fromEntries(DIMS.map(d => [d, { stufe, kommentar: '' }]));

const projekt = { id: ID, nummer: '2026-014', name: 'Digitale Patientenaufnahme', phase: 'P1', lebenszyklus: 'aktiv' };
const bericht = (o: Record<string, unknown> = {}) => ({
  id: null, projektId: ID, projektNummer: '2026-014', projektName: 'Digitale Patientenaufnahme', periode: PERIODE, periodeStand: 'offen',
  stand: 'entwurf', phase: 'P1', anlass: 'monatlich', status: null, trend: null, abschlussPer: '2027-06-30', naechsterMeilenstein: 'Pilot gestartet (15.04.2027)',
  abweichung: abw('keine'), abhaengigkeiten: '', entscheide: '', begruendung: '', massnahme: '', entscheidNoetig: false,
  vorperiode: { periode: '2026-09', status: 'im_plan', trend: 'gleichbleibend', stand: 'geprueft' },
  fehlend: [], eingereichtAt: null, eingereichtBy: null, geprueftAt: null, version: 0, updatedAt: null,
  can: { write: true, einreichen: false, zurueckziehen: false }, ...o,
});
const meilenstein = (o: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-0000000000b1', projektId: ID, version: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  can: { write: true }, phase: 'P1', art: 'meilenstein', text: 'Konzept abgenommen', adressat: '', ziel: '', terminAktuell: '2026-11-20', erreichtAm: null,
  abnahme: 'keine', terminBaseline: '2026-10-30', abgenommenAm: null, ...o,
});
const leer = () => json({ items: [], nextCursor: null, can: { write: true } });

const PL_ME: Partial<Me> = { roles: [], permissions: ['tenant:read'] };

function stub(o: { bericht?: () => Response; put?: (req: Request) => Response | Promise<Response>; kosten?: () => Response; meilensteine?: () => Response; einreichen?: () => Response } = {}) {
  const api = mockIamApi({
    'GET /v1/projekte': () => json({ items: [projekt], nextCursor: null }),
    [`GET ${URL_B}`]: o.bericht ?? (() => json(bericht(), 200, { etag: 'W/"0"' })),
    [`PUT ${URL_B}`]: o.put ?? (async req => {
      const body = await req.json() as Record<string, unknown>;
      return json(bericht({ ...body, id: '00000000-0000-4000-8000-0000000000c1', version: 1, can: { write: true, einreichen: true, zurueckziehen: false } }), 200, { etag: 'W/"1"' });
    }),
    [`POST ${URL_B}/einreichen`]: o.einreichen ?? (() => json(bericht({ id: '00000000-0000-4000-8000-0000000000c1', stand: 'eingereicht', status: 'im_plan', trend: 'gleichbleibend', version: 2, eingereichtAt: '2026-10-23T08:00:00Z', can: { write: false, einreichen: false, zurueckziehen: true } }), 200, { etag: 'W/"2"' })),
    [`POST ${URL_B}/zurueckziehen`]: () => json(bericht({ id: '00000000-0000-4000-8000-0000000000c1', status: 'im_plan', trend: 'gleichbleibend', version: 3, can: { write: true, einreichen: true, zurueckziehen: false } }), 200, { etag: 'W/"3"' }),
    [`GET /v1/projekte/${ID}/meilensteine`]: o.meilensteine ?? (() => json({ items: [meilenstein()], nextCursor: null, can: { write: true } })),
    [`GET /v1/projekte/${ID}/kosten`]: o.kosten ?? leer,
    [`GET /v1/projekte/${ID}/risiken`]: leer,
    'GET /v1/phasenmodelle/aktuell': () => json({ toleranzen: [{ dimension: 'termin', wert: 14, einheit: 'kalendertage' }, { dimension: 'kosten', wert: 10, einheit: 'prozent' }] }),
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

describe('Statusbericht erfassen (UI-13)', () => {
  it('Vorbelegung ohne Status und Trend, Vorperiode daneben; Seitenpanel nennt fehlende Angaben und springt zur Stelle', async () => {
    stub();
    const { container } = renderWithIam(<BerichtPage nummer="2026-014" periode={PERIODE} />, PL_ME);
    expect(await screen.findByRole('heading', { name: 'Statusbericht Oktober 2026' })).toBeInTheDocument();
    expect(screen.getByLabelText(TB.beurteilung.naechster)).toHaveValue('Pilot gestartet (15.04.2027)');
    const status = screen.getByRole('group', { name: TB.beurteilung.status });
    expect(within(status).getAllByRole('radio').every(r => !(r as HTMLInputElement).checked)).toBe(true);
    expect(within(status).getByText('Vorperiode: Im Plan')).toBeInTheDocument();
    expect(screen.getByText('2 Angaben fehlen')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TB.panel.einreichen }));
    expect(await screen.findByText(/Angaben fehlen: Status, Trend\./)).toBeInTheDocument();
    expect(within(status).getAllByRole('radio')[0]).toHaveFocus();
    await expectNoAxe(container);
  });

  it('Meilenstein: Abweichung zur Baseline an der Zeile, Warnung über der Toleranz (A-10); Ist-Kosten fehlen (Z4)', async () => {
    stub({ kosten: () => json({ items: [{ id: '00000000-0000-4000-8000-0000000000d1', projektId: ID, version: 1, createdAt: '', updatedAt: '', can: { write: true }, phase: 'P2', art: 'capex', text: 'Lizenzen', lieferant: '', offerte: '', prognose: 1_320_000, budgetBaseline: 1_250_000, ist: null }], nextCursor: null, can: { write: true } }) });
    renderWithIam(<BerichtPage nummer="2026-014" periode={PERIODE} />, PL_ME);
    expect(await screen.findByText(/\+3\sWochen gegenüber Baseline/)).toBeInTheDocument();
    expect(screen.getByText(/Konzept abgenommen neu .* statt .* laut Baseline/)).toBeInTheDocument();
    expect(await screen.findByText(TB.kosten.istFehlt)).toBeInTheDocument();
    expect(screen.getByText(/Prognose P2: CHF\s1,32\sMio\. · 6\s% über Budget/)).toBeInTheDocument();
  });

  it('«Kritisch» verlangt Begründung und Massnahme; Speichern mit If-Match, nur die geänderten Felder', async () => {
    const api = stub();
    renderWithIam(<BerichtPage nummer="2026-014" periode={PERIODE} />, PL_ME);
    await userEvent.click(await screen.findByRole('radio', { name: 'Kritisch' }));
    expect(screen.getByRole('alert')).toHaveTextContent(TB.beurteilung.kritischHinweis);
    expect(screen.getByLabelText(TB.beurteilung.entscheidNoetig)).toBeInTheDocument();
    await waitFor(() => expect(api.calls.some(c => c.method === 'PUT')).toBe(true));
    const put = api.calls.find(c => c.method === 'PUT')!;
    expect(put.headers.get('if-match')).toBe('W/"0"');
    expect(await put.clone().json()).toEqual({ status: 'kritisch' });
  });

  it('K1-1: ohne Änderung an den Registern in wenigen Interaktionen eingereicht, Rückgängig im Toast, danach nur lesbar (Z8)', async () => {
    const api = stub();
    renderWithIam(<BerichtPage nummer="2026-014" periode={PERIODE} />, PL_ME);
    let interaktionen = 0;
    const klick = async (el: HTMLElement) => { interaktionen++; await userEvent.click(el); };
    await klick(await screen.findByRole('radio', { name: 'Im Plan' }));
    await klick(screen.getByRole('radio', { name: 'gleichbleibend' }));
    await klick(screen.getByRole('button', { name: TB.panel.einreichen }));
    expect(await screen.findByText(TB.eingereicht('Oktober'))).toBeInTheDocument();
    expect(interaktionen).toBeLessThanOrEqual(15);
    // Einreichen erst nach dem Speichern der offenen Änderungen, mit dem ETag des gespeicherten Entwurfs
    const post = api.calls.find(c => c.url.endsWith('/einreichen'))!;
    expect(post.headers.get('if-match')).toBe('W/"1"');
    expect(screen.getByText(/In Prüfung bei der Unternehmensentwicklung seit/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Im Plan' })).toBeDisabled();
    await act(async () => { await userEvent.click(screen.getByRole('button', { name: TB.rueckgaengig })); });
    expect(await screen.findByText(TB.zurueckgezogen)).toBeInTheDocument();
    expect(api.calls.find(c => c.url.endsWith('/zurueckziehen'))!.headers.get('if-match')).toBe('W/"2"');
  });

  it('nach dem Einreichen nur lesbar: Banner statt Einreichen, Register ohne Eingaben (Z8)', async () => {
    stub({ bericht: () => json(bericht({ id: '00000000-0000-4000-8000-0000000000c1', stand: 'eingereicht', version: 2, eingereichtAt: '2026-10-23T08:00:00Z', can: { write: false, einreichen: false, zurueckziehen: false } }), 200, { etag: 'W/"2"' }) });
    const { container } = renderWithIam(<BerichtPage nummer="2026-014" periode={PERIODE} />, PL_ME);
    expect(await screen.findByText(/In Prüfung bei der Unternehmensentwicklung seit/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TB.panel.einreichen })).toBeNull();
    expect(screen.queryByRole('button', { name: /als erreicht melden/ })).toBeNull();
    await expectNoAxe(container);
  });

  it('Projekt unbekannt oder nicht sichtbar: Meldung statt Bericht', async () => {
    const api = mockIamApi({ 'GET /v1/projekte': () => json({ items: [], nextCursor: null }) }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
    vi.stubGlobal('fetch', api.fetch);
    renderWithIam(<BerichtPage nummer="2026-999" periode={PERIODE} />, PL_ME);
    expect(await screen.findByText(TB.projektFehlt)).toBeInTheDocument();
  });
});
