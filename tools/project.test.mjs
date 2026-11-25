// Tests of the projector for guarded capabilities (OWASP AST03, AST10): a role that may only run
// checks gets Bash plus the guard hook, and a projection that would lose the guard fails loudly.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const realProviders = JSON.parse(fs.readFileSync(path.join(repo, ".agents", "providers.json"), "utf8"));

function project({ caps, providers = realProviders, name = "checker" }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specmate-project-"));
  try {
    fs.mkdirSync(path.join(root, "tools"));
    fs.copyFileSync(path.join(repo, "tools", "project.mjs"), path.join(root, "tools", "project.mjs"));
    fs.mkdirSync(path.join(root, ".agents", "roles"), { recursive: true });
    fs.mkdirSync(path.join(root, ".agents", "skills"));
    fs.writeFileSync(path.join(root, ".agents", "providers.json"), JSON.stringify(providers));
    fs.writeFileSync(path.join(root, ".agents", "mcp.json"), JSON.stringify({ mcpServers: {} }));
    const role = (name, c) => `---\nname: ${name}\ndescription: test role\ncapabilities: [${c}]\ntier: estándar\n---\nBody.\n`;
    fs.writeFileSync(path.join(root, ".agents", "roles", "lead.md"), role("lead", "read"));
    fs.writeFileSync(path.join(root, ".agents", "roles", `${name}.md`), role(name, caps));
    const r = spawnSync(process.execPath, ["tools/project.mjs", "claude"], { cwd: root, encoding: "utf8" });
    const read = (...p) => (fs.existsSync(path.join(root, ...p)) ? fs.readFileSync(path.join(root, ...p), "utf8") : null);
    const settings = read(".claude", "settings.json");
    return {
      code: r.status,
      stderr: r.stderr,
      agent: read(".claude", "agents", `${name}.md`),
      settings: settings && JSON.parse(settings),
    };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// "|| exit 2": Claude Code only blocks on exit 2, so a guard that cannot start (node missing,
// file moved, syntax error) would otherwise let the command run.
// The guard goes in the session settings, not in the role's frontmatter: subagent frontmatter
// hooks did not fire in a live probe (2026-11-25), while session hooks do.
test("run-checks projects Bash plus a session guard hook for that role", () => {
  const r = project({ caps: "read, run-checks" });
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.agent, /^tools: Read, Grep, Glob, Bash$/m);
  assert.doesNotMatch(r.agent, /hooks:/);
  assert.deepEqual(r.settings.hooks.PreToolUse, [
    { matcher: "Bash", hooks: [{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR/tools/guard-bash.mjs" checker || exit 2' }] },
  ]);
});

test("a role with execute keeps unguarded Bash and no hook", () => {
  const r = project({ caps: "read, execute" });
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.agent, /^tools: Read, Grep, Glob, Bash$/m);
  assert.equal(r.settings.hooks.PreToolUse, undefined);
});

test("run-checks together with execute is refused", () => {
  const r = project({ caps: "read, execute, run-checks" });
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /checker\.md: run-checks y execute/);
});

test("a runtime without a guard for run-checks is refused, not projected without it", () => {
  const providers = structuredClone(realProviders);
  delete providers.claude.guards;
  const r = project({ caps: "read, run-checks", providers });
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /checker\.md: claude no tiene guardia para "run-checks"/);
});

test("the projected guard script exists", () => {
  const command = realProviders.claude.guards["run-checks"];
  const file = command.match(/\$CLAUDE_PROJECT_DIR\/([^"]+)"/)[1];
  assert.ok(fs.existsSync(path.join(repo, file)), file);
});

test("a guarded role whose name is not a plain identifier is refused (it goes into a shell command)", () => {
  const r = project({ caps: "read, run-checks", name: "x;calc" });
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /x;calc\.md: nombre de rol inválido para una guardia/);
});
