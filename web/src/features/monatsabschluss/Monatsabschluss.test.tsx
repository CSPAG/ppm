/**
 * Monatsabschluss (AP-E1-2; K1 «Prüfen», UC-005) gegen die nachgebildete API: Kopf der Periode, auffällige zuerst mit
 * Badges, Sammelbestätigung mit Ergebnis (I-L4), Tastatur (↑/↓, B, R, E, Leertaste, Enter), Rückfrage in der Zeile,
 * Schublade mit Vergleich, Abschluss mit Sperre bzw. Wirkung, gesperrte Periode (Z9), Termine, Rechte.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog, Me } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import type { Zeile } from './api.ts';
import { MonatsabschlussPage } from './MonatsabschlussPage.tsx';
import { validateMonatsabschlussSearch, type MonatsabschlussSearch, type SetMonatsabschlussSearch } from './search.ts';
import { TM } from './texte.ts';

const P = '2026-10';
const PF = '00000000-0000-4000-8000-0000000000f1';
const HEUTE = new Date(2026, 9, 27);
const UE: Partial<Me> = { roles: ['ue'], permissions: ['tenant:read', 'projekt:read', 'statusbericht:review', 'periode:close'] };
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const zeile = (n: number, o: Partial<Zeile> = {}): Zeile => ({
  projektId: id(n), projektNummer: `2026-${String(n).padStart(3, '0')}`, projektName: `Vorhaben ${n}`, portfolioId: PF, portfolioName: 'Transformation',
  phase: 'P2', stand: 'eingereicht', entwurf: false, status: 'im_plan', trend: 'gleichbleibend', abschlussPer: '2027-06-30', naechsterMeilenstein: 'Pilot',
  vorperiode: { periode: '2026-09', status: 'im_plan', trend: 'gleichbleibend' }, auffaelligkeiten: [], nachRueckfrage: false, rueckfrage: null,
  eingereichtAt: '2026-10-22T08:00:00Z', geprueftAt: null, eingefordertAt: null, version: 3,
  can: { bestaetigen: true, rueckfrage: true, einfordern: false, zuruecknehmen: false }, ...o,
});

const kopf = (o: Record<string, unknown> = {}) => ({
  periode: P, stand: 'offen', abgeschlossenAt: null, abgeschlossenBy: null, version: 1,
  anzahl: { projekte: 4, eingereicht: 3, zurueckgegeben: 0, geprueft: 0, ausstehend: 1, nichtGemeldet: 0, auffaellig: 1 },
  fristen: { berichtAufgabe: '2026-10-18', stichtag: '2026-10-25', abschlussBis: '2026-10-31' }, vorperiode: '2026-09',
  abschluss: { moeglich: false, sperre: 'Abschluss: 3 Berichte sind eingereicht, aber nicht geprüft. Prüfe diese zuerst.', geprueft: 0, nichtGemeldet: 1 },
  can: { pruefen: true, abschliessen: true }, ...o,
});

const ZEILEN = [
  zeile(1),
  zeile(2, { auffaelligkeiten: [{ art: 'status', von: 'im_plan', nach: 'kritisch' }], status: 'kritisch' }),
  zeile(3, { auffaelligkeiten: [{ art: 'termin', tage: 21, bezug: 'baseline', text: 'Abnahme' }] }),
  zeile(4, { stand: 'ausstehend', status: null, trend: null, eingereichtAt: null, version: 0, can: { bestaetigen: false, rueckfrage: false, einfordern: true, zuruecknehmen: false } }),
];

function Page({ initial = { periode: P } }: { initial?: MonatsabschlussSearch }) {
  const [search, set] = useState<MonatsabschlussSearch>(initial);
  const setSearch = useCallback<SetMonatsabschlussSearch>(next => set(s => {
    const merged: Record<string, string | undefined> = { ...s, ...next };
    return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined)) as MonatsabschlussSearch;
  }), []);
  return <><MonatsabschlussPage search={search} setSearch={setSearch} heute={HEUTE} /><output data-testid="s">{JSON.stringify(search)}</output></>;
}

function stub(routes: Parameters<typeof mockIamApi>[0], items = ZEILEN, k = kopf()) {
  const api = mockIamApi({ [`GET /v1/perioden/${P}`]: () => json({ kopf: k, items, nextCursor: null }), ...routes }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

const zeileVon = async (nr: string) => (await screen.findByRole('button', { name: `${TM.aktion.oeffnen}: ${nr}` })).closest('tr')!;

describe('Monatsabschluss', () => {
  it('zeigt Kopf, auffällige zuerst mit Badges und ist ohne axe-Befund', async () => {
    stub({});
    const { container } = renderWithIam(<Page />, UE);
    expect(await screen.findByText(TM.auff.status)).toBeInTheDocument();
    expect(screen.getByText('Termin +3 Wochen')).toBeInTheDocument();
    expect(screen.getByText(/Oktober 2026 · 3 von 4 eingereicht · 0 geprüft · 1 ausstehend · Stichtag So 25\.10\. · Abschluss bis Sa 31\.10\./)).toBeInTheDocument();
    const nummern = screen.getAllByRole('row').slice(1).map(r => within(r).getByText(/^2026-/).textContent);
    expect(nummern).toEqual(['2026-002', '2026-003', '2026-001', '2026-004']);
    expect(screen.getByText('Im Plan → Kritisch')).toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('Sammelbestätigung: Vorschau nennt bestätigte und übersprungene, Ergebnis mit Rückgängig (A-28, I-L4, I-R1)', async () => {
    let liste = ZEILEN;
    const api = stub({
      [`GET /v1/perioden/${P}`]: () => json({ kopf: kopf(), items: liste, nextCursor: null }),
      [`POST /v1/perioden/${P}/bestaetigen`]: () => {
        liste = [zeile(1, { stand: 'geprueft', version: 4, can: { bestaetigen: false, rueckfrage: false, einfordern: false, zuruecknehmen: true } }), ...ZEILEN.slice(1)];
        return json({ erledigt: [id(1)], uebersprungen: [{ projektId: id(2), projektNummer: '2026-002', grund: 'auffaellig' }, { projektId: id(3), projektNummer: '2026-003', grund: 'auffaellig' }], unbekannt: 0, kopf: kopf() });
      },
      [`POST /v1/projekte/${id(1)}/berichte/${P}/pruefung-zuruecknehmen`]: () => json(zeile(1, { version: 5 })),
    });
    renderWithIam(<Page />, UE);
    await userEvent.click(await screen.findByLabelText(TM.alleAuswaehlen));
    expect(screen.getByText(TM.auswahl(4))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: new RegExp(TM.aktion.sammelBestaetigen(3)) }));
    // Vorschau (I-R1 Stufe 3): noch nichts gesendet, Aufteilung sichtbar
    const dlg = await screen.findByRole('dialog', { name: TM.vorschau.bestaetigenTitel(1) });
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
    expect(within(dlg).getByText(TM.vorschau.uebersprungenAuffaellig(2))).toBeInTheDocument();
    expect(within(dlg).getByText(TM.vorschau.uebersprungenStand(1))).toBeInTheDocument();
    expect(within(dlg).getAllByRole('listitem').map(li => li.textContent)).toEqual(['2026-001 Vorhaben 1', '2026-002 Vorhaben 2', '2026-003 Vorhaben 3', '2026-004 Vorhaben 4']);
    await expectNoAxe(dlg);
    await userEvent.click(within(dlg).getByRole('button', { name: new RegExp(TM.aktion.sammelBestaetigen(1)) }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    const post = api.calls.find(c => c.method === 'POST')!;
    expect(await post.json()).toEqual({ projekte: [id(2), id(3), id(1)] });
    expect(post.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByText('1 bestätigt, 2 mit Auffälligkeit übersprungen.', { selector: '[role=status]' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Rückgängig: je bestätigten Bericht mit aktuellem Stand (If-Match)
    await userEvent.click(await screen.findByRole('button', { name: TM.aktion.zuruecknehmen }));
    await waitFor(() => expect(api.calls.some(c => c.url.endsWith('/pruefung-zuruecknehmen'))).toBe(true));
    expect(api.calls.find(c => c.url.endsWith('/pruefung-zuruecknehmen'))!.headers.get('If-Match')).toBe('W/"4"');
    expect(await screen.findByText(TM.toast.sammelZurueckgenommen(1, 0), { selector: '[role=status]' })).toBeInTheDocument();
  });

  it('Einfordern als Sammelaktion: Vorschau nennt die Projekte, Abbrechen sendet nichts', async () => {
    const api = stub({}, [...ZEILEN, zeile(5, { stand: 'ausstehend', status: null, trend: null, eingereichtAt: null, version: 0, can: { bestaetigen: false, rueckfrage: false, einfordern: true, zuruecknehmen: false } })]);
    renderWithIam(<Page />, UE);
    await userEvent.click(await screen.findByLabelText(TM.alleAuswaehlen));
    await userEvent.click(screen.getByRole('button', { name: new RegExp(TM.aktion.sammelEinfordern(2)) }));
    const dlg = await screen.findByRole('dialog', { name: TM.vorschau.einfordernTitel(null, 2) });
    expect(within(dlg).getByText(TM.vorschau.einfordernWirkung(2))).toBeInTheDocument();
    expect(within(dlg).getAllByRole('listitem')).toHaveLength(2);
    await userEvent.click(within(dlg).getByRole('button', { name: TM.aktion.abbrechen }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
  });

  it('Tastatur: ↓ wechselt die Zeile, B bestätigt mit If-Match, R öffnet die Rückfrage, E fordert nach der Vorschau ein', async () => {
    const api = stub({
      [`POST /v1/projekte/${id(3)}/berichte/${P}/pruefen`]: () => json(zeile(3, { stand: 'geprueft', version: 4 }), 200, { ETag: 'W/"4"' }),
      [`POST /v1/projekte/${id(1)}/berichte/${P}/rueckfragen`]: () => json(zeile(1, { stand: 'zurueckgegeben', version: 4 })),
      [`POST /v1/perioden/${P}/einfordern`]: () => json({ erledigt: [id(4)], uebersprungen: [], unbekannt: 0, kopf: kopf() }),
    });
    renderWithIam(<Page />, UE);
    const erste = await zeileVon('2026-002 Vorhaben 2');
    erste.focus();
    fireEvent.keyDown(erste, { key: 'ArrowDown' });
    const zweite = await zeileVon('2026-003 Vorhaben 3');
    expect(zweite).toHaveFocus();
    fireEvent.keyDown(zweite, { key: 'b' });
    await waitFor(() => expect(api.calls.some(c => c.url.endsWith('/pruefen'))).toBe(true));
    expect(api.calls.find(c => c.url.endsWith('/pruefen'))!.headers.get('If-Match')).toBe('W/"3"');
    expect(await screen.findByText(TM.toast.bestaetigt('2026-003'), { selector: '[role=status]' })).toBeInTheDocument();

    const dritte = await zeileVon('2026-001 Vorhaben 1');
    dritte.focus();
    fireEvent.keyDown(dritte, { key: 'r' });
    const feld = await screen.findByLabelText(new RegExp(TM.rueckfrage.label));
    await waitFor(() => expect(feld).toHaveFocus());
    await userEvent.click(screen.getByRole('button', { name: new RegExp(TM.aktion.senden) }));
    expect(await screen.findByText(TM.rueckfrage.leer)).toBeInTheDocument();
    await userEvent.type(feld, 'Warum verschoben?');
    await userEvent.click(screen.getByRole('button', { name: new RegExp(TM.aktion.senden) }));
    await waitFor(() => expect(api.calls.some(c => c.url.endsWith('/rueckfragen'))).toBe(true));
    expect(await api.calls.find(c => c.url.endsWith('/rueckfragen'))!.json()).toEqual({ text: 'Warum verschoben?' });

    const vierte = await zeileVon('2026-004 Vorhaben 4');
    vierte.focus();
    fireEvent.keyDown(vierte, { key: 'e' });
    const dlg = await screen.findByRole('dialog', { name: TM.vorschau.einfordernTitel('2026-004', 1) });
    expect(api.calls.some(c => c.url.endsWith('/einfordern'))).toBe(false);
    await userEvent.click(within(dlg).getByRole('button', { name: new RegExp(`^${TM.aktion.einfordern}$`) }));
    await waitFor(() => expect(api.calls.some(c => c.url.endsWith('/einfordern'))).toBe(true));
    expect(await screen.findByText(TM.toast.eingefordert(1, 0), { selector: '[role=status]' })).toBeInTheDocument();
  });

  it('Enter öffnet die Schublade mit Vergleich zur Vorperiode', async () => {
    const bericht = (status: string, massnahme: string) => ({
      id: id(99), projektId: id(2), projektNummer: '2026-002', projektName: 'Vorhaben 2', periode: P, periodeStand: 'offen', stand: 'eingereicht', phase: 'P2',
      anlass: 'monatlich', status, trend: 'abwaerts', abschlussPer: '2027-06-30', naechsterMeilenstein: 'Pilot',
      abweichung: Object.fromEntries(['inhalt', 'termin', 'ressourcen', 'budget'].map(d => [d, { stufe: 'keine', kommentar: '' }])),
      abhaengigkeiten: '', entscheide: '', begruendung: '', massnahme, entscheidNoetig: false, vorperiode: null, fehlend: [],
      eingereichtAt: '2026-10-22T08:00:00Z', eingereichtBy: null, geprueftAt: null, version: 3, updatedAt: null, can: { write: false, einreichen: false, zurueckziehen: false },
    });
    stub({
      [`GET /v1/projekte/${id(2)}/berichte/${P}`]: () => json(bericht('kritisch', 'Zweiter Lieferant')),
      [`GET /v1/projekte/${id(2)}/berichte/2026-09`]: () => json(bericht('im_plan', '')),
      [`GET /v1/projekte/${id(2)}/berichte/${P}/rueckfragen`]: () => json({ items: [] }),
    });
    renderWithIam(<Page />, UE);
    const z = await zeileVon('2026-002 Vorhaben 2');
    z.focus();
    fireEvent.keyDown(z, { key: 'Enter' });
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('"o":"bericht:2026-002"'));
    const dialog = await screen.findByRole('dialog', { name: '2026-002 Vorhaben 2' });
    expect(await within(dialog).findByText('Zweiter Lieferant')).toBeInTheDocument();
    expect(within(dialog).getAllByText(/· geändert/)).toHaveLength(2);
    expect(within(dialog).getByRole('button', { name: new RegExp(TM.aktion.bestaetigen) })).toBeInTheDocument();
  });

  it('Abschluss: Sperre mit Ausweg «Eingereichte anzeigen», sonst Wirkung und Abschluss mit If-Match', async () => {
    stub({});
    const r = renderWithIam(<Page />, UE);
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(TM.aktion.abschliessen) }));
    expect(screen.getByText(/3 Berichte sind eingereicht, aber nicht geprüft/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TM.aktion.eingereichteZeigen }));
    expect(screen.getByTestId('s')).toHaveTextContent('"stand":"eingereicht"');
    r.unmount();

    const api = stub({ [`POST /v1/perioden/${P}/abschliessen`]: () => json(kopf({ stand: 'abgeschlossen' })) }, ZEILEN,
      kopf({ abschluss: { moeglich: true, sperre: null, geprueft: 3, nichtGemeldet: 1 } }));
    renderWithIam(<Page />, UE);
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(TM.aktion.abschliessen) }));
    const d = screen.getByRole('dialog');
    expect(within(d).getByText('4 Projekte · 3 geprüft · 1 nicht gemeldet.')).toBeInTheDocument();
    expect(within(d).getByText(/die Werte von September mit dem Vermerk «nicht gemeldet»/)).toBeInTheDocument();
    expect(within(d).getByText(/ab So 1\.11\./)).toBeInTheDocument();
    await userEvent.click(within(d).getByRole('button', { name: new RegExp(TM.aktion.abschliessen) }));
    await waitFor(() => expect(api.calls.some(c => c.url.endsWith('/abschliessen'))).toBe(true));
    expect(api.calls.find(c => c.url.endsWith('/abschliessen'))!.headers.get('If-Match')).toBe('W/"1"');
  });

  it('abgeschlossene Periode: Banner, «nicht gemeldet» mit Vorperiode, keine Aktionen (Z9)', async () => {
    const zu = (z: Zeile) => ({ ...z, can: { bestaetigen: false, rueckfrage: false, einfordern: false, zuruecknehmen: false } });
    stub({}, [zu(zeile(1, { stand: 'geprueft' })), zu(zeile(4, { stand: 'nicht_gemeldet', status: 'kritisch', vorperiode: { periode: '2026-09', status: 'kritisch', trend: null } }))],
      kopf({ stand: 'abgeschlossen', abgeschlossenAt: '2026-10-31T16:00:00Z', abgeschlossenBy: { id: id(77), name: 'Sandra Frei' }, can: { pruefen: false, abschliessen: false } }));
    const { container } = renderWithIam(<Page />, UE);
    expect(await screen.findByText(/Oktober ist abgeschlossen \(Sa 31\.10\., Sandra Frei\)/)).toBeInTheDocument();
    expect(screen.getByText('Nicht gemeldet · Vorperiode Kritisch')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: new RegExp(TM.aktion.abschliessen) })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: new RegExp(TM.aktion.bestaetigen) })).not.toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('Termine: nach Verschiebung mit Text zum Balken und Projekten ohne Baseline', async () => {
    stub({
      [`GET /v1/perioden/${P}/terminabweichungen`]: () => json({
        items: [{ projektId: id(3), projektNummer: '2026-003', projektName: 'Vorhaben 3', phase: 'P2', phasen: [{ phase: 'P2', baseline: '2027-03-31', aktuell: '2027-04-21', tage: 21 }], abschluss: { baseline: '2027-06-30', aktuell: '2027-07-21', tage: 21 }, maxTage: 21 }],
        ohneBaseline: [{ projektId: id(4), projektNummer: '2026-004', projektName: 'Vorhaben 4' }],
      }),
    });
    const { container } = renderWithIam(<Page initial={{ periode: P, ansicht: 'termine' }} />, UE);
    expect(await screen.findByRole('link', { name: TM.aktion.projektOeffnen('2026-003') })).toHaveAttribute('href', '/projekte/2026-003');
    expect(screen.getAllByText('+3 Wochen').length).toBeGreaterThan(0);
    expect(screen.getByText(/2026-004/)).toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('ohne Prüfrecht nur der Hinweis; Adresse prüft Periode, Stand und Schlüssel (I-N5)', async () => {
    stub({});
    renderWithIam(<Page />, { roles: ['leser'], permissions: ['tenant:read', 'handlungsfeld:read'] });
    expect(await screen.findByText(TM.keinRecht)).toBeInTheDocument();
    expect(validateMonatsabschlussSearch({ periode: '2026-10', stand: 'eingereicht', o: 'bericht:2026-014', auffaellig: '1', x: 1 }))
      .toEqual({ periode: '2026-10', stand: 'eingereicht', o: 'bericht:2026-014', auffaellig: '1' });
    expect(validateMonatsabschlussSearch({ periode: '2026-13', stand: 'offen', o: '00000000-0000-4000-8000-000000000001' })).toEqual({});
  });

  it('ohne Periode in der Adresse die Periode in Arbeit aus dem Kopf', async () => {
    stub({ 'GET /v1/statusberichte/kopf': () => json({ pruefen: { periode: P, eingereicht: 3, ausstehend: 1, auffaellig: 1, abschlussBis: '2026-10-31' } }) });
    renderWithIam(<Page initial={{}} />, UE);
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent(`"periode":"${P}"`));
    expect(await screen.findByText(TM.auff.status)).toBeInTheDocument();
  });
});
