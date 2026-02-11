/**
 * Egen Meeting Notes - /get-user-settings Cloud Function
 *
 * Returns user settings from Firestore.
 * Used by the Chrome extension to get the user's Gemini notes folder ID.
 */

const functions = require('@google-cloud/functions-framework');
const { Firestore } = require('@google-cloud/firestore');
const { authenticateRequest, isEgenAiEmail } = require('../_shared/auth');

// Initialize Firestore
const db = new Firestore();

// Collection
const USER_SETTINGS_COLLECTION = 'user_settings';

/**
 * Get user settings from Firestore
 */
async function getUserSettings(userEmail) {
  const settingsRef = db.collection(USER_SETTINGS_COLLECTION).doc(userEmail);
  const doc = await settingsRef.get();

  if (!doc.exists) {
    return null;
  }

  return doc.data();
}

/**
 * HTTP Cloud Function entry point
 */
functions.http('getUserSettings', async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Only allow GET
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const authContext = await authenticateRequest(req, res, {
      emailFields: [{ location: 'query', key: 'userEmail' }],
    });
    if (!authContext) {
      return;
    }

    const requestedEmail = req.query.userEmail;
    const userEmail = authContext.email;

    if (!requestedEmail) {
      res.status(400).json({ error: 'Missing required parameter: userEmail' });
      return;
    }

    if (!isEgenAiEmail(userEmail)) {
      res.status(403).json({ error: 'User email must be @egen.ai' });
      return;
    }

    const settings = await getUserSettings(userEmail);

    // Add Cache-Control header for GET requests (5 minutes)
    res.set('Cache-Control', 'private, max-age=300');

    if (settings) {
      res.status(200).json({
        found: true,
        settings: {
          gemini_notes_folder_id: settings.gemini_notes_folder_id || null,
          gemini_notes_folder_url: settings.gemini_notes_folder_url || null,
          gemini_notes_folder_name: settings.gemini_notes_folder_name || null,
        },
      });
    } else {
      res.status(200).json({
        found: false,
        settings: null,
      });
    }

  } catch (error) {
    console.error('Get user settings error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// Export for testing
module.exports = { getUserSettings };
