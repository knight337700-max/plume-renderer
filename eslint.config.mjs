import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "dist-desktop/**", "release/**", "node_modules/**", "out/**", ".out-staging/**"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "apps/**/*.ts", "apps/**/*.tsx", "tests/**/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
);
