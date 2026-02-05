/**
 * Egen Meeting Notes - Classify API Integration Tests
 * Day 5: Test the deployed /classify endpoint
 *
 * Prerequisites:
 * - Cloud Function deployed
 * - CLASSIFY_ENDPOINT environment variable set
 *
 * Usage:
 *   CLASSIFY_ENDPOINT=https://us-central1-egen-meeting-notes.cloudfunctions.net/classify npm run test:integration
 */

const https = require('https');
const http = require('http');

// Get endpoint from environment or use local default
const CLASSIFY_ENDPOINT = process.env.CLASSIFY_ENDPOINT || 'http://localhost:8080';

/**
 * Make HTTP request to classify endpoint
 */
async function classifyRequest(meeting) {
  return new Promise((resolve, reject) => {
    const url = new URL(CLASSIFY_ENDPOINT);
    const client = url.protocol === 'https:' ? https : http;

    const data = JSON.stringify({ meeting });

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(body),
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body,
          });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

describe('Classify API Integration Tests', () => {
  // Check if endpoint is reachable
  const skipIfEndpointDown = async () => {
    try {
      const result = await classifyRequest({ title: 'test' });
      return result.status === 0;
    } catch (e) {
      return true;
    }
  };

  describe('Basic Classification', () => {
    test('should classify client meeting', async () => {
      const meeting = {
        title: 'Weekly Sync - Acme Data Platform',
        attendees: [
          { email: 'alice@egen.com', name: 'Alice' },
          { email: 'john@acme.com', name: 'John' },
        ],
        start_time: new Date().toISOString(),
      };

      const result = await classifyRequest(meeting);

      expect(result.status).toBe(200);
      expect(result.data.classification).toBeDefined();
      expect(result.data.classification.type).toBe('client');
      expect(result.data.suggested_actions).toBeDefined();
    }, 10000);

    test('should classify internal meeting', async () => {
      const meeting = {
        title: 'Team Planning',
        attendees: [
          { email: 'alice@egen.com' },
          { email: 'bob@egen.com' },
        ],
      };

      const result = await classifyRequest(meeting);

      expect(result.status).toBe(200);
      expect(result.data.classification.type).toBe('internal');
    }, 10000);

    test('should handle engineering standup', async () => {
      const meeting = {
        title: 'Daily Standup',
        attendees: [
          { email: 'alice@egen.com' },
          { email: 'bob@egen.com' },
          { email: 'charlie@egen.com' },
        ],
      };

      const result = await classifyRequest(meeting);

      expect(result.status).toBe(200);
      expect(result.data.classification.type).toBe('internal');
      expect(result.data.classification.internal_team).toBe('Engineering');
    }, 10000);
  });

  describe('Error Handling', () => {
    test('should return 400 for missing meeting', async () => {
      const result = await classifyRequest(null);

      expect(result.status).toBe(400);
      expect(result.data.error).toBeDefined();
    }, 10000);

    test('should return 400 for missing title', async () => {
      const meeting = {
        attendees: [{ email: 'alice@egen.com' }],
      };

      const result = await classifyRequest(meeting);

      expect(result.status).toBe(400);
    }, 10000);
  });

  describe('Confidence Scoring', () => {
    test('should return confidence score', async () => {
      const meeting = {
        title: 'Generic Meeting',
        attendees: [{ email: 'alice@egen.com' }],
      };

      const result = await classifyRequest(meeting);

      expect(result.status).toBe(200);
      expect(result.data.classification.confidence).toBeGreaterThan(0);
      expect(result.data.classification.confidence).toBeLessThanOrEqual(1);
    }, 10000);

    test('should return auto_apply flag', async () => {
      const meeting = {
        title: 'Meeting',
        attendees: [{ email: 'alice@egen.com' }],
      };

      const result = await classifyRequest(meeting);

      expect(result.status).toBe(200);
      expect(typeof result.data.auto_apply).toBe('boolean');
    }, 10000);
  });
});
