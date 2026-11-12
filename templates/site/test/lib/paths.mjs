import { fileURLToPath } from 'node:url';

export const distDir = fileURLToPath(new URL('../../dist/', import.meta.url));
export const srcDir = fileURLToPath(new URL('../../src/', import.meta.url));
