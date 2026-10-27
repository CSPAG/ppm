/**
 * Plattform von PPM (@vollholz/platform): Kontext, Modell und Ressourcen, daran gebunden die Bausteine der
 * Module – Audit mit Ereignis (`record`), Outbox (`emit`), Jobs (`enqueue`), volle Sicht (`fullTx`) und die
 * Verschlüsselung von Geheimnissen (`seal`, `unseal`, `reseal`). Module importieren von hier, nie aus `app.ts`.
 */
import { definePlatform } from '@vollholz/platform';
import { model } from './authz/model.ts';
import { resources } from './authz/resources.ts';
import { PRODUCT, SCHEMA } from './product.ts';

export { PRODUCT, SCHEMA };

export const platform = definePlatform({ product: PRODUCT, schema: SCHEMA, title: 'PPM', model, resources });
export const { record, enqueue, emit, fullTx, seal, unseal, reseal, audit } = platform;
