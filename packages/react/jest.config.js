module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  testEnvironmentOptions: {
    customExportConditions: ["node", "require", "default"],
  },
  setupFiles: ["<rootDir>/__tests__/setup.js"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", {
      // NOTE: the react package source uses `import.meta.env`, which ts-jest's
      // default (CommonJS) transform rejects (TS1343). Running this suite needs
      // a full jest-ESM setup with React CJS/ESM interop handling — tracked
      // separately; build/typecheck are unaffected.
      tsconfig: {
        jsx: "react-jsx"
      }
    }]
  }
};
