/** Typen des Features aus dem Vertrag (`schema.d.ts`). */
import type { Schemas } from '../../api/client.ts';

export type Projekt = Schemas['Projekt'];
export type ProjektCreate = Schemas['ProjektCreate'];
export type ProjektPatch = Schemas['ProjektPatch'];
export type ProjektVersion = Schemas['ProjektVersion'];
export type Level = 0 | 1 | 2;

export const asLevel = (n: number): Level => (n >= 2 ? 2 : n >= 1 ? 1 : 0);
