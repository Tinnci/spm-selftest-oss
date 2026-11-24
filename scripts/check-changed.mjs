import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

const isWin = process.platform === "win32";

function gitLines(args) {
  return execFileSync("git", args, { encoding: "utf8" })
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && fs.existsSync(s));
}

const changed = Array.from(
  new Set([
    ...gitLines(["diff", "--name-only", "HEAD"]),
    ...gitLines(["ls-files", "--others", "--exclude-standard"]),
  ]),
);

if (changed.length === 0) {
  console.log("check:changed: clean working tree");
  process.exit(0);
}

const prettierFiles = changed.filter((f) =>
  /\.(ts|tsx|js|mjs|json|html)$/i.test(f),
);
const eslintFiles = changed.filter((f) => /\.(ts|tsx|js|mjs)$/i.test(f));
const vitestFiles = changed.filter((f) =>
  /^(src|tests)\/.*\.(ts|tsx)$/i.test(f),
);

function run(label, cmd, args) {
  return new Promise((resolve) => {
    const start = performance.now();
    const useCmd = isWin && (cmd === "npm" || cmd === "npx");
    const spawnCmd = useCmd ? "cmd.exe" : cmd;
    const spawnArgs = useCmd ? ["/d", "/s", "/c", `${cmd}.cmd`, ...args] : args;
    const child = spawn(spawnCmd, spawnArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const out = [];
    child.stdout.on("data", (d) => out.push(d));
    child.stderr.on("data", (d) => out.push(d));
    child.on("close", (code) => {
      resolve({
        label,
        ok: code === 0,
        ms: Math.round(performance.now() - start),
        output: Buffer.concat(out).toString("utf8"),
      });
    });
  });
}

const jobs = [run("comments", "npm", ["run", "lint:comments"])];
if (prettierFiles.length > 0) {
  jobs.push(
    run("prettier", "npx", [
      "prettier",
      "--check",
      "--cache",
      "--cache-location",
      "node_modules/.cache/prettier",
      ...prettierFiles,
    ]),
  );
}
if (eslintFiles.length > 0) {
  jobs.push(
    run("eslint", "npx", [
      "eslint",
      "--cache",
      "--cache-location",
      "node_modules/.cache/eslint",
      "--max-warnings=0",
      ...eslintFiles,
    ]),
  );
}
if (vitestFiles.length > 0) {
  jobs.push(
    run("vitest:related", "npx", [
      "vitest",
      "related",
      "--run",
      ...vitestFiles,
    ]),
  );
}

const results = await Promise.all(jobs);
for (const item of results) {
  console.log(
    `${item.ok ? "PASS" : "FAIL"}  ${item.label.padEnd(16)} ${item.ms}ms`,
  );
}
const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  for (const item of failed) {
    console.error(`\n--- ${item.label} ---\n${item.output}`);
  }
  process.exit(1);
}
