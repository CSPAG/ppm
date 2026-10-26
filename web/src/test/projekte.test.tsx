/** Liste mit Cursor, Suche, Schublade über `?o=` und Knöpfe nach Rechten. */
import { json } from '@vollholz/iam-web/testing';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EDITOR, ID, projekt, VIEWER } from './fixtures.ts';
import { renderApp } from './render.tsx';

const A = projekt();
const B = projekt({ id: ID.b, label: 'Beta', beginn: null, ende: null, classification: 1 });
const C = projekt({ id: ID.c, label: 'Gamma' });

describe('Liste der Projekte', () => {
  it('lädt mit Cursor weitere Seiten («Mehr laden») bis next = null', async () => {
    const t = renderApp('/projekte', {
      routes: {
        'GET /v1/projekte': req => {
          const cursor = new URL(req.url).searchParams.get('cursor');
          return json(cursor === 'seite-2' ? { items: [C], next: null } : { items: [A, B], next: 'seite-2' });
        },
      },
    });
    expect(await screen.findByRole('link', { name: /Alpha/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Beta/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Gamma/ })).not.toBeInTheDocument();
    // Klassifizierung als Badge aus iam-web (Stufe 1)
    expect(within(screen.getByRole('link', { name: /Beta/ })).getByText('vertraulich')).toBeInTheDocument();

    await t.user.click(screen.getByRole('button', { name: 'Mehr laden' }));
    expect(await screen.findByRole('link', { name: /Gamma/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mehr laden' })).not.toBeInTheDocument();

    const urls = t.calls('GET /v1/projekte').map(r => new URL(r.url).searchParams);
    expect(urls).toHaveLength(2);
    expect(urls[0]!.get('cursor')).toBeNull();
    expect(urls[1]!.get('cursor')).toBe('seite-2');
    expect(urls[1]!.get('limit')).toBe('50');
  });

  it('sucht über ?q= und schickt die Organisation des Tabs mit', async () => {
    const t = renderApp('/projekte?q=Alp', { routes: { 'GET /v1/projekte': () => json({ items: [A], next: null }) } });
    expect(await screen.findByRole('link', { name: /Alpha/ })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Projekte durchsuchen' })).toHaveValue('Alp');
    const req = t.calls('GET /v1/projekte')[0]!;
    expect(new URL(req.url).searchParams.get('q')).toBe('Alp');
    expect(req.headers.get('x-tenant')).toBe('demo');
  });

  it('zeigt einen leeren Zustand', async () => {
    renderApp('/projekte', { routes: { 'GET /v1/projekte': () => json({ items: [], next: null }) } });
    expect(await screen.findByRole('heading', { name: 'Noch keine Projekte' })).toBeInTheDocument();
  });
});

describe('Schublade über ?o=', () => {
  const routes = {
    'GET /v1/projekte': () => json({ items: [A, B], next: null }),
    [`GET /v1/projekte/${ID.a}`]: () => json(A, 200, { etag: 'W/"3"' }),
    [`GET /v1/projekte/${ID.b}`]: () => json(B, 200, { etag: 'W/"3"' }),
  };

  it('öffnet das Projekt aus der Adresse und schliesst mit Esc (Suchparameter weg, Fokus zurück)', async () => {
    const t = renderApp(`/projekte?o=${ID.b}`, { routes });
    const dialog = await screen.findByRole('dialog', { name: 'Beta' });
    expect(within(dialog).getByText('Kein Zeitraum')).toBeInTheDocument();
    await t.user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(t.router.state.location.search).toEqual({});
  });

  it('Klick auf eine Zeile setzt ?o= und öffnet die Schublade', async () => {
    const t = renderApp('/projekte', { routes });
    await t.user.click(await screen.findByRole('link', { name: /Alpha/ }));
    expect(await screen.findByRole('dialog', { name: 'Alpha' })).toBeInTheDocument();
    expect(t.router.state.location.search).toEqual({ o: ID.a });
    // Fokus liegt in der Schublade
    expect(screen.getByRole('dialog', { name: 'Alpha' })).toContainElement(document.activeElement as HTMLElement);
  });

  it('ignoriert eine ungültige ID in ?o=', async () => {
    renderApp('/projekte?o=keine-id', { routes });
    expect(await screen.findByRole('link', { name: /Alpha/ })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Knöpfe nach Rechten (can)', () => {
  it('Leser:in: kein «Neues Projekt», kein «Bearbeiten», kein «Löschen»', async () => {
    const ro = projekt({ can: { write: false, delete: false } });
    renderApp(`/projekte?o=${ID.a}`, {
      me: VIEWER,
      routes: { 'GET /v1/projekte': () => json({ items: [ro], next: null }), [`GET /v1/projekte/${ID.a}`]: () => json(ro) },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Alpha' });
    expect(within(dialog).getByText('Du kannst dieses Projekt lesen, aber nicht ändern.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Bearbeiten' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Löschen' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Zugriff' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Neues Projekt' })).not.toBeInTheDocument();
  });

  it('Bearbeiter:in mit Recht am Ort: Bearbeiten ja, Löschen nur mit can.delete', async () => {
    const p = projekt({ can: { write: true, delete: false } });
    renderApp(`/projekte?o=${ID.a}`, {
      me: EDITOR,
      routes: { 'GET /v1/projekte': () => json({ items: [p], next: null }), [`GET /v1/projekte/${ID.a}`]: () => json(p) },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Alpha' });
    expect(within(dialog).getByRole('button', { name: 'Bearbeiten' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Löschen' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Neues Projekt' })).toBeInTheDocument();
  });
});
