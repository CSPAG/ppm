/** Navigation je Rolle aus der Registrierung (src/nav.ts): Antragstellende sehen nur Eingang und Ideen (AP-E4-1, A-46). */
import { describe, expect, it } from 'vitest';
import type { AppPermission } from './auth/permissions.ts';
import { navigation } from './nav.ts';
import { aufteilenUnten, sichtbareRaeume } from './shell/index.ts';

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
    expect(ids(['tenant:read', 'sitzung:read', 'auswertung:read'])).toEqual(expect.arrayContaining(['naechste-sitzung', 'dashboard']));
    expect(navigation.aktionen.find(a => a.id === 'naechste-sitzung')).toMatchObject({ irgendwo: true, pfad: '/gremien/sitzungen' });
  });
});
