module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["react", "react-hooks", "react-refresh"],
  extends: ["eslint:recommended", "plugin:react/recommended", "plugin:react-hooks/recommended"],
  settings: {
    react: {
      version: "detect",
    },
  },
  rules: {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
  },
  ignorePatterns: [
    "dist/",
    "node_modules/",
    "coverage/",
    "backend/uploads/",
    "public/",
    "**/*.min.js",
  ],
  overrides: [
    {
      files: ["backend/**/*.js", "backend/**/*.cjs"],
      env: {
        node: true,
        browser: false,
      },
      parserOptions: {
        sourceType: "script",
      },
    },
  ],
};
