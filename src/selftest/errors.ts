import { i18n, t } from "../i18n";

type BackendError = { code?: unknown; message?: unknown };

function known(code: string): boolean {
  return i18n.exists(`selftest.error.${code}`);
}

export function errorText(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const value = error as BackendError;
    if (typeof value.code === "string" && known(value.code)) {
      return t(`selftest.error.${value.code}`);
    }
    if (typeof value.message === "string" && value.message.trim()) {
      return value.message;
    }
  }
  return t("selftest.error.unknown");
}
