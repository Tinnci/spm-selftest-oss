export function localDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return now.getFullYear() + "-" + month + "-" + day;
}

function parseIsoDayUtc(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

export function patchCountdown(
  patch: string,
  reference?: string,
  validDays = 90,
): { remainingDays: number; expired: boolean; soon: boolean } | null {
  const patchMs = parseIsoDayUtc(patch);
  if (patchMs === null || !Number.isFinite(validDays) || validDays <= 0) {
    return null;
  }
  const refMs = parseIsoDayUtc(reference || localDate());
  if (refMs === null) return null;
  const dayMs = 86_400_000;
  const expiryMs = patchMs + validDays * dayMs;
  const remainingDays = Math.round((expiryMs - refMs) / dayMs);
  return {
    remainingDays,
    expired: remainingDays < 0,
    soon: remainingDays >= 0 && remainingDays <= 14,
  };
}

export function formatRelativeTime(iso: string, lang: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return iso.slice(0, 10);
  const diffSec = Math.round((ts - Date.now()) / 1000);
  const absSec = Math.abs(diffSec);
  if (absSec > 30 * 86_400) return iso.slice(0, 10);
  try {
    const rtf = new Intl.RelativeTimeFormat(lang || "en", {
      numeric: "auto",
      style: "narrow",
    });
    if (absSec < 60) return rtf.format(0, "minute");
    if (absSec < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
    if (absSec < 86_400) return rtf.format(Math.round(diffSec / 3600), "hour");
    return rtf.format(Math.round(diffSec / 86_400), "day");
  } catch {
    return iso.slice(0, 10);
  }
}
