/** Einstieg: Schriften lokal, Stile, Router. Anmeldung und Organisation übernimmt der Baukasten in `app.tsx`. */
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/400.css';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { router } from './router.tsx';
import './styles/tokens.css';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
