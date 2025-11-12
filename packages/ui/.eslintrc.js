/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ["@scopeguard/eslint-config/library"],
  parserOptions: {
    tsconfigRootDir: __dirname,
  },
  rules: {
    "react/prop-types": "off",
  },
};
