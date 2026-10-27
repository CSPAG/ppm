/**
 * Einstieg: Schriften lokal (wie vollholz/assets: IBM Plex Sans und Mono, Schibsted Grotesk für Titel), Stile, Router.
 * Anmeldung und Organisation übernimmt der Baukasten in `app.tsx`.
 */
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/schibsted-grotesk/600.css';
import '@fontsource/schibsted-grotesk/700.css';
import './styles/base.css';
import '@vollholz/iam-web/styles.css';
import './styles/app.css';
import './styles/iam.css';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { router } from './router.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
