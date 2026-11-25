#!/usr/bin/env node
// Bash guard for roles with the `run-checks` capability (OWASP AST03). Runs as a PreToolUse hook:
// reads the hook input from stdin and lets a Bash command through only when it is one of the
// read-only check commands below. Anything else exits 2, which blocks the call; stderr is the
// reason the agent sees. Any error also exits 2: the guard fails closed. The projected hook adds
// `|| exit 2`, so a guard that cannot even start (node missing, file moved) also blocks.
// Arguments: the guarded role names. As a session hook it then applies only when the call comes
// from one of those subagents (`agent_type`); other agents and the main session pass untouched.
// Without arguments it guards every call.
//
// Limit: an allowed command such as `npm test` runs the repository's own code with full
// permissions. The guard stops an agent from inventing commands; malicious code in the repo is
// caught by reviewing the diff, not here.

const CHAINING = /[;&|<>`$\n\r\\]/; // chaining, redirection, substitution, expansion, escapes
const GLOB = /[*?[\]{}]|^~/; // pathname, brace and tilde expansion in the unquoted part of a word

// Options are an allowlist per command: a flag (true) or an option that takes a value (a check of
// the value, given as --opt=value or as the next word). Anything else is refused, which covers
// abbreviations (git accepts --open-files for --open-files-in-pager) and npm config flags
// (--node-options, --script-shell) that run other programs. npx is left out: it downloads a
// package that is not installed locally.
const any = () => true;
const digits = (v) => /^\d+$/.test(v);
const workspace = (v) => /^packages\/[a-z0-9-]+$/.test(v);
const NPM_PLACE = {
  "--prefix": (v) => v === "templates/site",
  "--workspace": workspace,
  "-w": workspace,
  "--silent": true,
};
const NPM_AUDIT = {
  ...NPM_PLACE,
  "--json": true,
  "--omit": (v) => v === "dev",
  "--audit-level": (v) => /^(info|low|moderate|high|critical)$/.test(v),
};
const GIT_FLAGS = [
  "--stat", "--shortstat", "--numstat", "--summary", "--name-only", "--name-status", "--oneline",
  "--porcelain", "--short", "--branch", "--cached", "--staged", "--no-color", "--patch", "--graph",
  "--decorate", "--reverse", "--follow", "--merges", "--no-merges", "--first-parent", "--all",
  "--abbrev-ref", "--show-toplevel", "--verify", "--word-diff", "--ignore-all-space", "--root",
  "--line-number", "--count", "--ignore-case", "--files-with-matches", "--fixed-strings",
  "--extended-regexp",
];
const GIT_VALUED = [
  "--format", "--pretty", "--since", "--until", "--after", "--before", "--author", "--grep",
  "--diff-filter", "--untracked-files",
];
const GIT = {
  ...Object.fromEntries(GIT_FLAGS.map((o) => [o, true])),
  ...Object.fromEntries(GIT_VALUED.map((o) => [o, any])),
  "--max-count": digits,
  "--unified": digits,
  "-n": digits, // the value is optional: -n alone is git grep's --line-number
  "-U": digits,
  "-L": (v) => /^[\w,:+./-]+$/.test(v),
  "-e": any,
};
// Options whose value may come as the next word. Every other valued option needs --opt=value:
// git reads a bare --pretty or --untracked-files as complete, so a "value" in the next word would
// reach git as another option. A next word that starts with "-" is never taken as a value.
const SPACED = new Set(["--prefix", "--workspace", "-w", "-n", "-U", "-L", "-e"]);
// Short flags, clustered or not (-nw); no letter here takes a free value or starts a program.
const GIT_SHORT = /^-(\d+|[nU]\d+|L[\w,:+./-]+|[psbiwlEFMcn]+)$/;

// Each rule: the exact leading words, the allowed options, whether plain arguments may follow,
// and whether "--" may follow (after it only plain arguments, never options).
const RULES = [
  { words: ["npm", "test"], options: NPM_PLACE, args: false, dashdash: true },
  { words: ["npm", "run", "build"], options: NPM_PLACE, args: false },
  { words: ["npm", "run", "lint"], options: NPM_PLACE, args: false },
  { words: ["npm", "run", "check"], options: NPM_PLACE, args: false },
  { words: ["npm", "audit"], options: NPM_AUDIT, args: false },
  ...["status", "diff", "log", "show", "grep", "ls-files", "blame", "rev-parse"].map((c) => ({
    words: ["git", c], options: GIT, short: GIT_SHORT, args: true, dashdash: true,
  })),
  { words: ["ls"], options: {}, short: /^-[laAhRt1dF]+$/, args: true },
  { words: ["pwd"], options: {}, args: false },
];
const EXACT = [["node", "tools/project.mjs", "claude", "--check"]];

// The allowed commands for the block message, built from RULES and EXACT so the text cannot drift:
// rules that share their leading words and their options are grouped (git status|diff|...), so
// npm test and npm audit, with different options, stay apart.
function allowedSummary() {
  const groups = [];
  for (const rule of RULES) {
    const prefix = rule.words.slice(0, -1).join(" ");
    const group = groups.find((g) => g.prefix === prefix && g.options === rule.options);
    if (group) group.lasts.push(rule.words.at(-1));
    else groups.push({ prefix, options: rule.options, lasts: [rule.words.at(-1)] });
  }
  const ruleText = groups.map((g) => [g.prefix, g.lasts.join("|")].filter(Boolean).join(" "));
  return [...ruleText, ...EXACT.map((e) => e.join(" "))].join(", ");
}

class Refusal extends Error {}

// Split into words the way bash does once $, backticks and backslashes are refused: quoted
// segments are literal and join the text around them. An option name must be bare: -""y is -y to
// bash, so a quote before the "=" of a word that starts with "-" is refused.
function words(command) {
  const out = [];
  for (const raw of command.match(/(?:"[^"]*"|'[^']*'|[^\s"'])+/g) ?? []) {
    const value = raw.replace(/"([^"]*)"|'([^']*)'/g, "$1$2");
    if (value.startsWith("-") && /["']/.test(raw.split("=")[0])) throw new Refusal("quoted option name");
    if (GLOB.test(raw.replace(/"[^"]*"|'[^']*'/g, ""))) throw new Refusal("glob or brace expansion is not allowed");
    out.push(value);
  }
  return out;
}

const startsWith = (ws, prefix) => prefix.every((p, i) => ws[i] === p);

function checkArgs(rule, rest) {
  for (let i = 0; i < rest.length; i++) {
    const w = rest[i];
    if (w === "--" && rule.dashdash) {
      const opt = rest.slice(i + 1).find((a) => a.startsWith("-"));
      if (opt) throw new Refusal("option not allowed after --: " + opt);
      return;
    }
    if (!w.startsWith("-")) {
      if (!rule.args) throw new Refusal("argument not allowed: " + w);
      continue;
    }
    const eq = w.indexOf("=");
    const name = eq === -1 ? w : w.slice(0, eq);
    const allowed = Object.hasOwn(rule.options, name) ? rule.options[name] : undefined;
    if (allowed === true && eq === -1) continue;
    if (typeof allowed === "function") {
      if (eq !== -1) {
        if (allowed(w.slice(eq + 1))) continue;
      } else if (SPACED.has(name) && i + 1 < rest.length && !rest[i + 1].startsWith("-") && allowed(rest[i + 1])) {
        i++;
        continue;
      } else if (name === "-n") continue;
    } else if (eq === -1 && rule.short?.test(w)) continue;
    throw new Refusal("option not allowed: " + w);
  }
}

export function check(command) {
  if (typeof command !== "string" || command.trim() === "") return "empty command";
  if (CHAINING.test(command)) return "chaining, redirection or expansion is not allowed: run one command at a time";
  try {
    const ws = words(command.trim());
    if (EXACT.some((e) => e.length === ws.length && startsWith(ws, e))) return null;
    const rule = RULES.find((r) => startsWith(ws, r.words));
    if (!rule) return "not in the allowlist of check commands";
    checkArgs(rule, ws.slice(rule.words.length));
    return null;
  } catch (err) {
    if (err instanceof Refusal) return err.message;
    throw err;
  }
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => { raw += c; });
process.stdin.on("end", () => {
  try {
    let input;
    try { input = JSON.parse(raw); } catch { throw new Error("cannot read the hook input"); }
    if (input?.tool_name !== "Bash") process.exit(0);
    const roles = process.argv.slice(2);
    if (roles.length && !roles.includes(input.agent_type)) process.exit(0);
    const reason = check(input.tool_input?.command);
    if (reason === null) process.exit(0);
    process.stderr.write(
      `Blocked by tools/guard-bash.mjs: ${reason}. This role may only run these checks, ` +
        `one at a time: ${allowedSummary()}. Options must be read-only.\n`
    );
    process.exit(2);
  } catch (err) {
    process.stderr.write(`Blocked by tools/guard-bash.mjs: ${err.message}\n`);
    process.exit(2);
  }
});
