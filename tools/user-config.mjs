#!/usr/bin/env node
// Configuración de nivel usuario (no de proyecto): ~/.workspace/
//   user.json      { "agentName": "..." }  nombre del agente principal (ADR-019)
//   profile.md     perfil del developer, con tope (ADR-023)
//   profile.history/  versiones anteriores del perfil
// Sin dependencias. WORKSPACE_HOME reemplaza ~/.workspace (útil para tests).
//
// Uso:
//   node tools/user-config.mjs get [clave]
//   node tools/user-config.mjs set agentName "<nombre>"
//   node tools/user-config.mjs profile-show
//   node tools/user-config.mjs profile-save <archivo>
//   node tools/user-config.mjs profile-history
//   node tools/user-config.mjs profile-revert <archivo-del-historial>

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const HOME = process.env.WORKSPACE_HOME || path.join(os.homedir(), ".workspace");
const USER_JSON = path.join(HOME, "user.json");
const PROFILE = path.join(HOME, "profile.md");
const HISTORY = path.join(HOME, "profile.history");
const PROFILE_MAX_CHARS = 2000;
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,31}$/u;

const fail = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };

function readUser() {
  if (!fs.existsSync(USER_JSON)) return {};
  try { return JSON.parse(fs.readFileSync(USER_JSON, "utf8")); }
  catch { fail(`${USER_JSON} no es JSON válido; corregilo o borralo`); }
}

function writeAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

function reproject() {
  // Si estamos en un proyecto con .agents/, regenera la proyección con el nombre nuevo.
  const projector = path.join(process.cwd(), "tools", "project.mjs");
  if (!fs.existsSync(path.join(process.cwd(), ".agents")) || !fs.existsSync(projector)) return;
  const r = spawnSync(process.execPath, [projector, "claude"], { stdio: "inherit" });
  if (r.status !== 0) console.error("⚠️ no se pudo regenerar la proyección; corré tools/project.mjs a mano");
}

const stamp = () => new Date().toISOString().replaceAll(":", "-");

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case "get": {
    const user = readUser();
    const out = args[0] ? user[args[0]] : user;
    console.log(out === undefined ? "" : typeof out === "string" ? out : JSON.stringify(out, null, 2));
    break;
  }

  case "set": {
    const [key, ...rest] = args;
    const value = rest.join(" ").trim();
    if (key !== "agentName") fail(`clave no soportada: "${key}" (hoy: agentName)`);
    if (!NAME_RE.test(value))
      fail("nombre inválido: 1 a 32 caracteres, letras, números, espacios, . _ o -, y que empiece con letra o número");
    const user = readUser();
    const previous = user.agentName;
    user.agentName = value;
    user.updatedAt = new Date().toISOString();
    writeAtomic(USER_JSON, JSON.stringify(user, null, 2) + "\n");
    console.log(previous ? `✅ agentName: ${previous} → ${value}` : `✅ agentName: ${value}`);
    reproject();
    break;
  }

  case "profile-show": {
    console.log(fs.existsSync(PROFILE) ? fs.readFileSync(PROFILE, "utf8") : "(sin perfil todavía)");
    break;
  }

  case "profile-save": {
    const file = args[0];
    if (!file || !fs.existsSync(file)) fail("pasá el archivo con la versión nueva del perfil");
    const next = fs.readFileSync(file, "utf8").trim() + "\n";
    if (next.length > PROFILE_MAX_CHARS)
      fail(`el perfil tiene ${next.length} caracteres; el tope es ${PROFILE_MAX_CHARS}. Condensalo`);
    if (fs.existsSync(PROFILE)) {
      const current = fs.readFileSync(PROFILE, "utf8");
      if (current === next) { console.log("sin cambios"); break; }
      fs.mkdirSync(HISTORY, { recursive: true });
      fs.writeFileSync(path.join(HISTORY, `${stamp()}.md`), current);
    }
    writeAtomic(PROFILE, next);
    console.log(`✅ perfil guardado (${next.length}/${PROFILE_MAX_CHARS} caracteres)`);
    break;
  }

  case "profile-history": {
    const files = fs.existsSync(HISTORY) ? fs.readdirSync(HISTORY).sort().reverse() : [];
    console.log(files.length ? files.join("\n") : "(sin historial)");
    break;
  }

  case "profile-revert": {
    const name = path.basename(args[0] ?? "");
    const src = path.join(HISTORY, name);
    if (!name || !fs.existsSync(src)) fail("pasá un archivo de profile-history");
    if (fs.existsSync(PROFILE)) {
      fs.mkdirSync(HISTORY, { recursive: true });
      fs.writeFileSync(path.join(HISTORY, `${stamp()}.md`), fs.readFileSync(PROFILE, "utf8"));
    }
    writeAtomic(PROFILE, fs.readFileSync(src, "utf8"));
    console.log(`✅ perfil revertido a ${name}`);
    break;
  }

  default:
    fail("comandos: get · set agentName <nombre> · profile-show · profile-save <archivo> · profile-history · profile-revert <archivo>");
}
