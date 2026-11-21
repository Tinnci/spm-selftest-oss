#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const bundle = { win32: "nsis", linux: "appimage" }[process.platform];
if (!bundle) {
  console.error("Package from Windows for NSIS or Linux for AppImage.");
  process.exit(1);
}

const args = process.argv.slice(2);
const signed = args.includes("--signed");
const config = signed
  ? "src-tauri/tauri.release.conf.json"
  : JSON.stringify({ bundle: { active: true } });
const tauri = fileURLToPath(
  new URL("../node_modules/@tauri-apps/cli/tauri.js", import.meta.url),
);
const build = spawnSync(
  process.execPath,
  [
    tauri,
    "build",
    "--config",
    config,
    "--bundles",
    bundle,
    ...args.filter((arg) => arg !== "--signed"),
  ],
  {
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, VITE_ENABLE_UPDATER: signed ? "1" : "0" },
    stdio: "inherit",
  },
);
if (build.error) console.error(build.error.message);
process.exit(build.status ?? 1);
