/** Meldungen über die Toasts des Baukastens (unten, `aria-live`), damit App und Verwalten-Seiten gleich melden. */
import { useIamUi, type ToastApi } from '@vollholz/iam-web';

export const useToast = (): ToastApi => useIamUi().toast;
