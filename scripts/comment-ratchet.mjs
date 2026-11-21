#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const roots = ["src", "src-tauri/src", "src-tauri/tests", "scripts", ".github"];
const exts = new Set([
  ".rs",
  ".ts",
  ".tsx",
  ".css",
  ".mjs",
  ".js",
  ".yml",
  ".yaml",
]);
const skip = new Set(["node_modules", "target", "dist", ".git"]);
const directives = [
  "eslint-",
  "@ts-",
  "prettier-",
  "@vitest-environment",
  "yaml-language-server",
  "<reference",
  "istanbul",
  "c8 ",
  "v8 ",
  "stylelint-",
  "biome-",
  "oxlint-",
];
const baselinePath = "comment-baseline.json";
const update = process.argv.includes("--update");
const baseline = fs.existsSync(baselinePath)
  ? JSON.parse(fs.readFileSync(baselinePath, "utf8"))
  : {};
const counts = {};

function isDirective(line) {
  return directives.some((prefix) => line.includes(prefix));
}

function countFile(file) {
  const ext = path.extname(file);
  const lines = fs.readFileSync(file, "utf8").split("\n");
  let count = 0;
  let block = false;
  for (const line of lines) {
    const text = line.trim();
    let comment = false;
    if (block) {
      comment = true;
      if (text.includes("*/")) block = false;
    } else if (text.startsWith("//")) comment = true;
    else if (text.startsWith("/*")) {
      comment = true;
      if (!text.includes("*/")) block = true;
    } else if (
      (ext === ".yml" || ext === ".yaml") &&
      text.startsWith("#") &&
      !text.startsWith("#!")
    ) {
      comment = true;
    }
    if (comment && !isDirective(line)) count++;
  }
  return count;
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(file);
      continue;
    }
    if (!exts.has(path.extname(file))) continue;
    const key = file.split(path.sep).join("/");
    counts[key] = countFile(file);
  }
}

for (const root of roots) walk(root);

if (update) {
  const sorted = Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
  );
  fs.writeFileSync(baselinePath, JSON.stringify(sorted, null, 2) + "\n");
  console.log("comment-baseline.json updated");
  process.exit(0);
}

let failed = false;
for (const [file, count] of Object.entries(counts)) {
  const allowed = Number(baseline[file] ?? 0);
  if (count > allowed) {
    failed = true;
    console.error(
      file + ": " + count + " comments, baseline allows " + allowed,
    );
  } else if (count < allowed) {
    failed = true;
    console.error(
      file +
        ": baseline is stale (" +
        count +
        " comments, " +
        allowed +
        " allowed); run npm run lint:comments:update",
    );
  }
}
if (failed) {
  console.error(
    "Comment ratchet failed. Delete comments or update the baseline only after an audit.",
  );
  process.exit(1);
}
console.log(
  "comment-ratchet: " + Object.keys(counts).length + " files checked",
);
