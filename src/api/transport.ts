import { invoke, isTauri } from "@tauri-apps/api/core";

export const desktop = isTauri;

export function desktopOnly(): never {
  throw { code: "unsupported" };
}

export function call<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}
