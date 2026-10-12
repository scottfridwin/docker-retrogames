import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "mnt/"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: globals.node },
  },
  {
    files: ["public/**/*.js"],
    languageOptions: { globals: { ...globals.browser, $: "readonly", Dos: "readonly", emulators: "readonly" } },
  },
];
