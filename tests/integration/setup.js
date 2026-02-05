/**
 * Jest integration test setup
 */

// Load environment variables
require('dotenv').config();

// Set test timeout
jest.setTimeout(30000);

// Skip tests if no credentials
beforeAll(() => {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('⚠️  GOOGLE_APPLICATION_CREDENTIALS not set');
    console.log('   Some integration tests will be skipped');
  }
});

// Global test utilities
global.skipIfNoCredentials = () => {
  return !process.env.GOOGLE_APPLICATION_CREDENTIALS;
};
