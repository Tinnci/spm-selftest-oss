import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";

function resolveGitBuild(): string {
  const runGit = (args: string[]) => {
    try {
      return execFileSync("git", args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      return "";
    }
  };
  const sha =
    runGit(["rev-parse", "--short=7", "HEAD"]) ||
    (process.env.GITHUB_SHA ?? "").slice(0, 7);
  const rev = runGit(["rev-list", "--count", "HEAD"]);
  if (rev && sha) return `r${rev} · ${sha}`;
  if (sha) return sha;
  if (rev) return `r${rev}`;
  return "";
}

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

const gitBuild = resolveGitBuild();

export default defineConfig({
  plugins: [tailwindcss()],
  clearScreen: false,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_GIT_BUILD__: JSON.stringify(gitBuild),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    host: "127.0.0.1",
    port: 1430,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    target: "es2022",
    rolldownOptions: {
      onwarn(warning, defaultHandler) {
        if (
          warning.code === "MODULE_LEVEL_DIRECTIVE" &&
          warning.message.includes("use client")
        ) {
          return;
        }
        defaultHandler(warning);
      },
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@base-ui")) return "vendor-ui";
          if (id.includes("lucide-react")) return "vendor-icons";
          return "vendor";
        },
      },
    },
  },
});
