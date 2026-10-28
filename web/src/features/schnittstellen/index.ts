/**
 * Öffentliche Schnittstelle des Features «Schnittstellen» (UI-49 Schnittstellen, UI-50 Änderungsprotokoll; AP-E7-3):
 * Suchparameter und Texte für Router und Navigation; die Seiten lädt der Router über `seite()` (Q-L6).
 */
export {
  validateProtokollSearch, validateSchnittstellenSearch, type ProtokollSearch, type SchnittstellenSearch, type SetProtokollSearch,
  type SetSchnittstellenSearch,
} from './search.ts';
export { TX as schnittstellenTexte } from './texte.ts';
