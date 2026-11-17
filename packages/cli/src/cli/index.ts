// Entry point and composition root: the only place that wires the real adapters.
import { gitCli } from '../infrastructure/git-cli.ts';
import { nodeFileSystem } from '../infrastructure/node-file-system.ts';
import { templateSourceFrom } from '../infrastructure/template-source.ts';
import { main } from './main.ts';

process.exitCode = await main(
  process.argv.slice(2),
  { cwd: process.cwd(), out: (line) => console.log(line), err: (line) => console.error(line) },
  { workspace: nodeFileSystem, git: gitCli, template: templateSourceFrom(import.meta.url) },
);
