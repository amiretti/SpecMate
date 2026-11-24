// Entry point and composition root: the only place that wires the real adapters.
import path from 'node:path';
import { gitCli } from '../infrastructure/git-cli.ts';
import { nodeClientFolder } from '../infrastructure/node-client-folder.ts';
import { nodeFileSystem } from '../infrastructure/node-file-system.ts';
import { nodeRelevamientoStore } from '../infrastructure/node-relevamiento-store.ts';
import { nodeSiteTokens } from '../infrastructure/node-site-tokens.ts';
import { templateSourceFrom } from '../infrastructure/template-source.ts';
import { main } from './main.ts';

const template = templateSourceFrom(import.meta.url);

process.exitCode = await main(
  process.argv.slice(2),
  { cwd: process.cwd(), env: process.env, out: (line) => console.log(line), err: (line) => console.error(line) },
  {
    workspace: nodeFileSystem,
    git: gitCli,
    template,
    folder: nodeClientFolder,
    relevamiento: nodeRelevamientoStore,
    siteTokens: nodeSiteTokens,
    // templates/site lives two levels below the SpecMate repo root.
    specmateRoot: async () => path.resolve(await template.locate(), '..', '..'),
  },
);
