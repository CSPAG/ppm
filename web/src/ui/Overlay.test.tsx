/** Fokusfalle der Schublade: Fokus innen, Esc schliesst, Fokus zurück auf den Auslöser. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it } from 'vitest';
import { Drawer } from './Overlay.tsx';

function Demo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Öffnen</button>
      {open ? <Drawer title="Probe" onClose={() => setOpen(false)}><input aria-label="Feld" data-autofocus /></Drawer> : null}
    </>
  );
}

it('hält den Fokus und gibt ihn zurück', async () => {
  render(<Demo />);
  const trigger = screen.getByRole('button', { name: 'Öffnen' });
  await userEvent.click(trigger);
  expect(screen.getByRole('dialog', { name: 'Probe' })).toBeInTheDocument();
  expect(screen.getByLabelText('Feld')).toHaveFocus();
  await userEvent.tab();
  await userEvent.tab();
  expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
