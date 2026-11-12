#!/usr/bin/env node
// Proyector: .agents/ (fuente neutral) -> formato nativo de un runtime.
// Uso: node tools/project.mjs claude [--force | --check]
// --check: no escribe nada; sale con 1 si la proyección está desactualizada (para CI).
// Sin dependencias. Lo que genera lleva cabecera "generado" y queda registrado con su
// hash en .workspace/projection.json: si alguien lo editó a mano, NO se pisa (salvo --force).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const [target = "claude", ...flags] = process.argv.slice(2);
const force = flags.includes("--force");
const check = flags.includes("--check");
const root = process.cwd();
const src = path.join(root, ".agents");
const manifestPath = path.join(root, ".workspace", "projection.json");
const GEN = "generado por tools/project.mjs — no editar; la fuente está en";

if (target !== "claude") {
  console.error(`runtime no soportado todavía: ${target}`);
  process.exit(1);
}

const providers = JSON.parse(fs.readFileSync(path.join(src, "providers.json"), "utf8"));
const rt = providers[target];
if (!rt) throw new Error(`providers.json: falta ${target}`);
const tiers = rt.tiers;

// Catálogo MCP: ${workspaceRoot} -> ruta absoluta del proyecto (Engram exige ENGRAM_DATA_DIR absoluta).
const rootJson = JSON.stringify(root).slice(1, -1);
const catalog = JSON.parse(
  fs.readFileSync(path.join(src, "mcp.json"), "utf8").replaceAll("${workspaceRoot}", rootJson)
).mcpServers ?? {};
const META = new Set(["$comment", "enabled", "main", "requires", "external", "purpose", "risk"]);
const cleanServer = (s) => Object.fromEntries(Object.entries(s).filter(([k]) => !META.has(k)));
const enabledServers = Object.entries(catalog).filter(([, s]) => s.enabled);

const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");
const report = { written: [], skipped: [], removed: [], stale: [] };

function emit(rel, content) {
  const abs = path.join(root, rel);
  if (check) {
    const current = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
    if (current !== content) report.stale.push(`${rel} (${current === null ? "falta" : "desactualizado"})`);
    return;
  }
  if (fs.existsSync(abs) && !force) {
    const current = hash(fs.readFileSync(abs, "utf8"));
    if (manifest[rel] !== current) {
      report.skipped.push(`${rel} (editado a mano o no generado: llevá el cambio a .agents/ o usá --force)`);
      return;
    }
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  manifest[rel] = hash(content);
  report.written.push(rel);
}

// Fuente en LF siempre: con core.autocrlf=true (default de Git en Windows) los .md llegan
// con CRLF, y el \r rompe el parseo del frontmatter (en una regex, `.` no matchea \r).
const readText = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function splitFrontmatter(txt) {
  const end = txt.indexOf("\n---", 4);
  return [txt.slice(4, end).split("\n"), txt.slice(end + 4)];
}

// 1. Roles -> .claude/agents/
// Frontmatter mínimo: clave -> líneas crudas (incluye continuaciones indentadas).
function parseFm(lines) {
  const fm = new Map();
  let key = null;
  for (const line of lines) {
    const m = line.match(/^([A-Za-z][\w-]*):(.*)$/);
    if (m) { key = m[1]; fm.set(key, [line]); }
    else if (key) fm.get(key).push(line);
  }
  return fm;
}
const scalar = (fm, k) => fm.get(k)?.[0].replace(/^[\w-]+:\s*/, "").replace(/^"(.*)"$/, "$1").trim();
function list(fm, k) {
  const raw = fm.get(k);
  if (!raw) return [];
  const inline = raw[0].match(/\[(.*)\]/);
  if (inline) return inline[1].split(",").map((x) => x.trim()).filter(Boolean);
  return raw.slice(1).map((l) => l.replace(/^\s*-\s*/, "").trim()).filter(Boolean);
}
const toolsFor = (file, caps) => {
  const tools = new Set();
  for (const c of caps) {
    if (!(c in rt.capabilities)) throw new Error(`${file}: capability desconocida "${c}"`);
    rt.capabilities[c].forEach((t) => tools.add(t));
  }
  return [...tools];
};
const modelFor = (file, tier) => {
  const model = tiers[tier];
  if (!model) throw new Error(`${file}: nivel desconocido "${tier}"`);
  return model;
};

const roles = new Map();
for (const f of fs.readdirSync(path.join(src, "roles")).filter((n) => n.endsWith(".md"))) {
  const [lines, body] = splitFrontmatter(readText(path.join(src, "roles", f)));
  roles.set(f.replace(/\.md$/, ""), { file: f, fm: parseFm(lines), body });
}
// El agente principal (lead) es la sesión principal: sus conectores van a .mcp.json; los demás, inline en cada rol.
const MAIN = "lead";
if (!roles.has(MAIN)) throw new Error(`falta el rol ${MAIN}`);

for (const [name, r] of roles) {
  const caps = list(r.fm, "capabilities");
  const skills = list(r.fm, "skills");
  const out = [`name: ${name}`, ...(r.fm.get("description") ?? [])];
  out.push(`tools: ${toolsFor(r.file, caps).join(", ")}`, `model: ${modelFor(r.file, scalar(r.fm, "tier"))}`);
  if (skills.length) out.push("skills:", ...skills.map((s) => `  - ${s}`));
  const isMain = name === MAIN;
  const wanted = new Set(list(r.fm, "mcp"));
  const servers = enabledServers.filter(([n, s]) => wanted.has(n) || (isMain && s.main));
  if (servers.length) {
    const inline = (s) => { const c = cleanServer(s); return c.command && !c.type ? { type: "stdio", ...c } : c; };
    out.push("mcpServers:", ...servers.map(([n, s]) => (s.main ? `  - ${n}` : `  - ${n}: ${JSON.stringify(inline(s))}`)));
    const toolsLine = out.findIndex((l) => l.startsWith("tools: "));
    out[toolsLine] += ", " + servers.map(([n]) => `mcp__${n}__*`).join(", ");
  }
  if (r.fm.has("color")) out.push(...r.fm.get("color"));
  emit(`.claude/agents/${r.file}`, `---\n${out.join("\n")}\n---\n<!-- ${GEN} .agents/roles/${r.file} -->${r.body}`);
}

// Lo que quedó de una proyección vieja (un rol o una skill que ya no existe) y nadie editó, se borra.
function prune(dir, keep) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return;
  for (const e of fs.readdirSync(abs)) {
    if (keep.has(e)) continue;
    const files = fs.statSync(path.join(abs, e)).isDirectory()
      ? fs.readdirSync(path.join(abs, e)).map((f) => path.join(dir, e, f)) : [path.join(dir, e)];
    if (!files.some((rel) => rel in manifest)) continue; // no lo generó el proyector (por ejemplo, las skills de Spec Kit)
    const ours = files.every((rel) => manifest[rel] === hash(fs.readFileSync(path.join(root, rel), "utf8")));
    if (!ours) { report.skipped.push(`${dir}/${e} (sobra, pero fue editado: borralo a mano)`); continue; }
    if (check) { report.stale.push(`${dir}/${e} (sobra)`); continue; }
    fs.rmSync(path.join(abs, e), { recursive: true }); files.forEach((rel) => delete manifest[rel]); report.removed.push(`${dir}/${e}`);
  }
}
prune(".claude/agents", new Set([...roles.values()].map((r) => r.file)));
prune(".claude/skills", new Set(fs.readdirSync(path.join(src, "skills"))));

// Al abrir una sesión, avisa si alguien cambió .agents/ y no regeneró (no bloquea).
const settings = {
  agent: MAIN,
  hooks: { SessionStart: [{ hooks: [{ type: "command", command: "node tools/project.mjs claude --check" }] }] },
};
emit(".claude/settings.json", JSON.stringify(settings, null, 2) + "\n");

// 2. Skills -> .claude/skills/  (metadata del estándar -> campos propios de Claude)
for (const name of fs.readdirSync(path.join(src, "skills"))) {
  const dir = path.join(src, "skills", name);
  for (const file of fs.readdirSync(dir)) {
    const txt = readText(path.join(dir, file));
    if (file !== "SKILL.md") {
      emit(`.claude/skills/${name}/${file}`, txt);
      continue;
    }
    const [fm, body] = splitFrontmatter(txt);
    const out = [];
    let inMeta = false;
    for (const line of fm) {
      if (line === "metadata:") { inMeta = true; continue; }
      if (inMeta && line.startsWith("  ")) {
        const hint = line.match(/^\s+argument-hint:\s*"?(.*?)"?$/);
        if (hint) out.push(`argument-hint: ${hint[1]}`);
        if (/^\s+invocation:\s*manual/.test(line)) out.push("disable-model-invocation: true");
        continue;
      }
      inMeta = false;
      out.push(line);
    }
    emit(`.claude/skills/${name}/SKILL.md`, `---\n${out.join("\n")}\n---\n<!-- ${GEN} .agents/skills/${name}/SKILL.md -->${body}`);
  }
}

// 3. AGENTS.md -> CLAUDE.md que lo importa (raíz y módulos)
const SKIP = new Set(["node_modules", ".git", ".agents", ".workspace", ".claude", "bin", "obj", "dist"]);
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !SKIP.has(e.name)) walk(path.join(dir, e.name));
    else if (e.name === "AGENTS.md") {
      const rel = path.relative(root, path.join(dir, "CLAUDE.md"));
      emit(rel, `<!-- ${GEN} AGENTS.md -->\n@AGENTS.md\n`);
    }
  }
})(root);

// 4. Conectores de la sesión principal -> .mcp.json (los demás viven solo en los roles)
const mainServers = Object.fromEntries(enabledServers.filter(([, s]) => s.main).map(([n, s]) => [n, cleanServer(s)]));
emit(".mcp.json", JSON.stringify({ mcpServers: mainServers }, null, 2) + "\n");

if (check) {
  if (report.stale.length) {
    console.log(`❌ proyección desactualizada (${report.stale.length}): corré node tools/project.mjs ${target}`);
    report.stale.forEach((s) => console.log(`  ${s}`));
    process.exit(1);
  }
  console.log("✅ proyección al día");
  process.exit(0);
}
fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`generados: ${report.written.length} · salteados: ${report.skipped.length} · borrados: ${report.removed.length}`);
report.skipped.forEach((s) => console.log(`  ⚠️ ${s}`));
