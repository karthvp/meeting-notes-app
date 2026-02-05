/**
 * Jest configuration for integration tests
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/integration/**/*.test.js'],
  verbose: true,
  testTimeout: 30000, // Longer timeout for API calls
  setupFilesAfterEnv: ['./tests/integration/setup.js'],
};
