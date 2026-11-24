import { spawn } from "node:child_process";
import process from "node:process";

const skipRust = process.argv.includes("--skip-rust");
const isWin = process.platform === "win32";

function runTask(label, cmd, args) {
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
      const ms = Math.round(performance.now() - start);
      resolve({
        label,
        ok: code === 0,
        code: code ?? 1,
        ms,
        output: Buffer.concat(out).toString("utf8"),
      });
    });
  });
}

async function runRustLane() {
  const results = [];
  results.push(
    await runTask("rust:fmt", "cargo", [
      "fmt",
      "--manifest-path",
      "src-tauri/Cargo.toml",
      "--check",
    ]),
  );
  results.push(
    await runTask("rust:clippy", "cargo", [
      "clippy",
      "--locked",
      "--manifest-path",
      "src-tauri/Cargo.toml",
      "--all-targets",
      "--",
      "-D",
      "warnings",
    ]),
  );
  results.push(
    await runTask("rust:test", "cargo", [
      "test",
      "--locked",
      "--manifest-path",
      "src-tauri/Cargo.toml",
    ]),
  );
  return results;
}

const totalStart = performance.now();
const staticPromises = [
  runTask("versions", "npm", ["run", "check:versions"]),
  runTask("format", "npm", ["run", "format:check"]),
  runTask("lint", "npm", ["run", "lint"]),
  runTask("comments", "npm", ["run", "lint:comments"]),
  runTask("typecheck", "npm", ["run", "typecheck"]),
  runTask("vitest", "npm", ["test"]),
];
const rustPromise = skipRust ? Promise.resolve([]) : runRustLane();

const [staticResults, rustResults] = await Promise.all([
  Promise.all(staticPromises),
  rustPromise,
]);

const all = [...staticResults, ...rustResults];
const totalMs = Math.round(performance.now() - totalStart);

for (const item of all) {
  const mark = item.ok ? "PASS" : "FAIL";
  console.log(`${mark.padEnd(5)} ${item.label.padEnd(14)} ${item.ms}ms`);
}
console.log(`TOTAL wall=${totalMs}ms`);

const failed = all.filter((r) => !r.ok);
if (failed.length > 0) {
  for (const item of failed) {
    console.error(
      `\n--- ${item.label} (exit ${item.code}) ---\n${item.output}`,
    );
  }
  process.exit(1);
}
