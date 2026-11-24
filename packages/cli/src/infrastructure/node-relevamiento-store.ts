// RelevamientoStore over node:fs (US-15 FR-005; plan decision 5). Only the given step changes: the rest of the file is
// parsed and written back as is (2-space JSON, LF, trailing newline, like the template's example), through a temp
// file in the same folder and a rename, so a failure never leaves half a relevamiento.json.
import { randomBytes } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RelevamientoStore } from '../application/ports.ts';
import { SpecmateError } from '../domain/errors.ts';

const FILE = 'relevamiento.json';
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

async function load(file: string): Promise<{ json: Record<string, unknown>; steps?: Record<string, unknown> }> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    throw new SpecmateError(
      code === 'ENOENT'
        ? `${file} not found: run specmate inventory from the folder that holds the site created by specmate new`
        : `cannot read ${file} (${code ?? String(error)})`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^﻿/, ''));
  } catch (error) {
    throw new SpecmateError(`${file} is not valid JSON: ${(error as Error).message}`);
  }
  if (!isRecord(json)) throw new SpecmateError(`${file} must hold a JSON object`);
  if (json.steps !== undefined && !isRecord(json.steps)) throw new SpecmateError(`${file}: "steps" must be an object`);
  return { json, ...(json.steps ? { steps: json.steps } : {}) };
}

export const nodeRelevamientoStore: RelevamientoStore = {
  file(siteDir) {
    return path.join(siteDir, FILE);
  },

  async readStep(siteDir, name) {
    return (await load(path.join(siteDir, FILE))).steps?.[name];
  },

  async writeStep(siteDir, name, value) {
    const file = path.join(siteDir, FILE);
    const { json, steps } = await load(file);
    if (steps) steps[name] = value;
    else json.steps = { [name]: value };
    const temp = path.join(siteDir, `.${FILE}.tmp-${randomBytes(6).toString('hex')}`);
    try {
      await writeFile(temp, `${JSON.stringify(json, null, 2)}\n`, { flag: 'wx' });
      await rename(temp, file);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
  },
};
