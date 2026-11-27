#!/usr/bin/env node
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const pkg = JSON.parse(read("package.json")).version;
const lock = JSON.parse(read("package-lock.json"));
const tauri = JSON.parse(read("src-tauri/tauri.conf.json")).version;
const cargo = read("src-tauri/Cargo.toml").match(
  /^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m,
)?.[1];

const cargoLock = read("src-tauri/Cargo.lock").match(
  /^\[\[package\]\]\nname = "spm-selftest"\nversion = "([^"]+)"/m,
)?.[1];

const sources = {
  "package.json": pkg,
  "package-lock.json": lock.version,
  "package-lock.json (root package)": lock.packages?.[""]?.version,
  "src-tauri/tauri.conf.json": tauri,
  "src-tauri/Cargo.toml": cargo,
  "src-tauri/Cargo.lock": cargoLock,
};
const versions = new Set(Object.values(sources));
if (!pkg || versions.size !== 1) {
  console.error("Version mismatch:");
  for (const [file, version] of Object.entries(sources)) {
    console.error(`  ${file}: ${version ?? "(missing)"}`);
  }
  process.exit(1);
}
console.log(`versions agree on ${pkg}`);
