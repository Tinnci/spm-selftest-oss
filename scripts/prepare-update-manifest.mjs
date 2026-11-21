#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const [manifestPath, assetsPath, repository, tag] = process.argv.slice(2);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const assets = JSON.parse(readFileSync(assetsPath, "utf8"));
const version = tag.replace(/^v/, "");
const releasePath = `/${repository}/releases/download/${tag}/`;
const apiPath = `/repos/${repository}/releases/assets/`;

if (manifest.version.replace(/^v/, "") !== version) {
  throw new Error("Update manifest does not match the release tag");
}
if (
  !manifest.platforms["linux-x86_64"] ||
  !manifest.platforms["windows-x86_64"]
) {
  throw new Error("Update manifest must include both Linux and Windows");
}

for (const [platform, entry] of Object.entries(manifest.platforms)) {
  const url = new URL(entry.url);
  const asset =
    url.hostname === "api.github.com" && url.pathname.startsWith(apiPath)
      ? assets.find((asset) => url.pathname === `${apiPath}${asset.id}`)
      : assets.find(
          (asset) =>
            url.hostname === "github.com" &&
            (decodeURIComponent(url.pathname) ===
              `${releasePath}${asset.name}` ||
              url.href === asset.browser_download_url),
        );
  const valid =
    (platform.startsWith("linux-x86_64") &&
      asset?.name.endsWith(".AppImage")) ||
    (platform.startsWith("windows-x86_64") &&
      asset?.name.endsWith("-setup.exe"));
  if (
    !valid ||
    !entry.signature?.trim() ||
    !assets.some((item) => item.name === `${asset.name}.sig`)
  ) {
    throw new Error(`Missing signed release asset for ${platform}`);
  }
  entry.url = `https://github.com${releasePath}${encodeURIComponent(asset.name)}`;
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
