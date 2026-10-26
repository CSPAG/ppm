/** Bearbeiten mit Fassung (If-Match), Konflikt 412 mit «Neu laden», Löschen mit Rückfrage, Anlegen mit Idempotenz. */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { json } from '@vollholz/iam-web/testing';
import { describe, expect, it } from 'vitest';
import { ID, projekt } from './fixtures.ts';
import { renderApp } from './render.tsx';

describe('Bearbeiten und Konflikt (412)', () => {
  it('sendet If-Match, zeigt bei 412 den Hinweis und lädt auf Wunsch die aktuelle Fassung', async () => {
    let server = projekt();
    const t = renderApp(`/projekte?o=${ID.a}`, {
      routes: {
        'GET /v1/projekte': () => json({ items: [server], next: null }),
        [`GET /v1/projekte/${ID.a}`]: () => json(server, 200, { etag: `W/"${server.version}"` }),
        [`PATCH /v1/projekte/${ID.a}`]: () => {
          // In der Zwischenzeit hat jemand anderes gespeichert
          server = projekt({ label: 'Alpha (neu)', version: 4 });
          return json({ type: '/probleme/412', title: 'Fassung veraltet', status: 412, detail: 'Jemand hat den Eintrag inzwischen geändert.', currentVersion: 4 }, 412);
        },
      },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Alpha' });
    await t.user.click(within(dialog).getByRole('button', { name: 'Bearbeiten' }));
    const label = within(dialog).getByRole('textbox', { name: /Bezeichnung/ });
    await t.user.clear(label);
    await t.user.type(label, 'Alpha mit Änderung');
    await t.user.click(within(dialog).getByRole('button', { name: 'Speichern' }));

    expect(await within(dialog).findByText('Jemand hat das Projekt inzwischen geändert.')).toBeInTheDocument();
    const patch = t.calls(`PATCH /v1/projekte/${ID.a}`)[0]!;
    expect(patch.headers.get('if-match')).toBe('W/"3"');
    expect(patch.headers.get('x-csrf-token')).toBe('csrf-123');
    expect(await patch.json()).toEqual({ label: 'Alpha mit Änderung' });

    await t.user.click(within(dialog).getByRole('button', { name: 'Neu laden' }));
    await waitFor(() => expect(within(dialog).getByRole('textbox', { name: /Bezeichnung/ })).toHaveValue('Alpha (neu)'));
    expect(within(dialog).queryByText('Jemand hat das Projekt inzwischen geändert.')).not.toBeInTheDocument();
  });

  it('speichert mit der Fassung und zeigt den neuen Stand', async () => {
    let server = projekt();
    const t = renderApp(`/projekte?o=${ID.a}`, {
      routes: {
        'GET /v1/projekte': () => json({ items: [server], next: null }),
        [`GET /v1/projekte/${ID.a}`]: () => json(server),
        [`PATCH /v1/projekte/${ID.a}`]: async req => {
          server = { ...server, ...(await req.json() as object), version: 4 };
          return json(server, 200, { etag: 'W/"4"' });
        },
      },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Alpha' });
    await t.user.click(within(dialog).getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.change(within(dialog).getByLabelText('Ende'), { target: { value: '2027-06-30' } });
    await t.user.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    expect(await within(dialog).findByText('01.01.2026 – 30.06.2027')).toBeInTheDocument();
    // Zeitraum geht immer gemeinsam (die API prüft gegen den zusammengeführten Stand)
    expect(await t.calls(`PATCH /v1/projekte/${ID.a}`)[0]!.json()).toEqual({ beginn: '2026-01-01', ende: '2027-06-30' });
  });
});

describe('Löschen', () => {
  it('fragt nach, löscht mit If-Match und schliesst die Schublade', async () => {
    const t = renderApp(`/projekte?o=${ID.a}`, {
      routes: {
        'GET /v1/projekte': () => json({ items: [projekt()], next: null }),
        [`GET /v1/projekte/${ID.a}`]: () => json(projekt()),
        [`DELETE /v1/projekte/${ID.a}`]: () => new Response(null, { status: 204 }),
      },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Alpha' });
    await t.user.click(within(dialog).getByRole('button', { name: 'Löschen' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Projekt löschen?' });
    // Fokus zuerst auf «Abbrechen»
    expect(within(confirm).getByRole('button', { name: 'Abbrechen' })).toHaveFocus();
    await t.user.click(within(confirm).getByRole('button', { name: 'Löschen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const del = t.calls(`DELETE /v1/projekte/${ID.a}`)[0]!;
    expect(del.headers.get('if-match')).toBe('W/"3"');
    // Ohne Body auch ohne content-type (Fastify lehnt leeres JSON mit 400 ab)
    expect(del.headers.get('content-type')).toBeNull();
    expect(t.router.state.location.search).toEqual({});
  });
});

describe('Anlegen', () => {
  it('sendet Idempotency-Key und öffnet danach das neue Projekt', async () => {
    const created = projekt({ id: ID.c, label: 'Neu', beschreibung: '', beginn: null, ende: null, version: 1 });
    const t = renderApp('/projekte?neu=true', {
      routes: {
        'GET /v1/projekte': () => json({ items: [], next: null }),
        'POST /v1/projekte': () => json(created, 201),
        [`GET /v1/projekte/${ID.c}`]: () => json(created),
      },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Neues Projekt' });
    await t.user.type(within(dialog).getByRole('textbox', { name: /Bezeichnung/ }), 'Neu');
    await t.user.click(within(dialog).getByRole('button', { name: 'Anlegen' }));
    expect(await screen.findByRole('dialog', { name: 'Neu' })).toBeInTheDocument();
    const post = t.calls('POST /v1/projekte')[0]!;
    expect(post.headers.get('idempotency-key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(await post.json()).toEqual({ label: 'Neu', beschreibung: '', beginn: null, ende: null, classification: 0 });
    expect(t.router.state.location.search).toEqual({ o: ID.c });
  });
});
