#!/usr/bin/env node
/* global process, console */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

function readPackageJson(dir) {
  const packageJsonPath = join(dir, "package.json");
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  return JSON.parse(readFileSync(packageJsonPath, "utf8"));
}

function findWorkspaceRoot(startDir) {
  let current = startDir;

  while (true) {
    const pkg = readPackageJson(current);
    if (pkg?.workspaces) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

function getClangEnv() {
  if (process.platform === "win32") {
    return {};
  }

  const clang = spawnSync("clang", ["--version"], { stdio: "ignore" });
  const clangxx = spawnSync("clang++", ["--version"], { stdio: "ignore" });

  if (clang.status === 0 && clangxx.status === 0) {
    return { CC: "clang", CXX: "clang++" };
  }

  return {};
}

function tryLoadBetterSqlite3(fromDir) {
  try {
    const requireFromDir = createRequire(join(fromDir, "package.json"));
    requireFromDir("better-sqlite3");
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

function rebuildBetterSqlite3(cwd) {
  const env = { ...process.env, ...getClangEnv() };
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

  const usingClang = env.CC === "clang" && env.CXX === "clang++";
  console.log(
    usingClang
      ? `🔧 Rebuilding better-sqlite3 in ${cwd} with clang toolchain...`
      : `🔧 Rebuilding better-sqlite3 in ${cwd}...`,
  );

  const result = spawnSync(npmCmd, ["rebuild", "better-sqlite3"], {
    cwd,
    stdio: "inherit",
    env,
  });

  return result.status === 0;
}

function main() {
  const initial = tryLoadBetterSqlite3(REPO_ROOT);
  if (initial.ok) {
    return;
  }

  console.warn(
    `⚠️ better-sqlite3 unavailable: ${initial.error?.message ?? "unknown error"}`,
  );

  const locationsToTry = [REPO_ROOT];
  const workspaceRoot = findWorkspaceRoot(REPO_ROOT);
  if (workspaceRoot && workspaceRoot !== REPO_ROOT) {
    locationsToTry.push(workspaceRoot);
  }

  for (const cwd of locationsToTry) {
    if (!rebuildBetterSqlite3(cwd)) {
      continue;
    }

    const recheck = tryLoadBetterSqlite3(REPO_ROOT);
    if (recheck.ok) {
      console.log("✅ better-sqlite3 native binding is ready");
      return;
    }
  }

  const finalCheck = tryLoadBetterSqlite3(REPO_ROOT);
  console.error(
    "❌ better-sqlite3 is still unavailable after rebuild attempts.",
  );
  if (finalCheck.error) {
    console.error(finalCheck.error.message);
  }
  process.exit(1);
}

main();
