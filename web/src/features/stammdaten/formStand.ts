/**
 * Formular gegen den Stand des Servers (Z7, docs/ux/rahmen/interaktion.md): Kommt ein neuer Stand (z. B. «Neu laden» nach
 * 412), übernehmen nur die Felder ihn, die die Person nicht geändert hat; ihre Eingaben bleiben. Gesendet wird nur, was
 * sich vom Stand des Servers unterscheidet, damit eine Änderung einer anderen Person an einem anderen Feld bleibt.
 */
import { useState } from 'react';

const gleich = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function useFormStand<V extends object>(server: V): [V, (v: V) => void] {
  const [v, setV] = useState(server);
  const [basis, setBasis] = useState(server);
  if (!gleich(server, basis)) {
    // während des Renderns abgleichen (React «Zustand bei geänderten Props anpassen»)
    setBasis(server);
    setV(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, gleich(x, basis[k as keyof V]) ? server[k as keyof V] : x])) as V);
  }
  return [v, setV];
}

/** Nur die Felder von `neu`, die sich von `server` unterscheiden (Teil-PATCH). */
export function geaendert<T extends object>(neu: T, server: T): Partial<T> {
  return Object.fromEntries(Object.entries(neu).filter(([k, x]) => !gleich(x, server[k as keyof T]))) as Partial<T>;
}
