/**
 * Offener Vermerk (darstellung.md «Vermerk offen», UX-E12, A-74): Kreis gestrichelt und Text, gelb, z. B. «ohne Freigabe»,
 * «Quality-Check offen», «nicht geprüft». Der Ablauf ging ohne den Vermerk weiter; das Badge verschwindet, sobald er
 * nachgetragen ist (die API liefert ihn dann nicht mehr).
 */
export interface VermerkDaten { art: string; text: string }

export function Vermerke({ vermerke }: { vermerke?: readonly VermerkDaten[] }) {
  if (!vermerke?.length) return null;
  return <>{vermerke.map(v => <span key={v.art} className="vermerk"><span className="vermerk-kreis" aria-hidden="true" />{v.text}</span>)}</>;
}
