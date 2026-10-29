/**
 * Ähnliche eingereichte Ideen beim Ausfüllen (K4 Schritt 2, Master Entscheid 14) und «Eingereichte Ideen» für
 * Mitglieder gegen die nachgebildete API.
 */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog, Me } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { IdeenPage } from './IdeenPage.tsx';
import { AehnlicheIdeen } from './PoolAehnlich.tsx';
import { TI } from './texte.ts';

const HF = '00000000-0000-4000-8000-0000000000f1';
const zeile = (nummer: number, titel: string) => ({
  idee: {
    id: `00000000-0000-4000-8000-00000000000${nummer}`, nummer, titel, stand: 'in_pruefung', standAt: '2026-10-06T08:00:00Z', eingereichtAt: '2026-10-05T08:00:00Z',
    erfasstVon: '00000000-0000-4000-8000-0000000000e1', handlungsfeldId: HF, bereiche: [], herkunft: null, kategorie: null, rueckfragenOffen: 0,
  },
  gleichesHandlungsfeld: true, gemeinsameBereiche: 0,
});

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

const MITGLIED: Partial<Me> = { roles: ['mitglied'], permissions: ['tenant:read', 'idee:create', 'idee:list'] };

describe('Ähnliche Ideen beim Ausfüllen', () => {
  it('Hinweis mit Anzahl, aufklappbar, Ideen öffnen im neuen Tab', async () => {
    const api = stub({ 'GET /v1/ideen/aehnlich': () => json({ items: [zeile(3, 'Digitale Aufnahme'), zeile(5, 'Papierlose Aufnahme')] }) });
    const { container } = renderWithIam(<AehnlicheIdeen handlungsfeldId={HF} bereiche={[]} ausser="00000000-0000-4000-8000-0000000000a1" />, MITGLIED);
    const summary = await screen.findByText(TI.aehnlich.titel(2));
    const url = new URL(api.calls[0]!.url);
    expect([url.searchParams.get('handlungsfeldId'), url.searchParams.get('ausser')]).toEqual([HF, '00000000-0000-4000-8000-0000000000a1']);
    await userEvent.click(summary);
    const link = screen.getByRole('link', { name: 'Digitale Aufnahme' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('href', '/portfolio/ideen/3');
    await expectNoAxe(container);
  });

  it('ohne Handlungsfeld und Bereiche keine Anfrage und kein Hinweis', async () => {
    const api = stub({});
    renderWithIam(<AehnlicheIdeen handlungsfeldId={null} bereiche={[]} />, MITGLIED);
    await new Promise(r => setTimeout(r, 50));
    expect(api.calls.some(c => c.url.includes('/aehnlich'))).toBe(false);
    expect(screen.queryByText(/ähnliche Idee/)).not.toBeInTheDocument();
  });
});

describe('Eingereichte Ideen für Mitglieder', () => {
  it('fragt die eingereichten Stände ab, ohne Entwürfe, ohne «einreichen» im Leerzustand', async () => {
    const api = stub({ 'GET /v1/ideen': () => json({ items: [], nextCursor: null }) });
    renderWithIam(<IdeenPage gehe={() => {}} eingereicht />, MITGLIED);
    expect(await screen.findByText(TI.alleEingereichten.leer)).toBeInTheDocument();
    expect(api.calls.filter(c => c.url.includes('/v1/ideen')).length).toBe(1);
    const url = new URL(api.calls.find(c => c.url.includes('/v1/ideen'))!.url);
    expect(url.searchParams.getAll('stand')).not.toContain('entwurf');
    expect(url.searchParams.get('eigene')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: TI.alleEingereichten.titel })).toBeInTheDocument();
  });
});
