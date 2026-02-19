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
    "no-empty": ["error", { allowEmptyCatch: true }],
    "no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      },
    ],
    "no-constant-condition": ["error", { checkLoops: false }],
    "react/no-unescaped-entities": "off",
    "react/no-unknown-property": "off",
    "no-async-promise-executor": "warn",
    "no-useless-catch": "warn",
  },
  ignorePatterns: [
    ".eslintrc.cjs",
    "dist/",
    "node_modules/",
    "coverage/",
    "backend/uploads/",
    "backend/server/upload.js",
    "public/",
    "tests/",
    "**/*.min.js",
  ],
  overrides: [
    {
      files: ["*.config.js", "*.config.cjs", "vite.config.js", "vite.config.mjs", "tailwind.config.js", "postcss.config.js", "postcss.config.cjs", "server.js", "scripts/**/*.js"],
      env: {
        node: true,
        browser: false,
      },
    },
    {
      files: ["backend/**/*.js", "backend/**/*.cjs"],
      env: {
        node: true,
        browser: false,
      },
    },
    {
      files: ["src/**/__tests__/**/*.js", "src/**/__tests__/**/*.jsx"],
      env: {
        browser: true,
        node: true,
        es2021: true,
      },
      globals: {
        vi: "readonly",
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      },
    },
    {
      files: ["src/utils/sceneData.js"],
      globals: {
        Buffer: "readonly",
      },
    },
  ],
};
