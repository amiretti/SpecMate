// Entry point and composition root: the only place that wires the real adapters.
import path from 'node:path';
import { SpecmateError } from '../domain/errors.ts';
import { gitCli } from '../infrastructure/git-cli.ts';
import { nodeClientFolder } from '../infrastructure/node-client-folder.ts';
import { nodeFileSystem } from '../infrastructure/node-file-system.ts';
import { nodeRelevamientoStore } from '../infrastructure/node-relevamiento-store.ts';
import { nodeSiteTokens } from '../infrastructure/node-site-tokens.ts';
import { templateSourceFrom } from '../infrastructure/template-source.ts';
import { main } from './main.ts';

const template = templateSourceFrom(import.meta.url);

// A proposal for `specmate profile propose` (US-17): up to 64 KB, so a runaway agent cannot fill the memory.
const STDIN_LIMIT = 64 * 1024;
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > STDIN_LIMIT) throw new SpecmateError('the proposal on stdin is larger than 64 KB');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

process.exitCode = await main(
  process.argv.slice(2),
  {
    cwd: process.cwd(),
    env: process.env,
    out: (line) => console.log(line),
    err: (line) => console.error(line),
    stdin: readStdin,
  },
  {
    workspace: nodeFileSystem,
    git: gitCli,
    template,
    folder: nodeClientFolder,
    relevamiento: nodeRelevamientoStore,
    siteTokens: nodeSiteTokens,
    now: () => new Date(),
    // templates/site lives two levels below the SpecMate repo root.
    specmateRoot: async () => path.resolve(await template.locate(), '..', '..'),
  },
);
