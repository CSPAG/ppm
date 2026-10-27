/**
 * Navigation nach Arbeitsräumen (IA «Navigation», I-N2 bis I-N4): Sichtbarkeit nach Recht, Reihenfolge, keine leeren
 * Arbeitsräume, Aufteilung für das Telefon, «Mehr» mit Konto, Befehlspalette mit Aktionen und Suche nach Recht.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IamLinkProps, IamRouter, Me } from '@vollholz/iam-web';
import { StaticIam } from '@vollholz/iam-web/testing';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AppPermission } from '../auth/permissions.ts';
import { expectNoAxe } from '../test/axe.ts';
import { T } from '../ui/index.ts';
import { BottomNav, MehrBlatt } from './BottomNav.tsx';
import { CommandPalette } from './CommandPalette.tsx';
import { aufteilenUnten, sichtbareRaeume, useZaehler, type NavRegistrierung, type SichtbarerRaum } from './nav.ts';
import { BereichLeiste, Rail } from './Rail.tsx';

const REG: NavRegistrierung = {
  bereiche: [
    { raum: 'ziele', pfad: '/ziele/handlungsfelder', label: 'Handlungsfelder', recht: 'handlungsfeld:read' },
    { raum: 'projekte', pfad: '/projekte', label: 'Projekte', recht: 'handlungsfeld:write' },
    { raum: 'gremien', pfad: '/gremien', label: 'Gremien', recht: 'webhook:admin' },
  ],
  aktionen: [{ id: 'anlegen', label: 'Handlungsfeld anlegen', icon: 'plus', pfad: '/ziele/handlungsfelder?o=neu', recht: 'handlungsfeld:write' }],
  suchen: [{ id: 'hf', recht: 'handlungsfeld:read', suchen: async q => [{ id: '1', label: `Treffer ${q}`, icon: 'target', pfad: '/ziele/handlungsfelder?o=1' }] }],
};
const VERWALTEN = [{ path: '/verwalten/mitglieder', title: 'Mitglieder' }, { path: '/verwalten/organisationen', title: 'Organisationen' }];
const darf = (rechte: AppPermission[]) => (p: AppPermission) => rechte.includes(p);

function router() {
  return {
    Link: ({ to, children, ...rest }: IamLinkProps) => <a href={to} {...rest}>{children}</a>,
    navigate: vi.fn<IamRouter['navigate']>(),
    useSearch: () => '',
    usePathname: () => '/',
  } satisfies IamRouter;
}

function mit(ui: ReactNode, o: { me?: Partial<Me>; r?: IamRouter } = {}) {
  const r = o.r ?? router();
  return render(<StaticIam me={o.me} config={{ router: r }}>{ui}</StaticIam>);
}

describe('sichtbare Arbeitsräume', () => {
  it('nur mit Recht, in der Reihenfolge der Informationsarchitektur, ohne leere Arbeitsräume', () => {
    const r = sichtbareRaeume(REG, darf(['handlungsfeld:read', 'handlungsfeld:write', 'webhook:admin']), '/ziele/handlungsfelder', VERWALTEN);
    expect(r.map(x => x.id)).toEqual(['projekte', 'gremien', 'ziele', 'administration']);
    expect(r.find(x => x.id === 'ziele')).toMatchObject({ aktiv: true, pfad: '/ziele/handlungsfelder' });
    expect(r.find(x => x.id === 'administration')!.bereiche.map(b => b.label)).toEqual(['Mitglieder', 'Organisationen']);
    // Lesende: nur Ziele; ohne Verwalten-Seiten keine Administration (I-N2)
    expect(sichtbareRaeume(REG, darf(['handlungsfeld:read']), '/').map(x => x.id)).toEqual(['ziele']);
    expect(sichtbareRaeume(REG, darf([]), '/')).toEqual([]);
  });

  it('Administration: «Benutzer und Rollen» (Verwalten des Baukastens) zuerst, dann die Bereiche der App (IA)', () => {
    const reg = { bereiche: [{ raum: 'administration' as const, pfad: '/administration/organisation', label: 'Organisation', recht: 'webhook:admin' as const }] };
    const admin = sichtbareRaeume(reg, darf(['webhook:admin']), '/', VERWALTEN).find(r => r.id === 'administration')!;
    expect(admin.bereiche.map(b => b.label)).toEqual(['Mitglieder', 'Organisationen', 'Organisation']);
    expect(admin.pfad).toBe('/verwalten/mitglieder');
    // ohne Verwalten-Seiten bleibt der Bereich der App das Ziel
    expect(sichtbareRaeume(reg, darf(['webhook:admin']), '/')[0]!.pfad).toBe('/administration/organisation');
  });

  it('Telefon: die ersten drei nach Vorrang unten, die übrigen unter «Mehr»', () => {
    const alle = sichtbareRaeume(REG, darf(['handlungsfeld:read', 'handlungsfeld:write', 'webhook:admin']), '/', VERWALTEN);
    const { unten, mehr } = aufteilenUnten(alle);
    expect(unten.map(x => x.id)).toEqual(['projekte', 'gremien', 'ziele']);
    expect(mehr.map(x => x.id)).toEqual(['administration']);
    // Wer Projekte und Gremien nicht sieht, erhält die nächsten sichtbaren Ziele
    const wenige = aufteilenUnten(sichtbareRaeume(REG, darf(['handlungsfeld:read']), '/', VERWALTEN));
    expect(wenige.unten.map(x => x.id)).toEqual(['ziele', 'administration']);
    expect(wenige.mehr).toEqual([]);
  });
});

const RAEUME: SichtbarerRaum[] = sichtbareRaeume(REG, darf(['handlungsfeld:read', 'handlungsfeld:write', 'webhook:admin']), '/verwalten/mitglieder', VERWALTEN);

describe('Leisten', () => {
  it('Leiste links: aktueller Bereich mit aria-current, Bereiche des aktiven Arbeitsraums', async () => {
    const { container } = mit(<><Rail raeume={RAEUME} /><BereichLeiste raum={RAEUME.find(r => r.aktiv)} /></>);
    const nav = screen.getAllByRole('navigation', { name: T.nav.main })[0]!;
    expect(within(nav).getAllByRole('link').map(a => a.textContent)).toEqual(['Projekte', 'Gremien', 'Ziele', 'Administration', 'Mitglieder', 'Organisationen']);
    expect(within(nav).getByRole('link', { name: 'Mitglieder' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('navigation', { name: `${T.nav.bereiche} Administration` })).toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('Leiste unten mit «Mehr»; das Blatt zeigt übrige Arbeitsräume und Konto, Esc schliesst', async () => {
    const { unten, mehr } = aufteilenUnten(RAEUME);
    const onClose = vi.fn();
    const { container } = mit(<><BottomNav unten={unten} mehr={mehr} mehrOffen onMehr={() => undefined} /><MehrBlatt raeume={mehr} onClose={onClose} onRechte={() => undefined} /></>);
    expect(screen.getByRole('button', { name: T.nav.mehr })).toHaveAttribute('aria-expanded', 'true');
    const blatt = screen.getByRole('dialog', { name: T.nav.mehrTitel });
    expect(within(blatt).getByRole('link', { name: 'Administration' })).toBeInTheDocument();
    expect(within(blatt).getByRole('button', { name: T.konto.abmelden })).toBeInTheDocument();
    expect(within(blatt).getByRole('button', { name: T.theme.dark })).toHaveAttribute('aria-pressed');
    await expectNoAxe(container);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Zähler und Konto', () => {
  const Z = { ziele: { n: 3, text: '3 offene Aufgaben' } };

  it('Zähler an einem Arbeitsraum: Zahl sichtbar, Text im Namen des Links (I-N3)', async () => {
    const { container } = mit(<Rail raeume={RAEUME} zaehler={Z} />);
    const link = screen.getByRole('link', { name: 'Ziele, 3 offene Aufgaben' });
    expect(within(link).getByText('3')).toHaveAttribute('aria-hidden', 'true');
    await expectNoAxe(container);
  });

  it('«Mehr» zeigt die Konto-Einträge und den Zähler unten', async () => {
    const { unten, mehr } = aufteilenUnten(RAEUME);
    const { container } = mit(<>
      <BottomNav unten={unten} mehr={mehr} mehrOffen onMehr={() => undefined} zaehler={Z} />
      <MehrBlatt raeume={mehr} onClose={() => undefined} onRechte={() => undefined}
        konto={[{ id: 'stv', label: 'Profil und Stellvertretung', icon: 'users', pfad: '/konto/stellvertretung', recht: 'tenant:read' }]} />
    </>);
    expect(screen.getByRole('link', { name: 'Ziele, 3 offene Aufgaben' })).toBeInTheDocument();
    const blatt = screen.getByRole('dialog', { name: T.nav.mehrTitel });
    expect(within(blatt).getByRole('link', { name: 'Profil und Stellvertretung' })).toHaveAttribute('href', '/konto/stellvertretung');
    await expectNoAxe(container);
  });

  it('useZaehler: lädt nur mit Recht, zeigt nur Werte über 0', async () => {
    const laden = vi.fn(async () => 4);
    const ohne = vi.fn(async () => 9);
    function Probe() {
      const z = useZaehler({ zaehler: [
        { raum: 'eingang', recht: 'handlungsfeld:read', queryKey: ['probe', 'a'], laden, text: n => `${n} offen` },
        { raum: 'projekte', recht: 'webhook:admin', queryKey: ['probe', 'b'], laden: ohne, text: n => `${n} offen` },
      ] });
      return <output data-testid="zaehler">{JSON.stringify(z)}</output>;
    }
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mit(<QueryClientProvider client={qc}><Probe /></QueryClientProvider>, { me: { permissions: ['handlungsfeld:read'] } });
    await waitFor(() => expect(screen.getByTestId('zaehler').textContent).toBe(JSON.stringify({ eingang: { n: 4, text: '4 offen' } })));
    expect(ohne).not.toHaveBeenCalled();
  });
});

describe('Befehlspalette', () => {
  const aktionen = REG.aktionen.slice();

  it('Seiten und Aktionen, Enter führt aus', async () => {
    const r = router();
    const onClose = vi.fn();
    mit(<CommandPalette raeume={RAEUME} aktionen={aktionen} suchen={[]} onClose={onClose} />, { r });
    expect(screen.getByRole('option', { name: 'Ziele › Handlungsfelder' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Administration › Organisationen' })).toBeInTheDocument();
    await userEvent.keyboard('anlegen{Enter}');
    expect(onClose).toHaveBeenCalled();
    expect(r.navigate).toHaveBeenCalledWith('/ziele/handlungsfelder?o=neu');
  });

  it('Suche nach Objekten ab zwei Zeichen, Treffer führen zum Objekt', async () => {
    const r = router();
    const { baseElement } = mit(<CommandPalette raeume={RAEUME} aktionen={[]} suchen={REG.suchen} onClose={() => undefined} />, { r });
    await userEvent.keyboard('Pat');
    await waitFor(() => expect(screen.getByRole('option', { name: 'Treffer Pat' })).toBeInTheDocument());
    expect(screen.getByText(T.palette.treffer)).toBeInTheDocument();
    await expectNoAxe(baseElement);
    await userEvent.click(screen.getByRole('option', { name: 'Treffer Pat' }));
    expect(r.navigate).toHaveBeenCalledWith('/ziele/handlungsfelder?o=1');
  });
});
