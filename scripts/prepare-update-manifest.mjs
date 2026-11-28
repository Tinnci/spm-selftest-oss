#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const [manifestPath, assetsPath, repository, tag] = process.argv.slice(2);
const assets = JSON.parse(readFileSync(assetsPath, "utf8"));
const version = tag.slice(1);
const baseUrl = `https://github.com/${repository}/releases/download/${tag}/`;
const available = new Set(
  assets
    .filter(({ state, size }) => state === "uploaded" && size > 0)
    .map(({ name }) => name),
);
const targets = [
  ["linux-x86_64", "appimage", ["amd64.AppImage"]],
  ["windows-x86_64", "nsis", ["x64-setup.exe"]],
  ["windows-aarch64", "nsis", ["arm64-setup.exe", "aarch64-setup.exe"]],
];

const platforms = {};
for (const [platform, bundle, suffixes] of targets) {
  const matches = [...available].filter((name) =>
    suffixes.some((suffix) => name.endsWith(`_${version}_${suffix}`)),
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one ${bundle} asset for ${platform}, found ${matches.length}`,
    );
  }
  const [name] = matches;
  const signatureName = `${name}.sig`;
  if (!available.has(signatureName) || basename(name) !== name) {
    throw new Error(`Missing signed release asset for ${platform}`);
  }
  const signature = readFileSync(
    join(dirname(manifestPath), signatureName),
    "utf8",
  ).trim();
  if (!signature) throw new Error(`Empty signature for ${platform}`);

  if (bundle === "nsis") {
    for (const extension of ["exe", "exe.sig", "zip", "sha256"]) {
      const portable = `SPM-SelfTest-${version}-${platform}.${extension}`;
      if (!available.has(portable))
        throw new Error(`Missing portable asset ${portable}`);
    }
    const portableExe = `SPM-SelfTest-${version}-${platform}.exe`;
    const portableSig = readFileSync(
      join(dirname(manifestPath), `${portableExe}.sig`),
      "utf8",
    ).trim();
    if (!portableSig)
      throw new Error(`Empty portable signature for ${platform}`);
    platforms[`${platform}-portable`] = {
      url: `${baseUrl}${encodeURIComponent(portableExe)}`,
      signature: portableSig,
    };
  }

  const entry = { url: `${baseUrl}${encodeURIComponent(name)}`, signature };
  platforms[platform] = entry;
  platforms[`${platform}-${bundle}`] = entry;
}

const manifest = {
  version,
  notes: `SPM Self-Test ${tag}`,
  pub_date: new Date().toISOString(),
  platforms,
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
