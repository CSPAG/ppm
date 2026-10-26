/** Formularprüfung wie die API: Zeitraum nur gemeinsam, Ende nicht vor Beginn, Feldfehler der API (422). */
import { fireEvent, screen, within } from '@testing-library/react';
import { json } from '@vollholz/iam-web/testing';
import { describe, expect, it } from 'vitest';
import { MESSAGES, validateProjekt, zeitraumErrors } from '../features/projekt/validate.ts';
import { renderApp } from './render.tsx';

describe('validateProjekt', () => {
  const base = { label: 'X', beschreibung: '', beginn: '', ende: '', classification: 0 as const };
  it('verlangt eine Bezeichnung', () => {
    expect(validateProjekt({ ...base, label: '   ' })).toEqual({ label: MESSAGES.labelRequired });
  });
  it('Beginn und Ende nur gemeinsam (Pfade wie die API)', () => {
    expect(zeitraumErrors({ beginn: '2026-01-01', ende: null })).toEqual([{ path: '/ende', message: 'Beginn und Ende gibt es nur gemeinsam.' }]);
    expect(zeitraumErrors({ beginn: null, ende: '2026-01-01' })).toEqual([{ path: '/beginn', message: 'Beginn und Ende gibt es nur gemeinsam.' }]);
    expect(zeitraumErrors({ beginn: null, ende: null })).toEqual([]);
  });
  it('Ende nicht vor Beginn, gleicher Tag erlaubt', () => {
    expect(validateProjekt({ ...base, beginn: '2026-05-02', ende: '2026-05-01' })).toEqual({ ende: 'Das Ende liegt vor dem Beginn.' });
    expect(validateProjekt({ ...base, beginn: '2026-05-01', ende: '2026-05-01' })).toEqual({});
  });
});

describe('Formular «Neues Projekt»', () => {
  it('zeigt Feldfehler am Feld, setzt den Fokus darauf und sendet nichts', async () => {
    const t = renderApp('/projekte?neu=true', { routes: { 'GET /v1/projekte': () => json({ items: [], next: null }) } });
    const dialog = await screen.findByRole('dialog', { name: 'Neues Projekt' });
    await t.user.type(within(dialog).getByRole('textbox', { name: /Bezeichnung/ }), 'Mit Zeitraum');
    fireEvent.change(within(dialog).getByLabelText('Beginn'), { target: { value: '2026-03-01' } });
    await t.user.click(within(dialog).getByRole('button', { name: 'Anlegen' }));

    const ende = within(dialog).getByLabelText('Ende');
    expect(ende).toHaveAttribute('aria-invalid', 'true');
    expect(ende).toHaveAccessibleDescription('Beginn und Ende gibt es nur gemeinsam.');
    expect(ende).toHaveFocus();

    fireEvent.change(ende, { target: { value: '2026-02-01' } });
    expect(ende).toHaveAccessibleDescription('Das Ende liegt vor dem Beginn.');
    await t.user.click(within(dialog).getByRole('button', { name: 'Anlegen' }));
    expect(t.calls('POST /v1/projekte')).toHaveLength(0);
  });

  it('zeigt Feldfehler der API (422, errors[].path) am passenden Feld', async () => {
    const t = renderApp('/projekte?neu=true', {
      routes: {
        'GET /v1/projekte': () => json({ items: [], next: null }),
        'POST /v1/projekte': () => json({ type: '/probleme/422', title: 'Ungültige Eingabe', status: 422, errors: [{ path: '/beginn', message: 'Beginn und Ende gibt es nur gemeinsam.' }] }, 422),
      },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Neues Projekt' });
    await t.user.type(within(dialog).getByRole('textbox', { name: /Bezeichnung/ }), 'Server prüft');
    await t.user.click(within(dialog).getByRole('button', { name: 'Anlegen' }));
    expect(await within(dialog).findByText('Beginn und Ende gibt es nur gemeinsam.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Beginn')).toHaveAttribute('aria-invalid', 'true');
  });
});
