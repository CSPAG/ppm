/**
 * Zugriff auf einen Blick (docs/ux/zugriff.md): «Darf» aus den Rechten der Rolle, Schaltfläche mit Schloss nur bei
 * vertraulichen Objekten, Kurzübersicht mit eigenem Zugriff und Grund, Rollen je Herkunft mit Anzahl und Namen, Zeile
 * der Mitglieder und Sprung in den Bereich «Zugriff»; axe ohne Befund.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi, StaticIam } from '@vollholz/iam-web/testing';
import { makeAuthz, type AuthzCatalog } from '@vollholz/iam-web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../test/axe.ts';
import { CATALOG_PPM } from '../test/render.tsx';
import { T, ZugriffKurz, zugriffDarf } from './index.ts';

const ID = '00000000-0000-4000-8000-000000000001';
const PF = '00000000-0000-4000-8000-0000000000f1';
const BASIS = ['tenant:read', 'stammdaten:read', 'phasenmodell:read', 'portfolio:read'];

/** Katalog mit den Rollen aus Master Entscheid 18, soweit die Tests sie brauchen. */
const CATALOG = {
  ...CATALOG_PPM,
  roles: [
    ...CATALOG_PPM.roles,
    { key: 'mitglied', label: 'Mitglied', description: '', permissions: [...BASIS, 'projekt:list', 'idee:list'], adminOnly: false },
    { key: 'alle-lesen', label: 'Alle Portfolios lesen', description: '', permissions: [...BASIS, 'projekt:list', 'projekt:read', 'finanzen:read'], adminOnly: false },
    { key: 'gremium', label: 'Gremium', description: '', permissions: [...BASIS, 'projekt:read', 'finanzen:read'], adminOnly: false },
    { key: 'projekt-fuehren', label: 'Projekt führen', description: '', permissions: [...BASIS, 'projekt:read', 'projekt:write', 'access:admin'], adminOnly: false },
    { key: 'projekt-mitlesen', label: 'Projekt mitlesen', description: '', permissions: [...BASIS, 'projekt:read', 'finanzen:read'], adminOnly: false },
  ],
} as unknown as AuthzCatalog;

const eintrag = (o: Record<string, unknown>) => ({ expiresAt: null, createdAt: '2026-10-01T08:00:00Z', createdBy: null, removable: false, ...o });
const ITEMS = [
  eintrag({ id: 't1', subject: { ref: 'user:a', kind: 'user', name: 'Sandra Huber' }, relation: 'projekt-fuehren', place: { type: 'projekt', id: ID }, via: 'direct' }),
  eintrag({ id: 't2', subject: { ref: 'user:b', kind: 'user', name: 'Peter Kern' }, relation: 'projekt-mitlesen', place: { type: 'projekt', id: ID }, via: 'direct' }),
  eintrag({ id: 't3', subject: { ref: 'user:c', kind: 'user', name: 'Mia Roth' }, relation: 'projekt-mitlesen', place: { type: 'projekt', id: ID }, via: 'direct' }),
  eintrag({ id: 't4', subject: { ref: 'group:prat', kind: 'group', name: 'PRAT' }, relation: 'gremium', place: { type: 'portfolio', id: PF }, via: 'inherited' }),
  eintrag({ id: 't5', subject: { ref: 'user:d', kind: 'user', name: 'Ursula Egli' }, relation: 'alle-lesen', place: { type: 'org', id: null }, via: 'inherited' }),
  eintrag({ id: 't6', subject: { ref: 'members', kind: 'members', name: 'Alle Mitglieder' }, relation: 'mitglied', place: { type: 'org', id: null }, via: 'inherited' }),
];

function stub(darfSchreiben: boolean) {
  const api = mockIamApi({
    'GET /v1/access': () => json({ resource: { type: 'projekt', id: ID }, classification: null, grantable: [], items: ITEMS }),
    'GET /v1/access/explain': req => {
      const permission = new URL(req.url).searchParams.get('permission') ?? 'projekt:read';
      const allowed = permission === 'projekt:read' || darfSchreiben;
      const relation = darfSchreiben ? 'projekt-fuehren' : 'alle-lesen';
      const place = darfSchreiben ? { type: 'projekt', id: ID } : { type: 'org', id: null };
      return json({
        allowed, permission, subject: { ref: 'user:me', name: 'Ich' }, blocked: null,
        reasons: allowed ? [{ via: darfSchreiben ? 'direct' : 'inherited', relation, place, tupleId: null, matched: permission, label: '' }] : [],
      });
    },
  }, { catalog: CATALOG });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

afterEach(() => { window.history.replaceState(null, '', '/'); });

describe('Darf', () => {
  it('übersetzt die Rechte der Rolle in auflisten, lesen, bearbeiten und «verwaltet Zugriff»', () => {
    const authz = makeAuthz(CATALOG);
    expect(zugriffDarf(authz, 'projekt-fuehren')).toBe(`${T.zugriff.darf.bearbeiten}, ${T.zugriff.darf.verwalten}`);
    expect(zugriffDarf(authz, 'projekt-mitlesen')).toBe(T.zugriff.darf.lesen);
    expect(zugriffDarf(authz, 'mitglied')).toBe(T.zugriff.darf.auflisten);
    expect(zugriffDarf(authz, 'unbekannt')).toBe('');
  });
});

describe('Zugriff auf einen Blick', () => {
  it('Schloss nur bei vertraulichen Objekten', () => {
    stub(true);
    const { unmount } = render(<StaticIam><ZugriffKurz ort={{ type: 'projekt', id: ID }} label="2026-014" bereich="/projekte/2026-014/zugriff" /></StaticIam>);
    expect(screen.getByRole('button', { name: T.zugriff.schaltflaeche })).toBeInTheDocument();
    unmount();
    render(<StaticIam><ZugriffKurz ort={{ type: 'projekt', id: ID }} label="2026-014" vertraulich bereich="/projekte/2026-014/zugriff" /></StaticIam>);
    expect(screen.getByRole('button', { name: T.zugriff.schaltflaecheVertraulich })).toBeInTheDocument();
  });

  it('Kurzübersicht: eigener Zugriff mit Grund, Rollen je Herkunft mit Anzahl und Namen, Mitglieder, Sprung in den Bereich', async () => {
    stub(true);
    const { baseElement } = render(
      <StaticIam><ZugriffKurz ort={{ type: 'projekt', id: ID }} label="2026-014 Digitale Patientenaufnahme" bereich="/projekte/2026-014/zugriff" /></StaticIam>,
    );
    await userEvent.click(screen.getByRole('button', { name: T.zugriff.schaltflaeche }));
    const dialog = await screen.findByRole('dialog', { name: T.zugriff.titel('2026-014 Digitale Patientenaufnahme') });

    expect(await within(dialog).findByText(`${T.zugriff.duBearbeiten.projekt}${T.zugriff.grund('Projekt führen', T.zugriff.wo.projekt)}`)).toBeInTheDocument();
    expect(within(dialog).getByText(T.zugriff.stufe.offenProjekt)).toBeInTheDocument();

    const hier = await within(dialog).findByRole('region', { name: T.zugriff.gruppe.projekt });
    expect(within(hier).getByText('Projekt mitlesen')).toBeInTheDocument();
    expect(within(hier).getByText(`(${T.zugriff.anzahl(2)})`)).toBeInTheDocument();
    expect(within(hier).getByText('Peter Kern')).toBeInTheDocument();
    expect(within(within(dialog).getByRole('region', { name: T.zugriff.gruppe.ueberPortfolio })).getByText('PRAT')).toBeInTheDocument();
    expect(within(within(dialog).getByRole('region', { name: T.zugriff.gruppe.org })).getByText('Ursula Egli')).toBeInTheDocument();
    // Mitglieder stehen nur in der eigenen Zeile, nicht als Rolle
    expect(within(dialog).queryByText('Mitglied')).not.toBeInTheDocument();
    expect(within(within(dialog).getByRole('region', { name: T.zugriff.mitglieder })).getByText(T.zugriff.mitgliederProjekt)).toBeInTheDocument();
    await expectNoAxe(baseElement);

    await userEvent.click(within(dialog).getByRole('button', { name: T.zugriff.alleAnzeigen }));
    await waitFor(() => expect(window.location.pathname).toBe('/projekte/2026-014/zugriff'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('nur lesend über alle Portfolios; vertraulich: Mitglieder ohne Zugriff', async () => {
    stub(false);
    render(<StaticIam><ZugriffKurz ort={{ type: 'projekt', id: ID }} label="2026-014" vertraulich bereich="/projekte/2026-014/zugriff" /></StaticIam>);
    await userEvent.click(screen.getByRole('button', { name: T.zugriff.schaltflaecheVertraulich }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(`${T.zugriff.duLesen.projekt}${T.zugriff.grund('Alle Portfolios lesen', T.zugriff.wo.org)}`)).toBeInTheDocument();
    expect(within(dialog).getByText(T.zugriff.stufe.vertraulichProjekt)).toBeInTheDocument();
    expect(await within(dialog).findByText(T.zugriff.mitgliederVertraulich)).toBeInTheDocument();
  });
});
