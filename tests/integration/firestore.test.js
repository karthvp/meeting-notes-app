/**
 * Egen Meeting Notes - Firestore Integration Tests
 * Day 5: Test Firestore read/write operations
 *
 * Prerequisites:
 * - GOOGLE_APPLICATION_CREDENTIALS set
 * - Firestore database created
 * - Seed data populated
 *
 * Usage:
 *   npm run test:integration
 */

const { Firestore } = require('@google-cloud/firestore');

// Skip if no credentials
const skipIfNoCredentials = () => {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return true;
  }
  return false;
};

describe('Firestore Integration Tests', () => {
  let db;

  beforeAll(() => {
    if (skipIfNoCredentials()) {
      console.log('Skipping Firestore tests - no credentials found');
      return;
    }
    db = new Firestore();
  });

  describe('Clients Collection', () => {
    test.skipIf(skipIfNoCredentials())('should read clients collection', async () => {
      const snapshot = await db.collection('clients').limit(10).get();

      expect(snapshot.empty).toBe(false);

      const client = snapshot.docs[0].data();
      expect(client).toHaveProperty('name');
      expect(client).toHaveProperty('domains');
      expect(client).toHaveProperty('status');
    });

    test.skipIf(skipIfNoCredentials())('should query active clients', async () => {
      const snapshot = await db.collection('clients')
        .where('status', '==', 'active')
        .get();

      expect(snapshot.empty).toBe(false);

      snapshot.docs.forEach(doc => {
        expect(doc.data().status).toBe('active');
      });
    });
  });

  describe('Projects Collection', () => {
    test.skipIf(skipIfNoCredentials())('should read projects collection', async () => {
      const snapshot = await db.collection('projects').limit(10).get();

      expect(snapshot.empty).toBe(false);

      const project = snapshot.docs[0].data();
      expect(project).toHaveProperty('client_id');
      expect(project).toHaveProperty('project_name');
      expect(project).toHaveProperty('team');
    });

    test.skipIf(skipIfNoCredentials())('should query projects by client', async () => {
      // First get a client ID
      const clientSnapshot = await db.collection('clients').limit(1).get();
      if (clientSnapshot.empty) return;

      const clientId = clientSnapshot.docs[0].id;

      const projectSnapshot = await db.collection('projects')
        .where('client_id', '==', clientId)
        .get();

      projectSnapshot.docs.forEach(doc => {
        expect(doc.data().client_id).toBe(clientId);
      });
    });
  });

  describe('Rules Collection', () => {
    test.skipIf(skipIfNoCredentials())('should read rules collection', async () => {
      const snapshot = await db.collection('rules').limit(10).get();

      expect(snapshot.empty).toBe(false);

      const rule = snapshot.docs[0].data();
      expect(rule).toHaveProperty('name');
      expect(rule).toHaveProperty('conditions');
      expect(rule).toHaveProperty('actions');
      expect(rule).toHaveProperty('priority');
    });

    test.skipIf(skipIfNoCredentials())('should query rules by priority', async () => {
      const snapshot = await db.collection('rules')
        .where('status', '==', 'active')
        .orderBy('priority', 'desc')
        .get();

      if (snapshot.docs.length >= 2) {
        const priorities = snapshot.docs.map(doc => doc.data().priority);
        for (let i = 0; i < priorities.length - 1; i++) {
          expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i + 1]);
        }
      }
    });
  });

  describe('Write Operations', () => {
    const testDocId = '_test_integration_doc';

    afterAll(async () => {
      if (skipIfNoCredentials()) return;
      // Clean up test document
      try {
        await db.collection('notes_metadata').doc(testDocId).delete();
      } catch (e) {
        // Ignore if doesn't exist
      }
    });

    test.skipIf(skipIfNoCredentials())('should write note metadata', async () => {
      const noteData = {
        drive_file_id: 'test_file_123',
        meeting: {
          title: 'Test Meeting',
          organizer: 'test@egen.com',
          attendees: [{ email: 'test@egen.com' }],
          start_time: new Date(),
        },
        classification: {
          type: 'internal',
          confidence: 0.85,
        },
        created_at: Firestore.FieldValue.serverTimestamp(),
      };

      await db.collection('notes_metadata').doc(testDocId).set(noteData);

      // Read back
      const doc = await db.collection('notes_metadata').doc(testDocId).get();
      expect(doc.exists).toBe(true);
      expect(doc.data().drive_file_id).toBe('test_file_123');
    });

    test.skipIf(skipIfNoCredentials())('should update note metadata', async () => {
      await db.collection('notes_metadata').doc(testDocId).update({
        'classification.user_confirmed': true,
        updated_at: Firestore.FieldValue.serverTimestamp(),
      });

      const doc = await db.collection('notes_metadata').doc(testDocId).get();
      expect(doc.data().classification.user_confirmed).toBe(true);
    });
  });
});
