/**
 * Sitzungsmodus, Protokoll und Entscheide (AP-E2-2, UI-34–UI-36, K3 Schritte 7–10) gegen die nachgebildete API:
 * Starten mit If-Match, Antrag zuoberst, Entscheid erfassen mit Sperre «Begründung fehlt», Auflagen, Wirkung vor dem
 * Erfassen, Korrektur mit If-Match, Tastatur → / ← und E, Schliessen mit Hinweis auf Traktanden ohne Entscheid,
 * Lesemodus für Mitglieder, Protokoll bereinigen und versenden, Liste der Entscheide mit «Erledigt melden».
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog, Me } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { validateEntscheideSearch } from './Entscheide.search.ts';
import { EntscheidePage } from './EntscheidePage.tsx';
import { ProtokollPage } from './ProtokollPage.tsx';
import { TM } from './Sitzungsmodus.texte.ts';
import { SitzungsmodusPage } from './SitzungsmodusPage.tsx';

const SID = '00000000-0000-4000-8000-0000000000a1';
const GID = '00000000-0000-4000-8000-0000000000b1';
const PF = '00000000-0000-4000-8000-0000000000c1';
const PL = '00000000-0000-4000-8000-0000000000c2';
const T1 = '00000000-0000-4000-8000-0000000000d1';
const T2 = '00000000-0000-4000-8000-0000000000d2';
const E1 = '00000000-0000-4000-8000-0000000000e1';
const A1 = '00000000-0000-4000-8000-0000000000f1';
const URL_S = '/v1/gremien/prat/sitzungen/2026-11-18';

const frist = { bis: '2026-11-11', arbeitstage: 5, restArbeitstage: 4, vorlauf: 9, eingehalten: true };
const traktandumS = (o: Record<string, unknown> = {}) => ({
  id: T1, sitzungId: SID, art: 'gate', artLabel: 'Gate-Review', bezug: { typ: 'gate_antrag', id: 'x' },
  projekt: { id: PF, nummer: '2026-014', name: 'Neues KIS', phase: 'P2' }, titel: 'Gate P2–P3 Neues KIS', antrag: 'Freigabe Phase P3 und Projektvertrag Version 3.0',
  position: 1, dauerMin: 35, zeit: '14:00', stand: 'traktandiert', viaSns: false, vertraulich: false, verschobenVon: null,
  unterlagen: { stand: 'bereit', liste: [{ art: 'packet', titel: 'Gate Review Packet', bereit: true, hinweis: 'Quality-Check bestanden 28.10.' }] },
  einladungen: [{ personId: PL, name: 'Anna Muster', funktion: 'pl' }], version: 2, ...o,
});
const sitzung = (o: Record<string, unknown> = {}) => ({
  id: SID, gremium: { id: GID, kuerzel: 'prat', name: 'Programmausschuss' }, portfolioId: PF, datum: '2026-11-18', beginn: '14:00', dauerMin: 180, ort: 'Sitzungszimmer 1',
  stand: 'laufend', versendetAt: '2026-11-05T09:00:00Z', versandVorlauf: 9, frist, zeitbedarfMin: 35,
  traktanden: [traktandumS(), traktandumS({ id: T2, position: 2, art: 'eskalation', artLabel: 'Eskalation', titel: 'Eskalation Lieferverzug', antrag: 'Massnahme beschliessen', projekt: null, unterlagen: { stand: 'keine', liste: [] }, einladungen: [] })],
  version: 7, createdAt: '2026-10-20T08:00:00Z', updatedAt: '2026-10-20T08:00:00Z', can: { write: false }, ...o,
});
const gateOptionen = [{ schluessel: 'freigegeben', label: 'Freigegeben' }, { schluessel: 'mit_auflagen', label: 'Mit Auflagen freigegeben' }, { schluessel: 'zurueckgestellt', label: 'Zurückgestellt' }, { schluessel: 'abgelehnt', label: 'Gestoppt' }];
const entscheid = (o: Record<string, unknown> = {}) => ({
  id: E1, traktandumId: T1, sitzungId: SID, ergebnis: 'freigegeben', label: 'Freigegeben', begruendung: 'Business Case überzeugt', stellungnahme: false, anVr: false, sns: null,
  erfasstAt: '2026-11-18T14:30:00Z', erfasstVon: 'UE', auflagen: [], version: 1, verlauf: [], can: { korrigieren: true, snsErfassen: false }, ...o,
});
const modus = (o: Record<string, unknown> = {}, e: unknown = null) => ({
  sitzungId: SID, gremium: { kuerzel: 'prat', name: 'Programmausschuss' }, datum: '2026-11-18', stand: 'laufend', geschlossenAt: null, version: 7,
  traktanden: [
    { traktandumId: T1, position: 1, art: 'gate', artLabel: 'Gate-Review', titel: 'Gate P2–P3 Neues KIS', antrag: 'Freigabe Phase P3 und Projektvertrag Version 3.0', projekt: { id: PF, nummer: '2026-014', name: 'Neues KIS' }, viaSns: false, vertraulich: false, optionen: gateOptionen, entscheid: e },
    { traktandumId: T2, position: 2, art: 'eskalation', artLabel: 'Eskalation', titel: 'Eskalation Lieferverzug', antrag: 'Massnahme beschliessen', projekt: null, viaSns: false, vertraulich: false, optionen: [{ schluessel: 'erledigt', label: 'Erledigt mit Massnahme' }, { schluessel: 'zurueckgestellt', label: 'Zurückgestellt' }], entscheid: null },
  ],
  ohneEntscheid: e ? 1 : 2, can: { starten: false, erfassen: true, schliessen: true }, ...o,
});
const UE: Partial<Me> = { roles: ['ue'], permissions: ['tenant:read', 'portfolio:read', 'projekt:read', 'sitzung:read', 'sitzung:write', 'stammdaten:read'] };
const MITGLIED: Partial<Me> = { roles: ['gremium'], permissions: ['tenant:read', 'sitzung:read'] };

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi({
    [`GET ${URL_S}`]: () => json(sitzung()),
    'GET /v1/people': () => json({ items: [{ id: PL, kind: 'user', name: 'Anna Muster' }], nextCursor: null }),
    ...routes,
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

function Modus({ traktandum, setSearch = () => {} }: { traktandum?: string; setSearch?: (n: { traktandum?: string }) => void }) {
  return <SitzungsmodusPage kuerzel="prat" datum="2026-11-18" search={traktandum ? { traktandum } : {}} setSearch={setSearch} gehe={() => {}} />;
}

describe('Sitzungsmodus', () => {
  it('Antrag zuoberst; Begründung fehlt sperrt; Entscheid erfassen mit Wirkung und Ansage (K3 Schritt 8, K3-3)', async () => {
    let m = modus();
    const api = stub({
      [`GET /v1/sitzungen/${SID}/entscheide`]: () => json(m),
      [`PUT /v1/traktanden/${T1}/entscheid`]: () => { m = modus({}, entscheid()); return json(entscheid()); },
    });
    const { container } = renderWithIam(<Modus />, UE);
    const titel = await screen.findByRole('heading', { level: 2, name: /Gate P2–P3 Neues KIS/ });
    expect(titel).toBeInTheDocument();
    expect(screen.getByText('Freigabe Phase P3 und Projektvertrag Version 3.0')).toBeInTheDocument();
    expect(screen.getByText(/Quality-Check bestanden 28\.10\./)).toBeInTheDocument();
    await expectNoAxe(container);

    const start = performance.now();
    await userEvent.click(screen.getByRole('radio', { name: 'Freigegeben' }));
    await userEvent.click(screen.getByRole('button', { name: TM.erfassen }));
    expect(await screen.findByText(new RegExp(TM.begruendungFehlt))).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'PUT')).toBe(false);

    await userEvent.type(screen.getByLabelText(TM.begruendung), 'Business Case überzeugt');
    expect(screen.getByText(/Gate P2–P3 Neues KIS: Freigegeben\. Die Folge wird sofort nachgeführt\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TM.erfassen }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'PUT')).toBe(true));
    const put = api.calls.find(c => c.method === 'PUT')!;
    expect(put.headers.get('If-Match')).toBeNull();
    expect(await put.json()).toEqual({ ergebnis: 'freigegeben', begruendung: 'Business Case überzeugt', anVr: false, auflagen: [] });
    expect((await screen.findAllByText(TM.erfasst('Freigegeben'))).length).toBeGreaterThan(0);
    // Erfassen im Test in Sekunden (K3-3: ≤ 60 s je Traktandum ab Wortlaut; Messung mit Personen im Aufgabentest)
    expect(performance.now() - start).toBeLessThan(60_000);
  });

  it('Mit Auflagen: Auflage mit Text, Termin, Verantwortlichen; Korrektur mit If-Match (A3, A-30)', async () => {
    const api = stub({
      [`GET /v1/sitzungen/${SID}/entscheide`]: () => json(modus({}, entscheid())),
      [`PUT /v1/traktanden/${T1}/entscheid`]: () => json(entscheid({ ergebnis: 'mit_auflagen', label: 'Mit Auflagen freigegeben', version: 2 })),
    });
    renderWithIam(<Modus />, UE);
    await userEvent.click(await screen.findByRole('radio', { name: 'Mit Auflagen freigegeben' }));
    await userEvent.click(screen.getByRole('button', { name: TM.korrigieren }));
    expect(await screen.findByText(new RegExp(TM.auflagenFehlen.slice(0, 15)))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TM.auflageNeu }));
    await userEvent.type(screen.getByLabelText(`${TM.auflageText} 1`), 'Risikoplan nachreichen');
    fireEvent.change(screen.getByLabelText(TM.auflageTermin), { target: { value: '2026-12-15' } });
    expect((screen.getByLabelText(TM.auflageVerantwortlich) as HTMLSelectElement).value).toBe(PL);
    await userEvent.click(screen.getByLabelText(TM.anVr));
    await userEvent.click(screen.getByRole('button', { name: TM.korrigieren }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'PUT')).toBe(true));
    const put = api.calls.find(c => c.method === 'PUT')!;
    expect(put.headers.get('If-Match')).toBe('W/"1"');
    expect(await put.json()).toEqual({ ergebnis: 'mit_auflagen', begruendung: 'Business Case überzeugt', anVr: true, auflagen: [{ text: 'Risikoplan nachreichen', termin: '2026-12-15', verantwortlich: PL }] });
  });

  it('Tastatur: → nächstes Traktandum, E fokussiert die Entscheidmaske', async () => {
    stub({ [`GET /v1/sitzungen/${SID}/entscheide`]: () => json(modus()) });
    const setSearch = vi.fn();
    renderWithIam(<Modus setSearch={setSearch} />, UE);
    await screen.findByRole('heading', { level: 2, name: /Gate P2–P3/ });
    await userEvent.keyboard('{ArrowRight}');
    expect(setSearch).toHaveBeenCalledWith({ traktandum: '2' }, { replace: true });
    await userEvent.keyboard('e');
    expect(screen.getByRole('radio', { name: 'Freigegeben' })).toHaveFocus();
  });

  it('Starten nach dem Versand und Schliessen mit Hinweis auf Traktanden ohne Entscheid (K3 Schritte 7, 9)', async () => {
    let m = modus({ stand: 'versendet', can: { starten: true, erfassen: false, schliessen: false } });
    const api = stub({
      [`GET /v1/sitzungen/${SID}/entscheide`]: () => json(m),
      [`POST /v1/sitzungen/${SID}/starten`]: () => { m = modus({ version: 8 }); return json(m); },
      [`POST /v1/sitzungen/${SID}/schliessen`]: () => json({ nichtBehandelt: 2, zurueckgestellt: 0, auflagen: 0, benachrichtigt: 0, sitzung: modus({ stand: 'geschlossen', geschlossenAt: '2026-11-18T17:00:00Z', ohneEntscheid: 0, can: { starten: false, erfassen: false, schliessen: false } }) }),
    });
    const { container } = renderWithIam(<Modus />, UE);
    expect(await screen.findByText(TM.nichtGestartet)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TM.starten }));
    await waitFor(() => expect(api.calls.find(c => c.url.endsWith('/starten'))?.headers.get('If-Match')).toBe('W/"7"'));
    await userEvent.click(await screen.findByRole('button', { name: TM.schliessen }));
    const dialog = await screen.findByRole('dialog', { name: TM.schliessenTitel });
    expect(within(dialog).getByText(TM.schliessenOhne(2))).toBeInTheDocument();
    await expectNoAxe(container.ownerDocument.body);
    await userEvent.click(within(dialog).getByRole('button', { name: TM.schliessen }));
    await waitFor(() => expect(api.calls.find(c => c.url.endsWith('/schliessen'))?.headers.get('If-Match')).toBe('W/"8"'));
    expect((await screen.findAllByText(TM.geschlossen)).length).toBeGreaterThan(0);
  });

  it('Mitglieder lesen: Entscheid ohne Maske, via SNS-VR ausstehend (Z8, UC-006 A1)', async () => {
    stub({
      [`GET /v1/sitzungen/${SID}/entscheide`]: () => json(modus({ can: { starten: false, erfassen: false, schliessen: false } },
        entscheid({ stellungnahme: true, can: { korrigieren: false, snsErfassen: false } }))),
    });
    const { container } = renderWithIam(<Modus />, MITGLIED);
    expect(await screen.findByText(`${TM.stellungnahmeKurz}: Freigegeben`)).toBeInTheDocument();
    expect(screen.getByText(TM.snsAusstehend, { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TM.erfassen })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TM.schliessen })).not.toBeInTheDocument();
    await expectNoAxe(container);
  });
});

const protokoll = (o: Record<string, unknown> = {}) => ({
  sitzungId: SID, stand: 'entwurf', version: 3, updatedAt: '2026-11-18T17:00:00Z', versendetAt: null,
  frist: { bis: '2026-11-23', restArbeitstage: 2, nachSitzung: 0, eingehalten: true }, can: { write: true },
  inhalt: {
    kopf: { gremium: { kuerzel: 'prat', name: 'Programmausschuss' }, datum: '2026-11-18', beginn: '14:00', ort: 'Sitzungszimmer 1' }, anwesende: '', bemerkungen: '',
    traktanden: [
      { traktandumId: T1, position: 1, art: 'gate', artLabel: 'Gate-Review', titel: 'Gate P2–P3 Neues KIS', antrag: 'Freigabe Phase P3', projekt: { nummer: '2026-014', name: 'Neues KIS' }, vertraulich: false, viaSns: false,
        behandlung: 'entschieden', entscheid: { ergebnis: 'mit_auflagen', label: 'Mit Auflagen freigegeben', begruendung: 'Business Case überzeugt', stellungnahme: false, anVr: false, auflagen: [{ text: 'Risikoplan nachreichen', verantwortlich: 'Anna Muster', termin: '2026-12-15' }] }, notiz: '' },
      { traktandumId: T2, position: 2, art: 'eskalation', artLabel: 'Eskalation', titel: 'Eskalation Lieferverzug', antrag: '', projekt: null, vertraulich: false, viaSns: false, behandlung: 'nicht_behandelt', entscheid: null, notiz: '' },
    ],
  }, ...o,
});

describe('Protokoll', () => {
  it('bereinigen speichert beim Verlassen mit If-Match; versenden mit Vorschau der Empfänger (K3 Schritt 10)', async () => {
    let p = protokoll();
    const api = stub({
      [`GET ${URL_S}`]: () => json(sitzung({ stand: 'geschlossen' })),
      [`GET /v1/sitzungen/${SID}/protokoll`]: () => json(p),
      [`PUT /v1/sitzungen/${SID}/protokoll`]: () => { p = protokoll({ version: 4, inhalt: { ...protokoll().inhalt, anwesende: 'Alle Mitglieder' } }); return json(p); },
      [`GET /v1/sitzungen/${SID}/protokoll/versand`]: () => json({ frist: p.frist, beteiligte: [{ personId: PL, name: 'Anna Muster' }] }),
      [`POST /v1/sitzungen/${SID}/protokoll/versenden`]: () => { p = protokoll({ stand: 'versendet', versendetAt: '2026-11-19T10:00:00Z', version: 5, can: { write: false } }); return json(p); },
    });
    const { container } = renderWithIam(<ProtokollPage kuerzel="prat" datum="2026-11-18" gehe={() => {}} />, UE);
    expect(await screen.findByText('Mit Auflagen freigegeben')).toBeInTheDocument();
    expect(screen.getByText(/Risikoplan nachreichen · Anna Muster · bis/)).toBeInTheDocument();
    expect(screen.getByText(TM.nichtBehandelt)).toBeInTheDocument();
    expect(screen.getByText(/in 2 Arbeitstagen/)).toBeInTheDocument();
    await expectNoAxe(container);

    await userEvent.type(screen.getByLabelText(TM.anwesende), 'Alle Mitglieder');
    await userEvent.tab();
    await waitFor(() => expect(api.calls.some(c => c.method === 'PUT')).toBe(true));
    const put = api.calls.find(c => c.method === 'PUT')!;
    expect(put.headers.get('If-Match')).toBe('W/"3"');
    expect(await put.json()).toEqual({ anwesende: 'Alle Mitglieder' });

    await userEvent.click(screen.getByRole('button', { name: TM.protokollVersenden }));
    const dialog = await screen.findByRole('dialog', { name: TM.protokollVersandTitel });
    expect(await within(dialog).findByText(TM.protokollEmpfaenger('PRAT', 1))).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: TM.protokollVersenden }));
    await waitFor(() => expect(api.calls.find(c => c.method === 'POST')?.headers.get('If-Match')).toBe('W/"4"'));
    expect(await screen.findByText(new RegExp(TM.protokollFest))).toBeInTheDocument();
    expect(screen.queryByLabelText(TM.anwesende)).not.toBeInTheDocument();
  });

  it('vor dem Schliessen: Protokoll fehlt (Z2)', async () => {
    stub({ [`GET /v1/sitzungen/${SID}/protokoll`]: () => json({ title: 'Protokoll nicht gefunden', status: 404 }, 404) });
    renderWithIam(<ProtokollPage kuerzel="prat" datum="2026-11-18" gehe={() => {}} />, UE);
    expect(await screen.findByText(TM.protokollFehlt)).toBeInTheDocument();
  });
});

describe('Entscheide und Auflagen', () => {
  const eintrag = {
    ...entscheid({ ergebnis: 'mit_auflagen', label: 'Mit Auflagen freigegeben' }),
    auflagen: [{ id: A1, entscheidId: E1, text: 'Risikoplan nachreichen', verantwortlich: { id: PL, name: 'Anna Muster' }, termin: '2026-12-15', stand: 'offen', erfuelltAt: null, can: { erfuellen: true } }],
    traktandum: { id: T1, art: 'gate', artLabel: 'Gate-Review', titel: 'Gate P2–P3 Neues KIS', antrag: 'Freigabe Phase P3', viaSns: false },
    projekt: { id: PF, nummer: '2026-014', name: 'Neues KIS' }, sitzung: { id: SID, datum: '2026-11-18', gremium: { kuerzel: 'prat', name: 'Programmausschuss' } },
  } as Record<string, unknown>;
  delete eintrag.verlauf;
  delete eintrag.can;

  it('Liste, Schublade aus der Aufgabe (?auflage=…), Erledigt melden (UI-36, UC-006 A3)', async () => {
    const api = stub({
      'GET /v1/gremien': () => json({ items: [], nextCursor: null }),
      'GET /v1/entscheide': () => json({ items: [eintrag], nextCursor: null }),
      [`POST /v1/auflagen/${A1}/erfuellen`]: () => json({ ...(eintrag.auflagen as object[])[0], stand: 'erfuellt', can: { erfuellen: false } }),
    });
    const { container } = renderWithIam(<EntscheidePage search={{ auflage: A1 }} setSearch={() => {}} />, UE);
    const drawer = await screen.findByRole('dialog', { name: '2026-014 Gate P2–P3 Neues KIS' });
    expect(within(drawer).getByText('Business Case überzeugt')).toBeInTheDocument();
    expect(api.calls.find(c => c.url.includes('/v1/entscheide'))!.url).toContain('auflagen=offen');
    await expectNoAxe(container.ownerDocument.body);
    await userEvent.click(within(drawer).getByRole('button', { name: TM.erfuellenName('Risikoplan nachreichen') }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    expect(api.calls.find(c => c.method === 'POST')!.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('Adresse: Filter und Schublade, Unbekanntes fällt weg (I-N5)', () => {
    expect(validateEntscheideSearch({ gremium: 'prat', auflagen: 'offen', vr: '1', e: E1, x: 1 })).toEqual({ gremium: 'prat', auflagen: 'offen', vr: '1', e: E1 });
    expect(validateEntscheideSearch({ gremium: 'PRAT!', auflage: 'abc' })).toEqual({});
  });
});
