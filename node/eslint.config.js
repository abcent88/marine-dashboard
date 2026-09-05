const globals = require("globals");

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "coverage/**"
    ]
  },
  {
    files: ["public/js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
      "no-unreachable": "error"
    }
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
      "no-unreachable": "error"
    }
  }
];
