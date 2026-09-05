module.exports = {
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/routes/__tests__/**/*.test.js"
  ],
  collectCoverageFrom: [
    "routes/**/*.js",
    "middleware/**/*.js",
    "lib/**/*.js"
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
  clearMocks: true
};
