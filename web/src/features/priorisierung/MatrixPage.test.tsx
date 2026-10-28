/**
 * Seite «Matrix» (UI-21, AP-E5-2; BC PP.03.04, PP.02.02, PP.02.03, PC.02.01; UC-008 Schritte 3–4) gegen die nachgebildete
 * API: Felder nach Q6 F9, Position als Text (K5), nicht eingeordnete Projekte, Tabelle als Alternative, Regel (A-39),
 * Rangfolge mit Alt+↑/↓ und Begründung (If-Match, 412), verletzte Abhängigkeit, Abhängigkeit hinzufügen,
 * Portfoliorisiko erfassen, Gremium nur lesen (Z8).
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockIamApi } from '@vollholz/iam-web/testing';
import type { AuthzCatalog } from '@vollholz/iam-web';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AppPermission } from '../../auth/permissions.ts';
import { expectNoAxe } from '../../test/axe.ts';
import { CATALOG_PPM, renderWithIam } from '../../test/render.tsx';
import { MatrixPage } from './MatrixPage.tsx';
import type { MatrixSearch, SetMatrixSearch } from './search.ts';

const UE = { roles: ['ue'], permissions: ['tenant:read', 'stammdaten:read', 'portfolio:read', 'projekt:read', 'projekt:write', 'priorisierung:read', 'priorisierung:write', 'finanzen:read'] as AppPermission[] };
const GREMIUM = { roles: ['gremium'], permissions: ['tenant:read', 'portfolio:read'] as AppPermission[], somewhere: ['priorisierung:read', 'projekt:read'] as AppPermission[] };

const PF = { id: '00000000-0000-4000-8000-0000000000a1', kategorie: 'A', schluessel: 'transformation', name: 'Transformation', pflichten: true, version: 1 };
const id = (i: number) => `00000000-0000-4000-8000-${String(100 + i).padStart(12, '0')}`;
const achse = (wert: number | null, stufe: string | null) => ({ wert, stufe, bewertet: wert === null ? 0 : 2, von: 2 });
const projekt = (i: number, nutzen: [number | null, string | null], risiko: [number | null, string | null], feld: string | null, extra: object = {}) => ({
  id: id(i), nummer: `2026-00${i}`, name: `Projekt ${i}`, phase: 'P1', nutzen: achse(...nutzen), risiko: achse(...risiko), feld,
  ressourcen: { fteMonate: null, groesse: null }, kosten: 100000 * i, rang: null, rangEntwurf: null, abhaengigVon: [], ...extra,
});
// 1 braucht 2 (Abhängigkeit); 3 liegt auf der Grenze (kein Feld)
const PROJEKTE = [
  projekt(1, [3, 'hoch'], [2.5, 'hoch'], 'priorisieren', { abhaengigVon: [id(2)], ressourcen: { fteMonate: 6, groesse: null } }),
  projekt(2, [2.5, 'hoch'], [1, 'tief'], 'rasch_umsetzen', { ressourcen: { fteMonate: null, groesse: 'M' } }),
  projekt(3, [2, 'grenze'], [3, 'hoch'], null),
];
const KRITERIEN = [
  { schluessel: 'strategie', text: 'Strategiebeitrag', dimension: 'nutzen' }, { schluessel: 'komplexitaet', text: 'Komplexität', dimension: 'risiko' },
  { schluessel: 'change', text: 'Change-Aufwand', dimension: null },
];

function Page({ initial = {} }: { initial?: MatrixSearch }) {
  const [search, set] = useState<MatrixSearch>(initial);
  const setSearch = useCallback<SetMatrixSearch>(next => set(s => Object.fromEntries(Object.entries({ ...s, ...next }).filter(([, v]) => v !== undefined)) as MatrixSearch), []);
  return <><MatrixPage search={search} setSearch={setSearch} navigieren={() => {}} /><output data-testid="o">{search.o ?? ''}</output></>;
}

function server(o: { write?: boolean; kosten?: boolean } = {}) {
  let version = 0;
  let entwurf: { projektId: string; rang: number; begruendung: string }[] = [];
  const puts: { ifMatch: string | null; body: { projekte: { projektId: string; begruendung?: string }[] } }[] = [];
  const posts: { pfad: string; body: Record<string, unknown> }[] = [];
  const risiken: Record<string, unknown>[] = [];
  const write = o.write ?? true;
  const api = mockIamApi({
    'GET /v1/portfolios': () => json({ items: [PF], nextCursor: null }),
    [`GET /v1/portfolios/${PF.id}/matrix`]: () => json({
      portfolio: { id: PF.id, schluessel: PF.schluessel, name: PF.name, kategorie: 'A' },
      modell: { id: 'm1', nummer: 1, inKraftAt: '2026-11-12T10:00:00Z', kriterien: KRITERIEN }, kostenSichtbar: o.kosten ?? true,
      projekte: PROJEKTE.map(p => ({ ...p, rangEntwurf: entwurf.find(e => e.projektId === p.id)?.rang ?? null })),
    }),
    [`GET /v1/portfolios/${PF.id}/rangfolge`]: () => new Response(JSON.stringify({ entschieden: [], entwurf, version, geaendertAt: version ? '2026-11-20T10:00:00Z' : null, can: { write } }), { headers: { 'content-type': 'application/json', etag: `W/"${version}"` } }),
    [`PUT /v1/portfolios/${PF.id}/rangfolge`]: async req => {
      const body = await req.json() as (typeof puts)[number]['body'];
      const ifMatch = req.headers.get('if-match');
      puts.push({ ifMatch, body });
      if (ifMatch !== `W/"${version}"`) return json({ type: 'about:blank', title: 'Veraltet', status: 412 }, 412);
      version += 1;
      entwurf = body.projekte.map((p, i) => ({ projektId: p.projektId, rang: i + 1, begruendung: (p.begruendung ?? '').trim() }));
      return new Response(JSON.stringify({ entschieden: [], entwurf, version, geaendertAt: '2026-11-20T10:00:00Z', can: { write } }), { headers: { 'content-type': 'application/json', etag: `W/"${version}"` } });
    },
    [`GET /v1/projekte/${id(1)}/abhaengigkeiten`]: () => json({
      items: [{ id: 'a1', projektId: id(1), version: 1, createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-01T10:00:00Z', can: { write }, text: 'braucht die Plattform', ansprechperson: '', zuProjektId: id(2), richtung: 'ausgehend', anderesProjekt: { id: id(2), nummer: '2026-002', name: 'Projekt 2' } }],
      nextCursor: null, can: { write },
    }),
    [`POST /v1/projekte/${id(1)}/abhaengigkeiten`]: async req => {
      posts.push({ pfad: 'abhaengigkeiten', body: await req.json() as Record<string, unknown> });
      return json({ id: 'a2' }, 201);
    },
    [`GET /v1/portfolios/${PF.id}/risiken`]: () => json({ items: risiken, nextCursor: null, can: { write } }),
    [`POST /v1/portfolios/${PF.id}/risiken`]: async req => {
      const body = await req.json() as Record<string, unknown>;
      posts.push({ pfad: 'risiken', body });
      risiken.push({ id: `r${risiken.length}`, projektId: null, portfolioId: PF.id, version: 1, createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-01T10:00:00Z', can: { write }, massnahmeStand: 'offen', massnahme: '', verantwortlich: '', ...body });
      return json(risiken.at(-1), 201);
    },
  }, { catalog: CATALOG_PPM as unknown as AuthzCatalog });
  vi.stubGlobal('fetch', api.fetch);
  return { puts, posts, setVersion: (v: number) => { version = v; } };
}

describe('MatrixPage', () => {
  it('zeigt die Felder nach Q6 F9, Position als Text, nicht eingeordnete Projekte und die Rangfolge (axe ohne Befund)', async () => {
    server();
    const { container } = renderWithIam(<Page />, UE);
    const p1 = await screen.findByRole('button', { name: '2026-001 Projekt 1: Nutzen hoch, Risiko hoch, Feld Priorisieren' });
    expect(p1).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2026-002 Projekt 2: Nutzen hoch, Risiko tief, Feld Rasch umsetzen' })).toBeInTheDocument();
    for (const f of ['Priorisieren', 'Rasch umsetzen', 'Opportunistisch umsetzen', 'Hinterfragen']) expect(screen.getAllByText(f).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 Projekt ist nicht eingeordnet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2026-003 Projekt 3: Nutzen auf der Grenze, Risiko hoch, kein Feld' })).toBeInTheDocument();
    expect(screen.getByText('Kreisgrösse = Kosten (Prognose, sonst Budget).')).toBeInTheDocument();
    // Rangfolge ohne Entwurf in der Reihenfolge der Matrix; verletzte Abhängigkeit (1 braucht 2, liegt aber davor)
    expect(await screen.findByText('Abhängigkeit: 2026-001 Projekt 1 braucht 2026-002 Projekt 2, liegt aber vor 2026-002 Projekt 2.')).toBeInTheDocument();
    await expectNoAxe(container);
  });

  it('Ressourcen × Nutzen und Tabelle als Alternative; ohne finanzen:read keine Kosten', async () => {
    server({ kosten: false });
    renderWithIam(<Page initial={{ ansicht: 'ressourcen' }} />, UE);
    expect(await screen.findByRole('button', { name: '2026-001 Projekt 1: Nutzen hoch, Ressourcenbedarf 6 FTE-Monate, Feld Priorisieren' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2026-002 Projekt 2: Nutzen hoch, Ressourcenbedarf M (geschätzt), Feld Rasch umsetzen' })).toBeInTheDocument();
    expect(screen.getByText('Kosten sehen Sie nicht; alle Kreise sind gleich gross.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Als Tabelle/ }));
    const tabelle = await screen.findByRole('table', { name: 'Projekte der Matrix' });
    expect(within(tabelle).queryByRole('columnheader', { name: 'Kosten' })).toBeNull();
    expect(within(tabelle).getAllByRole('row')[1]).toHaveTextContent('hoch (3)');
    expect(within(tabelle).getAllByRole('row')[3]).toHaveTextContent('kein Feld');
  });

  it('«Wie wird das berechnet?» zeigt die Regel und die Zuordnung des Modells (A-39)', async () => {
    server();
    renderWithIam(<Page />, UE);
    await userEvent.click(await screen.findByRole('button', { name: /Wie wird das berechnet\?/ }));
    const d = await screen.findByRole('dialog', { name: 'Wie wird das berechnet?' });
    expect(within(d).getByText(/hoch = 3, mittel = 2, tief = 1/)).toBeInTheDocument();
    expect(within(d).getByText(/keinen Gesamtwert \(Score\)/)).toBeInTheDocument();
    expect(within(d).getByRole('row', { name: /Change-Aufwand ohne Zuordnung/ })).toBeInTheDocument();
    await expectNoAxe(d);
  });

  it('Rangfolge mit Alt+↑/↓ und Begründung; Ansage; gespeichert mit If-Match; danach keine Warnung mehr', async () => {
    const s = server();
    renderWithIam(<Page />, UE);
    const griff = await screen.findByRole('button', { name: 'Rang 1: 2026-001 Projekt 1 (Abhängigkeiten)' });
    griff.focus();
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(await screen.findByText('2026-001 Projekt 1 auf Rang 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rang 2: 2026-001 Projekt 1' })).toHaveFocus();
    expect(screen.queryByText(/^Abhängigkeit: /)).toBeNull();
    await userEvent.type(screen.getByRole('textbox', { name: 'Begründung für 2026-002 Projekt 2' }), 'Plattform zuerst');
    await userEvent.click(screen.getByRole('button', { name: 'Rangfolge speichern' }));
    await waitFor(() => expect(s.puts).toHaveLength(1));
    expect(s.puts[0]!.ifMatch).toBe('W/"0"');
    expect(s.puts[0]!.body.projekte).toEqual([{ projektId: id(2), begruendung: 'Plattform zuerst' }, { projektId: id(1), begruendung: '' }, { projektId: id(3), begruendung: '' }]);
    expect(await screen.findByText(/Entwurf, zuletzt gespeichert am/)).toBeInTheDocument();
  });

  it('Konflikt (412, Z7): Hinweis mit «Neu laden»', async () => {
    const s = server();
    renderWithIam(<Page />, UE);
    await userEvent.click(await screen.findByRole('button', { name: '2026-002 Projekt 2 nach oben' }));
    s.setVersion(5);
    await userEvent.click(screen.getByRole('button', { name: 'Rangfolge speichern' }));
    expect(await screen.findByText(/hat die Rangfolge inzwischen geändert/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Neu laden' }));
    await waitFor(() => expect(screen.queryByText(/hat die Rangfolge inzwischen geändert/)).toBeNull());
  });

  it('Projekt in der Schublade: Lage, Abhängigkeiten, «Abhängigkeit hinzufügen» mit Pflichtfeldern', async () => {
    const s = server();
    renderWithIam(<Page />, UE);
    await userEvent.click(await screen.findByRole('button', { name: /^2026-001 Projekt 1: Nutzen hoch/ }));
    const d = await screen.findByRole('dialog', { name: '2026-001 Projekt 1' });
    expect(await within(d).findByText('braucht die Plattform')).toBeInTheDocument();
    expect(within(d).getByText(/^CHF.100.000$/)).toBeInTheDocument();
    await userEvent.click(within(d).getByRole('button', { name: 'Abhängigkeit hinzufügen' }));
    await userEvent.click(within(d).getByRole('button', { name: 'Hinzufügen' }));
    expect(within(d).getAllByText('Pflichtfeld.')).toHaveLength(2);
    await userEvent.selectOptions(within(d).getByLabelText('Dieses Projekt braucht'), id(3));
    await userEvent.type(within(d).getByLabelText('Art der Abhängigkeit'), 'Daten aus Projekt 3');
    await userEvent.click(within(d).getByRole('button', { name: 'Hinzufügen' }));
    await waitFor(() => expect(s.posts).toEqual([{ pfad: 'abhaengigkeiten', body: { zuProjektId: id(3), text: 'Daten aus Projekt 3' } }]));
    await expectNoAxe(d);
  });

  it('Portfoliorisiko erfassen (PC.02.01)', async () => {
    const s = server();
    renderWithIam(<Page />, UE);
    await userEvent.click(await screen.findByRole('button', { name: 'Portfoliorisiken' }));
    const d = await screen.findByRole('dialog', { name: 'Portfoliorisiken' });
    expect(await within(d).findByText('Noch keine Portfoliorisiken erfasst.')).toBeInTheDocument();
    await userEvent.click(within(d).getByRole('button', { name: 'Portfoliorisiko erfassen' }));
    await userEvent.type(within(d).getByLabelText('Risiko'), 'Engpass Architektur');
    await userEvent.click(within(within(d).getByRole('radiogroup', { name: 'Auswirkung' })).getByRole('radio', { name: 'hoch' }));
    await userEvent.click(within(d).getByRole('button', { name: 'Portfoliorisiko erfassen' }));
    await waitFor(() => expect(s.posts[0]).toEqual({ pfad: 'risiken', body: { text: 'Engpass Architektur', wahrscheinlichkeit: 'mittel', auswirkung: 'hoch', massnahme: '', verantwortlich: '' } }));
    expect(await within(d).findByText('EW mittel, AW hoch')).toBeInTheDocument();
  });

  it('Gremium (Z8): Matrix und Rangfolge nur lesen', async () => {
    server({ write: false });
    const { container } = renderWithIam(<Page />, GREMIUM);
    expect(await screen.findByText('Sie können die Rangfolge nur ansehen; sie pflegt die Unternehmensentwicklung.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /nach oben/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rangfolge speichern' })).toBeNull();
    await expectNoAxe(container);
  });
});
