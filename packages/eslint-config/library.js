/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ["./index.js"],
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: ["dist", "node_modules", "build", ".turbo"],
};
