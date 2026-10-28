/** Breite ab 1024 px (Bewerten und Umordnen nur dort, K5 «Mobil»); ohne Angabe der Umgebung (Tests) breit. */
import { useEffect, useState } from 'react';

export function useBreit(): boolean {
  const schmal = '(max-width: 1023.98px)';
  const [breit, setBreit] = useState(() => !(typeof window !== 'undefined' && window.matchMedia?.(schmal).matches));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(schmal);
    const f = () => setBreit(!mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return breit;
}
