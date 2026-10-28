/**
 * Projektakte › Vertrag (UI-07, K2) gegen die nachgebildete API: erster Entwurf ohne Rückfrage (UC-002 Schritt 1),
 * Abnahme K2-4 (jede fehlende Angabe mit einem Klick aus dem Seitenpanel, Fokus an der Stelle), Einreichen gesperrt mit
 * Liste bzw. mit Wirkung davor (I-R1 Stufe 3), automatisches Speichern mit If-Match, Konflikt (Z7), Lesemodus (Z8), axe.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { feldId, KAPITEL, TERMINE } from './felder.ts';
import type { SetVertragSearch, VertragSearch } from './search.ts';
import { T } from '../../ui/index.ts';
import { TV } from './texte.ts';
import { VertragPage } from './VertragPage.tsx';

const P = '00000000-0000-4000-8000-000000000001';
const V = '00000000-0000-4000-8000-0000000000c1';

const projekt = { id: P, nummer: '2026-014', name: 'Digitale Patientenaufnahme', phase: 'P0', lebenszyklus: 'aktiv' };
const version = (o: Record<string, unknown> = {}) => ({
  id: V, projektId: P, nummer: '0.1', anlass: 'initial', zielphase: 'P1', stand: 'in_arbeit', baseline: false, baselineAt: null, basisVersionId: null,
  begruendung: '', eingereichtAt: null, version: 1, createdAt: '2026-10-20T08:00:00Z', updatedAt: '2026-10-20T08:00:00Z', can: { write: true, einreichen: true }, ...o,
});

/** Leerer Inhalt eines Kapitels wie die API ihn anlegt. */
function leer(nr: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of KAPITEL[nr - 1]!.felder) {
    out[f.key] = f.art === 'text' ? '' : f.art === 'liste' ? [] : f.art === 'termine' ? Object.fromEntries(TERMINE.map(([k]) => [k, null])) : null;
  }
  return out;
}
const kopf = (fehlend: Record<number, number> = {}) => KAPITEL.map(k => ({ kapitel: k.nr, titel: k.titel, geaendert: false, fehlend: fehlend[k.nr] ?? 0, version: 1, updatedAt: '2026-10-20T08:00:00Z' }));
const kapitel = (nr: number, inhalt = leer(nr), o: Record<string, unknown> = {}) => ({
  versionId: V, kapitel: nr, titel: KAPITEL[nr - 1]!.titel, inhalt, basis: null, geaendert: false, version: 1, updatedAt: '2026-10-20T08:00:00Z', can: { write: true }, ...o,
});
const angabe = (kapitel: number, feld: string, text: string, erfuellt = false) => ({ kapitel, feld, text, quelle: { art: 'gate', code: 'P0_P1' }, erfuellt, grund: erfuellt ? null : 'Die Angabe ist leer.' });
const mitEtag = (body: unknown, v: number, status = 200) => json(body, status, { ETag: `W/"${v}"` });

const FEHLEND = [angabe(1, 'ausgangslage', 'Ausgangslage'), angabe(9, 'personal', 'Personalbedarf'), angabe(10, 'risiken', 'Risiken')];

function stub(o: { versionen?: unknown[]; angaben?: unknown[]; v?: Record<string, unknown>; kapitelRo?: boolean; routes?: Parameters<typeof mockIamApi>[0] } = {}) {
  const routes: Parameters<typeof mockIamApi>[0] = {
    'GET /v1/projekte': () => json({ items: [projekt], nextCursor: null }),
    [`GET /v1/projekte/${P}/vertrag`]: () => json({ projektId: P, versionen: o.versionen ?? [version(o.v)], entwurf: V, baseline: null, can: { entwerfen: [] } }),
    [`GET /v1/vertragsversionen/${V}`]: () => mitEtag({ version: version(o.v), kapitel: kopf({ 1: 1, 9: 1, 10: 1 }) }, Number(o.v?.version ?? 1)),
    [`GET /v1/vertragsversionen/${V}/pflichtangaben`]: () => json({ versionId: V, zielphase: 'P1', vollstaendig: !(o.angaben ?? FEHLEND).some((a: unknown) => !(a as { erfuellt: boolean }).erfuellt), angaben: o.angaben ?? FEHLEND }),
    [`GET /v1/projekte/${P}/vertrag/ziele`]: () => json({ ziele: [], jahresziele: [] }),
    'GET /v1/codetabellen/ressourcenrolle/werte': () => json({ items: [{ id: 'r1', schluessel: 'pl', label: 'Projektleitung', position: 0, aktiv: true }], nextCursor: null }),
    ...o.routes,
  };
  for (const k of KAPITEL) {
    const key = `GET /v1/vertragsversionen/${V}/kapitel/${k.nr}`;
    if (!routes[key]) routes[key] = () => mitEtag(kapitel(k.nr, leer(k.nr), o.kapitelRo ? { can: { write: false } } : {}), 1);
  }
  const api = mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

function Page({ initial = {} }: { initial?: VertragSearch }) {
  const [search, set] = useState<VertragSearch>(initial);
  const setSearch = useCallback<SetVertragSearch>(next => set(s => {
    const merged: Record<string, unknown> = { ...s, ...next };
    return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined)) as VertragSearch;
  }), []);
  return <><output data-testid="adresse">{JSON.stringify(search)}</output><VertragPage nummer="2026-014" search={search} setSearch={setSearch} /></>;
}

const PL = { permissions: ['tenant:read', 'projekt:read'] } as const;
const titel = () => screen.getByRole('heading', { level: 3, name: /^\d+ / });

afterEach(() => { vi.unstubAllGlobals(); });

describe('Projektvertrag (UI-07)', () => {
  it('legt beim ersten Öffnen den Entwurf 0.1 ohne Rückfrage an (UC-002 Schritt 1)', async () => {
    let angelegt = false;
    const api = stub({
      routes: {
        [`GET /v1/projekte/${P}/vertrag`]: () => json(angelegt
          ? { projektId: P, versionen: [version()], entwurf: V, baseline: null, can: { entwerfen: [] } }
          : { projektId: P, versionen: [], entwurf: null, baseline: null, can: { entwerfen: ['initial'] } }),
        [`POST /v1/projekte/${P}/vertrag/entwuerfe`]: () => { angelegt = true; return mitEtag({ version: version(), kapitel: kopf() }, 1, 201); },
      },
    });
    renderWithIam(<Page />, PL as never);
    expect(await screen.findByRole('heading', { level: 3, name: '1 Ausgangslage / Problembeschreibung' })).toBeInTheDocument();
    const post = api.calls.filter(c => c.method === 'POST');
    expect(post).toHaveLength(1);
    expect(await post[0]!.json()).toEqual({ anlass: 'initial' });
    expect(post[0]!.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(screen.getAllByRole('button', { name: /^\d+ / }).filter(b => b.classList.contains('vt-nav-i'))).toHaveLength(13);
  });

  it('ohne Vertrag und ohne Recht: erklärt, wer ihn erstellt (Z2)', async () => {
    stub({ routes: { [`GET /v1/projekte/${P}/vertrag`]: () => json({ projektId: P, versionen: [], entwurf: null, baseline: null, can: { entwerfen: [] } }) } });
    renderWithIam(<Page />, PL as never);
    expect(await screen.findByText(TV.leer)).toBeInTheDocument();
  });

  it('K2-4: jede fehlende Angabe erreicht die PL mit einem Klick aus dem Seitenpanel, der Fokus steht an der Stelle', async () => {
    stub();
    const { container } = renderWithIam(<Page />, PL as never);
    const panel = await screen.findByRole('complementary');
    await within(panel).findByText(TV.pflichtFehlen(3, 'P1 Konzept und Planung'));
    for (const a of FEHLEND) {
      const knopf = within(panel).getByRole('button', { name: TV.pflichtSprung(a.text, a.kapitel) });
      await userEvent.click(knopf); // genau ein Klick
      await waitFor(() => expect(titel()).toHaveTextContent(`${a.kapitel} ${KAPITEL[a.kapitel - 1]!.titel}`));
      await waitFor(() => expect(document.getElementById(feldId(a.kapitel, a.feld))!.contains(document.activeElement)).toBe(true));
      expect(screen.getByTestId('adresse')).toHaveTextContent(`"kapitel":${a.kapitel}`);
    }
    // Symbol «Angaben fehlen» an den Kapiteln (vorher, I-P3)
    expect(screen.getAllByText(TV.fehlt(1))).toHaveLength(3);
    await expectNoAxe(container);
  });

  it('Pflichtangaben nicht ladbar: Seitenpanel meldet es mit «Erneut versuchen» statt «keine verlangt» (Z5)', async () => {
    let fehler = true;
    stub({ routes: { [`GET /v1/vertragsversionen/${V}/pflichtangaben`]: () => fehler
      ? json({ type: 'about:blank', title: 'Interner Fehler', status: 500 }, 500, { 'Content-Type': 'application/problem+json' })
      : json({ versionId: V, zielphase: 'P1', vollstaendig: false, angaben: FEHLEND }) } });
    renderWithIam(<Page />, PL as never);
    const panel = await screen.findByRole('complementary');
    expect(await within(panel).findByText(T.common.teilFehler(TV.pflicht))).toBeInTheDocument();
    expect(within(panel).queryByText(TV.pflichtKeine)).toBeNull();
    fehler = false;
    await userEvent.click(within(panel).getByRole('button', { name: T.common.retry }));
    expect(await within(panel).findByText(TV.pflichtFehlen(3, 'P1 Konzept und Planung'))).toBeInTheDocument();
  });

  it('Alt+N springt zur nächsten fehlenden Angabe', async () => {
    stub();
    renderWithIam(<Page initial={{ kapitel: 2 }} />, PL as never);
    await screen.findByRole('heading', { level: 3, name: '2 Strategiebezug' });
    await userEvent.keyboard('{Alt>}n{/Alt}');
    await waitFor(() => expect(titel()).toHaveTextContent('9 Ressourcen'));
    await waitFor(() => expect(document.getElementById(feldId(9, 'personal'))!.contains(document.activeElement)).toBe(true));
  });

  it('Einreichen mit fehlenden Angaben: gesperrt und erklärt, ohne Aufruf (I-F4, UC-002 A3)', async () => {
    const api = stub();
    renderWithIam(<Page />, PL as never);
    await userEvent.click(await screen.findByRole('button', { name: TV.einreichen }));
    expect(await screen.findByText(/Angaben für P1 Konzept und Planung fehlen: Ausgangslage \(Kap\. 1\), Personalbedarf \(Kap\. 9\), Risiken \(Kap\. 10\)/)).toBeInTheDocument();
    expect(api.calls.some(c => c.url.includes('/einreichen'))).toBe(false);
  });

  it('Einreichen mit Wirkung davor (I-R1 Stufe 3) und If-Match', async () => {
    let eingereicht = false;
    const api2 = stub({
      angaben: FEHLEND.map(a => ({ ...a, erfuellt: true, grund: null })),
      routes: { [`POST /v1/vertragsversionen/${V}/einreichen`]: () => { eingereicht = true; return mitEtag({ version: version({ stand: 'in_pruefung', version: 2, can: { write: false, einreichen: false } }), kapitel: kopf() }, 2); } },
    });
    renderWithIam(<Page />, PL as never);
    await screen.findByText(TV.pflichtVollstaendig);
    await userEvent.click(screen.getByRole('button', { name: TV.einreichen }));
    const dialog = await screen.findByRole('dialog', { name: TV.einreichenFrage('0.1') });
    expect(within(dialog).getByText(TV.einreichenWirkung)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: TV.einreichen }));
    await waitFor(() => expect(eingereicht).toBe(true));
    const post = api2.calls.find(c => c.url.includes('/einreichen'))!;
    expect(post.headers.get('if-match')).toBe('W/"1"');
  });

  it('speichert automatisch mit If-Match; Konflikt (412) mit beiden Wegen (Z7)', async () => {
    const puts: { ifMatch: string | null; body: { inhalt: Record<string, unknown> } }[] = [];
    let konflikt = false;
    stub({
      routes: {
        [`PUT /v1/vertragsversionen/${V}/kapitel/1`]: async req => {
          puts.push({ ifMatch: req.headers.get('if-match'), body: await req.json() });
          if (konflikt) return json({ type: 'about:blank', title: 'Vorbedingung', status: 412, detail: 'Version' }, 412);
          return mitEtag(kapitel(1, puts[puts.length - 1]!.body.inhalt, { version: 2 }), 2);
        },
      },
    });
    renderWithIam(<Page />, PL as never);
    const feld = await screen.findByLabelText('Ausgangslage (optional)');
    await userEvent.type(feld, 'Papierformulare');
    await waitFor(() => expect(puts.length).toBe(1), { timeout: 3000 });
    expect(puts[0]!.ifMatch).toBe('W/"1"');
    expect(puts[0]!.body.inhalt.ausgangslage).toBe('Papierformulare');
    expect(await screen.findByText(TV.gespeichert)).toBeInTheDocument();

    konflikt = true;
    await userEvent.type(feld, ' bei der Aufnahme');
    expect(await screen.findByText(TV.konflikt(1), {}, { timeout: 3000 })).toBeInTheDocument();
    expect(puts[puts.length - 1]!.ifMatch).toBe('W/"2"');
    expect(screen.getByRole('button', { name: TV.konfliktLaden })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TV.konfliktVerwerfen })).toBeInTheDocument();
  });

  it('Lesemodus (Z8): ohne Bearbeiten-Elemente, mit Hinweis', async () => {
    stub({ v: { can: { write: false, einreichen: false } }, kapitelRo: true });
    const { container } = renderWithIam(<Page />, PL as never);
    expect(await screen.findByText(TV.nurLesen)).toBeInTheDocument();
    await screen.findByRole('heading', { level: 3, name: '1 Ausgangslage / Problembeschreibung' });
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: TV.einreichen })).toBeNull();
    await expectNoAxe(container);
  });

  it('in Prüfung (Z8): Banner mit Datum, gesperrt', async () => {
    stub({ v: { stand: 'in_pruefung', eingereichtAt: '2026-10-21T08:00:00Z', can: { write: false, einreichen: false } }, kapitelRo: true });
    renderWithIam(<Page />, PL as never);
    expect(await screen.findByText(/In Prüfung bei der Unternehmensentwicklung seit/)).toBeInTheDocument();
  });

  it('Kap. 2: Ziele zur Wahl aus dem Modul vertrag, das Handlungsfeld folgt dem Ziel (PP.02.05)', async () => {
    const Z = '00000000-0000-4000-8000-0000000000d1';
    const H = '00000000-0000-4000-8000-0000000000d2';
    const puts: Record<string, unknown>[] = [];
    stub({ routes: {
      [`GET /v1/projekte/${P}/vertrag/ziele`]: () => json({ ziele: [{ id: Z, nummer: '2.1', text: 'Digitale Aufnahme', handlungsfeldId: H, handlungsfeld: 'Patientenpfade' }], jahresziele: [] }),
      [`PUT /v1/vertragsversionen/${V}/kapitel/2`]: async req => { const b = await req.json(); puts.push(b.inhalt); return mitEtag(kapitel(2, b.inhalt, { version: 2 }), 2); },
    } });
    renderWithIam(<Page initial={{ kapitel: 2 }} />, PL as never);
    const wahl = await screen.findByLabelText('Strategisches Ziel');
    await screen.findByRole('option', { name: '2.1 Digitale Aufnahme' });
    await userEvent.selectOptions(wahl, Z);
    expect(await screen.findByText(TV.zielHinweis('2.1'))).toBeInTheDocument();
    expect(await screen.findByText('Patientenpfade')).toBeInTheDocument();
    await waitFor(() => expect(puts.length).toBe(1), { timeout: 3000 });
    expect(puts[0]).toMatchObject({ strategischesZielId: Z, handlungsfeldId: H, jahreszielId: null });
  });

  it('Kap. 7: Toleranzen je Dimension erfassen (A-10), doppelte Dimension vor dem Speichern gemeldet', async () => {
    const puts: Record<string, unknown>[] = [];
    stub({ routes: {
      [`PUT /v1/vertragsversionen/${V}/kapitel/7`]: async req => { const b = await req.json(); puts.push(b.inhalt); return mitEtag(kapitel(7, b.inhalt, { version: 2 }), 2); },
    } });
    const { container } = renderWithIam(<Page initial={{ kapitel: 7 }} />, PL as never);
    const gruppe = await screen.findByRole('group', { name: 'Toleranzen' });
    expect(within(gruppe).getByText(/Gilt ab der Baseline und ersetzt je Dimension den Standard des Phasenmodells/)).toBeInTheDocument();
    await userEvent.click(within(gruppe).getByRole('button', { name: 'Toleranz hinzufügen' }));
    await userEvent.selectOptions(within(gruppe).getByLabelText(/^Dimension \(Toleranz 1\)/), 'kosten');
    await userEvent.type(within(gruppe).getByLabelText(/^Wert \(Toleranz 1\)/), '5');
    await userEvent.selectOptions(within(gruppe).getByLabelText(/^Einheit \(Toleranz 1\)/), 'prozent');
    await waitFor(() => expect(puts.at(-1)?.toleranzen).toEqual([{ dimension: 'kosten', wert: 5, einheit: 'prozent' }]), { timeout: 3000 });
    await expectNoAxe(container);

    await userEvent.click(within(gruppe).getByRole('button', { name: 'Toleranz hinzufügen' }));
    await userEvent.selectOptions(within(gruppe).getByLabelText(/^Dimension \(Toleranz 2\)/), 'kosten');
    expect(await within(gruppe).findByText('Für diese Dimension gibt es schon eine Toleranz.')).toBeInTheDocument();
  });

  it('Kapitelnavigation mit ↑/↓', async () => {
    stub();
    renderWithIam(<Page initial={{ kapitel: 3 }} />, PL as never);
    const aktiv = await screen.findByRole('button', { name: /^3 Ziele und Nutzenbeitrag/ });
    aktiv.focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(titel()).toHaveTextContent('4 Lösungsansatz'));
    await waitFor(() => expect(document.activeElement).toHaveTextContent(/^4 Lösungsansatz/));
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => expect(document.activeElement).toHaveTextContent(/^3 Ziele/));
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => expect(titel()).toHaveTextContent('2 Strategiebezug'));
  });
});
