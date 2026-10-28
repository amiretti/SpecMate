#!/usr/bin/env node
// Conectores del catálogo .agents/mcp.json: estado, activación y concesiones por historia.
// Uso:
//   node tools/mcp.mjs list                          catálogo: para qué sirve, riesgo, quién lo usa
//   node tools/mcp.mjs enable|disable <nombre>...    activar o apagar para los roles que lo piden (decisión humana)
//   node tools/mcp.mjs grant <nombre> <rol> --story <id>   conceder un conector a un rol para una historia (lo hace el lead)
//   node tools/mcp.mjs revoke <nombre> <rol>         quitar una concesión
//   node tools/mcp.mjs revoke-story <id>             quitar todas las concesiones de una historia (close-story)
//   node tools/mcp.mjs grants                        concesiones vigentes
// Cada cambio regenera la proyección: la próxima delegación al rol ya lo tiene.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const file = path.join(root, ".agents", "mcp.json");
const rolesDir = path.join(root, ".agents", "roles");
const grantsPath = path.join(root, ".workspace", "mcp-grants.json");
const fail = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };
if (!fs.existsSync(file)) fail("no encuentro .agents/mcp.json (corré esto desde la raíz del proyecto)");

const catalog = JSON.parse(fs.readFileSync(file, "utf8"));
const servers = catalog.mcpServers ?? {};
const roles = fs.readdirSync(rolesDir).filter((n) => n.endsWith(".md")).map((n) => n.replace(".md", ""));
let grants = fs.existsSync(grantsPath) ? JSON.parse(fs.readFileSync(grantsPath, "utf8")) : [];

const usedBy = {};
for (const r of roles) {
  const m = fs.readFileSync(path.join(rolesDir, `${r}.md`), "utf8").match(/^mcp:\s*\[(.*)\]/m);
  for (const s of m ? m[1].split(",").map((x) => x.trim()).filter(Boolean) : []) (usedBy[s] ??= []).push(r);
}
const missingEnv = (s) => (s.requires ?? []).filter((v) => !process.env[v]);
const placeholder = (s) => JSON.stringify(s).includes("<");
const warn = (name, s) => {
  if (placeholder(s)) console.log(`⚠️ ${name}: completá los <...> en .agents/mcp.json`);
  if (missingEnv(s).length) console.log(`⚠️ ${name}: definí ${missingEnv(s).join(", ")} en tu entorno (nunca en el repo)`);
  if (s.external) console.log(`⚠️ ${name}: conector externo; los datos de esas apps pasan por un tercero`);
};
const reproject = () => {
  const r = spawnSync(process.execPath, [path.join(root, "tools", "project.mjs"), "claude"], { stdio: "inherit" });
  process.exit(r.status ?? 0);
};
const saveGrants = () => {
  fs.mkdirSync(path.dirname(grantsPath), { recursive: true });
  fs.writeFileSync(grantsPath, JSON.stringify(grants, null, 2) + "\n");
};

const [cmd, ...args] = process.argv.slice(2);

switch (cmd ?? "list") {
  case "list": {
    for (const [name, s] of Object.entries(servers)) {
      const where = s.main ? "sesión principal" : `roles: ${(usedBy[name] ?? []).join(", ") || "ninguno"}`;
      const state = s.enabled ? "✅" : "· ";
      const extra = [missingEnv(s).length ? `falta ${missingEnv(s).join(", ")}` : "", placeholder(s) ? "sin completar" : ""].filter(Boolean);
      console.log(`${state} ${name.padEnd(16)} riesgo ${s.risk ?? "?"} · ${where}${extra.length ? " · " + extra.join(" · ") : ""}`);
      if (s.purpose) console.log(`   ${s.purpose}`);
    }
    if (grants.length) console.log(`\nconcesiones vigentes: ${grants.map((g) => `${g.server}→${g.role} (${g.story})`).join(", ")}`);
    break;
  }

  case "enable":
  case "disable": {
    if (!args.length) fail(`decime qué conector: ${Object.keys(servers).join(", ")}`);
    for (const name of args) {
      const s = servers[name];
      if (!s) fail(`no existe "${name}" en el catálogo`);
      s.enabled = cmd === "enable";
      if (s.enabled) {
        warn(name, s);
        if (!s.main && !usedBy[name]) console.log(`⚠️ ${name}: ningún rol lo pide; agregalo al campo mcp: del rol que lo use`);
      }
      console.log(`${s.enabled ? "✅" : "·"} ${name} ${s.enabled ? "activado" : "desactivado"}`);
    }
    fs.writeFileSync(file, JSON.stringify(catalog, null, 2) + "\n");
    reproject();
    break;
  }

  case "grant": {
    const [name, role] = args;
    const story = args[args.indexOf("--story") + 1];
    if (!servers[name]) fail(`no existe "${name}" en el catálogo`);
    if (!roles.includes(role)) fail(`no existe el rol "${role}"`);
    if (!args.includes("--story") || !story) fail("toda concesión es por historia: --story <id>");
    warn(name, servers[name]);
    if (servers[name].risk === "alto") console.log(`⚠️ ${name}: riesgo alto; esta concesión necesita aprobación humana (piso)`);
    grants = grants.filter((g) => !(g.server === name && g.role === role));
    grants.push({ server: name, role, story, at: new Date().toISOString() });
    saveGrants();
    console.log(`✅ ${name} → ${role} para ${story}`);
    reproject();
    break;
  }

  case "revoke": {
    const [name, role] = args;
    const before = grants.length;
    grants = grants.filter((g) => !(g.server === name && g.role === role));
    saveGrants();
    console.log(before === grants.length ? "no había esa concesión" : `· ${name} → ${role} revocado`);
    reproject();
    break;
  }

  case "revoke-story": {
    const [story] = args;
    if (!story) fail("decime la historia");
    const before = grants.length;
    grants = grants.filter((g) => g.story !== story);
    saveGrants();
    console.log(`· ${before - grants.length} concesiones de ${story} revocadas`);
    reproject();
    break;
  }

  case "grants": {
    console.log(grants.length ? grants.map((g) => `${g.server} → ${g.role} · ${g.story} · ${g.at}`).join("\n") : "(sin concesiones)");
    break;
  }

  default:
    fail("comandos: list · enable · disable · grant <nombre> <rol> --story <id> · revoke <nombre> <rol> · revoke-story <id> · grants");
}
