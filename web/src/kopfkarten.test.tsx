/**
 * Kopfkarten der Startseite je Rolle (informationsarchitektur.md «Startseite je Rolle»; fachmodell.md 4.1) mit der
 * Liste aus `kopfkarten.ts` gegen die nachgebildete API: Monatszyklus (UE), Meine Projekte (PL, CTL, SP), Nächste
 * Sitzung (UE, PRAT, GLPA), Ideen; Karten ohne Inhalt entfallen; axe.
 */
import { screen, within } from '@testing-library/react';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import type { AppPermission } from './auth/permissions.ts';
import { EingangPage } from './features/eingang/EingangPage.tsx';
import { kopfkarten } from './kopfkarten.ts';
import { expectNoAxe } from './test/axe.ts';
import { CATALOG_PPM, renderWithIam } from './test/render.tsx';

const tag = (n: number) => { const d = new Date(Date.now() + n * 86_400_000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const eingang = {
  'GET /v1/eingang/anzahl': () => json({ offen: 0, ueberfaellig: 0, naechsteFrist: null }),
  'GET /v1/eingang': () => json({ items: [], nextCursor: null }),
  'GET /v1/mitteilungen': () => json({ items: [], nextCursor: null, ungelesen: 0 }),
  'GET /v1/stellvertretungen': () => json({ items: [] }),
  'GET /v1/ideen/kopf': () => json({ eigene: { entwurf: 0, inErgaenzung: 0, laufend: 0 }, zuPruefen: 0 }),
};
const projekt = (n: number, o: Record<string, unknown> = {}) => ({ id: uuid(n), nummer: `2026-0${10 + n}`, name: `Projekt ${n}`, phase: 'P1', lebenszyklus: 'aktiv', rollen: ['pl'], ...o });
const gremium = (kuerzel: string, n: number) => ({ id: uuid(100 + n), kuerzel, name: kuerzel.toUpperCase() });
const sitzung = (n: number, g: ReturnType<typeof gremium>, datum: string, o: Record<string, unknown> = {}) => ({ id: uuid(200 + n), gremium: g, datum, stand: 'in_vorbereitung', traktanden: 6, versandBis: tag(3), unterlagenBereit: 4, ...o });

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi({ ...eingang, ...routes }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

const UE: AppPermission[] = ['tenant:read', 'statusbericht:review', 'projekt:read', 'sitzung:read', 'idee:create'];
const page = () => <EingangPage search={{}} setSearch={() => {}} gehe={() => {}} kopfkarten={kopfkarten} />;

describe('Kopfkarten je Rolle', () => {
  it('Monatszyklus, eigene Projekte und nächste Sitzung je Gremium (höchstens drei), je mit Direktaktion', async () => {
    const prat = gremium('prat', 1);
    const glpa = gremium('glpa', 2);
    stub({
      'GET /v1/statusberichte/kopf': () => json({ pruefen: { periode: '2026-10', eingereicht: 12, zurueckgegeben: 2, geprueft: 15, ausstehend: 2, auffaellig: 3, projekte: 31, stichtag: '2026-10-25', abschlussBis: '2026-10-31' } }),
      'GET /v1/projekte/kopf': () => json({ projekte: [projekt(4, { rollen: ['sp', 'ctl'], lebenszyklus: 'sistiert' }), ...[1, 2, 3, 5, 6].map(n => projekt(n))], anzahl: 6 }),
      'GET /v1/statusberichte/stand': () => json({ items: [
        { projektId: uuid(1), letzter: { periode: '2026-09', status: 'im_plan', trend: 'aufwaerts', begruendung: '', naechsterMeilenstein: 'Go-live Pilot' }, laufend: { periode: '2026-10', stand: 'entwurf', stichtag: tag(3) } },
        { projektId: uuid(3), letzter: { periode: '2026-09', status: 'kritisch', trend: 'abwaerts', begruendung: 'Lieferverzug Hauptsystem', naechsterMeilenstein: '' }, laufend: { periode: '2026-10', stand: 'eingereicht', stichtag: tag(3) } },
      ] }),
      'GET /v1/traktanden/naechste': () => json({ items: [
        { projektId: uuid(1), traktandumId: uuid(301), art: 'gate', artLabel: 'Gate', titel: 'Gate P1–P2', sitzung: { id: uuid(201), datum: tag(10), gremium: prat } },
        { projektId: uuid(4), traktandumId: uuid(302), art: 'aenderung', artLabel: 'Änderung', titel: 'Änderung', sitzung: { id: uuid(201), datum: tag(10), gremium: prat } },
      ] }),
      'GET /v1/sitzungen/kopf': () => json({ sitzungen: [sitzung(1, prat, tag(10)), sitzung(2, glpa, tag(12), { stand: 'versendet' }), sitzung(3, gremium('dir', 3), tag(20)), sitzung(4, gremium('gl', 4), tag(40))] }),
    });
    const { container } = renderWithIam(page(), { permissions: UE });

    const monat = (await screen.findByRole('heading', { name: 'Statusberichte Oktober 2026' })).closest('article')!;
    expect(within(monat).getByText('29 von 31 eingereicht, 15 geprüft')).toBeInTheDocument();
    expect(within(monat).getByText(/^Stichtag .* · Abschluss bis /)).toBeInTheDocument();
    expect(within(monat).getByRole('link', { name: '12 Berichte prüfen' })).toHaveAttribute('href', '/portfolio/monatsabschluss?periode=2026-10&stand=eingereicht');

    const projekte = (await screen.findByRole('heading', { name: 'Meine Projekte' })).closest('article')!;
    // Kritische zuerst mit Grund (SP); Status mit Trend; ausstehender Bericht mit Frist und Sprung zum Bericht (K1)
    await within(projekte).findByText(/Grund: Lieferverzug Hauptsystem/);
    const pz = within(projekte).getAllByRole('listitem');
    expect(pz).toHaveLength(5);
    expect(within(pz[0]!).getByRole('link', { name: '2026-013 Projekt 3' })).toBeInTheDocument();
    expect(within(pz[0]!).getByText('Kritisch')).toBeInTheDocument();
    expect(within(pz[0]!).queryByText(/^Statusbericht /)).toBeNull();
    const p1 = pz.find(z => within(z).queryByRole('link', { name: '2026-011 Projekt 1' }))!;
    expect(within(p1).getByText('Im Plan')).toBeInTheDocument();
    expect(within(p1).getByText('Trend aufwärts')).toBeInTheDocument();
    expect(within(p1).getByRole('link', { name: /^Statusbericht Oktober fällig / })).toHaveAttribute('href', '/projekte/2026-011/bericht?periode=2026-10');
    // Nächster Meilenstein und nächstes Geschäft im Gremium; als CTL «Du stellst am … vor»
    expect(within(p1).getByText('Nächster Meilenstein: Go-live Pilot')).toBeInTheDocument();
    expect(within(p1).getByRole('link', { name: /^Gate im PRAT / })).toHaveAttribute('href', `/gremien/prat/sitzungen/${tag(10)}`);
    const p4 = pz.find(z => within(z).queryByRole('link', { name: '2026-014 Projekt 4' }))!;
    expect(within(p4).getByRole('link', { name: /^Du stellst am .* im PRAT vor$/ })).toBeInTheDocument();
    expect(within(projekte).getByRole('link', { name: '2026-014 Projekt 4' })).toHaveAttribute('href', '/projekte/2026-014');
    expect(within(projekte).getByText('P1 Konzept und Planung · sistiert · Sponsor, CTL')).toBeInTheDocument();
    expect(within(projekte).getByRole('link', { name: 'Alle 6 Projekte' })).toHaveAttribute('href', '/projekte');

    const sitzungen = (await screen.findByRole('heading', { name: 'Nächste Sitzungen' })).closest('article')!;
    const zeilen = within(sitzungen).getAllByRole('listitem');
    expect(zeilen).toHaveLength(3);
    expect(within(zeilen[0]!).getByRole('link', { name: /^PRAT / })).toHaveAttribute('href', `/gremien/prat/sitzungen/${tag(10)}`);
    expect(within(zeilen[0]!).getByText(/^6 Traktanden · 4 von 6 mit Unterlagen · Versand bis /)).toBeInTheDocument();
    expect(within(zeilen[1]!).getByText('6 Traktanden · Unterlagen versendet')).toBeInTheDocument();

    await expectNoAxe(container);
  });

  it('ohne Inhalt entfallen die Karten; ohne Recht werden sie nicht geladen', async () => {
    const api = stub({
      'GET /v1/statusberichte/kopf': () => json({ pruefen: null }),
      'GET /v1/projekte/kopf': () => json({ projekte: [], anzahl: 0 }),
      'GET /v1/sitzungen/kopf': () => json({ sitzungen: [] }),
    });
    const { container } = renderWithIam(page(), { permissions: ['tenant:read', 'projekt:read', 'sitzung:read', 'idee:create'] satisfies AppPermission[] });
    expect(await screen.findByRole('heading', { name: 'Ideen' })).toBeInTheDocument();
    await vi.waitFor(() => expect(api.calls.some(c => c.url.includes('/v1/sitzungen/kopf'))).toBe(true));
    await vi.waitFor(() => expect(container.querySelectorAll('.eg-karte:empty')).toHaveLength(2));
    expect(screen.queryByRole('heading', { name: 'Meine Projekte' })).not.toBeInTheDocument();
    expect(api.calls.some(c => c.url.includes('/v1/statusberichte/kopf'))).toBe(false);
  });
});
