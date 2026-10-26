/** Einstieg: Schriften und Stile (lokal), Thema, Router und App. */
import '@fontsource-variable/inter';
import './styles/index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App, createQueryClient } from './app.tsx';
import { createAppRouter } from './router.tsx';
import { applyTheme } from './ui/theme.ts';

applyTheme();
const router = createAppRouter();
const queryClient = createQueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App router={router} queryClient={queryClient} />
  </StrictMode>,
);
