// eslint-disable-next-line @typescript-eslint/no-var-requires
require("dotenv").config({ path: ".env.test" });

module.exports = {
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  preset: "ts-jest",
  testEnvironment: "node",
  coveragePathIgnorePatterns: ["/node_modules/"],
  coverageReporters: ["html", "text", "lcov", "json", "cobertura"],
};
