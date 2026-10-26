import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  // jsdom kennt weder Scrollen noch Medienabfragen
  window.scrollTo = vi.fn();
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    });
  }
});

// Ohne Vitest-Globals räumt Testing Library nicht selbst auf
afterEach(() => { cleanup(); document.body.innerHTML = ''; window.sessionStorage.clear(); });
