/**
 * Sitzung vorbereiten (AP-E2-1, UI-33, K3) gegen die nachgebildete API: leere Sitzung mit Vorschlägen (Z2), Aufnehmen
 * mit Idempotency-Key, Traktandum mit Zeitbedarf, «via SNS-VR» und Warnung «Unterlagen fehlen» samt Verschieben und
 * Rückgängig, Umordnen mit Alt+↓ und If-Match, Versand mit Vorschau der Wirkung (I-R1), Lesemodus nach dem Versand,
 * Termin ohne Sitzung anlegen, Übersicht je Gremium; festes Traktandum 1 ohne Griff und Entfernen (K3 Schritt 4).
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog, Me } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { validateSitzungSearch } from './search.ts';
import { SitzungenPage } from './SitzungenPage.tsx';
import { SitzungPage } from './SitzungPage.tsx';
import { TS } from './texte.ts';

const SID = '00000000-0000-4000-8000-0000000000s1'.replace('s', 'a');
const GID = '00000000-0000-4000-8000-0000000000g1'.replace('g', 'b');
const PF = '00000000-0000-4000-8000-0000000000c1';
const T1 = '00000000-0000-4000-8000-0000000000d1';
const T2 = '00000000-0000-4000-8000-0000000000d2';
const URL_S = '/v1/gremien/prat/sitzungen/2026-11-18';

const frist = { bis: '2026-11-11', arbeitstage: 5, restArbeitstage: 4, vorlauf: 9, eingehalten: true };
const traktandum = (o: Record<string, unknown> = {}) => ({
  id: T1, sitzungId: SID, art: 'gate', artLabel: 'Gate-Review', bezug: { typ: 'gate_antrag', id: 'x' },
  projekt: { id: PF, nummer: '2026-014', name: 'Neues KIS', phase: 'P1' }, titel: 'Gate P1–P2 Neues KIS', antrag: 'Freigabe Phase P2 und Projektvertrag Version 2.0',
  position: 1, dauerMin: 35, zeit: '14:00', stand: 'traktandiert', viaSns: true, vertraulich: false, fest: false, verschobenVon: null,
  unterlagen: { stand: 'bereit', liste: [{ art: 'packet', titel: 'Gate Review Packet', bereit: true, hinweis: 'Quality-Check bestanden 28.10.' }] },
  einladungen: [{ personId: PF, name: 'Anna Muster', funktion: 'pl' }], version: 1, ...o,
});
const sitzung = (o: Record<string, unknown> = {}) => ({
  id: SID, gremium: { id: GID, kuerzel: 'prat', name: 'Programmausschuss' }, portfolioId: PF, datum: '2026-11-18', beginn: '14:00', dauerMin: 180, ort: 'Sitzungszimmer 1',
  stand: 'in_vorbereitung', versendetAt: null, versandVorlauf: null, frist, zeitbedarfMin: 0, traktanden: [], version: 3,
  createdAt: '2026-10-20T08:00:00Z', updatedAt: '2026-10-20T08:00:00Z', can: { write: true }, ...o,
});
const vorschlaege = { gruppen: [{ art: 'gate', label: 'Gate-Review', traktanden: [traktandum({ sitzungId: null, position: null, stand: 'vorgeschlagen', einladungen: [], zeit: null, dauerMin: null })] }] };
const UE: Partial<Me> = { roles: ['ue'], permissions: ['tenant:read', 'portfolio:read', 'projekt:read', 'sitzung:read', 'sitzung:write'] };

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi({
    'GET /v1/projekte': () => json({ items: [], nextCursor: null }),
    'GET /v1/gremien/prat/sitzungen': () => json({ gremium: { id: GID, kuerzel: 'prat', name: 'Programmausschuss' }, items: [], nextCursor: null, can: { write: true } }),
    ...routes,
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

const Page = (p: { traktandum?: string }) => <SitzungPage kuerzel="prat" datum="2026-11-18" search={p} setSearch={() => {}} />;

describe('Sitzung vorbereiten', () => {
  it('leere Sitzung erklärt die Vorschläge; Aufnehmen mit Idempotency-Key (K3 Schritte 1–2, Z2)', async () => {
    let s = sitzung();
    const api = stub({
      [`GET ${URL_S}`]: () => json(s, 200, { ETag: 'W/"3"' }),
      [`GET /v1/sitzungen/${SID}/vorschlaege`]: () => json(s.traktanden.length ? { gruppen: [] } : vorschlaege),
      [`POST /v1/sitzungen/${SID}/traktanden`]: () => { s = sitzung({ traktanden: [traktandum()], zeitbedarfMin: 35, version: 4 }); return json(s); },
    });
    const { container } = renderWithIam(<Page />, UE);
    expect(await screen.findByText(TS.leer(1))).toBeInTheDocument();
    expect(screen.getByText(/in 4 Arbeitstagen/)).toBeInTheDocument();
    await expectNoAxe(container);
    await userEvent.click(screen.getByRole('button', { name: TS.aufnehmenName('Gate P1–P2 Neues KIS') }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    const post = api.calls.find(c => c.method === 'POST')!;
    expect(post.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(await post.json()).toEqual({ vorschlagId: T1 });
    const liste = await screen.findByRole('list', { name: TS.liste });
    expect(within(liste).getByText('Freigabe Phase P2 und Projektvertrag Version 2.0')).toBeInTheDocument();
    expect(within(liste).getByText(TS.viaSns)).toBeInTheDocument();
    expect(within(liste).getByText(/14:00 · 35 Min\./)).toBeInTheDocument();
    expect(within(liste).getByText(/Anna Muster \(PL\)/)).toBeInTheDocument();
    expect(screen.getByText(/35 Min\. von 3 h/)).toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('Unterlagen fehlen: Warnung mit Ausweg, Verschieben mit Rückgängig (UC-006 A2)', async () => {
    let s = sitzung({ traktanden: [traktandum({ unterlagen: { stand: 'quality_check_offen', liste: [] } })], zeitbedarfMin: 35 });
    const api = stub({
      [`GET ${URL_S}`]: () => json(s),
      [`GET /v1/sitzungen/${SID}/vorschlaege`]: () => json({ gruppen: [] }),
      [`POST /v1/traktanden/${T1}/verschieben`]: () => { s = sitzung(); return json({ traktandum: traktandum({ stand: 'verschoben' }), nach: { id: GID, datum: '2026-12-16' } }); },
      [`POST /v1/sitzungen/${SID}/traktanden`]: () => json(sitzung({ traktanden: [traktandum()] })),
    });
    renderWithIam(<Page />, UE);
    expect(await screen.findByText(TS.qcWarnung('2026-014 Gate P1–P2 Neues KIS'))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TS.verschieben }));
    const undo = await screen.findByRole('button', { name: TS.rueckgaengig });
    expect(screen.getByText(/Traktandum auf Mi 16\.12\. verschoben/)).toBeInTheDocument();
    await userEvent.click(undo);
    await waitFor(() => expect(api.calls.filter(c => c.method === 'POST').length).toBe(2));
    expect(await api.calls.filter(c => c.method === 'POST')[1]!.json()).toEqual({ vorschlagId: T1 });
  });

  it('ordnet mit Alt+↓ und If-Match (I-M2)', async () => {
    const s = sitzung({ traktanden: [traktandum(), traktandum({ id: T2, position: 2, titel: 'Eskalation', projekt: null, viaSns: false })], zeitbedarfMin: 35 });
    const api = stub({
      [`GET ${URL_S}`]: () => json(s),
      [`GET /v1/sitzungen/${SID}/vorschlaege`]: () => json({ gruppen: [] }),
      [`PUT /v1/sitzungen/${SID}/traktanden`]: () => json(sitzung({ ...s, traktanden: [s.traktanden[1], s.traktanden[0]], version: 4 })),
    });
    renderWithIam(<Page />, UE);
    const griff = await screen.findByRole('button', { name: TS.griff(1, '2026-014 Gate P1–P2 Neues KIS') });
    griff.focus();
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    await waitFor(() => expect(api.calls.some(c => c.method === 'PUT')).toBe(true));
    const put = api.calls.find(c => c.method === 'PUT')!;
    expect(put.headers.get('If-Match')).toBe('W/"3"');
    expect(await put.json()).toEqual({ reihenfolge: [T2, T1] });
  });

  it('festes Traktandum 1 «Bericht der Programmleitung»: ohne Griff und Entfernen, mit Hinweis; nichts darüber (K3 Schritt 4)', async () => {
    const fest = traktandum({ id: T2, art: 'portfoliobericht', artLabel: 'Portfoliobericht', bezug: { typ: 'sitzung', id: SID }, projekt: null, titel: 'Bericht der Programmleitung',
      antrag: '', dauerMin: null, viaSns: false, fest: true, einladungen: [], unterlagen: { stand: 'fehlt', liste: [] } });
    const s = sitzung({ traktanden: [fest, traktandum({ position: 2 })], zeitbedarfMin: 35 });
    stub({ [`GET ${URL_S}`]: () => json(s), [`GET /v1/sitzungen/${SID}/vorschlaege`]: () => json({ gruppen: [] }) });
    const { container } = renderWithIam(<Page />, UE);
    const liste = await screen.findByRole('list', { name: TS.liste });
    expect(within(liste).getByText(`${TS.festHinweis} ${TS.festPlatzhalter}`)).toBeInTheDocument();
    expect(within(liste).queryByRole('button', { name: /Bericht der Programmleitung/ })).toBeNull();
    expect(within(liste).queryByRole('button', { name: /Auf nächste Sitzung verschieben/ })).toBeNull();
    expect(within(liste).getByRole('button', { name: TS.nachOben('2026-014 Gate P1–P2 Neues KIS') })).toBeDisabled();
    await expectNoAxe(container);
  });

  it('Versand: Vorschau der Wirkung, dann ein bewusster Klick (K3 Schritt 5, I-R1)', async () => {
    let s = sitzung({ traktanden: [traktandum()], zeitbedarfMin: 35 });
    const api = stub({
      [`GET ${URL_S}`]: () => json(s),
      [`GET /v1/sitzungen/${SID}/vorschlaege`]: () => json({ gruppen: [] }),
      [`GET /v1/sitzungen/${SID}/versand`]: () => json({ frist, traktanden: 6, unterlagen: { packet: 3, bericht: 1, beilage: 0 }, eingeladene: 7, warnungen: [], verschoben: 0 }),
      [`POST /v1/sitzungen/${SID}/versenden`]: () => { s = sitzung({ ...s, stand: 'versendet', versendetAt: '2026-11-05T09:00:00Z', can: { write: false }, version: 4 }); return json(s); },
    });
    const { container } = renderWithIam(<Page />, UE);
    await userEvent.click(await screen.findByRole('button', { name: TS.versenden }));
    const dialog = await screen.findByRole('dialog', { name: TS.versandTitel });
    expect(await within(dialog).findByText('Die Mitglieder des PRAT erhalten Traktandenliste (6 Traktanden), Portfoliobericht und 3 Gate Review Packets.')).toBeInTheDocument();
    expect(within(dialog).getByText(TS.versandEingeladene(7))).toBeInTheDocument();
    expect(within(dialog).getByText(TS.fristEingehalten(9))).toBeInTheDocument();
    await expectNoAxe(container.ownerDocument.body);
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: TS.versenden }));
    await waitFor(() => expect(api.calls.find(c => c.method === 'POST')?.headers.get('If-Match')).toBe('W/"3"'));
    expect(await screen.findByText(/Unterlagen versendet am .* Die Traktandenliste ist fest\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TS.versenden })).not.toBeInTheDocument();
  });

  it('Mitglieder lesen ohne Bearbeiten-Elemente (Z8)', async () => {
    stub({ [`GET ${URL_S}`]: () => json(sitzung({ stand: 'versendet', versendetAt: '2026-11-05T09:00:00Z', traktanden: [traktandum()], can: { write: false } })) });
    renderWithIam(<Page />, { roles: ['gremium'], permissions: ['tenant:read', 'sitzung:read'] });
    expect(await screen.findByText('Freigabe Phase P2 und Projektvertrag Version 2.0')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /nach oben|aufnehmen|versenden/i })).not.toBeInTheDocument();
    expect(screen.queryByText(TS.vorschlaege)).not.toBeInTheDocument();
  });

  it('Termin ohne Sitzung: «Sitzung vorbereiten» legt sie an; sonst wie nicht gefunden (Z10)', async () => {
    const api = stub({
      [`GET ${URL_S}`]: () => json({ title: 'Sitzung nicht gefunden', status: 404 }, 404),
      'GET /v1/gremien/prat/sitzungen': () => json({ gremium: { id: GID, kuerzel: 'prat', name: 'Programmausschuss' }, items: [{ datum: '2026-11-18', id: null, stand: 'geplant', traktanden: 0, versendetAt: null }], nextCursor: null, can: { write: true } }),
      'POST /v1/gremien/prat/sitzungen': () => json(sitzung(), 201),
      [`GET /v1/sitzungen/${SID}/vorschlaege`]: () => json({ gruppen: [] }),
    });
    renderWithIam(<Page />, UE);
    await userEvent.click(await screen.findByRole('button', { name: TS.anlegen }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    expect(await api.calls.find(c => c.method === 'POST')!.json()).toEqual({ datum: '2026-11-18' });
    expect(await screen.findByText(TS.leer(0))).toBeInTheDocument();
  });

  it('Übersicht: Termine je Gremium öffnen die Sitzung', async () => {
    stub({
      'GET /v1/gremien': () => json({ items: [{ id: GID, portfolioId: PF, kuerzel: 'prat', name: 'Programmausschuss', art: 'entscheidend', rhythmus: '', version: 1, createdAt: '', createdBy: null, updatedAt: '', updatedBy: null, can: { admin: false } }], nextCursor: null }),
      'GET /v1/gremien/prat/sitzungen': () => json({ gremium: { id: GID, kuerzel: 'prat', name: 'Programmausschuss' }, items: [{ datum: '2026-11-18', id: SID, stand: 'versendet', traktanden: 6, versendetAt: '2026-11-05T09:00:00Z' }], nextCursor: null, can: { write: false } }),
    });
    const gehe = vi.fn();
    const { container } = renderWithIam(<SitzungenPage kuerzel="prat" gehe={gehe} />, UE);
    await userEvent.click(await screen.findByRole('button', { name: /Sitzung PRAT .*18\.11\..* öffnen/ }));
    expect(gehe).toHaveBeenCalledWith('/gremien/prat/sitzungen/2026-11-18');
    await expectNoAxe(container);
  });

  it('Adresse: Traktandum als Position, Unbekanntes fällt weg (I-N5)', () => {
    expect(validateSitzungSearch({ traktandum: '3', x: 1 })).toEqual({ traktandum: '3' });
    expect(validateSitzungSearch({ traktandum: 'abc' })).toEqual({});
  });
});
