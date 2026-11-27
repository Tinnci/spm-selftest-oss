import { readFileSync, writeFileSync } from "node:fs";

const [bump, custom = ""] = process.argv.slice(2);
const core = "(0|[1-9]\\d*)";
const semver = new RegExp(
  `^${core}\\.${core}\\.${core}(?:-([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?$`,
);
const numeric = /^\d+$/;

function parse(version) {
  const match = version.match(semver);
  const prerelease = match?.[4]?.split(".") ?? [];
  if (!match || prerelease.some((part) => /^0\d+$/.test(part))) {
    throw new Error(`Invalid release version: ${version}`);
  }
  return [...match.slice(1, 4), ...prerelease];
}

function isNewer(next, current) {
  for (let i = 0; i < Math.min(next.length, current.length); i++) {
    const a = next[i];
    const b = current[i];
    if (a === b) continue;
    if (numeric.test(a) && numeric.test(b)) return BigInt(a) > BigInt(b);
    if (numeric.test(a) !== numeric.test(b)) return !numeric.test(a);
    return a > b;
  }
  if (next.length === 3) return current.length > 3;
  if (current.length === 3) return false;
  return next.length > current.length;
}

const read = (path) => readFileSync(path, "utf8");
const json = (path) => JSON.parse(read(path));
const pkg = json("package.json");
const current = parse(pkg.version);
const [major, minor, patch] = current.slice(0, 3).map(BigInt);
const bumps = {
  major: `${major + 1n}.0.0`,
  minor: `${major}.${minor + 1n}.0`,
  patch:
    current.length > 3
      ? `${major}.${minor}.${patch}`
      : `${major}.${minor}.${patch + 1n}`,
};
if (bump !== "custom" && !Object.hasOwn(bumps, bump)) {
  throw new Error(`Invalid bump: ${bump}`);
}
const next = bump === "custom" ? custom.trim().replace(/^v/, "") : bumps[bump];
if (!isNewer(parse(next), current)) {
  throw new Error(`Release version must be newer than ${pkg.version}`);
}

const lock = json("package-lock.json");
const tauri = json("src-tauri/tauri.conf.json");
lock.version = next;
lock.packages[""].version = next;
tauri.version = next;
pkg.version = next;

const textFiles = [
  [
    "src-tauri/Cargo.toml",
    /^\[package\]\s*\n(?:[^\n[]*\n)*?version\s*=\s*"[^"]+"/m,
  ],
  [
    "src-tauri/Cargo.lock",
    /^\[\[package\]\]\nname = "spm-selftest"\nversion = "[^"]+"/m,
  ],
].map(([path, pattern]) => {
  const source = read(path);
  if (!pattern.test(source))
    throw new Error(`Missing package version in ${path}`);
  return [
    path,
    source.replace(pattern, (section) =>
      section.replace(/(version\s*=\s*)"[^"]+"$/, `$1"${next}"`),
    ),
  ];
});

for (const [path, content] of [
  ["package.json", pkg],
  ["package-lock.json", lock],
  ["src-tauri/tauri.conf.json", tauri],
]) {
  writeFileSync(path, `${JSON.stringify(content, null, 2)}\n`);
}
for (const [path, content] of textFiles) writeFileSync(path, content);
console.log(next);
