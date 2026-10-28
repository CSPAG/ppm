/**
 * Projektakte › Versionen (UI-10, K2 Schritt 5; PS.03.04) gegen die nachgebildete API: Liste der Versionen, Vergleich
 * Entwurf gegen Baseline als Standard, Kennzeichnung «neu» / «entfernt» / «geändert» zusätzlich zur Farbe (Q-B5), Zahl mit
 * Differenz, Wahl der Versionen in der Adresse, ohne Recht auf Beträge der Hinweis; axe.
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { TA } from './AenderungTexte.ts';
import { VersionenPage } from './VersionenPage.tsx';

const P = '00000000-0000-4000-8000-000000000001';
const A = '00000000-0000-4000-8000-0000000000b0';
const B = '00000000-0000-4000-8000-0000000000b1';
const V = '00000000-0000-4000-8000-0000000000c2';

const projekt = { id: P, nummer: '2026-014', name: 'Digitale Patientenaufnahme', phase: 'P1', lebenszyklus: 'aktiv' };
const version = (id: string, nummer: string, o: Record<string, unknown> = {}) => ({
  id, projektId: P, nummer, anlass: 'aenderung', zielphase: 'P1', stand: 'in_arbeit', baseline: false, baselineAt: null, basisVersionId: B,
  begruendung: '', eingereichtAt: null, version: 2, createdAt: '2026-10-20T08:00:00Z', updatedAt: '2026-10-27T08:00:00Z', can: { write: true, einreichen: false }, ...o,
});
const versionen = [
  version(V, '1.1'),
  version(B, '1.0', { anlass: 'gate', stand: 'abgenommen', baseline: true, baselineAt: '2026-09-01T08:00:00Z', basisVersionId: A }),
  version(A, '0.1', { anlass: 'initial', stand: 'abgenommen', basisVersionId: null }),
];
const kapitel = (nr: number, titel: string, unterschiede: unknown[] = []) => ({ kapitel: nr, titel, geaendert: unterschiede.length > 0, unterschiede });
const vergleich = (betraege = true) => ({
  versionId: V, nummer: '1.1', mitVersionId: B, mitNummer: '1.0', betraege,
  kapitel: [
    kapitel(1, 'Ausgangslage / Problembeschreibung'),
    kapitel(9, 'Ressourcen', betraege ? [{ feld: 'kosten', label: 'Kosten', eintrag: 'P2 Lizenzen', eintragFeld: 'betrag', art: 'geaendert', alt: 2100000, neu: 2400000, differenz: 300000 }] : []),
    kapitel(10, 'Risiko-Management', [{ feld: 'risiken', label: 'Risiken', eintrag: 'Ressourcenengpass', eintragFeld: null, art: 'neu', alt: null,
      neu: { registerId: null, text: 'Ressourcenengpass', wahrscheinlichkeit: 'hoch', auswirkung: 'mittel', massnahme: '', verantwortlich: '' }, differenz: null }]),
  ],
});

function stub(betraege = true) {
  const api = mockIamApi({
    'GET /v1/projekte': () => json({ items: [projekt], nextCursor: null }),
    [`GET /v1/projekte/${P}/vertrag`]: () => json({ projektId: P, versionen, entwurf: V, baseline: B, can: { entwerfen: [] } }),
    [`GET /v1/vertragsversionen/${V}/vergleich`]: () => json(vergleich(betraege)),
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

describe('Versionen und Vergleich', () => {
  it('vergleicht standardmässig den Entwurf mit der Baseline; Kennzeichnung und Differenz (Q-B5)', async () => {
    const api = stub();
    const { container } = renderWithIam(<VersionenPage nummer="2026-014" search={{}} setSearch={() => {}} />);
    expect(await screen.findByText(`${TA.vergleichTitel('1.0', '1.1')} · ${TA.unveraendertKapitel(1)}`)).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(4);
    const kosten = screen.getByText('Kosten «P2 Lizenzen» · Betrag').closest('li')!;
    expect(within(kosten).getByText(TA.art.geaendert)).toBeInTheDocument();
    expect(within(kosten).getByText(/2'400'000/)).toBeInTheDocument();
    expect(within(kosten).getByText(/Differenz: \+CHF.300'000/)).toBeInTheDocument();
    const risiko = screen.getByText('Risiken «Ressourcenengpass»').closest('li')!;
    expect(within(risiko).getByText(TA.art.neu)).toBeInTheDocument();
    expect(within(risiko).getByText('Ressourcenengpass · hoch · mittel')).toBeInTheDocument();
    const get = api.calls.find(c => c.url.includes('/vergleich'))!;
    expect(new URL(get.url).searchParams.get('mit')).toBe(B);
    await expectNoAxe(container);
  });

  it('Wahl der Versionen geht in die Adresse (I-N5)', async () => {
    stub();
    const setSearch = vi.fn();
    renderWithIam(<VersionenPage nummer="2026-014" search={{ vergleich: 'baseline...entwurf' }} setSearch={setSearch} />);
    await userEvent.selectOptions(await screen.findByLabelText(TA.alt), A);
    expect(setSearch).toHaveBeenCalledWith({ vergleich: `${A}...${V}` }, { replace: true });
  });

  it('ohne Recht auf Beträge: Hinweis, keine Beträge (A-33)', async () => {
    stub(false);
    renderWithIam(<VersionenPage nummer="2026-014" search={{}} setSearch={() => {}} />);
    expect(await screen.findByText(TA.ohneBetraege)).toBeInTheDocument();
    expect(screen.queryByText(/Lizenzen/)).not.toBeInTheDocument();
  });
});
