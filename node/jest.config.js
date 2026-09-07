module.exports = {
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/routes/__tests__/**/*.test.js",
    "<rootDir>/middleware/__tests__/**/*.test.js",
    "<rootDir>/lib/__tests__/**/*.test.js",
    "<rootDir>/services/__tests__/**/*.test.js",
    "<rootDir>/integration/__tests__/**/*.test.js"
  ],
  collectCoverageFrom: [
    "routes/**/*.js",
    "middleware/**/*.js",
    "services/**/*.js",
    "lib/**/*.js"
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 85,
      functions: 95,
      lines: 90
    }
  },
  clearMocks: true
};
