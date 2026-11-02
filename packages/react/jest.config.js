const path = require("node:path");
const reactDir = path.dirname(require.resolve("react/package.json"));
const reactDomDir = path.dirname(require.resolve("react-dom/package.json"));
module.exports = {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  testEnvironment: "jsdom",
  setupFiles: ["<rootDir>/__tests__/setup.js"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  moduleNameMapper: { "^react$": require.resolve("react"), "^react/(.*)$": `${reactDir}/$1`, "^react-dom$": require.resolve("react-dom"), "^react-dom/(.*)$": `${reactDomDir}/$1`, "^(\\.{1,2}/.*)\\.js$": "$1" },
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", {
      useESM: true,
      tsconfig: { module: "ESNext", moduleResolution: "bundler", jsx: "react-jsx", esModuleInterop: true },
    }],
  },
};
