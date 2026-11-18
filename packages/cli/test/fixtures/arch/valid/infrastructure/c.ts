import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { b } from '../application/b.ts';
export const c = () => readFile(path.join('x', String(b)));
