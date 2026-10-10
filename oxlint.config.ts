import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react],
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
    "oxc/no-barrel-file": "off",
  },
});
