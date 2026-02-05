/**
 * Jest configuration for unit tests
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js', '!**/tests/integration/**'],
  collectCoverageFrom: [
    'functions/**/*.js',
    '!functions/**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 10000,
};
