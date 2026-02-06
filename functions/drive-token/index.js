/**
 * Egen Meeting Notes - /drive-token Cloud Function
 *
 * Manages Google Drive OAuth tokens for users.
 * - Stores refresh tokens securely in Firestore
 * - Exchanges refresh tokens for fresh access tokens
 * - Eliminates need for repeated OAuth popups
 */

const functions = require('@google-cloud/functions-framework');
const { Firestore } = require('@google-cloud/firestore');
const { google } = require('googleapis');

// Initialize Firestore
const db = new Firestore();

// Collection for storing user tokens
const TOKENS_COLLECTION = 'user_drive_tokens';

// OAuth2 client configuration
// These should match your Google Cloud Console OAuth 2.0 credentials
const OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

/**
 * Create OAuth2 client
 */
function getOAuth2Client() {
  return new google.auth.OAuth2(
    OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET
  );
}

/**
 * Validate @egen.com or @egen.ai email
 */
function validateEgenEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const lower = email.toLowerCase();
  return lower.endsWith('@egen.com') || lower.endsWith('@egen.ai');
}

/**
 * Store refresh token for a user
 * Called after user completes OAuth consent with Drive scope
 */
async function storeToken(userEmail, refreshToken) {
  const docRef = db.collection(TOKENS_COLLECTION).doc(userEmail);

  await docRef.set({
    refresh_token: refreshToken,
    created_at: new Date(),
    updated_at: new Date(),
  }, { merge: true });

  return { success: true };
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(code, redirectUri) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.redirectUri = redirectUri;

  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Get fresh access token using stored refresh token
 */
async function getAccessToken(userEmail) {
  // Get stored refresh token
  const docRef = db.collection(TOKENS_COLLECTION).doc(userEmail);
  const doc = await docRef.get();

  if (!doc.exists) {
    return { error: 'no_token', message: 'No refresh token stored for this user' };
  }

  const { refresh_token } = doc.data();

  if (!refresh_token) {
    return { error: 'no_token', message: 'No refresh token stored for this user' };
  }

  // Use refresh token to get new access token
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();

    // Update stored token if we got a new refresh token
    if (credentials.refresh_token && credentials.refresh_token !== refresh_token) {
      await docRef.update({
        refresh_token: credentials.refresh_token,
        updated_at: new Date(),
      });
    }

    return {
      success: true,
      access_token: credentials.access_token,
      expires_at: credentials.expiry_date,
    };
  } catch (error) {
    console.error('Failed to refresh token:', error.message);

    // If refresh token is invalid/revoked, delete it
    if (error.message.includes('invalid_grant') || error.message.includes('Token has been expired or revoked')) {
      await docRef.delete();
      return { error: 'token_revoked', message: 'Refresh token has been revoked. User needs to re-authorize.' };
    }

    return { error: 'refresh_failed', message: error.message };
  }
}

/**
 * Check if user has a valid stored token
 */
async function hasStoredToken(userEmail) {
  const docRef = db.collection(TOKENS_COLLECTION).doc(userEmail);
  const doc = await docRef.get();
  return doc.exists && !!doc.data()?.refresh_token;
}

/**
 * HTTP Cloud Function entry point
 */
functions.http('driveToken', async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { action } = req.query;
    const { userEmail, code, redirectUri, refreshToken } = req.body || {};

    // Validate user email for all actions
    if (action !== 'check' && !validateEgenEmail(userEmail)) {
      res.status(403).json({ error: 'User email must be @egen.com or @egen.ai' });
      return;
    }

    switch (action) {
      case 'exchange':
        // Exchange authorization code for tokens and store refresh token
        if (!code) {
          res.status(400).json({ error: 'Missing authorization code' });
          return;
        }

        try {
          const tokens = await exchangeCodeForTokens(code, redirectUri);

          if (tokens.refresh_token) {
            await storeToken(userEmail, tokens.refresh_token);
          }

          res.status(200).json({
            success: true,
            access_token: tokens.access_token,
            expires_at: tokens.expiry_date,
            has_refresh_token: !!tokens.refresh_token,
          });
        } catch (error) {
          console.error('Token exchange failed:', error);
          res.status(400).json({ error: 'token_exchange_failed', message: error.message });
        }
        break;

      case 'store':
        // Directly store a refresh token (for cases where frontend has it)
        if (!refreshToken) {
          res.status(400).json({ error: 'Missing refresh token' });
          return;
        }

        await storeToken(userEmail, refreshToken);
        res.status(200).json({ success: true });
        break;

      case 'refresh':
        // Get fresh access token using stored refresh token
        if (!userEmail) {
          res.status(400).json({ error: 'Missing userEmail' });
          return;
        }

        const result = await getAccessToken(userEmail);

        if (result.error) {
          res.status(result.error === 'no_token' ? 404 : 400).json(result);
        } else {
          res.status(200).json(result);
        }
        break;

      case 'check':
        // Check if user has stored token
        if (!userEmail || !validateEgenEmail(userEmail)) {
          res.status(200).json({ hasToken: false });
          return;
        }

        const hasToken = await hasStoredToken(userEmail);
        res.status(200).json({ hasToken });
        break;

      case 'revoke':
        // Delete stored token (user wants to disconnect)
        if (!userEmail) {
          res.status(400).json({ error: 'Missing userEmail' });
          return;
        }

        await db.collection(TOKENS_COLLECTION).doc(userEmail).delete();
        res.status(200).json({ success: true });
        break;

      default:
        res.status(400).json({ error: 'Invalid action. Use: exchange, store, refresh, check, or revoke' });
    }

  } catch (error) {
    console.error('Drive token error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// Export for testing
module.exports = { getAccessToken, storeToken, hasStoredToken };
