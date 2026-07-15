import { afterEach, beforeEach } from 'vitest';

function resetBrowserState(): void {
  localStorage.clear();
  document.documentElement.lang = 'en';
}

beforeEach(resetBrowserState);
afterEach(resetBrowserState);
