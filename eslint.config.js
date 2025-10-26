import js from "@eslint/js";
import pluginImport from "eslint-plugin-import";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  {
    ignores: ["frontend/dist", "backend/static"],
  },
  js.configs.recommended,
  {
    files: ["backend/src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      import: pluginImport,
    },
    rules: {
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
        },
      ],
    },
  },
  prettier,
];
