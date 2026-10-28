/**
 * Assistent «Projektidee» und «Meine Ideen» (AP-E4-1, K4) gegen die nachgebildete API: Sperre der Pflichtfelder beim
 * «Weiter», Entwurf beim ersten Speichern mit Idempotency-Key, Fokus auf die Überschrift des Schritts, Vorbelegung aus
 * dem Zielzyklus, Zusammenfassung mit Wirkung, Einreichen mit If-Match und Bestätigung, Entwurf anbieten, Rückfragen
 * über dem Feld beantworten und erneut einreichen, Ansicht nur lesen, Liste mit Stand.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import type { AppPermission } from '../../auth/permissions.ts';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { IdeenPage } from './IdeenPage.tsx';
import { IdeeNeuPage, IdeePage } from './IdeeSeiten.tsx';
import { ideeNeuPfad, validateIdeeNeuSearch } from './search.ts';
import { PFLICHT, TI } from './texte.ts';

const ID = '00000000-0000-4000-8000-0000000000a1';
const HF = '00000000-0000-4000-8000-0000000000f1';
const HF2 = '00000000-0000-4000-8000-0000000000f2';
const Z1 = '00000000-0000-4000-8000-0000000000c1';
const B1 = '00000000-0000-4000-8000-0000000000b1';
const RF = '00000000-0000-4000-8000-0000000000d1';
const AS: AppPermission[] = ['tenant:read', 'stammdaten:read', 'phasenmodell:read', 'portfolio:read', 'idee:create'];
const ALS_AS = { roles: ['antragsteller'], permissions: AS };

const auswahl = {
  handlungsfelder: [
    { id: HF, label: 'Patientenorientierung', leitsatz: 'Der Mensch im Mittelpunkt.', ziele: [{ id: Z1, nummer: '1.1', text: 'Zugang verbessern' }] },
    { id: HF2, label: 'Wirtschaftlichkeit', leitsatz: '', ziele: [] },
  ],
  bereiche: [{ id: B1, kuerzel: 'DPF', name: 'Pflege', parentId: null }],
  herkunft: [{ schluessel: 'innovationsprozess', label: 'Innovationsprozess' }, { schluessel: 'strategieprozess', label: 'Strategieprozess' }, { schluessel: 'bereich', label: 'Bereich' }],
};

const idee = (o: Record<string, unknown> = {}) => ({
  id: ID, nummer: 7, stand: 'entwurf', standAt: '2026-10-06T08:00:00Z', eingereichtAt: null, erfasstVon: ID, eigene: true,
  titel: '', ausgangslage: '', zielsetzung: '', handlungsfeldId: null, strategischesZielId: null, bereiche: [], nutzen: null, nutzenText: '',
  aufwand: null, aufwandText: '', relevanz: null, relevanzText: '', herkunft: null, fuehrendeIdeeId: null, begruendung: '', rueckfragen: [],
  version: 1, createdAt: '2026-10-06T08:00:00Z', updatedAt: '2026-10-06T08:00:00Z', can: { bearbeiten: true, einreichen: true, loeschen: true }, ...o,
});
const zeile = (i: ReturnType<typeof idee>, offen = 0) => ({
  id: i.id, nummer: i.nummer, titel: i.titel, stand: i.stand, standAt: i.standAt, eingereichtAt: i.eingereichtAt, eigene: true,
  handlungsfeldId: i.handlungsfeldId, rueckfragenOffen: offen, updatedAt: i.updatedAt,
});

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi({ 'GET /v1/ideen/auswahl': () => json(auswahl), ...routes }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

/** Nachgebildete Idee auf dem Server: Anlegen, Ändern (Version + 1), Einreichen. */
function server(start: ReturnType<typeof idee> | null, liste: ReturnType<typeof idee>[] = []) {
  let cur = start;
  const api = stub({
    'GET /v1/ideen': (req: Request) => {
      const u = new URL(req.url);
      if (u.searchParams.get('nummer')) return json({ items: cur ? [zeile(cur)] : [], nextCursor: null });
      // Entwürfe: auch der eben angelegte (der Assistent darf sich davon nicht unterbrechen lassen)
      if (u.searchParams.get('stand') === 'entwurf') return json({ items: cur?.stand === 'entwurf' ? [zeile(cur)] : [], nextCursor: null });
      return json({ items: liste.map(i => zeile(i)), nextCursor: null });
    },
    [`GET /v1/ideen/${ID}`]: () => json(cur, 200, { ETag: `W/"${cur!.version}"` }),
    'POST /v1/ideen': async (req: Request) => { cur = idee({ ...(await req.json()) }); return json(cur, 201, { ETag: 'W/"1"' }); },
    [`PATCH /v1/ideen/${ID}`]: async (req: Request) => { cur = idee({ ...cur, ...(await req.json()), version: cur!.version + 1 }); return json(cur, 200, { ETag: `W/"${cur.version}"` }); },
    [`POST /v1/ideen/${ID}/einreichen`]: () => { cur = idee({ ...cur, stand: 'eingereicht', version: cur!.version + 1, can: { bearbeiten: false, einreichen: false, loeschen: false } }); return json(cur, 200, { ETag: `W/"${cur.version}"` }); },
    [`PUT /v1/ideen/${ID}/rueckfragen/${RF}`]: async (req: Request) => json({ id: RF, feld: 'zielsetzung', text: 'Woran messen Sie den Erfolg?', antwort: (await req.json()).antwort, gestelltAt: '2026-10-07T08:00:00Z', beantwortetAt: '2026-10-08T08:00:00Z' }),
  });
  return api;
}

const gehe = vi.fn<(p: string) => void>();

describe('Assistent Projektidee', () => {
  it('sperrt «Weiter» ohne Pflichtfelder, legt den Entwurf an und führt durch alle Schritte bis zur Bestätigung', async () => {
    const api = server(null);
    const { container } = renderWithIam(<IdeeNeuPage search={{}} gehe={gehe} />, ALS_AS);
    const titel = await screen.findByLabelText(TI.titelFeld);
    expect(screen.getByRole('heading', { name: TI.schritt(1, 4, TI.schritte[0]!) })).toBeInTheDocument();
    await expectNoAxe(container);

    await userEvent.click(screen.getByRole('button', { name: TI.weiterSchritt }));
    expect(screen.getByText(PFLICHT.zielsetzung)).toBeInTheDocument();
    expect(titel).toHaveFocus();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);

    await userEvent.type(titel, 'Digitale Aufnahme');
    await userEvent.type(screen.getByLabelText(TI.ausgangslage), 'Papier');
    await userEvent.type(screen.getByLabelText(TI.zielsetzung), 'Ohne Papier');
    await userEvent.click(screen.getByRole('button', { name: TI.weiterSchritt }));
    const h2 = await screen.findByRole('heading', { name: TI.schritt(2, 4, TI.schritte[1]!) });
    expect(h2).toHaveFocus();
    await waitFor(() => expect(api.calls.filter(c => c.method === 'POST')).toHaveLength(1));
    const post = api.calls.find(c => c.method === 'POST')!;
    expect(post.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(await post.json()).toMatchObject({ titel: 'Digitale Aufnahme', ausgangslage: 'Papier', zielsetzung: 'Ohne Papier' });

    // Schritt 2: Handlungsfeld mit Leitsatz, dann seine Ziele; Bereiche und Herkunft freiwillig
    await userEvent.click(screen.getByRole('button', { name: TI.weiterSchritt }));
    expect(screen.getByText(PFLICHT.handlungsfeldId)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Patientenorientierung/ }));
    await userEvent.click(screen.getByRole('radio', { name: '1.1 Zugang verbessern' }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Pflege/ }));
    await expectNoAxe(container);
    await userEvent.click(screen.getByRole('button', { name: TI.weiterSchritt }));

    // Schritt 3: erste Einschätzung
    await screen.findByRole('heading', { name: TI.schritt(3, 4, TI.schritte[2]!) });
    await userEvent.click(screen.getByRole('button', { name: TI.weiterSchritt }));
    expect(screen.getByText(PFLICHT.nutzen)).toBeInTheDocument();
    for (const g of [TI.nutzen, TI.aufwand, TI.relevanz]) await userEvent.click(screen.getAllByRole('radiogroup', { name: g })[0]!.querySelector('input[value="hoch"]')!);
    await userEvent.click(screen.getByRole('button', { name: TI.weiterSchritt }));

    // Schritt 4: Zusammenfassung mit Wirkung, dann Einreichen mit If-Match
    await screen.findByRole('heading', { name: TI.schritt(4, 4, TI.schritte[3]!) });
    expect(screen.getByText('Patientenorientierung')).toBeInTheDocument();
    expect(screen.getByText('1.1 Zugang verbessern')).toBeInTheDocument();
    expect(screen.getByText(TI.wirkung)).toBeInTheDocument();
    await expectNoAxe(container);
    await userEvent.click(screen.getByRole('button', { name: TI.einreichen }));
    expect(await screen.findByRole('heading', { name: TI.eingereicht })).toBeInTheDocument();
    expect(screen.getByText(TI.bestaetigung)).toBeInTheDocument();
    const senden = api.calls.find(c => c.method === 'POST' && c.url.endsWith('/einreichen'))!;
    expect(senden.headers.get('If-Match')).toMatch(/^W\/"\d+"$/);
    const patches = api.calls.filter(c => c.method === 'PATCH');
    expect(await patches[patches.length - 1]!.json()).toMatchObject({ handlungsfeldId: HF, strategischesZielId: Z1, bereiche: [B1], nutzen: 'hoch', aufwand: 'hoch', relevanz: 'hoch' });
  });

  it('übernimmt die Vorbelegung aus dem Zielzyklus (Handlungsfeld und Ziel) und die Herkunft', async () => {
    const api = server(null);
    renderWithIam(<IdeeNeuPage search={validateIdeeNeuSearch({ ziel: 'ziel:1.1', herkunft: 'strategieprozess' })} gehe={gehe} />, ALS_AS);
    await userEvent.type(await screen.findByLabelText(TI.titelFeld), 'Aus dem Zielzyklus');
    await userEvent.type(screen.getByLabelText(TI.ausgangslage), 'A');
    await userEvent.type(screen.getByLabelText(TI.zielsetzung), 'Z');
    await userEvent.click(screen.getByRole('button', { name: TI.weiterSchritt }));
    expect(await screen.findByRole('radio', { name: '1.1 Zugang verbessern' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Strategieprozess' })).toBeChecked();
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    expect(await api.calls.find(c => c.method === 'POST')!.json()).toMatchObject({ handlungsfeldId: HF, strategischesZielId: Z1, herkunft: 'strategieprozess' });
    expect(ideeNeuPfad({ ziel: '1.1' })).toBe('/portfolio/ideen/neu?ziel=ziel%3A1.1');
  });

  it('bietet einen offenen Entwurf an', async () => {
    const e = idee({ titel: 'Halb fertig' });
    stub({ 'GET /v1/ideen': () => json({ items: [zeile(e)], nextCursor: null }) });
    renderWithIam(<IdeeNeuPage search={{}} gehe={gehe} />, ALS_AS);
    expect(await screen.findByText(/Halb fertig/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: TI.entwurfFortsetzen })).toHaveAttribute('href', '/portfolio/ideen/7');
    await userEvent.click(screen.getByRole('button', { name: TI.neuBeginnen }));
    expect(await screen.findByLabelText(TI.titelFeld)).toHaveValue('');
  });

  it('zeigt Rückfragen über dem Feld, speichert die Antwort und reicht erneut ein (UC-001 A2.2)', async () => {
    const e = idee({
      stand: 'in_ergaenzung', titel: 'Aufnahme', ausgangslage: 'Papier', zielsetzung: 'Ohne Papier', handlungsfeldId: HF, nutzen: 'hoch', aufwand: 'mittel', relevanz: 'tief',
      rueckfragen: [{ id: RF, feld: 'zielsetzung', text: 'Woran messen Sie den Erfolg?', antwort: null, gestelltAt: '2026-10-07T08:00:00Z', beantwortetAt: null }],
      can: { bearbeiten: true, einreichen: true, loeschen: false },
    });
    const api = server(e);
    const { container } = renderWithIam(<IdeePage nummer={7} search={{}} setSearch={vi.fn()} gehe={gehe} />, ALS_AS);
    expect(await screen.findByText('Woran messen Sie den Erfolg?')).toBeInTheDocument();
    expect(screen.getByText(TI.rueckfragenBanner(1))).toBeInTheDocument();
    await expectNoAxe(container);
    await userEvent.type(screen.getByLabelText(TI.antwort), 'Aufnahmezeit unter 10 Minuten');
    await userEvent.tab();
    await waitFor(() => expect(api.calls.some(c => c.method === 'PUT')).toBe(true));
    expect(await api.calls.find(c => c.method === 'PUT')!.json()).toEqual({ antwort: 'Aufnahmezeit unter 10 Minuten' });
    for (let i = 0; i < 3; i++) await userEvent.click(screen.getByRole('button', { name: TI.weiterSchritt }));
    expect(screen.getByText(TI.wirkungErneut)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TI.erneutEinreichen }));
    expect(await screen.findByRole('heading', { name: TI.eingereicht })).toBeInTheDocument();
  });

  it('zeigt eine eingereichte Idee nur lesend, ohne Bearbeiten', async () => {
    server(idee({ stand: 'eingereicht', titel: 'Aufnahme', zielsetzung: 'Ohne Papier', handlungsfeldId: HF, eingereichtAt: '2026-10-03T08:00:00Z', can: { bearbeiten: false, einreichen: false, loeschen: false } }));
    const { container } = renderWithIam(<IdeePage nummer={7} search={{}} setSearch={vi.fn()} gehe={gehe} />, ALS_AS);
    expect(await screen.findByText(TI.nurLesen)).toBeInTheDocument();
    expect(screen.getByText('eingereicht')).toBeInTheDocument();
    expect(await screen.findByText('Patientenorientierung')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TI.weiterSchritt })).toBeNull();
    await expectNoAxe(container);
  });

  it('unbekannte Nummer: gleiche Meldung wie ohne Zugriff (Z10)', async () => {
    server(null);
    renderWithIam(<IdeePage nummer={99} search={{}} setSearch={vi.fn()} gehe={gehe} />, ALS_AS);
    expect(await screen.findByText(TI.nichtGefunden)).toBeInTheDocument();
  });
});

describe('Meine Ideen', () => {
  it('zeigt die eigenen Ideen mit Stand und offenen Rückfragen', async () => {
    stub({ 'GET /v1/ideen': () => json({ items: [zeile(idee({ titel: 'Aufnahme', stand: 'in_ergaenzung' }), 2), zeile(idee({ id: 'x', nummer: 8, titel: 'Entwurf A' }))], nextCursor: null }) });
    const { container } = renderWithIam(<IdeenPage gehe={gehe} />, ALS_AS);
    expect(await screen.findByText(TI.rueckfragenOffen(2))).toBeInTheDocument();
    expect(screen.getByText('in Ergänzung')).toBeInTheDocument();
    expect(screen.getAllByText(/zuletzt bearbeitet/)).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /Aufnahme, in Ergänzung/ }));
    expect(gehe).toHaveBeenCalledWith('/portfolio/ideen/7');
    await expectNoAxe(container);
  });

  it('leer: erklärt die Ansicht und bietet «Projektidee einreichen»', async () => {
    stub({ 'GET /v1/ideen': () => json({ items: [], nextCursor: null }) });
    renderWithIam(<IdeenPage gehe={gehe} />, ALS_AS);
    expect(await screen.findByText(TI.leer)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: TI.einreichen })[0]).toHaveAttribute('href', '/portfolio/ideen/neu');
  });
});
