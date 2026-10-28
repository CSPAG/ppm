/**
 * Freigabe der Jahresziele (UI-39, K6 Schritte 6–7; AP-E6-2) gegen die nachgebildete API: Sperre ohne Metrik mit
 * Sprung zum Ziel (Abnahme), Zusammenfassung je Handlungsfeld, Wirkung und Vorlegen mit If-Match, Freigabe erfassen
 * (Rückmeldungen Pflicht bei Anpassungen), nur lesen ohne Recht.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import type { Vorlage } from './FreigabeApi.ts';
import { FreigabePage } from './FreigabePage.tsx';
import { TF } from './FreigabeTexte.ts';

const vorlage = (o: Partial<Vorlage> = {}): Vorlage => ({
  jahr: 2027, stand: 'in_arbeit', version: 4, anzahl: 3, anzahlVorjahr: 2,
  jeHandlungsfeld: [
    { handlungsfeldId: '00000000-0000-4000-8000-0000000000f1', label: 'Wirtschaftlichkeit', anzahl: 2, anzahlVorjahr: 2 },
    { handlungsfeldId: '00000000-0000-4000-8000-0000000000f2', label: 'Innovation', anzahl: 1, anzahlVorjahr: 0 },
  ],
  ohneMetrik: [], ohneUmsetzung: [{ id: 'x', nummer: '3.1.1' }],
  can: { vorlegen: true, freigabe: false },
  ...o,
});
const zieljahr = (stand: string) => ({ jahr: 2027, stand, vorlageBis: null, vorgelegtAt: null, freigabeAt: null, freigabeText: '', version: 5, createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-01T08:00:00Z', can: { write: false } });

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

describe('Freigabe der Jahresziele', () => {
  it('Jahresziel ohne Metrik sperrt die Vorlage und springt zum Ziel (Abnahme AP-E6-2)', async () => {
    stub({ 'GET /v1/ziele/2027/vorlage': () => json(vorlage({ ohneMetrik: [{ id: 'a', nummer: '2.1.2' }] })) });
    const zumZyklus = vi.fn();
    const { container } = renderWithIam(<FreigabePage jahr={2027} zumZyklus={zumZyklus} />);
    expect(await screen.findByText(TF.metrikFehlt(['2.1.2']))).toBeInTheDocument();
    await expectNoAxe(container);
    await userEvent.click(screen.getByRole('button', { name: TF.zumZiel('2.1.2') }));
    expect(zumZyklus).toHaveBeenCalledWith('2.1.2');
    await userEvent.click(screen.getByRole('button', { name: TF.weiter }));
    await userEvent.click(screen.getByRole('button', { name: TF.weiter }));
    expect(screen.getByRole('button', { name: TF.vorlegen })).toBeDisabled();
    expect(screen.getAllByText(TF.metrikFehlt(['2.1.2'])).length).toBeGreaterThan(0);
  });

  it('Zusammenfassung je Handlungsfeld mit Vorjahr, Wirkung, Vorlegen mit If-Match', async () => {
    const api = stub({
      'GET /v1/ziele/2027/vorlage': () => json(vorlage()),
      'POST /v1/ziele/2027/vorlegen': () => json(zieljahr('zur_freigabe')),
    });
    const zumZyklus = vi.fn();
    renderWithIam(<FreigabePage jahr={2027} zumZyklus={zumZyklus} />);
    expect(await screen.findByText(TF.pruefungOk)).toBeInTheDocument();
    expect(screen.getByText(TF.ohneUmsetzung('3.1.1'))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TF.weiter }));
    const zeilen = screen.getAllByRole('row').map(r => r.textContent);
    expect(zeilen).toEqual([`Handlungsfeld${TF.anzahl(2027)}${TF.vorjahr(2026)}`, 'Wirtschaftlichkeit22', 'Innovation10', 'Total32']);
    await userEvent.click(screen.getByRole('button', { name: TF.weiter }));
    expect(screen.getByText(TF.wirkungVorlegen(3))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TF.vorlegen }));
    await waitFor(() => expect(zumZyklus).toHaveBeenCalled());
    expect(api.calls.find(c => c.method === 'POST')!.headers.get('If-Match')).toBe('W/"4"');
  });

  it('Freigabe erfassen: Rückmeldungen Pflicht bei «Anpassungen verlangt»', async () => {
    const api = stub({
      'GET /v1/ziele/2027/vorlage': () => json(vorlage({ stand: 'zur_freigabe', can: { vorlegen: false, freigabe: true } })),
      'POST /v1/ziele/2027/freigabe': () => json(zieljahr('in_arbeit')),
    });
    const zumZyklus = vi.fn();
    const { container } = renderWithIam(<FreigabePage jahr={2027} zumZyklus={zumZyklus} />, { roles: ['ue'], permissions: ['tenant:read', 'ziel:read', 'ziel:freigabe'] });
    await userEvent.click(await screen.findByRole('radio', { name: TF.anpassungen }));
    expect(screen.getByText(TF.wirkungAnpassungen(2027))).toBeInTheDocument();
    await expectNoAxe(container);
    await userEvent.click(screen.getByRole('button', { name: TF.erfassen }));
    expect(await screen.findByText(TF.textFehlt)).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
    await userEvent.clear(screen.getByLabelText(TF.datum));
    await userEvent.type(screen.getByLabelText(TF.datum), '2026-12-01');
    await userEvent.type(screen.getByLabelText(TF.text), 'Ziel 3.1.1 schärfen');
    await userEvent.click(screen.getByRole('button', { name: TF.erfassen }));
    await waitFor(() => expect(zumZyklus).toHaveBeenCalled());
    const post = api.calls.find(c => c.method === 'POST')!;
    expect(post.headers.get('If-Match')).toBe('W/"4"');
    expect(await post.json()).toEqual({ entscheid: 'anpassungen', datum: '2026-12-01', text: 'Ziel 3.1.1 schärfen' });
  });

  it('Konflikt (412): «Neu laden» holt den neuen Stand, die Eingaben bleiben, erneut mit neuer Version (Z7)', async () => {
    let version = 4;
    let erster = true;
    const api = stub({
      'GET /v1/ziele/2027/vorlage': () => json(vorlage({ stand: 'zur_freigabe', version, can: { vorlegen: false, freigabe: true } })),
      'POST /v1/ziele/2027/freigabe': () => {
        if (erster) { erster = false; version = 5; return json({ title: 'Inzwischen geändert', status: 412 }, 412); }
        return json(zieljahr('in_arbeit'));
      },
    });
    const zumZyklus = vi.fn();
    renderWithIam(<FreigabePage jahr={2027} zumZyklus={zumZyklus} />, { roles: ['ue'], permissions: ['tenant:read', 'ziel:read', 'ziel:freigabe'] });
    await userEvent.click(await screen.findByRole('radio', { name: TF.anpassungen }));
    await userEvent.clear(screen.getByLabelText(TF.datum));
    await userEvent.type(screen.getByLabelText(TF.datum), '2026-12-01');
    await userEvent.type(screen.getByLabelText(TF.text), 'Ziel 3.1.1 schärfen');
    await userEvent.click(screen.getByRole('button', { name: TF.erfassen }));
    expect(await screen.findByText(TF.konflikt)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TF.erfassen })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: TF.neuLaden }));
    await waitFor(() => expect(screen.queryByText(TF.konflikt)).not.toBeInTheDocument());
    expect(zumZyklus).not.toHaveBeenCalled();
    expect(screen.getByLabelText(TF.text)).toHaveValue('Ziel 3.1.1 schärfen');
    expect(screen.getByRole('radio', { name: TF.anpassungen })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: TF.erfassen }));
    await waitFor(() => expect(zumZyklus).toHaveBeenCalled());
    const posts = api.calls.filter(c => c.method === 'POST');
    expect(posts.map(c => c.headers.get('If-Match'))).toEqual(['W/"4"', 'W/"5"']);
  });

  it('ohne Recht: nur der Stand (Z8)', async () => {
    stub({ 'GET /v1/ziele/2027/vorlage': () => json(vorlage({ stand: 'zur_freigabe', can: { vorlegen: false, freigabe: false } })) });
    renderWithIam(<FreigabePage jahr={2027} zumZyklus={() => undefined} />, { roles: ['leser'], permissions: ['tenant:read', 'ziel:read'] });
    expect(await screen.findByText(TF.nichtsZuTun.zur_freigabe!(2027))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TF.erfassen })).not.toBeInTheDocument();
  });
});
