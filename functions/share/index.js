/**
 * Egen Meeting Notes - /share Cloud Function
 *
 * Shares a note with specified team members via Google Drive API.
 *
 * This function handles:
 * 1. Adding Drive permissions for specified users
 * 2. Updating sharing metadata in Firestore
 * 3. Tracking sharing history
 */

const functions = require('@google-cloud/functions-framework');
const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { google } = require('googleapis');
const { authenticateRequest, isEgenAiEmail } = require('../_shared/auth');
const { canUserAccessNote } = require('../_shared/note-access');

// Initialize Firestore
const db = new Firestore();

// Collections
const NOTES_COLLECTION = 'notes_metadata';

/**
 * Get authenticated Drive client using default credentials
 */
async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

/**
 * Valid permission levels for Google Drive
 */
const VALID_PERMISSIONS = ['reader', 'commenter', 'writer'];

/**
 * Get Drive file ID from note metadata
 */
async function getDriveFileIdFromNote(noteId) {
  const noteRef = db.collection(NOTES_COLLECTION).doc(noteId);
  const noteDoc = await noteRef.get();

  if (!noteDoc.exists) {
    throw new Error('Note not found');
  }

  return noteDoc.data();
}

/**
 * Get current permissions for a file
 */
async function getCurrentPermissions(drive, fileId) {
  try {
    const response = await drive.permissions.list({
      fileId,
      fields: 'permissions(id, emailAddress, role, type)',
    });
    return response.data.permissions || [];
  } catch (error) {
    console.error('Failed to get current permissions:', error);
    return [];
  }
}

/**
 * Share file with a user
 */
async function shareWithUser(drive, fileId, email, permission, sendNotification = false) {
  try {
    const response = await drive.permissions.create({
      fileId,
      requestBody: {
        type: 'user',
        role: permission,
        emailAddress: email,
      },
      sendNotificationEmail: sendNotification,
    });

    return {
      email,
      permission,
      success: true,
      permissionId: response.data.id,
    };
  } catch (error) {
    // Check if user already has access
    if (error.code === 400 && error.message?.includes('already has access')) {
      // Try to update existing permission
      try {
        const currentPerms = await getCurrentPermissions(drive, fileId);
        const existingPerm = currentPerms.find(
          p => p.emailAddress?.toLowerCase() === email.toLowerCase()
        );

        if (existingPerm) {
          await drive.permissions.update({
            fileId,
            permissionId: existingPerm.id,
            requestBody: { role: permission },
          });

          return {
            email,
            permission,
            success: true,
            permissionId: existingPerm.id,
            updated: true,
          };
        }
      } catch (updateError) {
        console.error(`Failed to update permission for ${email}:`, updateError);
      }
    }

    return {
      email,
      permission,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Remove sharing for a user
 */
async function removeSharing(drive, fileId, email) {
  try {
    const currentPerms = await getCurrentPermissions(drive, fileId);
    const existingPerm = currentPerms.find(
      p => p.emailAddress?.toLowerCase() === email.toLowerCase()
    );

    if (existingPerm) {
      await drive.permissions.delete({
        fileId,
        permissionId: existingPerm.id,
      });

      return { email, success: true, removed: true };
    }

    return { email, success: true, removed: false, message: 'User did not have access' };
  } catch (error) {
    return { email, success: false, error: error.message };
  }
}

/**
 * Main share function
 */
async function shareNote(noteId, shareWith, userEmail, options = {}) {
  const { sendNotifications = false, action = 'add' } = options;

  // Get Drive file ID
  let driveFileId = options.driveFileId;
  let noteData = null;

  if (noteId) {
    noteData = await getDriveFileIdFromNote(noteId);
    driveFileId = driveFileId || noteData.drive_file_id;
  }

  if (noteId && noteData && !canUserAccessNote(noteData, userEmail)) {
    const permissionError = new Error('Not authorized to share this note');
    permissionError.code = 403;
    throw permissionError;
  }

  if (!driveFileId) {
    throw new Error('No Drive file ID available');
  }

  const drive = await getDriveClient();
  const results = [];

  if (action === 'remove') {
    // Remove sharing
    for (const share of shareWith) {
      const result = await removeSharing(drive, driveFileId, share.email);
      results.push(result);
    }
  } else {
    // Add/update sharing
    for (const share of shareWith) {
      const permission = VALID_PERMISSIONS.includes(share.permission)
        ? share.permission
        : 'reader';

      const result = await shareWithUser(
        drive,
        driveFileId,
        share.email,
        permission,
        sendNotifications
      );
      results.push(result);
    }
  }

  // Update Firestore metadata
  if (noteId) {
    const noteRef = db.collection(NOTES_COLLECTION).doc(noteId);
    const noteDoc = await noteRef.get();

    if (noteDoc.exists) {
      const currentData = noteDoc.data();
      const currentSharedWith = currentData.sharing?.shared_with || [];

      let newSharedWith;
      if (action === 'remove') {
        const removedEmails = shareWith.map(s => s.email.toLowerCase());
        newSharedWith = currentSharedWith.filter(
          email => !removedEmails.includes(email.toLowerCase())
        );
      } else {
        const newEmails = shareWith.map(s => s.email);
        newSharedWith = [...new Set([...currentSharedWith, ...newEmails])];
      }

      await noteRef.update({
        'sharing.shared_with': newSharedWith,
        'sharing.shared_at': FieldValue.serverTimestamp(),
        'sharing.shared_by': userEmail,
        updated_at: FieldValue.serverTimestamp(),
        updated_by: userEmail,
      });
    }
  }

  return {
    success: results.every(r => r.success),
    sharedWith: results,
    noteId,
    driveFileId,
  };
}

/**
 * HTTP Cloud Function entry point
 */
functions.http('share', async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const authContext = await authenticateRequest(req, res, {
      emailFields: [{ location: 'body', key: 'userEmail' }],
    });
    if (!authContext) {
      return;
    }

    const {
      noteId,
      driveFileId,
      shareWith,
      userEmail: requestUserEmail,
      sendNotifications,
      action,
    } = req.body;
    const userEmail = authContext.email;

    // Validate required fields
    if (!requestUserEmail) {
      res.status(400).json({ error: 'Missing required field: userEmail' });
      return;
    }

    if (!isEgenAiEmail(userEmail)) {
      res.status(403).json({ error: 'User email must be @egen.ai' });
      return;
    }

    if (!noteId && !driveFileId) {
      res.status(400).json({ error: 'Must provide either noteId or driveFileId' });
      return;
    }

    if (!shareWith || !Array.isArray(shareWith) || shareWith.length === 0) {
      res.status(400).json({ error: 'shareWith must be a non-empty array' });
      return;
    }

    // Validate shareWith entries
    for (const share of shareWith) {
      if (!share.email) {
        res.status(400).json({ error: 'Each shareWith entry must have an email' });
        return;
      }
    }

    // Perform sharing
    const result = await shareNote(noteId, shareWith, userEmail, {
      driveFileId,
      sendNotifications: sendNotifications || false,
      action: action || 'add',
    });

    res.status(200).json(result);

  } catch (error) {
    console.error('Share error:', error);

    if (error.message === 'Note not found') {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error.code === 403) {
      res.status(403).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// Export for testing
module.exports = { shareNote };
