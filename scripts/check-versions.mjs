#!/usr/bin/env node
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const pkg = JSON.parse(read("package.json")).version;
const tauri = JSON.parse(read("src-tauri/tauri.conf.json")).version;
const cargo = read("src-tauri/Cargo.toml").match(
  /^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m,
)?.[1];

const sources = {
  "package.json": pkg,
  "src-tauri/tauri.conf.json": tauri,
  "src-tauri/Cargo.toml": cargo ?? "(missing)",
};
const versions = new Set(Object.values(sources));
if (versions.size !== 1) {
  console.error("Version mismatch:");
  for (const [file, version] of Object.entries(sources)) {
    console.error(`  ${file}: ${version}`);
  }
  process.exit(1);
}
console.log(`versions agree on ${pkg}`);
