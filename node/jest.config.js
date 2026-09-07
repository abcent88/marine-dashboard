module.exports = {
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/routes/__tests__/**/*.test.js",
    "<rootDir>/middleware/__tests__/**/*.test.js",
    "<rootDir>/lib/__tests__/**/*.test.js",
    "<rootDir>/integration/__tests__/**/*.test.js"
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
