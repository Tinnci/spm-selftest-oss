import { isTauri } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { desktopOnly } from "./transport";

export const SOURCE_REPOSITORY = "https://github.com/Tinnci/spm-selftest-oss";

export function openRepository() {
  return openUrl(SOURCE_REPOSITORY);
}

export async function copyText(text: string) {
  if (isTauri()) await writeText(text);
  else await navigator.clipboard.writeText(text);
}

export function revealPath(path: string) {
  if (!isTauri()) return desktopOnly();
  return revealItemInDir(path);
}

export async function appVersion(): Promise<string> {
  const base = isTauri() ? await getVersion() : __APP_VERSION__;
  const build = typeof __APP_GIT_BUILD__ === "string" ? __APP_GIT_BUILD__ : "";
  return build ? `${base} (${build})` : base;
}
