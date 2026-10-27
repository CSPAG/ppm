/**
 * Seite «Zielerreichung» (AP-E6-3, BC ZM.03.01, K6 Schritt 10) gegen die nachgebildete API: Tabelle je Ziel mit letztem
 * Stand und Fortschritt, Erfassen beim Verlassen der Zeile mit Idempotency-Key, Ändern mit If-Match, Konflikt (412) in
 * der Zeile mit «Neu laden», Kommentar ohne Stand, nur lesen (Z8), leer (Z2), Quartal wechseln, Adresse.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { T } from '../../ui/index.ts';
import { abgeschlossenesQuartal, nachbarQuartal, validateZielerreichungSearch } from './ZielerreichungSearch.ts';
import { ZielerreichungPage } from './ZielerreichungPage.tsx';
import { TZE } from './ZielerreichungTexte.ts';

const S = '00000000-0000-4000-8000-0000000000b1';
const J = '00000000-0000-4000-8000-0000000000b2';
const E = '00000000-0000-4000-8000-0000000000e1';
const URL_Q = '/v1/zielerreichung/2026-Q3';

const eintrag = (o: Record<string, unknown> = {}) => ({
  id: E, zielTyp: 'jahresziel', zielId: J, quartal: '2026-Q3', stand: '35 %', beurteilung: '', erfasstAt: '2026-10-05T08:00:00Z',
  erfasstVon: { id: '00000000-0000-4000-8000-0000000000c1', name: 'Anna Muster' }, version: 1, ...o,
});
const quartal = (o: { eintrag?: unknown; write?: boolean } = {}) => ({
  quartal: '2026-Q3', jahr: 2026,
  ziele: [
    { typ: 'strategisch', id: S, strategischesZielId: S, nummer: '3.1', text: 'Qualität sichern', metrik: 'Zufriedenheit', zielwert: '≥ 80 %', eintrag: null,
      letzter: { ...eintrag(), id: '00000000-0000-4000-8000-0000000000e0', zielTyp: 'strategisch', zielId: S, quartal: '2026-Q2', stand: '72 %' } },
    { typ: 'jahresziel', id: J, strategischesZielId: S, nummer: '3.1.1', text: 'Befragung einführen', metrik: '', zielwert: '40 %', eintrag: o.eintrag ?? null, letzter: null },
  ],
  fortschritt: { nachgefuehrt: o.eintrag ? 1 : 0, gesamt: 2 },
  can: { write: o.write ?? true },
});

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

const zeigen = (o: { setQuartal?: () => void; zuZielen?: () => void } = {}) =>
  <ZielerreichungPage jahr={2026} quartal={3} setQuartal={o.setQuartal ?? vi.fn()} zuZielen={o.zuZielen ?? vi.fn()} />;

describe('Zielerreichung', () => {
  it('zeigt je Ziel Metrik, Zielwert, letzten Stand und den Fortschritt (K6 Schritt 10)', async () => {
    stub({ [`GET ${URL_Q}`]: () => json(quartal()) });
    const { container } = renderWithIam(zeigen());
    expect(await screen.findByRole('heading', { name: TZE.title('Q3 2026'), level: 1 })).toBeInTheDocument();
    expect(await screen.findByText(TZE.fortschritt(0, 2))).toBeInTheDocument();
    expect(screen.getByText('72 %')).toBeInTheDocument();
    expect(screen.getByText('· Q2 2026')).toBeInTheDocument();
    expect(screen.getByText(TZE.metrikFehlt)).toBeInTheDocument();
    expect(screen.getByLabelText(TZE.standVon('3.1.1'))).toHaveValue('');
    await expectNoAxe(container);
  });

  it('erfasst beim Verlassen der Zeile mit Idempotency-Key; Tab springt zum nächsten Ziel', async () => {
    const api = stub({
      [`GET ${URL_Q}`]: () => json(quartal()),
      [`POST ${URL_Q}`]: () => json(eintrag({ zielTyp: 'strategisch', zielId: S, stand: '74 %', beurteilung: 'auf Kurs' }), 201, { ETag: 'W/"1"' }),
    });
    renderWithIam(zeigen());
    await userEvent.type(await screen.findByLabelText(TZE.standVon('3.1')), ' 74 % ');
    await userEvent.tab();
    expect(screen.getByLabelText(TZE.beurteilungVon('3.1'))).toHaveFocus();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
    await userEvent.type(screen.getByLabelText(TZE.beurteilungVon('3.1')), 'auf Kurs');
    await userEvent.tab();
    expect(screen.getByLabelText(TZE.standVon('3.1.1'))).toHaveFocus();
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    const post = api.calls.find(c => c.method === 'POST')!;
    expect(post.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(await post.json()).toEqual({ zielTyp: 'strategisch', zielId: S, stand: '74 %', beurteilung: 'auf Kurs' });
    expect(await screen.findByText(TZE.fortschritt(1, 2))).toBeInTheDocument();
    expect(await screen.findByText(TZE.gespeichertAnsage('3.1'))).toBeInTheDocument();
  });

  it('ändert mit If-Match; Konflikt (412) bleibt in der Zeile, Eingabe bleibt, «Neu laden»', async () => {
    let version = 1;
    const api = stub({
      [`GET ${URL_Q}`]: () => json(quartal({ eintrag: eintrag({ version }) })),
      [`PATCH ${URL_Q}/${E}`]: () => { version = 2; return json({ title: 'Inzwischen geändert', status: 412 }, 412); },
    });
    renderWithIam(zeigen());
    const feld = await screen.findByLabelText(TZE.standVon('3.1.1'));
    expect(feld).toHaveValue('35 %');
    await userEvent.clear(feld);
    await userEvent.type(feld, '36 %{Enter}');
    expect(await screen.findByText(TZE.konflikt)).toBeInTheDocument();
    expect(api.calls.find(c => c.method === 'PATCH')!.headers.get('If-Match')).toBe('W/"1"');
    await userEvent.click(screen.getByRole('button', { name: T.common.reload }));
    await waitFor(() => expect(screen.queryByText(TZE.konflikt)).not.toBeInTheDocument());
    await waitFor(() => expect(api.calls.filter(c => c.method === 'GET').length).toBe(2));
    expect(screen.getByLabelText(TZE.standVon('3.1.1'))).toHaveValue('36 %');
  });

  it('leerer Stand entfernt den Eintrag; Kommentar ohne Stand wird nicht gespeichert', async () => {
    const api = stub({
      [`GET ${URL_Q}`]: () => json(quartal({ eintrag: eintrag() })),
      [`DELETE ${URL_Q}/${E}`]: () => new Response(null, { status: 204 }),
    });
    renderWithIam(zeigen());
    await userEvent.clear(await screen.findByLabelText(TZE.standVon('3.1.1')));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(api.calls.some(c => c.method === 'DELETE')).toBe(true));
    expect(await screen.findByText(TZE.fortschritt(0, 2))).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(TZE.beurteilungVon('3.1')), 'nur Kommentar{Enter}');
    expect(await screen.findByText(TZE.standFehlt)).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
  });

  it('ohne Recht nur lesen (Z8)', async () => {
    stub({ [`GET ${URL_Q}`]: () => json(quartal({ eintrag: eintrag(), write: false })) });
    const { container } = renderWithIam(zeigen(), { roles: ['leser'], permissions: ['tenant:read', 'handlungsfeld:read', 'ziel:read'] });
    expect(await screen.findByText(TZE.nurLesen)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('35 %')).toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('leer (Z2) führt zu den strategischen Zielen; Quartal wechseln', async () => {
    stub({ [`GET ${URL_Q}`]: () => json({ ...quartal(), ziele: [], fortschritt: { nachgefuehrt: 0, gesamt: 0 } }) });
    const zuZielen = vi.fn();
    const setQuartal = vi.fn();
    renderWithIam(zeigen({ zuZielen, setQuartal }));
    expect(await screen.findByText(TZE.leer)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TZE.zuZielen }));
    expect(zuZielen).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: new RegExp(TZE.vorher) }));
    expect(setQuartal).toHaveBeenCalledWith(2026, 2);
    await userEvent.click(screen.getByRole('button', { name: new RegExp(TZE.nachher) }));
    expect(setQuartal).toHaveBeenCalledWith(2026, 4);
  });

  it('Fehler der API (Z5) mit «Erneut versuchen»', async () => {
    stub({ [`GET ${URL_Q}`]: () => json({ title: 'Ungültige Anfrage', status: 422, detail: 'Quartal ungültig.' }, 422) });
    renderWithIam(zeigen());
    expect(await screen.findByText('Quartal ungültig.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: T.common.retry })).toBeInTheDocument();
  });

  it('Adresse und Quartale (I-N5)', () => {
    expect(validateZielerreichungSearch({ quartal: 'q3', x: 1 })).toEqual({ quartal: 'q3' });
    expect(validateZielerreichungSearch({ quartal: 'q5' })).toEqual({});
    expect(abgeschlossenesQuartal(new Date(2026, 9, 27))).toEqual({ jahr: 2026, quartal: 3 });
    expect(abgeschlossenesQuartal(new Date(2027, 0, 15))).toEqual({ jahr: 2026, quartal: 4 });
    expect(nachbarQuartal(2026, 4, 1)).toEqual({ jahr: 2027, quartal: 1 });
    expect(nachbarQuartal(2027, 1, -1)).toEqual({ jahr: 2026, quartal: 4 });
  });
});
