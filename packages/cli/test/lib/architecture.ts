// Architecture rule of packages/cli (ADR-0034, US-13 FR-008/FR-009, plan decision 6). Own implementation: 3 layers
// and one rule do not justify a dependency. It reads every .ts file under a src dir and its static and dynamic imports.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const LAYERS = ['domain', 'application', 'infrastructure', 'cli'] as const;
type Layer = (typeof LAYERS)[number];

// Which layers each layer may import (relative imports). Bare packages and node:* are allowed only where listed.
const MAY_IMPORT: Record<Layer, readonly Layer[]> = {
  domain: ['domain'],
  application: ['domain', 'application'],
  infrastructure: ['domain', 'application', 'infrastructure'],
  cli: ['domain', 'application', 'infrastructure', 'cli'],
};
const MAY_IMPORT_EXTERNAL: Record<Layer, boolean> = {
  domain: false,
  application: false,
  infrastructure: true,
  cli: true,
};

const IMPORT =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
// A separator next to a concatenation: '/' or '\\' joined with +, or right before/after a ${...} in a template
// literal. An escape such as "}\n" is not a separator (only "/" or an escaped backslash "\\" count).
const SEPARATOR_CONCAT = /\+\s*['"](?:\/|\\\\)['"]|['"](?:\/|\\\\)['"]\s*\+|\$\{[^}]+\}(?:\/|\\\\)|(?:\/|\\\\)\$\{/;

async function tsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.ts'))
    .map((e) => path.join(e.parentPath, e.name))
    .sort();
}

const layerOf = (srcDir: string, file: string): Layer | undefined => {
  const first = path.relative(srcDir, file).split(path.sep)[0];
  return (LAYERS as readonly string[]).includes(first ?? '') && path.relative(srcDir, file).includes(path.sep)
    ? (first as Layer)
    : undefined;
};

/** One problem string per violation; [] when the code under `srcDir` respects the rule. */
export async function checkArchitecture(srcDir: string, { requireLayers = false } = {}): Promise<string[]> {
  const files = await tsFiles(srcDir);
  if (files.length === 0) return [`${srcDir}: no .ts files (cannot check, so it fails)`];
  const problems: string[] = [];
  const seen = new Set<Layer>();
  for (const file of files) {
    const rel = path.relative(srcDir, file);
    const layer = layerOf(srcDir, file);
    if (layer === undefined) {
      problems.push(`${rel}: outside the layers (${LAYERS.join(', ')})`);
      continue;
    }
    seen.add(layer);
    const text = await readFile(file, 'utf8');
    for (const match of text.matchAll(IMPORT)) {
      const spec = match[1] ?? match[2] ?? match[3] ?? '';
      if (spec.startsWith('.')) {
        const target = layerOf(srcDir, path.resolve(path.dirname(file), spec));
        if (target === undefined || !MAY_IMPORT[layer].includes(target))
          problems.push(`${rel}: ${layer} imports ${spec}`);
      } else if (!MAY_IMPORT_EXTERNAL[layer]) {
        problems.push(`${rel}: ${layer} imports ${spec}`);
      }
    }
    const code = text.replace(/^\s*\/\/.*$/gm, '');
    if (SEPARATOR_CONCAT.test(code)) problems.push(`${rel}: builds a path by concatenating a separator; use node:path`);
  }
  if (requireLayers) {
    for (const layer of LAYERS) if (!seen.has(layer)) problems.push(`${srcDir}: missing layer ${layer}`);
  }
  return problems;
}
