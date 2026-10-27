/** Navigation je Rolle aus der Registrierung (src/nav.ts): Antragstellende sehen nur Eingang und Ideen (AP-E4-1, A-46). */
import { describe, expect, it } from 'vitest';
import type { AppPermission } from './auth/permissions.ts';
import { navigation } from './nav.ts';
import { sichtbareRaeume } from './shell/index.ts';

const ANTRAGSTELLER: AppPermission[] = ['tenant:read', 'stammdaten:read', 'phasenmodell:read', 'portfolio:read', 'idee:create'];

describe('Navigation der Antragstellenden', () => {
  it('zeigt nur Eingang und Portfolio › Ideen; «Projektidee einreichen» in der Befehlspalette', () => {
    const raeume = sichtbareRaeume(navigation, p => ANTRAGSTELLER.includes(p), '/portfolio/ideen');
    expect(raeume.map(r => r.id).filter(id => id !== 'eingang')).toEqual(['portfolio']);
    expect(raeume.find(r => r.id === 'portfolio')!.bereiche.map(b => b.pfad)).toEqual(['/portfolio/ideen']);
    expect(navigation.aktionen.filter(a => ANTRAGSTELLER.includes(a.recht)).map(a => a.pfad)).toContain('/portfolio/ideen/neu');
  });
});
