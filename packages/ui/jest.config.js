const path = require("node:path");
const reactDir = path.dirname(require.resolve("react/package.json", { paths: [path.resolve(__dirname, "../react")] }));
const reactDomDir = path.dirname(require.resolve("react-dom/package.json", { paths: [path.resolve(__dirname, "../react")] }));
module.exports = {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  testEnvironment: "jsdom",
  setupFiles: ["<rootDir>/../react/__tests__/setup.js"],
  testMatch: ["**/__tests__/**/*.test.tsx"],
  moduleNameMapper: {
    "^@clavex/react$": "<rootDir>/../react/src/index.ts",
    "^react$": `${reactDir}/index.js`, "^react/(.*)$": `${reactDir}/$1`,
    "^react-dom$": `${reactDomDir}/index.js`, "^react-dom/(.*)$": `${reactDomDir}/$1`,
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: { "^.+\\.(ts|tsx)$": ["ts-jest", {useESM: true, tsconfig: {module: "ESNext", moduleResolution: "bundler", jsx: "react-jsx", esModuleInterop: true}}] },
};
