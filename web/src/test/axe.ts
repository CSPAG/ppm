/**
 * axe in Komponententests (Q-B1, WCAG 2.2 AA): ohne Befund. Kontrast prüft erst E2E im Browser (jsdom rechnet keine
 * Stile), ebenso die Landmarken einer ganzen Seite.
 */
import axe from 'axe-core';
import { expect } from 'vitest';

export async function expectNoAxe(el: Element) {
  const r = await axe.run(el, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false }, 'landmark-one-main': { enabled: false }, 'page-has-heading-one': { enabled: false } },
  });
  expect(r.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
}
