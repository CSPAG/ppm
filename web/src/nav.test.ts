/** Navigation je Rolle aus der Registrierung (src/nav.ts): Antragstellende sehen nur Eingang und Ideen (AP-E4-1, A-46). */
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import type { AppPermission } from './auth/permissions.ts';
import { navigation } from './nav.ts';
import { aufteilenUnten, sichtbareRaeume } from './shell/index.ts';
import { CATALOG_PPM } from './test/render.tsx';

const ANTRAGSTELLER: AppPermission[] = ['tenant:read', 'stammdaten:read', 'phasenmodell:read', 'portfolio:read', 'idee:create'];

describe('Navigation der Antragstellenden', () => {
  it('zeigt nur Eingang und Portfolio › Ideen; «Projektidee einreichen» in der Befehlspalette', () => {
    const raeume = sichtbareRaeume(navigation, p => ANTRAGSTELLER.includes(p), '/portfolio/ideen');
    expect(raeume.map(r => r.id).filter(id => id !== 'eingang')).toEqual(['portfolio']);
    expect(raeume.find(r => r.id === 'portfolio')!.bereiche.map(b => b.pfad)).toEqual(['/portfolio/ideen']);
    expect(navigation.aktionen.filter(a => ANTRAGSTELLER.includes(a.recht)).map(a => a.pfad)).toContain('/portfolio/ideen/neu');
    // Telefon: unten «Eingang» und «Ideen» (IA «Navigation»)
    expect(aufteilenUnten(raeume).unten.map(r => r.label)).toEqual(['Eingang', 'Ideen']);
    // Suche nach den eigenen Ideen in der Befehlspalette (I-N4)
    expect(navigation.suchen.filter(s => (typeof s.recht === 'string' ? [s.recht] : s.recht).some(p => ANTRAGSTELLER.includes(p))).map(s => s.id)).toEqual(['ideen']);
  });

  it('Befehlspalette: Aktionen der IA nach Recht (I-N4)', () => {
    const ids = (rechte: AppPermission[]) => [
      ...navigation.aktionen.filter(a => rechte.includes(a.recht)).map(a => a.id),
      ...navigation.suchen.filter(s => (typeof s.recht === 'string' ? [s.recht] : s.recht).some(p => rechte.includes(p))).map(s => s.id),
    ];
    // Projektleitung: Statusbericht erstellen, Änderung beantragen, Stellvertretung erfassen
    expect(ids(['tenant:read', 'projekt:read', 'statusbericht:write', 'vertrag:write'])).toEqual(expect.arrayContaining(['statusbericht', 'aenderung', 'stellvertretung-erfassen', 'projekte']));
    // Gremium: nächste Sitzung und Dashboard
    expect(ids(['tenant:read', 'sitzung:read', 'auswertung:read'])).toEqual(expect.arrayContaining(['naechste-sitzung', 'dashboard', 'sitzungen']));
    expect(navigation.aktionen.find(a => a.id === 'naechste-sitzung')).toMatchObject({ irgendwo: true, pfad: '/gremien/sitzungen' });
    // Personensuche nur für die Administration (members:admin)
    expect(ids(['tenant:read', 'members:admin'])).toContain('personen');
    expect(ids(['tenant:read', 'projekt:read', 'sitzung:read', 'auswertung:read'])).not.toContain('personen');
    // Personen aus sichtbaren Projekten für alle mit projekt:read (I-N4)
    expect(ids(['tenant:read', 'projekt:read'])).toContain('personen-projekte');
    expect(ids(['tenant:read', 'idee:create'])).not.toContain('personen-projekte');
  });

  it('Personensuche: Name mit Funktion und Projekt, ohne E-Mail; Treffer führt ins Projekt', async () => {
    const api = mockIamApi({
      'GET /v1/projekte/personen': () => json({ items: [
        { id: 'p1', name: 'Sabine Sponsorin', kontexte: [{ projektId: 'x1', nummer: '2026-014', name: 'Digitale Aufnahme', funktion: 'sp' }, { projektId: 'x2', nummer: '2026-020', name: 'Labor', funktion: 'weitere' }] },
      ] }),
    }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
    vi.stubGlobal('fetch', api.fetch);
    const suche = navigation.suchen.find(s => s.id === 'personen-projekte')!;
    const t = await suche.suchen('sab', new AbortController().signal);
    expect(t).toEqual([{ id: 'projekt-person:p1', label: 'Sabine Sponsorin', detail: 'Projektauftraggeber:in · 2026-014, weitere Funktion · 2026-020', icon: 'user', pfad: '/projekte/2026-014' }]);
    expect(new URL(api.calls[0]!.url).searchParams.get('q')).toBe('sab');
  });

  it('Suche nach Sitzungen (I-N4): Gremium und Datum, Fundstelle im Traktandum, Ziel ist die Sitzung', async () => {
    const api = mockIamApi({
      'GET /v1/sitzungen': req => {
        expect(new URL(req.url).searchParams.get('q')).toBe('prat');
        return json({ items: [
          { id: 's1', gremium: { id: 'g1', kuerzel: 'prat', name: 'Programmausschuss' }, datum: '2026-11-18', stand: 'versendet', traktandum: null },
          { id: 's2', gremium: { id: 'g1', kuerzel: 'prat', name: 'Programmausschuss' }, datum: '2026-12-16', stand: 'vorbereitung', traktandum: 'Priorisierung Transformation' },
        ] });
      },
    });
    vi.stubGlobal('fetch', api.fetch);
    const treffer = await navigation.suchen.find(x => x.id === 'sitzungen')!.suchen('prat', new AbortController().signal);
    expect(treffer.map(t => [t.pfad, t.detail])).toEqual([
      ['/gremien/prat/sitzungen/2026-11-18', 'Programmausschuss · Sitzungen'],
      ['/gremien/prat/sitzungen/2026-12-16', 'Priorisierung Transformation'],
    ]);
    expect(treffer[0]!.label).toMatch(/^PRAT · \S+ 18\.11\./);
    vi.unstubAllGlobals();
  });
});
