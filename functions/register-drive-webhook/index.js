/**
 * Egen Meeting Notes - Drive Webhook Registration
 * Allows users to register their own Drive folders for automatic note detection
 */

const functions = require('@google-cloud/functions-framework');
const { Firestore, FieldValue } = require('@google-cloud/firestore');
const {
  authenticateRequest,
  getDriveAccessToken,
  isEgenAiEmail,
} = require('../_shared/auth');

const db = new Firestore();
const USER_DRIVE_CONFIGS_COLLECTION = 'user_drive_configs';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'karthik-patil-sandbox';
const WEBHOOK_URL = `https://us-central1-${PROJECT_ID}.cloudfunctions.net/processNewNote`;

/**
 * Register a Drive webhook for a user's folder
 */
functions.http('registerDriveWebhook', async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Drive-Access-Token'
  );

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const authContext = await authenticateRequest(req, res, {
      emailFields: [{ location: 'body', key: 'userEmail' }],
    });
    if (!authContext) {
      return;
    }

    const { folderId, folderName, userEmail: requestUserEmail } = req.body;
    const accessToken = getDriveAccessToken(req);
    const userEmail = authContext.email;

    console.log('Webhook registration request:', {
      folderId,
      folderName,
      userEmail,
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken?.length,
    });

    if (!folderId || !accessToken || !requestUserEmail) {
      res.status(400).json({
        error: 'Missing required fields: folderId, accessToken, userEmail',
      });
      return;
    }

    if (!isEgenAiEmail(userEmail)) {
      res.status(403).json({
        error: 'User email must be @egen.ai',
      });
      return;
    }

    // First, verify the folder exists and is accessible
    console.log('Verifying folder access...');
    const verifyResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!verifyResponse.ok) {
      const verifyText = await verifyResponse.text();
      console.error('Folder verification failed:', verifyResponse.status, verifyText);
      res.status(verifyResponse.status).json({
        error: 'Cannot access the specified folder',
        details: `Drive API returned status ${verifyResponse.status}. Make sure the folder ID is correct and you have access to it.`,
      });
      return;
    }

    const folderInfo = await verifyResponse.json();
    console.log('Folder verified:', folderInfo);

    // Generate unique channel ID
    const channelId = `meeting-notes-${userEmail.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`;

    // Calculate expiration (7 days max)
    const expirationMs = Date.now() + (7 * 24 * 60 * 60 * 1000);

    // Register webhook with Drive API
    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}/watch`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: WEBHOOK_URL,
          expiration: expirationMs.toString(),
        }),
      }
    );

    // Check if response is JSON before parsing
    const contentType = driveResponse.headers.get('content-type');
    let driveData;

    if (contentType && contentType.includes('application/json')) {
      driveData = await driveResponse.json();
    } else {
      const textResponse = await driveResponse.text();
      console.error('Drive API returned non-JSON response:', textResponse.substring(0, 500));
      res.status(driveResponse.status || 500).json({
        error: 'Failed to register webhook with Drive',
        details: `Drive API returned non-JSON response (status ${driveResponse.status}). This may be an authentication issue - please try signing out and signing back in.`,
      });
      return;
    }

    if (!driveResponse.ok) {
      console.error('Drive API error:', driveData);
      res.status(driveResponse.status).json({
        error: 'Failed to register webhook with Drive',
        details: driveData.error?.message || JSON.stringify(driveData),
      });
      return;
    }

    // Store webhook config in Firestore
    const configRef = db.collection(USER_DRIVE_CONFIGS_COLLECTION).doc(userEmail);

    await configRef.set({
      user_email: userEmail,
      folder_id: folderId,
      folder_name: folderName || 'Meeting Notes',
      webhook: {
        channel_id: channelId,
        resource_id: driveData.resourceId,
        expiration: new Date(parseInt(driveData.expiration)),
      },
      status: 'active',
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });

    res.status(200).json({
      success: true,
      message: 'Webhook registered successfully',
      channelId,
      resourceId: driveData.resourceId,
      expiration: new Date(parseInt(driveData.expiration)).toISOString(),
    });

  } catch (error) {
    console.error('Webhook registration error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * Unregister a Drive webhook
 */
functions.http('unregisterDriveWebhook', async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Drive-Access-Token'
  );

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const authContext = await authenticateRequest(req, res, {
      emailFields: [{ location: 'body', key: 'userEmail' }],
    });
    if (!authContext) {
      return;
    }

    const { userEmail: requestUserEmail } = req.body;
    const accessToken = getDriveAccessToken(req);
    const userEmail = authContext.email;

    if (!accessToken || !requestUserEmail) {
      res.status(400).json({
        error: 'Missing required fields: accessToken, userEmail',
      });
      return;
    }

    // Get existing config
    const configRef = db.collection(USER_DRIVE_CONFIGS_COLLECTION).doc(userEmail);
    const configDoc = await configRef.get();

    if (!configDoc.exists) {
      res.status(404).json({ error: 'No webhook configuration found' });
      return;
    }

    const config = configDoc.data();
    const { channel_id, resource_id } = config.webhook || {};

    if (channel_id && resource_id) {
      // Stop the webhook channel
      const stopResponse = await fetch(
        'https://www.googleapis.com/drive/v3/channels/stop',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: channel_id,
            resourceId: resource_id,
          }),
        }
      );

      if (!stopResponse.ok) {
        const errorText = await stopResponse.text().catch(() => 'Unknown error');
        console.warn('Failed to stop Drive channel:', errorText);
        // Continue anyway - channel may have already expired
      }
    }

    // Update Firestore
    await configRef.update({
      status: 'disconnected',
      webhook: null,
      updated_at: FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      success: true,
      message: 'Webhook unregistered successfully',
    });

  } catch (error) {
    console.error('Webhook unregistration error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * Get user's Drive webhook configuration
 */
functions.http('getDriveWebhookConfig', async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const authContext = await authenticateRequest(req, res, {
      emailFields: [{ location: 'query', key: 'userEmail' }],
    });
    if (!authContext) {
      return;
    }

    const userEmail = authContext.email;

    if (!req.query.userEmail) {
      res.status(400).json({ error: 'Missing required query param: userEmail' });
      return;
    }

    const configRef = db.collection(USER_DRIVE_CONFIGS_COLLECTION).doc(userEmail);
    const configDoc = await configRef.get();

    if (!configDoc.exists) {
      res.status(200).json({ configured: false });
      return;
    }

    const config = configDoc.data();
    res.status(200).json({
      configured: true,
      folderId: config.folder_id,
      folderName: config.folder_name,
      status: config.status,
      webhookExpiration: config.webhook?.expiration?.toDate?.()?.toISOString() || null,
    });

  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

module.exports = {};
