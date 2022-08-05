// eslint-disable-next-line no-undef
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "eslint-plugin-import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
  ],
  rules: {
    semi: ["error"],
    "import/order": [
      2,
      {
        "newlines-between": "always",
      },
    ],
    "import/no-unresolved": 0,
  },
  ignorePatterns: ["dist", "node_modules"],
};
