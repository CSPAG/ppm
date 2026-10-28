/**
 * Plattform von PPM (@vollholz/platform): Kontext, Modell und Ressourcen, daran gebunden die Bausteine der
 * Module – Audit mit Ereignis (`record`), Outbox (`emit`), Jobs (`enqueue`), volle Sicht (`fullTx`) und die
 * Verschlüsselung von Geheimnissen (`seal`, `unseal`, `reseal`); dazu CSV für Exporte (`csv`). Module importieren von
 * hier, nie aus `app.ts`.
 */
import { definePlatform } from '@vollholz/platform';
import { model } from './authz/model.ts';
import { resources } from './authz/resources.ts';
import { PRODUCT, SCHEMA } from './product.ts';

export { PRODUCT, SCHEMA };

export const platform = definePlatform({ product: PRODUCT, schema: SCHEMA, title: 'PPM', model, resources });
export const { record, enqueue, emit, fullTx, seal, unseal, reseal, audit } = platform;

/**
 * Feld für CSV (Export der Seiten vom Typ Bericht; RFC 4180, Semikolon wie Excel in der Schweiz): in Anführungszeichen
 * bei Trennzeichen, Anführungszeichen oder Zeilenumbruch; Text, der mit = + - @ beginnt, mit Apostroph davor (keine
 * Formel beim Öffnen).
 */
export function csvFeld(v: string | number | null): string {
  if (v === null) return '';
  if (typeof v === 'number') return String(v);
  const t = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** CSV mit BOM (Excel erkennt UTF-8), Zeilen mit CRLF. */
export function csv(zeilen: (string | number | null)[][]): string {
  return `﻿${zeilen.map(z => z.map(csvFeld).join(';')).join('\r\n')}\r\n`;
}
