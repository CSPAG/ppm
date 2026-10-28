/**
 * Kopfkarte «Jahresziele» (IA «Startseite je Rolle», GL; K6) gegen die nachgebildete API: Jahresziele mit Metrik und
 * Vorlage an den VR, Zielerreichung des zuletzt abgeschlossenen Quartals; Zielzyklus nicht gestartet; axe.
 */
import { screen } from '@testing-library/react';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { abgeschlossenesQuartal } from './ZielerreichungSearch.ts';
import { ZielzyklusKopfKarte } from './ZielzyklusKopfKarte.tsx';

const JAHR = new Date().getFullYear() + 1;
const Q = abgeschlossenesQuartal();
const jz = (nummer: string) => ({ id: `id-${nummer}`, nummer, text: nummer, metrik: '', zielwert: '', version: 1, hauptaktivitaeten: [], projekte: [] });
const zyklus = (gestartet: boolean) => ({
  jahr: JAHR, zieljahr: gestartet ? { jahr: JAHR, stand: 'in_arbeit', vorlageBis: `${JAHR - 1}-11-15`, vorgelegtAt: null, freigabeAt: null, freigabeText: '', version: 1, createdAt: '', updatedAt: '', can: {} } : null,
  strategischeZiele: [{ id: 's1', handlungsfeldId: 'h1', nummer: '1', text: 'Ziel', metrik: '', zielwert: '', projekte: [], jahresziele: [jz('1.1'), jz('1.2'), jz('1.3')] }],
  pruefung: { ohneMetrik: [{ id: 'id-1.3', nummer: '1.3' }], ohneUmsetzung: [] }, can: {},
});

function stub(gestartet: boolean) {
  vi.stubGlobal('fetch', mockIamApi({
    [`GET /v1/ziele/${JAHR}`]: () => json(zyklus(gestartet)),
    [`GET /v1/zielerreichung/${Q.jahr}-Q${Q.quartal}`]: () => json({ quartal: `${Q.jahr}-Q${Q.quartal}`, jahr: Q.jahr, ziele: [], fortschritt: { nachgefuehrt: 24, gesamt: 30 }, can: {} }),
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog }).fetch);
}

describe('Kopfkarte Jahresziele', () => {
  it('Jahresziele mit Metrik, Vorlage an den VR und Zielerreichung des letzten Quartals (GL)', async () => {
    stub(true);
    const { container } = renderWithIam(<article><ZielzyklusKopfKarte /></article>);
    expect(await screen.findByRole('heading', { name: `Jahresziele ${JAHR}` })).toBeInTheDocument();
    expect(screen.getByText(/^2 von 3 mit Metrik · Vorlage an den VR bis /)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: `Zielerreichung Q${Q.quartal} ${Q.jahr}: 24 von 30 nachgeführt` }))
      .toHaveAttribute('href', `/ziele/${Q.jahr}/zielerreichung?quartal=q${Q.quartal}`);
    await expectNoAxe(container);
  });

  it('Zielzyklus noch nicht gestartet', async () => {
    stub(false);
    renderWithIam(<article><ZielzyklusKopfKarte /></article>);
    expect(await screen.findByText('Der Zielzyklus ist noch nicht gestartet.')).toBeInTheDocument();
  });
});
