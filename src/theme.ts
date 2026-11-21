export type Theme = "light" | "dark";

const storageKey = "spm.selftest.theme.v1";

function stored(): Theme {
  try {
    return window.localStorage.getItem(storageKey) === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

let theme = stored();
const apply = () =>
  document.documentElement.classList.toggle("dark", theme === "dark");

export const themePreference = () => theme;

export function setTheme(value: Theme) {
  theme = value;
  apply();
  try {
    window.localStorage.setItem(storageKey, value);
  } catch {}
}

apply();
