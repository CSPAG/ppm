/**
 * «Neu laden» bei Konflikt (412, Z7, docs/ux/rahmen/interaktion.md): erst wenn der neue Stand da ist, verschwindet der
 * Hinweis und die Aktion ist wieder frei; scheitert das Laden, bleibt der Hinweis stehen (erneut versuchen).
 */
import { useState } from 'react';

export function useNeuLaden(neuLaden: () => Promise<{ error: unknown }>, zuruecksetzen: () => void) {
  const [laedt, setLaedt] = useState(false);
  const laden = async () => {
    setLaedt(true);
    try {
      if (!(await neuLaden()).error) zuruecksetzen();
    } finally {
      setLaedt(false);
    }
  };
  return { laedt, laden };
}
