/**
 * Schemas des Moduls «projekt» als benannte Komponenten (`$id`): Der Client der Webapp nutzt sie per Namen
 * (`components['schemas']['Projekt']`).
 */
import { Type, type Static } from '@sinclair/typebox';
import { Classification, DateOnly, DateTime, NextCursor, Nullable, Uuid } from '../../http/route-kit.ts';

export const ProjektCan = Type.Object({
  write: Type.Boolean({ description: 'Darf ändern' }),
  delete: Type.Boolean({ description: 'Darf löschen' }),
}, { $id: 'ProjektCan', additionalProperties: true, description: 'Fähigkeiten der anfragenden Person an diesem Projekt.' });

export const Projekt = Type.Object({
  id: Uuid,
  label: Type.String({ description: 'Bezeichnung' }),
  beschreibung: Type.String(),
  beginn: Nullable(DateOnly),
  ende: Nullable(DateOnly),
  classification: Classification,
  version: Type.Integer({ minimum: 1, description: 'Fassung; als ETag `W/"<version>"`.' }),
  createdAt: DateTime,
  updatedAt: DateTime,
  can: Type.Ref('ProjektCan'),
}, { $id: 'Projekt', additionalProperties: false });
export type Projekt = Omit<Static<typeof Projekt>, 'can'> & { can?: Record<string, boolean> };

export const ProjektList = Type.Object({
  items: Type.Array(Type.Ref('Projekt')),
  next: NextCursor,
}, { $id: 'ProjektList', additionalProperties: false });

const Label = Type.String({ minLength: 1, maxLength: 200, pattern: '\\S' });
const Beschreibung = Type.String({ maxLength: 10_000 });

export const ProjektCreate = Type.Object({
  label: Label,
  beschreibung: Type.Optional(Beschreibung),
  beginn: Type.Optional(Nullable(DateOnly)),
  ende: Type.Optional(Nullable(DateOnly)),
  classification: Type.Optional(Classification),
}, { $id: 'ProjektCreate', additionalProperties: false });
export type ProjektCreate = Static<typeof ProjektCreate>;

export const ProjektPatch = Type.Object({
  label: Type.Optional(Label),
  beschreibung: Type.Optional(Beschreibung),
  beginn: Type.Optional(Nullable(DateOnly)),
  ende: Type.Optional(Nullable(DateOnly)),
  classification: Type.Optional(Classification),
}, { $id: 'ProjektPatch', additionalProperties: false, minProperties: 1 });
export type ProjektPatch = Static<typeof ProjektPatch>;

export const ProjektVersion = Type.Object({
  version: Type.Integer(),
  action: Type.Union([Type.Literal('created'), Type.Literal('updated'), Type.Literal('deleted')]),
  changedAt: DateTime,
  changedBy: Nullable(Uuid),
  data: Type.Object({}, { additionalProperties: true }),
}, { $id: 'ProjektVersion', additionalProperties: false });

export const ProjektHistory = Type.Object({ items: Type.Array(Type.Ref('ProjektVersion')) }, { $id: 'ProjektHistory', additionalProperties: false });

export const ProjektListQuery = Type.Object({
  q: Type.Optional(Type.String({ maxLength: 200, description: 'Suche in der Bezeichnung (Teilstring).' })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
  cursor: Type.Optional(Type.String({ maxLength: 1000 })),
}, { additionalProperties: false });

export const SCHEMAS = [ProjektCan, Projekt, ProjektList, ProjektCreate, ProjektPatch, ProjektVersion, ProjektHistory];

/**
 * Invarianten über mehrere Felder (vor dem Schreiben, auch bei PATCH gegen den zusammengeführten Stand): Beginn und
 * Ende nur gemeinsam, Ende nicht vor Beginn. Liefert Feldfehler für 422.
 */
export function zeitraumErrors(v: { beginn: string | null; ende: string | null }): { path: string; message: string }[] {
  if ((v.beginn === null) !== (v.ende === null)) {
    return [{ path: v.beginn === null ? '/beginn' : '/ende', message: 'Beginn und Ende gibt es nur gemeinsam.' }];
  }
  if (v.beginn !== null && v.ende !== null && v.ende < v.beginn) return [{ path: '/ende', message: 'Das Ende liegt vor dem Beginn.' }];
  return [];
}
