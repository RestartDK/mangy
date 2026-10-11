import { recommended } from "@effect/tsgo/oxlint-presets";
import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react, recommended],
  ignorePatterns: core.ignorePatterns,
  overrides: [
    {
      files: ["apps/web/src/routes/**/*.tsx"],
      rules: {
        complexity: "off",
        "typescript/consistent-type-definitions": "off",
        "typescript/no-empty-object-type": "off",
      },
    },
    {
      files: ["apps/web/src/components/ui/**/*.tsx"],
      rules: {
        eqeqeq: "off",
      },
    },
    {
      files: ["apps/server/tests/**/*.ts"],
      rules: {
        "require-await": "off",
      },
    },
  ],
  rules: {
    // effect/http-api and effect/sql are the replacements for elysia and drizzle,
    // so the unstable imports are deliberate and there is no stable alternative.
    // The rule is correct that these may break in a minor release; that risk is
    // accepted knowingly. Revisit when those modules graduate.
    "effecttsgo/unstable-api-usage": "off",
    "oxc/no-barrel-file": "off",
  },
});
