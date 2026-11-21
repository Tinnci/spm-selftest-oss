const EMAIL_PREFS_KEY = "spm-selftest.email";

export type EmailRecipients = {
  to: string;
  cc: string;
  userPath: string;
  debugPath: string;
};

const EMPTY: EmailRecipients = { to: "", cc: "", userPath: "", debugPath: "" };

export function readEmailPrefs(): EmailRecipients {
  try {
    const raw = localStorage.getItem(EMAIL_PREFS_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<EmailRecipients>;
    return {
      to: parsed.to ?? "",
      cc: parsed.cc ?? "",
      userPath: parsed.userPath ?? "",
      debugPath: parsed.debugPath ?? "",
    };
  } catch {
    return { ...EMPTY };
  }
}

export function writeEmailPrefs(prefs: Partial<EmailRecipients>) {
  try {
    const next = { ...readEmailPrefs(), ...prefs };
    localStorage.setItem(EMAIL_PREFS_KEY, JSON.stringify(next));
  } catch {}
}
