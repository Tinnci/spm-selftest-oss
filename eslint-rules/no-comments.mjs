import fs from "node:fs";
import path from "node:path";

const baselinePath = path.resolve(process.cwd(), "comment-baseline.json");
const baseline = fs.existsSync(baselinePath)
  ? JSON.parse(fs.readFileSync(baselinePath, "utf8"))
  : {};

const directive = (value) =>
  [
    "eslint-",
    "@ts-",
    "prettier-",
    "@vitest-environment",
    "yaml-language-server",
    "<reference",
    "istanbul",
    "c8 ",
    "v8 ",
    "stylelint-",
    "biome-",
    "oxlint-",
  ].some((prefix) => value.includes(prefix));

const relative = (filename) =>
  path.relative(process.cwd(), filename).split(path.sep).join("/");

export default {
  rules: {
    "no-comments": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Ban source comments except tool directives, ratcheted per file.",
        },
        schema: [],
        messages: {
          banned:
            "Comments are banned in this repository; move decisions to docs/adr/. This file allows {{allowed}} legacy comment(s).",
          stale:
            "Comment baseline is stale for this file ({{actual}} now, {{allowed}} allowed). Run npm run lint:comments:update after the audit.",
        },
      },
      create(context) {
        return {
          Program() {
            const file = relative(context.filename);
            const allowed = Number(baseline[file] ?? 0);
            const shebang = context.sourceCode.text.startsWith("#!");
            const comments = context.sourceCode
              .getAllComments()
              .filter(
                (comment) =>
                  !directive(comment.value) &&
                  !(shebang && comment.loc.start.line === 1),
              );
            if (comments.length < allowed) {
              context.report({
                loc: { line: 1, column: 0 },
                messageId: "stale",
                data: { actual: comments.length, allowed },
              });
              return;
            }
            for (const comment of comments.slice(allowed)) {
              context.report({
                loc: comment.loc,
                messageId: "banned",
                data: { allowed },
              });
            }
          },
        };
      },
    },
  },
};
