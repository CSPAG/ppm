/**
 * Weiter ohne Vermerk (UC-002 A7, UX-E12) gegen die nachgebildete API: offene Vermerke, «Dem Gremium vorlegen» mit
 * Wirkung vor dem Klick und If-Match, «Phase beginnen» mit der Zielphase im Körper.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { TV } from './texte.ts';
import { VermerkPanel } from './VermerkPanel.tsx';

const P = '00000000-0000-4000-8000-000000000001';
const V = '00000000-0000-4000-8000-0000000000a1';

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

const vermerke = (o: Record<string, unknown> = {}) => ({
  projekt: [], versionen: [{ versionId: V, nummer: '0.1', vermerke: [{ art: 'quality_check_offen', text: 'Quality-Check offen' }] }],
  can: { phaseBeginnen: 'P1', vorlegen: { versionId: V, nummer: '0.1', version: 3, fehlt: [{ art: 'quality_check_offen', text: 'Quality-Check offen' }] } }, ...o,
});

describe('Vermerke im Reiter Vertrag', () => {
  it('zeigt Vermerke; vorlegen nennt vorher, was fehlt, und schickt If-Match', async () => {
    const api = stub({
      [`GET /v1/projekte/${P}/vermerke`]: () => json(vermerke()),
      [`POST /v1/vertragsversionen/${V}/vorlegen`]: () => json(vermerke({ can: { phaseBeginnen: 'P1', vorlegen: null } })),
    });
    const { container } = renderWithIam(<VermerkPanel projektId={P} />, { roles: [], permissions: ['tenant:read', 'projekt:read', 'vertrag:write'] });
    expect(await screen.findByText('Quality-Check offen')).toBeInTheDocument();
    await expectNoAxe(container);
    await userEvent.click(screen.getByRole('button', { name: TV.vermerk.vorlegen }));
    const d = screen.getByRole('dialog', { name: TV.vermerk.vorlegenFrage('0.1') });
    expect(within(d).getByText(TV.vermerk.vorlegenMitVermerk('Quality-Check offen'))).toBeInTheDocument();
    await userEvent.click(within(d).getByRole('button', { name: TV.vermerk.vorlegen }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    expect(api.calls.find(c => c.method === 'POST')!.headers.get('If-Match')).toBe('W/"3"');
  });

  it('Phase beginnen mit Wirkung; die Zielphase geht im Körper mit', async () => {
    const api = stub({
      [`GET /v1/projekte/${P}/vermerke`]: () => json(vermerke()),
      [`POST /v1/projekte/${P}/phase-beginnen`]: () => json(vermerke({ projekt: [{ art: 'ohne_gate_entscheid', text: 'ohne Gate-Entscheid' }] })),
    });
    renderWithIam(<VermerkPanel projektId={P} />, { roles: [], permissions: ['tenant:read', 'projekt:read', 'projekt:write'] });
    await userEvent.click(await screen.findByRole('button', { name: TV.vermerk.phaseBeginnen('P1') }));
    const d = screen.getByRole('dialog', { name: TV.vermerk.phaseFrage('P1') });
    expect(within(d).getByText(TV.vermerk.phaseWirkung('P1'))).toBeInTheDocument();
    await userEvent.click(within(d).getByRole('button', { name: TV.vermerk.phaseBeginnen('P1') }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    expect(await api.calls.find(c => c.method === 'POST')!.json()).toEqual({ phase: 'P1' });
  });
});
