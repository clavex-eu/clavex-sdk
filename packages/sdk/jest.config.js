/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: {
        module: "CommonJS",
        esModuleInterop: true,
      },
    }],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  // Strip .js extensions from imports (TypeScript uses them for ESM compat)
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
