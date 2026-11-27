import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), "spm-selftest-release-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function run(dir, script, ...args) {
  return spawnSync(
    process.execPath,
    [fileURLToPath(new URL(script, import.meta.url)), ...args],
    { cwd: dir, encoding: "utf8" },
  );
}

test("release bump updates manifests and both lockfiles", (t) => {
  const dir = tempDir(t);
  mkdirSync(join(dir, "src-tauri"));
  const files = [
    "package.json",
    "package-lock.json",
    "src-tauri/tauri.conf.json",
    "src-tauri/Cargo.toml",
    "src-tauri/Cargo.lock",
  ];
  for (const file of files) {
    copyFileSync(new URL(`../${file}`, import.meta.url), join(dir, file));
  }

  const { version } = JSON.parse(
    readFileSync(join(dir, "package.json"), "utf8"),
  );
  const [major, minor, patch] = version.split(/[.-]/);
  const prerelease = `${major}.${minor}.${Number(patch) + 1}-rc.2`;
  for (const invalid of [version, "01.2.3", "v1.0.0-rc.01", "$(git push)"]) {
    assert.equal(run(dir, "bump-release.mjs", "custom", invalid).status, 1);
  }
  assert.equal(
    JSON.parse(readFileSync(join(dir, "package.json"))).version,
    version,
  );

  const candidate = run(dir, "bump-release.mjs", "custom", `v${prerelease}`);
  assert.equal(candidate.status, 0, candidate.stderr);
  assert.equal(candidate.stdout.trim(), prerelease);
  const stable = run(dir, "bump-release.mjs", "patch");
  assert.equal(stable.status, 0, stable.stderr);
  assert.equal(stable.stdout.trim(), prerelease.split("-")[0]);
  for (const file of files) {
    assert.ok(
      readFileSync(join(dir, file), "utf8").includes(
        `"${stable.stdout.trim()}"`,
      ),
      file,
    );
  }
  const lock = JSON.parse(readFileSync(join(dir, "package-lock.json"), "utf8"));
  assert.equal(lock.packages[""].version, stable.stdout.trim());
});

test("manifest keeps updater keys and requires signed binaries for all architectures", (t) => {
  const dir = tempDir(t);
  const assetNames = [
    "SPM.Self-Test_0.1.5_amd64.AppImage",
    "SPM.Self-Test_0.1.5_x64-setup.exe",
    "SPM.Self-Test_0.1.5_arm64-setup.exe",
  ];
  const assets = assetNames.flatMap((name) => {
    const signature = `${name}.sig`;
    writeFileSync(join(dir, signature), `signature for ${name}\n`);
    return [name, signature];
  });
  for (const platform of ["windows-x86_64", "windows-aarch64"]) {
    for (const extension of ["exe", "zip", "sha256"]) {
      assets.push(`SPM-SelfTest-0.1.5-${platform}.${extension}`);
    }
  }
  const manifestPath = join(dir, "latest.json");
  const assetsPath = join(dir, "assets.json");
  const generate = (names) => {
    writeFileSync(
      assetsPath,
      JSON.stringify(
        names.map((name) => ({ name, state: "uploaded", size: 100 })),
      ),
    );
    return run(
      dir,
      "prepare-update-manifest.mjs",
      manifestPath,
      assetsPath,
      "owner/repo",
      "v0.1.5",
    );
  };

  const result = generate(assets);
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.version, "0.1.5");
  assert.deepEqual(Object.keys(manifest.platforms), [
    "linux-x86_64",
    "linux-x86_64-appimage",
    "windows-x86_64",
    "windows-x86_64-nsis",
    "windows-aarch64",
    "windows-aarch64-nsis",
  ]);
  const arm = manifest.platforms["windows-aarch64"];
  assert.deepEqual(arm, manifest.platforms["windows-aarch64-nsis"]);
  assert.equal(arm.signature, `signature for ${assetNames[2]}`);
  assert.equal(
    arm.url,
    `https://github.com/owner/repo/releases/download/v0.1.5/${assetNames[2]}`,
  );

  const unsigned = generate(
    assets.filter((name) => name !== `${assetNames[2]}.sig`),
  );
  assert.equal(unsigned.status, 1);
  assert.match(
    unsigned.stderr,
    /Missing signed release asset for windows-aarch64/,
  );
  const missingPortable = generate(
    assets.filter((name) => !name.endsWith("windows-aarch64.zip")),
  );
  assert.equal(missingPortable.status, 1);
  assert.match(missingPortable.stderr, /Missing portable asset/);
});
