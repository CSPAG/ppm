/**
 * Seite «Quartalsreporting» (AP-E6-4, BC ZM.03.02, K6 Schritte 11–14) gegen die nachgebildete API: noch nicht erstellt
 * (Z2) mit «Bericht erstellen», Entwurf mit Hinweisen (Z4), Weiterleitungen und Kommentaren (PATCH mit If-Match),
 * Traktandieren, nach der Verabschiedung Aufträge des VR mit Pflichtangaben, nur lesen (Z8).
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import type { AppPermission } from '../../auth/permissions.ts';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { QuartalsreportingPage } from './QuartalsreportingPage.tsx';
import { TQR } from './QuartalsreportingTexte.ts';

const URL_Q = '/v1/quartalsberichte/2026-Q3';
const UE = { roles: ['ue'], permissions: ['tenant:read', 'stammdaten:read', 'portfolio:read', 'ziel:read', 'quartalsbericht:write'] as AppPermission[] };
const P = '00000000-0000-4000-8000-0000000000a1';

const bericht = (o: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-0000000000b1', quartal: '2026-Q3', stand: 'in_arbeit', erzeugtAt: '2026-10-05T08:00:00Z', traktandiertAt: null, verabschiedetAt: null, version: 2,
  inhalt: {
    hinweise: ['Zielerreichung Q3 2026: 1 von 2 Zielen ohne neuen Stand; diese erscheinen mit dem letzten früheren Stand.'],
    zielerreichung: { nachgefuehrt: 1, gesamt: 2, ziele: [
      { typ: 'strategisch', id: '00000000-0000-4000-8000-0000000000c1', nummer: '1.1', text: 'Wartezeit senken', metrik: 'Median', zielwert: '−10 %', stand: '−4 %', beurteilung: 'auf Kurs', quartal: '2026-Q3' },
      { typ: 'strategisch', id: '00000000-0000-4000-8000-0000000000c2', nummer: '1.2', text: 'Kosten senken', metrik: 'CHF', zielwert: '−5 %', stand: '−1 %', beurteilung: '', quartal: '2026-Q2' },
    ] },
    portfolios: [{
      id: P, name: 'Transformation', periode: '2026-09', berichtId: '00000000-0000-4000-8000-0000000000d1', bereitgestellt: true, projekte: 2, imPlan: 1, kritisch: 1, nichtGemeldet: 0,
      kritischeProjekte: [{ nummer: '2026-001', name: 'Neues KIS', phase: 'P2', trend: 'abwaerts' }],
      meilensteine: [{ projekt: { nummer: '2026-001', name: 'Neues KIS' }, text: 'Go-live Pilot', termin: '2026-12-01' }],
      risiken: [{ projekt: null, text: 'Fachkräftemangel', wahrscheinlichkeit: 'hoch', auswirkung: 'hoch', massnahme: '' }],
      abhaengigkeiten: [], eskalationen: [],
    }],
    weiterleitungen: [{ entscheidId: '00000000-0000-4000-8000-0000000000e1', datum: '2026-08-12', gremium: 'PRAT', titel: 'Eskalation KIS', ergebnis: 'erledigt', begruendung: 'Budget nötig', ausserordentlichAm: null }],
  },
  kommentare: { gesamtstatus: '', entwicklungen: '', risiken: '', abhaengigkeiten: '', auswirkungen: '', weiterleitungen: '' },
  rueckmeldungPrat: '', vrRueckmeldung: '', vrRueckmeldungAt: null, auftraege: [],
  can: { erzeugen: true, bearbeiten: true, traktandieren: true, rueckmeldung: false },
  ...o,
});

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}
const zeigen = () => <QuartalsreportingPage jahr={2026} quartal={3} setQuartal={vi.fn()} />;

describe('Quartalsreporting', () => {
  it('noch nicht erstellt: «Bericht erstellen» erzeugt den Entwurf', async () => {
    let b: ReturnType<typeof bericht> | null = null;
    const api = stub({
      [`GET ${URL_Q}`]: () => (b ? json(b, 200, { ETag: 'W/"2"' }) : json({ title: 'Nicht gefunden', status: 404 }, 404)),
      [`POST ${URL_Q}/erzeugen`]: () => { b = bericht(); return json(b, 201, { ETag: 'W/"2"' }); },
    });
    const { container } = renderWithIam(zeigen(), UE);
    expect(await screen.findByText(TQR.leer('Q3 2026'))).toBeInTheDocument();
    await expectNoAxe(container);
    await userEvent.click(screen.getByRole('button', { name: TQR.erstellen }));
    await waitFor(() => expect(api.calls.some(c => c.url.endsWith('/erzeugen'))).toBe(true));
    expect(await screen.findByText('Eskalation KIS')).toBeInTheDocument();
  });

  it('Entwurf: Hinweise, Weiterleitungen, Kommentare mit If-Match, Traktandieren', async () => {
    let b = bericht();
    const api = stub({
      [`GET ${URL_Q}`]: () => json(b, 200, { ETag: `W/"${b.version}"` }),
      [`PATCH ${URL_Q}`]: () => { b = bericht({ version: 3, kommentare: { ...b.kommentare, gesamtstatus: 'Auf Kurs' } }); return json(b, 200, { ETag: 'W/"3"' }); },
      [`POST ${URL_Q}/traktandieren`]: () => { b = bericht({ version: 4, stand: 'traktandiert', traktandiertAt: '2026-10-06T08:00:00Z', can: { erzeugen: false, bearbeiten: false, traktandieren: false, rueckmeldung: false } }); return json(b, 200, { ETag: 'W/"4"' }); },
    });
    const { container } = renderWithIam(zeigen(), UE);
    expect(await screen.findByText(/1 von 2 Zielen ohne neuen Stand/)).toBeInTheDocument();
    expect(screen.getByText('Eskalation KIS')).toBeInTheDocument();
    expect(screen.getByText(`−1 % ${TQR.ausQuartal('Q2 2026')}`)).toBeInTheDocument();
    await expectNoAxe(container);
    await userEvent.type(screen.getByLabelText(TQR.kommentarVon('Gesamtstatus')), 'Auf Kurs');
    expect(screen.getByRole('button', { name: TQR.traktandieren })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: TQR.kommentareSpeichern }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'PATCH')).toBe(true));
    const patch = api.calls.find(c => c.method === 'PATCH')!;
    expect(patch.headers.get('If-Match')).toBe('W/"2"');
    expect((await patch.json()).kommentare.gesamtstatus).toBe('Auf Kurs');
    await waitFor(() => expect(screen.getByRole('button', { name: TQR.traktandieren })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: TQR.traktandieren }));
    // Wirkung vor dem Klick (I-R1 Stufe 3): noch nichts gesendet
    const dlg = await screen.findByRole('dialog', { name: TQR.traktandierenFrage('Q3 2026') });
    expect(within(dlg).getByText(TQR.kommentiert(1, 6))).toBeInTheDocument();
    expect(within(dlg).getByText(TQR.traktandierenHinweise(1))).toBeInTheDocument();
    expect(api.calls.some(c => c.url.endsWith('/traktandieren'))).toBe(false);
    await expectNoAxe(dlg);
    await userEvent.click(within(dlg).getByRole('button', { name: TQR.traktandieren }));
    await waitFor(() => expect(api.calls.some(c => c.url.endsWith('/traktandieren'))).toBe(true));
    expect(api.calls.find(c => c.url.endsWith('/traktandieren'))!.headers.get('If-Match')).toBe('W/"3"');
    expect(await screen.findByText(/Dem PRAT vorgelegt am/)).toBeInTheDocument();
  });

  it('Konflikt beim Speichern (Z7): Kommentar bleibt, «Neu laden» übernimmt ihn in den neuen Stand', async () => {
    let b = bericht();
    let patches = 0;
    const api = stub({
      [`GET ${URL_Q}`]: () => json(b, 200, { ETag: `W/"${b.version}"` }),
      [`PATCH ${URL_Q}`]: () => {
        patches += 1;
        if (patches === 1) {
          // inzwischen hat jemand anderes kommentiert
          b = bericht({ version: 3, kommentare: { ...b.kommentare, risiken: 'Von Bruno' } });
          return json({ title: 'Inzwischen geändert', status: 412 }, 412);
        }
        b = bericht({ version: 4, kommentare: { ...b.kommentare, gesamtstatus: 'Auf Kurs' } });
        return json(b, 200, { ETag: 'W/"4"' });
      },
    });
    renderWithIam(zeigen(), UE);
    const feld = await screen.findByLabelText(TQR.kommentarVon('Gesamtstatus'));
    await userEvent.type(feld, 'Auf Kurs');
    await userEvent.click(screen.getByRole('button', { name: TQR.kommentareSpeichern }));
    expect(await screen.findByText(TQR.konfliktKommentare(1))).toBeInTheDocument();
    expect(screen.getByLabelText(TQR.kommentarVon('Gesamtstatus'))).toHaveValue('Auf Kurs');
    await userEvent.click(screen.getByRole('button', { name: TQR.konfliktNeuLaden }));
    await waitFor(() => expect(screen.getByLabelText(TQR.kommentarVon('Kritische Portfoliorisiken'))).toHaveValue('Von Bruno'));
    expect(screen.getByLabelText(TQR.kommentarVon('Gesamtstatus'))).toHaveValue('Auf Kurs');
    expect(screen.queryByText(TQR.konfliktKommentare(1))).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: TQR.kommentareSpeichern }));
    await waitFor(() => expect(patches).toBe(2));
    const zweiter = api.calls.filter(c => c.method === 'PATCH')[1]!;
    expect(zweiter.headers.get('If-Match')).toBe('W/"3"');
    expect((await zweiter.json()).kommentare).toEqual({ gesamtstatus: 'Auf Kurs' });
  });

  it('«Neu erstellen» fragt vorher und behält ungespeicherte Kommentare', async () => {
    let b = bericht();
    const api = stub({
      [`GET ${URL_Q}`]: () => json(b, 200, { ETag: `W/"${b.version}"` }),
      [`POST ${URL_Q}/erzeugen`]: () => { b = bericht({ version: 3, erzeugtAt: '2026-10-07T08:00:00Z' }); return json(b, 200, { ETag: 'W/"3"' }); },
    });
    renderWithIam(zeigen(), UE);
    await userEvent.type(await screen.findByLabelText(TQR.kommentarVon('Gesamtstatus')), 'Entwurf');
    await userEvent.click(screen.getByRole('button', { name: TQR.neuErstellen }));
    let dlg = await screen.findByRole('dialog', { name: TQR.neuFrage('Q3 2026') });
    expect(within(dlg).getByText(TQR.neuKommentareUngespeichert(1))).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('button', { name: TQR.abbrechen }));
    expect(api.calls.some(c => c.url.endsWith('/erzeugen'))).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: TQR.neuErstellen }));
    dlg = await screen.findByRole('dialog', { name: TQR.neuFrage('Q3 2026') });
    await userEvent.click(within(dlg).getByRole('button', { name: TQR.neuErstellen }));
    await waitFor(() => expect(api.calls.some(c => c.url.endsWith('/erzeugen'))).toBe(true));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByLabelText(TQR.kommentarVon('Gesamtstatus'))).toHaveValue('Entwurf');
  });

  it('verabschiedet: Auftrag des VR nur mit Text und verantwortlicher Person', async () => {
    const b = bericht({ stand: 'verabschiedet', verabschiedetAt: '2026-11-12T08:00:00Z', can: { erzeugen: false, bearbeiten: false, traktandieren: false, rueckmeldung: true } });
    const api = stub({ [`GET ${URL_Q}`]: () => json(b, 200, { ETag: 'W/"5"' }) });
    const { container } = renderWithIam(zeigen(), UE);
    expect(await screen.findByRole('heading', { name: TQR.vr })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TQR.pdf })).toBeInTheDocument();
    await expectNoAxe(container);
    await userEvent.click(screen.getByRole('button', { name: TQR.auftragHinzufuegen }));
    expect(screen.getByText(TQR.auftragFehlt)).toBeInTheDocument();
    expect(screen.getByText(TQR.verantwortlichFehlt)).toBeInTheDocument();
    expect(api.calls.some(c => c.url.endsWith('/auftraege'))).toBe(false);
  });

  it('nur lesen (GL): keine Handlungen, Hinweis', async () => {
    stub({ [`GET ${URL_Q}`]: () => json(bericht({ can: { erzeugen: false, bearbeiten: false, traktandieren: false, rueckmeldung: false } }), 200, { ETag: 'W/"2"' }) });
    renderWithIam(zeigen());
    expect(await screen.findByText(TQR.nurLesen)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TQR.traktandieren })).toBeNull();
    expect(screen.queryByRole('button', { name: TQR.kommentareSpeichern })).toBeNull();
  });
});
