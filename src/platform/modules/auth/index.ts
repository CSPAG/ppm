/** Modul «auth»: Auslieferung der Webapp. Anmeldung (BFF unter /auth/*) bringt das Plugin von @vollholz/iam. */
import type { Module } from '../../http/app.ts';
import { registerUi } from './ui.ts';

export const uiModule: Module = { name: 'ui', register: registerUi };
export { resolveAsset, uiCsp } from './ui.ts';
