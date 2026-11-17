// Invented violation (US-13 AC-8): application must not do I/O.
import { readFile } from 'node:fs/promises';
export const x = readFile;
