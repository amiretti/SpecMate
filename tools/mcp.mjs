#!/usr/bin/env node
// Conectores del catálogo .agents/mcp.json: estado y activación.
// Uso:
//   node tools/mcp.mjs list                          catálogo: para qué sirve, riesgo, quién lo usa
//   node tools/mcp.mjs enable|disable <nombre>...    activar o apagar para los roles que lo piden (decisión humana: piso)
// Cada cambio regenera la proyección: la próxima delegación al rol ya lo tiene.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const file = path.join(root, ".agents", "mcp.json");
const rolesDir = path.join(root, ".agents", "roles");
const fail = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };
if (!fs.existsSync(file)) fail("no encuentro .agents/mcp.json (corré esto desde la raíz del proyecto)");

const catalog = JSON.parse(fs.readFileSync(file, "utf8"));
const servers = catalog.mcpServers ?? {};
const roles = fs.readdirSync(rolesDir).filter((n) => n.endsWith(".md")).map((n) => n.replace(".md", ""));

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

  default:
    fail("comandos: list · enable <nombre>… · disable <nombre>…");
}
