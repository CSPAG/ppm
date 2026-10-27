/** Lesen für andere Module: Version in Kraft bzw. eine bestimmte Version (z. B. `projekt.phasenmodell_id`, A-13). */
import type { Tx } from '@vollholz/platform';
import type { Dokument } from './schemas.ts';
import * as store from './store.ts';

export interface Version extends Dokument { id: string; nummer: number; stand: store.Row['stand'] }

const mit = async (tx: Tx, r: store.Row | null): Promise<Version | null> => (r ? { id: r.id, nummer: r.nummer, stand: r.stand, ...(await store.dokument(tx, r.id)) } : null);

export const aktuellesPhasenmodell = async (tx: Tx) => mit(tx, await store.byStand(tx, 'in_kraft'));
export const phasenmodellLesen = async (tx: Tx, id: string) => mit(tx, await store.get(tx, id));
