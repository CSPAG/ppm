/**
 * Dokumentausgabe einer Vertragsversion (AP-E3-5, DM.02.07, K2 Schritt 11) gegen die nachgebildete API: PDF und Word
 * laden die Datei mit dem Format, speichern sie unter dem Namen aus `Content-Disposition`, Hinweis auf Personendaten
 * (G12), Fehler aus problem+json am Ort (Z5), barrierefrei.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { DokumentAusgabe } from './DokumentAusgabe.tsx';
import { TD } from './DokumentTexte.ts';

const ID = '00000000-0000-4000-8000-0000000000d1';
const URL_DOK = `/v1/vertragsversionen/${ID}/dokument`;

function stub(routes: Parameters<typeof mockIamApi>[0]) {
  const api = mockIamApi(routes, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return api;
}

const datei = (format: string, name: string) => new Response(format === 'pdf' ? '%PDF-1.4' : 'PK', {
  status: 200, headers: { 'content-type': format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'content-disposition': `attachment; filename="${name}"` },
});

describe('Dokumentausgabe', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('lädt PDF und Word mit dem Format und speichert unter dem Namen der Antwort', async () => {
    const api = stub({ [`GET ${URL_DOK}`]: (req: Request) => {
      const f = new URL(req.url).searchParams.get('format')!;
      return datei(f, `Projektvertrag-2026-014-v0.1.${f}`);
    } });
    const createObjectURL = vi.fn(() => 'blob:x');
    vi.stubGlobal('URL', Object.assign(globalThis.URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const klick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { container } = renderWithIam(<DokumentAusgabe versionId={ID} nummer="0.1" />);
    expect(screen.getByText(TD.personendaten)).toBeInTheDocument();
    await expectNoAxe(container);

    await userEvent.click(screen.getByRole('button', { name: TD.pdfLang('0.1') }));
    expect(await screen.findByText(TD.bereit('Projektvertrag-2026-014-v0.1.pdf'))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TD.wordLang('0.1') }));
    expect(await screen.findByText(TD.bereit('Projektvertrag-2026-014-v0.1.docx'))).toBeInTheDocument();

    expect(api.calls.map(c => new URL(c.url).searchParams.get('format'))).toEqual(['pdf', 'docx']);
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect((klick.mock.contexts as HTMLAnchorElement[]).map(a => a.download)).toEqual(['Projektvertrag-2026-014-v0.1.pdf', 'Projektvertrag-2026-014-v0.1.docx']);
  });

  it('zeigt den Fehler der API am Ort (Z5)', async () => {
    stub({ [`GET ${URL_DOK}`]: () => json({ title: 'Nicht gefunden', status: 404, detail: 'Vertragsversion nicht gefunden.' }, 404) });
    renderWithIam(<DokumentAusgabe versionId={ID} nummer="0.1" />);
    await userEvent.click(screen.getByRole('button', { name: TD.pdfLang('0.1') }));
    expect(await screen.findByText('Vertragsversion nicht gefunden.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: TD.pdfLang('0.1') })).toBeEnabled());
  });
});
