/**
 * Seite «Vorlagen» (AP-E7-7, UI-48; UC-018 Schritte 1–2) gegen die nachgebildete API: Liste aller Dokumentarten mit
 * gültiger Vorlage, Schublade mit Versionen, Hochladen (Base64, Idempotency-Key), Zuordnung mit Prüfbericht, Aktiv
 * setzen mit Wirkung vorher (I-F5), Entwurf löschen, Konflikt (412), Art ohne Datenquelle, axe.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import type { AppPermission } from '../../auth/permissions.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { T } from '../../ui/index.ts';
import { validateVorlagenSearch, type SetVorlagenSearch, type VorlagenSearch } from './search.ts';
import { TV } from './texte.ts';
import { VorlagenPage } from './VorlagenPage.tsx';

const UE = { roles: ['ue'], permissions: ['tenant:read', 'vorlage:write'] as AppPermission[] };

const liste = (aktiv: number | null = null) => ({ items: [
  { art: 'projektvertrag', name: 'Projektvertrag', grundbestand: { version: '1', quelle: 'Q7' }, aktiv, entwuerfe: 1, versionen: 1, datenquelle: true },
  { art: 'vorstudie', name: 'Vorstudie', grundbestand: null, aktiv: null, entwuerfe: 0, versionen: 0, datenquelle: false },
] });

const version = (o: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-0000000000f1', art: 'projektvertrag', version: 1, stand: 'entwurf', dateiname: 'Vertrag.docx', groesse: 1200, sha256: 'a'.repeat(64),
  platzhalter: ['Projektname', 'Unbekannt'], zuordnung: { Projektname: 'projekt.name', Unbekannt: null }, personendaten: false, bemerkung: '',
  aktivAt: null, erstelltAt: '2026-10-28T08:00:00Z', erstelltVon: { id: '00000000-0000-4000-8000-0000000000c1', name: 'Ursula Ebner' }, rev: 1,
  pruefung: { aktivierbar: false, meldungen: [
    { stufe: 'sperre', regel: 'zuordnung', text: 'Zuordnung fehlt: 1 von 2 Platzhaltern ohne Datenfeld («Unbekannt»).', platzhalter: ['Unbekannt'] },
    { stufe: 'warnung', regel: 'personendaten', text: 'Kennzeichnung fehlt: Die Vorlage nennt «Personendaten» nicht.' },
  ] },
  can: { zuordnen: true, aktivieren: false, entfernen: true }, ...o,
});
const fertig = (o: Record<string, unknown> = {}) => version({
  zuordnung: { Projektname: 'projekt.name', Unbekannt: 'kap1.ausgangslage' }, rev: 2,
  pruefung: { aktivierbar: true, meldungen: [{ stufe: 'warnung', regel: 'personendaten', text: 'Kennzeichnung fehlt: Die Vorlage nennt «Personendaten» nicht.' }] },
  can: { zuordnen: true, aktivieren: true, entfernen: true }, ...o,
});
const detail = (v: ReturnType<typeof version>[]) => ({
  art: 'projektvertrag', name: 'Projektvertrag', grundbestand: { version: '1', quelle: 'Q7' },
  felder: [
    { schluessel: 'projekt.name', bezeichnung: 'Projektname', gruppe: 'Deckblatt' },
    { schluessel: 'kap1.ausgangslage', bezeichnung: 'Ausgangslage', gruppe: '1 Ausgangslage / Problembeschreibung' },
  ],
  versionen: v,
});

function Page({ initial = {} }: { initial?: VorlagenSearch }) {
  const [search, set] = useState<VorlagenSearch>(initial);
  const setSearch = useCallback<SetVorlagenSearch>(next => set(s => validateVorlagenSearch({ ...s, ...next })), []);
  return <><VorlagenPage search={search} setSearch={setSearch} /><output data-testid="s">{JSON.stringify(search)}</output></>;
}

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

describe('Vorlagen', () => {
  it('zeigt alle Dokumentarten mit gültiger Vorlage und Datenquelle (UC-018 Schritt 1)', async () => {
    stub({ 'GET /v1/vorlagen': () => json(liste()) });
    const { container } = renderWithIam(<Page />, UE);
    expect(await screen.findByRole('button', { name: T.liste.oeffnen('Projektvertrag') })).toBeInTheDocument();
    expect(screen.getByText(TV.grundbestand('1'))).toBeInTheDocument();
    expect(screen.getByText(TV.vorbereitet)).toBeInTheDocument();
    expect(screen.getByText(TV.anzahl(1, 1))).toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('lädt eine Word-Datei als Base64 mit Idempotency-Key hoch und öffnet die neue Version', async () => {
    const api = stub({
      'GET /v1/vorlagen': () => json(liste()),
      'GET /v1/vorlagen/projektvertrag': () => json(detail([version()])),
      'POST /v1/vorlagen/projektvertrag/versionen': () => json(version({ version: 2 }), 201),
    });
    renderWithIam(<Page initial={{ o: 'projektvertrag' }} />, UE);
    expect(await screen.findByRole('button', { name: `${TV.version(1)}, ${TV.stand.entwurf}` })).toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: 'Projektvertrag' });
    const input = dialog.querySelector('input[type=file]') as HTMLInputElement;
    await userEvent.upload(input, new File([new Uint8Array([0x50, 0x4b, 3, 4])], 'Vertrag neu.DOCX', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    const post = api.calls.find(c => c.method === 'POST')!;
    expect(post.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    // Endung gross geschrieben: klein an den Server (sonst 422)
    expect(await post.json()).toEqual({ dateiname: 'Vertrag neu.docx', inhalt: 'UEsDBA==' });
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('"v":2'));
  });

  it('prüft vor dem Hochladen Dateityp und Grösse', async () => {
    const api = stub({ 'GET /v1/vorlagen': () => json(liste()), 'GET /v1/vorlagen/projektvertrag': () => json(detail([])) });
    renderWithIam(<Page initial={{ o: 'projektvertrag' }} />, UE);
    await screen.findByText(TV.leer);
    const dialog = screen.getByRole('dialog', { name: 'Projektvertrag' });
    await userEvent.upload(dialog.querySelector('input[type=file]') as HTMLInputElement, new File(['x'], 'Notiz.txt'), { applyAccept: false });
    expect(await screen.findByText(TV.keinWord)).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
  });

  it('Zuordnung: Prüfbericht, Aktiv setzen gesperrt mit Grund; nach Speichern aktiv setzen mit Wirkung (I-F5)', async () => {
    let v = version();
    const api = stub({
      'GET /v1/vorlagen': () => json(liste()),
      'GET /v1/vorlagen/projektvertrag': () => json(detail([v])),
      'PATCH /v1/vorlagen/projektvertrag/versionen/1': () => { v = fertig(); return json(v); },
      'POST /v1/vorlagen/projektvertrag/versionen/1/aktivieren': () => { v = fertig({ stand: 'aktiv', rev: 3, can: { zuordnen: false, aktivieren: false, entfernen: false } }); return json(v); },
    });
    const { container } = renderWithIam(<Page initial={{ o: 'projektvertrag', v: 1 }} />, UE);
    expect(await screen.findByText(/Zuordnung fehlt: 1 von 2/)).toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: `Projektvertrag · ${TV.version(1)}` });
    expect(within(dialog).getByRole('button', { name: TV.aktivieren })).toBeDisabled();
    await expectNoAxe(container);

    await userEvent.selectOptions(within(dialog).getByLabelText('«Unbekannt»'), 'Ausgangslage');
    expect(within(dialog).getByText(TV.ungespeichert)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: TV.speichern }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'PATCH')).toBe(true));
    const patch = api.calls.find(c => c.method === 'PATCH')!;
    expect(patch.headers.get('If-Match')).toBe('W/"1"');
    expect(await patch.json()).toEqual({ zuordnung: { Projektname: 'projekt.name', Unbekannt: 'kap1.ausgangslage' } });

    const aktiv = await screen.findByRole('button', { name: TV.aktivieren });
    await waitFor(() => expect(aktiv).toBeEnabled());
    await userEvent.click(aktiv);
    const frage = await screen.findByRole('dialog', { name: TV.aktivFrage(1) });
    expect(within(frage).getByText(TV.aktivWirkung('Projektvertrag', null))).toBeInTheDocument();
    await userEvent.click(within(frage).getByRole('button', { name: TV.aktivieren }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST' && c.url.endsWith('/aktivieren'))).toBe(true));
    expect(await screen.findByText(TV.gesperrt)).toBeInTheDocument();
  });

  it('Konflikt (412) mit «Neu laden»; Entwurf löschen mit Dialog', async () => {
    stub({
      'GET /v1/vorlagen': () => json(liste()),
      'GET /v1/vorlagen/projektvertrag': () => json(detail([fertig()])),
      'POST /v1/vorlagen/projektvertrag/versionen/1/aktivieren': () => json({ title: 'Geändert', status: 412 }, 412),
      'DELETE /v1/vorlagen/projektvertrag/versionen/1': () => new Response(null, { status: 204 }),
    });
    renderWithIam(<Page initial={{ o: 'projektvertrag', v: 1 }} />, UE);
    await userEvent.click(await screen.findByRole('button', { name: TV.aktivieren }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: TV.aktivFrage(1) })).getByRole('button', { name: TV.aktivieren }));
    expect(await screen.findByText(TV.conflict)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: T.common.reload })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: TV.entfernen }));
    const frage = await screen.findByRole('dialog', { name: TV.entfernenFrage(1) });
    await userEvent.click(within(frage).getByRole('button', { name: TV.entfernen }));
    await waitFor(() => expect(screen.getByTestId('s')).not.toHaveTextContent('"v"'));
  });

  it('Art ohne Datenquelle: Hinweis; Adresse mit Art und Version (I-N5)', async () => {
    stub({ 'GET /v1/vorlagen': () => json(liste()), 'GET /v1/vorlagen/vorstudie': () => json({ ...detail([]), art: 'vorstudie', name: 'Vorstudie', grundbestand: null, felder: null }) });
    renderWithIam(<Page initial={{ o: 'vorstudie' }} />, UE);
    expect(await screen.findByText(TV.vorbereitetHinweis)).toBeInTheDocument();
    expect(validateVorlagenSearch({ o: 'projektvertrag', v: '3', x: 1 })).toEqual({ o: 'projektvertrag', v: 3 });
    expect(validateVorlagenSearch({ v: 3 })).toEqual({});
    expect(validateVorlagenSearch({ o: '../x' })).toEqual({});
  });
});
