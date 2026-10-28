/**
 * Projektakte › Abschluss (UI-14, UC-015) gegen die nachgebildete API: Ausgangslage aus Vertrag und Register,
 * Seitenpanel mit fehlenden Pflichtangaben und Sprung zur Stelle, automatisches Speichern mit If-Match, Einreichen mit
 * Vorschau der Wirkung (I-R1), Nutzenprüfung durch den Sponsor, Lessons Learned erfassen, sistiertes Projekt mit
 * Wiederaufnahme (A-09), abgeschlossenes Projekt nur lesbar (Z9), noch kein Abschluss (P2), axe ohne Befund.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog, Me } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { T } from '../../ui/index.ts';
import { AbschlussPage } from './AbschlussPage.tsx';
import { TA } from './texte.ts';

const ID = '00000000-0000-4000-8000-000000000001';
const URL_A = `/v1/projekte/${ID}/abschluss`;
const KPI = '00000000-0000-4000-8000-0000000000a1';
const projekt = { id: ID, nummer: '2026-014', name: 'Neues Labor', phase: 'P4', lebenszyklus: 'aktiv' };

const bericht = (o: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-0000000000b1', art: 'abschluss', stand: 'entwurf', projektstand: '', zielerreichung: '', kpiWerte: [], businessCase: '',
  uebergabe: '', offenePunkte: [], nutzen: { sp: null, ue: null }, eingereichtAt: null, abgenommenAt: null, version: 1, updatedAt: '2026-10-20T08:00:00Z', ...o,
});
const abschluss = (o: Record<string, unknown> = {}, b: Record<string, unknown> | null = {}) => ({
  projekt: { id: ID, nummer: '2026-014', name: 'Neues Labor', phase: 'P4', lebenszyklus: 'aktiv' },
  lage: 'abschluss', bericht: b === null ? null : bericht(b), berichte: [],
  grundlagen: {
    baseline: '4.0', ziele: 'Labor in Betrieb', nutzen: 'Kürzere Wartezeiten', businessCase: 'Amortisation in 4 Jahren',
    kpis: [{ id: KPI, art: 'projekt', text: 'Durchlaufzeit', einheit: 'h', zielwert: '24', ist: { periode: '2026-09', wert: 26 } }],
    kosten: { budgetBaseline: 1_200_000, prognose: 1_150_000, ist: 1_100_000 },
    offeneMeilensteine: [{ id: '00000000-0000-4000-8000-0000000000c1', phase: 'P4', art: 'lieferergebnis', text: 'Schulung Linie', terminBaseline: '2026-12-15', terminAktuell: null }],
    nutzenpruefung: { version: '4.0', beurteilung: 'Nutzen stabil', werte: [{ kpiId: KPI, wert: '25', bemerkung: '' }] },
  },
  lessonsLearned: [], entscheid: null,
  can: { bearbeiten: true, einreichen: true, nutzenSp: false, nutzenUe: false, wiederaufnahme: false, lessons: true, dokument: true }, ...o,
});

const PL_ME: Partial<Me> = { roles: [], permissions: ['tenant:read'] };

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi({ 'GET /v1/projekte': () => json({ items: [projekt], nextCursor: null }), ...routes }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

describe('Abschluss (UI-14)', () => {
  it('Ausgangslage, fehlende Pflichtangaben mit Sprung, automatisches Speichern, Einreichen mit Vorschau der Wirkung', async () => {
    let gespeichert: Record<string, unknown> = {};
    const api = stub({
      [`GET ${URL_A}`]: () => json(abschluss(), 200, { etag: 'W/"1"' }),
      [`PUT ${URL_A}`]: async req => { gespeichert = await req.json() as Record<string, unknown>; return json(abschluss({}, { ...gespeichert, version: 2 }), 200, { etag: 'W/"2"' }); },
      [`POST ${URL_A}/einreichen`]: () => json(abschluss({ can: { ...abschluss().can, bearbeiten: false, einreichen: false } }, { ...gespeichert, stand: 'traktandiert', version: 3, eingereichtAt: '2026-10-28T08:00:00Z' }), 200, { etag: 'W/"3"' }),
    });
    const { container } = renderWithIam(<AbschlussPage nummer="2026-014" />, PL_ME);
    expect(await screen.findByRole('heading', { name: TA.titel.abschluss })).toBeInTheDocument();
    expect(screen.getByText('Labor in Betrieb')).toBeInTheDocument();
    expect(screen.getByText('Nutzen stabil')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: TA.grundlagen.gateWert })).toBeInTheDocument();
    expect(screen.getByText(TA.grundlagen.offeneMeilensteine(1))).toBeInTheDocument();
    expect(screen.getByText('3 Angaben fehlen')).toBeInTheDocument();
    await expectNoAxe(container);

    await userEvent.click(screen.getByRole('button', { name: TA.panel.einreichen }));
    expect(screen.getByRole('alert')).toHaveTextContent(TA.felder.zielerreichung);
    expect(screen.getByRole('textbox', { name: TA.felder.zielerreichung })).toHaveFocus();

    await userEvent.type(screen.getByRole('textbox', { name: TA.felder.zielerreichung }), 'Ziele erreicht');
    await userEvent.type(screen.getByRole('textbox', { name: TA.felder.businessCase }), 'Im Budget');
    await userEvent.type(screen.getByRole('textbox', { name: TA.felder.uebergabe }), 'Betrieb ab 1.1.');
    await userEvent.type(screen.getByLabelText(TA.kpi.erreichtVon('Durchlaufzeit')), '23');
    await waitFor(() => expect(gespeichert.uebergabe).toBe('Betrieb ab 1.1.'), { timeout: 3000 });
    expect(gespeichert.kpiWerte).toEqual([{ kpiId: KPI, wert: '23', bemerkung: '' }]);
    expect(api.calls.find(c => c.method === 'PUT')!.headers.get('If-Match')).toBe('W/"1"');
    expect(screen.getByText(TA.panel.bereit)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: TA.panel.einreichen }));
    const dialog = screen.getByRole('dialog', { name: TA.panel.frage });
    expect(within(dialog).getByText(TA.panel.wirkungAbschluss)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: TA.panel.einreichen }));
    expect(await screen.findByText(TA.banner.traktandiert)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: TA.felder.zielerreichung })).toBeDisabled();
  });

  it('Speichern nacheinander mit dem neuen ETag; offene Eingabe wird beim Verlassen gespeichert (I-R3)', async () => {
    const puts: { etag: string | null; body: Record<string, unknown> }[] = [];
    let freigeben: (() => void) | null = null;
    stub({
      [`GET ${URL_A}`]: () => json(abschluss(), 200, { etag: 'W/"1"' }),
      [`PUT ${URL_A}`]: async req => {
        const body = await req.json() as Record<string, unknown>;
        puts.push({ etag: req.headers.get('If-Match'), body });
        const v = puts.length + 1;
        // der erste Aufruf bleibt hängen, bis der Test ihn freigibt
        if (puts.length === 1) await new Promise<void>(r => { freigeben = r; });
        return json(abschluss({}, { ...body, version: v }), 200, { etag: `W/"${v}"` });
      },
    });
    const { unmount } = renderWithIam(<AbschlussPage nummer="2026-014" />, PL_ME);
    const feld = await screen.findByRole('textbox', { name: TA.felder.zielerreichung });
    await userEvent.type(feld, 'A');
    await waitFor(() => expect(puts.length).toBe(1), { timeout: 3000 });
    await userEvent.type(feld, 'B');
    await new Promise(r => setTimeout(r, 900));
    expect(puts.length).toBe(1);
    freigeben!();
    await waitFor(() => expect(puts.length).toBe(2), { timeout: 3000 });
    expect(puts.map(p => p.etag)).toEqual(['W/"1"', 'W/"2"']);
    expect(puts[1]!.body.zielerreichung).toBe('AB');

    await userEvent.type(screen.getByRole('textbox', { name: TA.felder.uebergabe }), 'X');
    unmount();
    await waitFor(() => expect(puts.length).toBe(3));
    expect(puts[2]!.body.uebergabe).toBe('X');
  });

  it('Konflikt (412) beim automatischen Speichern: Eingabe bleibt, «behalten» speichert mit neuem Stand, «übernehmen» zeigt den anderen (Z7)', async () => {
    let n = 0;
    const puts: { etag: string | null; body: Record<string, unknown> }[] = [];
    stub({
      [`GET ${URL_A}`]: () => (n ? json(abschluss({}, { zielerreichung: 'Von Paula', businessCase: 'BC von Paula', version: 5 }), 200, { etag: 'W/"5"' }) : json(abschluss(), 200, { etag: 'W/"1"' })),
      [`PUT ${URL_A}`]: async req => {
        puts.push({ etag: req.headers.get('If-Match'), body: await req.json() as Record<string, unknown> });
        if (n++ === 0) return json({ title: 'Inzwischen geändert', status: 412 }, 412);
        return json(abschluss({}, { ...puts.at(-1)!.body, version: 6 }), 200, { etag: 'W/"6"' });
      },
    });
    renderWithIam(<AbschlussPage nummer="2026-014" />, PL_ME);
    const feld = await screen.findByRole('textbox', { name: TA.felder.zielerreichung });
    await userEvent.type(feld, 'Meins');
    expect(await screen.findByText(TA.konflikt, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(feld).toHaveValue('Meins');
    await new Promise(r => setTimeout(r, 900));
    expect(puts).toHaveLength(1); // kein weiteres Speichern, solange der Konflikt offen ist
    await userEvent.click(screen.getByRole('button', { name: TA.konfliktBehalten }));
    await waitFor(() => expect(puts).toHaveLength(2));
    // eigene Änderung über den neuen Stand, das andere Feld der anderen bleibt
    expect([puts[1]!.etag, puts[1]!.body.zielerreichung, puts[1]!.body.businessCase]).toEqual(['W/"5"', 'Meins', 'BC von Paula']);
    expect(screen.queryByText(TA.konflikt)).toBeNull();
  });

  it('Konflikt (412): «Stand der anderen übernehmen» verwirft die eigene Eingabe ohne Speichern (Z7)', async () => {
    let n = 0;
    const api = stub({
      [`GET ${URL_A}`]: () => (n ? json(abschluss({}, { zielerreichung: 'Von Paula', version: 5 }), 200, { etag: 'W/"5"' }) : json(abschluss(), 200, { etag: 'W/"1"' })),
      [`PUT ${URL_A}`]: () => { n++; return json({ title: 'Inzwischen geändert', status: 412 }, 412); },
    });
    renderWithIam(<AbschlussPage nummer="2026-014" />, PL_ME);
    const feld = await screen.findByRole('textbox', { name: TA.felder.zielerreichung });
    await userEvent.type(feld, 'Meins');
    await userEvent.click(await screen.findByRole('button', { name: TA.konfliktUebernehmen }, { timeout: 3000 }));
    await waitFor(() => expect(feld).toHaveValue('Von Paula'));
    expect(screen.queryByText(TA.konflikt)).toBeNull();
    expect(api.calls.filter(c => c.method === 'PUT')).toHaveLength(1);
  });

  it('Sponsor beurteilt die Nutzenrealisierung; Lessons Learned erfassen', async () => {
    let nutzen: Record<string, unknown> = {};
    let lesson: Record<string, unknown> = {};
    const api = stub({
      [`GET ${URL_A}`]: () => json(abschluss({ can: { ...abschluss().can, bearbeiten: false, einreichen: false, nutzenSp: true } }, { stand: 'traktandiert', eingereichtAt: '2026-10-28T08:00:00Z' }), 200, { etag: 'W/"3"' }),
      [`PUT ${URL_A}/nutzen`]: async req => { nutzen = await req.json() as Record<string, unknown>; return json(abschluss({}, { stand: 'traktandiert', eingereichtAt: '2026-10-28T08:00:00Z', version: 4, nutzen: { sp: { text: 'Erreicht', at: '2026-10-28T09:00:00Z', von: 'Sara Sponsor' }, ue: null } }), 200, { etag: 'W/"4"' }); },
      [`POST /v1/projekte/${ID}/lessons-learned`]: async req => { lesson = await req.json() as Record<string, unknown>; return json({}, 201); },
    });
    renderWithIam(<AbschlussPage nummer="2026-014" />, PL_ME);
    await userEvent.type(await screen.findByLabelText(TA.nutzen.sp), 'Erreicht');
    await userEvent.click(screen.getByRole('button', { name: TA.nutzen.speichern }));
    await waitFor(() => expect(nutzen).toEqual({ rolle: 'sp', beurteilung: 'Erreicht' }));
    expect(api.calls.find(c => c.url.endsWith('/nutzen'))!.headers.get('If-Match')).toBe('W/"3"');

    await userEvent.type(screen.getByLabelText(TA.lessons.text), 'Früh mit dem Betrieb planen');
    await userEvent.type(screen.getByLabelText(TA.lessons.kategorie), 'Übergabe');
    await userEvent.click(screen.getByRole('button', { name: TA.lessons.erfassen }));
    await waitFor(() => expect(lesson).toEqual({ text: 'Früh mit dem Betrieb planen', kategorie: 'Übergabe' }));
    expect(api.calls.find(c => c.url.endsWith('/lessons-learned'))!.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('Lesson Learned löschen erst nach der Rückfrage; Download-Fehler sichtbar am Knopf (I-R1, Z5, G12)', async () => {
    const LL = '00000000-0000-4000-8000-0000000000d1';
    const ll = { id: LL, projekt: { id: ID, nummer: '2026-014', name: 'Neues Labor' }, text: 'Früh mit dem Betrieb planen', kategorie: '', jahr: 2026, version: 1,
      createdAt: '2026-10-28T08:00:00Z', von: 'Paula Leiterin', can: { write: true } };
    const api = stub({
      [`GET ${URL_A}`]: () => json(abschluss({ lessonsLearned: [ll] }), 200, { etag: 'W/"1"' }),
      [`DELETE /v1/lessons-learned/${LL}`]: () => new Response(null, { status: 204 }),
      [`GET ${URL_A}/dokument`]: () => json({ type: 'about:blank', title: 'Vorlage fehlt', status: 409, detail: 'Es gibt keine aktive Vorlage «Abschlussbericht».' }, 409, { 'Content-Type': 'application/problem+json' }),
    });
    renderWithIam(<AbschlussPage nummer="2026-014" />, PL_ME);
    expect(await screen.findByText(TA.dokument.personendaten)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: TA.lessons.loeschen(ll.text) }));
    const frage = await screen.findByRole('dialog', { name: TA.lessons.loeschenFrage(ll.text) });
    expect(frage).toHaveTextContent(TA.lessons.loeschenWirkung);
    await expectNoAxe(frage);
    expect(api.calls.some(c => c.method === 'DELETE')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: T.common.cancel }));
    expect(api.calls.some(c => c.method === 'DELETE')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: TA.lessons.loeschen(ll.text) }));
    await userEvent.click(await screen.findByRole('button', { name: TA.lessons.loeschenJa }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'DELETE')).toBe(true));
    expect(await screen.findByText(TA.lessons.geloescht)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: TA.dokument.pdf }));
    expect(await screen.findByRole('alert')).toHaveTextContent(TA.dokument.fehler('Es gibt keine aktive Vorlage «Abschlussbericht».'));
  });

  it('sistiert: Bericht zur Sistierung und Wiederaufnahme mit Begründung (A-09)', async () => {
    let antrag: Record<string, unknown> = {};
    stub({
      [`GET ${URL_A}`]: () => json(abschluss({ lage: 'sistierung', projekt: { ...projekt, phase: 'P2', lebenszyklus: 'sistiert' }, can: { ...abschluss().can, wiederaufnahme: true } }, { art: 'sistierung' }), 200, { etag: 'W/"1"' }),
      [`POST /v1/projekte/${ID}/wiederaufnahme`]: async req => { antrag = await req.json() as Record<string, unknown>; return json(abschluss({ lage: 'sistierung' }, { art: 'sistierung' })); },
    });
    const { container } = renderWithIam(<AbschlussPage nummer="2026-014" />, PL_ME);
    expect(await screen.findByRole('heading', { name: TA.titel.sistierung })).toBeInTheDocument();
    expect(screen.getByText(TA.banner.sistiert)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: TA.felder.projektstand })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: TA.felder.zielerreichung })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TA.wiederaufnahme.aktion }));
    const dialog = screen.getByRole('dialog', { name: TA.wiederaufnahme.titel });
    await userEvent.click(within(dialog).getByRole('button', { name: TA.wiederaufnahme.senden }));
    expect(within(dialog).getByText(TA.wiederaufnahme.fehlt)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(TA.wiederaufnahme.begruendung), 'Finanzierung gesichert');
    await userEvent.click(within(dialog).getByRole('button', { name: TA.wiederaufnahme.senden }));
    await waitFor(() => expect(antrag).toEqual({ begruendung: 'Finanzierung gesichert' }));
    await expectNoAxe(container);
  });

  it('abgeschlossen: nur lesbar mit Grund (Z9); Phase P2 ohne Entscheid: noch kein Abschluss', async () => {
    stub({
      [`GET ${URL_A}`]: () => json(abschluss({ lage: 'abgeschlossen', projekt: { ...projekt, lebenszyklus: 'abgeschlossen' }, can: { ...abschluss().can, bearbeiten: false, einreichen: false } },
        { stand: 'abgenommen', zielerreichung: 'Ziele erreicht', eingereichtAt: '2026-10-01T08:00:00Z', abgenommenAt: '2026-10-15T10:00:00Z' }), 200, { etag: 'W/"0"' }),
    });
    const { unmount } = renderWithIam(<AbschlussPage nummer="2026-014" />, PL_ME);
    expect(await screen.findByText(TA.banner.abgeschlossen('Do 15.10.'))).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: TA.felder.zielerreichung })).toBeDisabled();
    expect(screen.queryByRole('button', { name: TA.panel.einreichen })).not.toBeInTheDocument();
    unmount();

    stub({ [`GET ${URL_A}`]: () => json(abschluss({ lage: 'keine', projekt: { ...projekt, phase: 'P2' }, can: { ...abschluss().can, bearbeiten: false, einreichen: false, dokument: false } }, null), 200, { etag: 'W/"0"' }) });
    renderWithIam(<AbschlussPage nummer="2026-014" />, PL_ME);
    expect(await screen.findByText(TA.keine.titel)).toBeInTheDocument();
  });

  it('vor dem ersten Speichern: die Projektleitung sieht die fehlenden Angaben, nicht «nur lesen»', async () => {
    stub({ [`GET ${URL_A}`]: () => json(abschluss({ can: { ...abschluss().can, einreichen: false } }, null), 200, { etag: 'W/"0"' }) });
    renderWithIam(<AbschlussPage nummer="2026-014" />, PL_ME);
    expect(await screen.findByText('3 Angaben fehlen')).toBeInTheDocument();
    expect(screen.queryByText(TA.banner.nurLesen)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TA.panel.einreichen }));
    expect(screen.getByRole('textbox', { name: TA.felder.zielerreichung })).toHaveFocus();
  });
});
