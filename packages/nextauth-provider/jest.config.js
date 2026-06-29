/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  globals: {
    "ts-jest": {
      tsconfig: {
        module: "CommonJS",
        moduleResolution: "node",
        skipLibCheck: true,
        noEmit: true,
        strict: false,
      },
      diagnostics: {
        ignoreCodes: ["TS5076", "TS2664", "TS2339"],
      },
    },
  },
};
