/** @type {import('jest').Config} */
module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json", "node"],
  // Source files import relative paths with a ".js" extension (required by the
  // project's NodeNext module resolution), but the files on disk are ".ts".
  // Jest's resolver needs this mapping to find them.
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
};
