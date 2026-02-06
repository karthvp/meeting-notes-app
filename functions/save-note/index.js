/**
 * Egen Meeting Notes - /save-note Cloud Function
 *
 * Moves a note to the correct Drive folder and updates Firestore metadata.
 *
 * This function handles:
 * 1. Moving the note file to the target Drive folder
 * 2. Updating notes_metadata in Firestore
 * 3. Optionally sharing with specified users
 */

const functions = require('@google-cloud/functions-framework');
const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { google } = require('googleapis');

// Initialize Firestore
const db = new Firestore();

// Collections
const NOTES_COLLECTION = 'notes_metadata';
const CLIENTS_COLLECTION = 'clients';
const PROJECTS_COLLECTION = 'projects';

/**
 * Get authenticated Drive client using user's access token
 * Falls back to service account if no token provided
 */
async function getDriveClient(accessToken = null) {
  if (accessToken) {
    // Use user's OAuth token for personal Drive access
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  // Fallback to service account (for shared drives or service operations)
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
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
 * Move file to target folder in Google Drive
 */
async function moveFileToFolder(drive, fileId, targetFolderId) {
  // Get current parent(s)
  const file = await drive.files.get({
    fileId,
    fields: 'parents',
    supportsAllDrives: true,
  });

  const previousParents = file.data.parents ? file.data.parents.join(',') : '';

  // Move file to new folder
  const response = await drive.files.update({
    fileId,
    addParents: targetFolderId,
    removeParents: previousParents,
    fields: 'id, name, webViewLink, parents',
    supportsAllDrives: true,
  });

  return response.data;
}

/**
 * Get folder path from folder ID
 */
async function getFolderPath(drive, folderId) {
  const parts = [];
  let currentId = folderId;

  while (currentId) {
    try {
      const folder = await drive.files.get({
        fileId: currentId,
        fields: 'id, name, parents',
        supportsAllDrives: true,
      });

      parts.unshift(folder.data.name);
      currentId = folder.data.parents ? folder.data.parents[0] : null;

      // Stop at "My Drive" or root
      if (!currentId || parts.length > 10) break;
    } catch (error) {
      break;
    }
  }

  return parts.join('/');
}

/**
 * Share file with users
 */
async function shareFileWithUsers(drive, fileId, shareWith) {
  const results = [];

  for (const share of shareWith) {
    try {
      await drive.permissions.create({
        fileId,
        requestBody: {
          type: 'user',
          role: share.permission || 'reader',
          emailAddress: share.email,
        },
        sendNotificationEmail: false,
        supportsAllDrives: true,
      });
      results.push({ email: share.email, success: true });
    } catch (error) {
      console.error(`Failed to share with ${share.email}:`, error.message);
      results.push({ email: share.email, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Get client info by ID
 */
async function getClientInfo(clientId) {
  if (!clientId) return null;
  const doc = await db.collection(CLIENTS_COLLECTION).doc(clientId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

/**
 * Get project info by ID
 */
async function getProjectInfo(projectId) {
  if (!projectId) return null;
  const doc = await db.collection(PROJECTS_COLLECTION).doc(projectId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

/**
 * Main save-note function
 */
async function saveNote(params) {
  const {
    noteId,
    driveFileId,
    targetFolderId,
    classification,
    sharedWith = [],
    tags = [],
    userEmail,
    meeting, // Optional: meeting info when no note exists yet
    accessToken, // Optional: user's OAuth token for Drive operations
  } = params;

  const drive = await getDriveClient(accessToken);
  let fileUrl = '';
  let folderPath = '';
  let shareResults = [];
  let noteMetadataId = noteId;
  let driveError = null;

  // Step 1: Move file to target folder (if targetFolderId provided)
  console.log('Step 1 check - targetFolderId:', targetFolderId, 'driveFileId:', driveFileId);
  if (targetFolderId && driveFileId) {
    console.log('Attempting to move file', driveFileId, 'to folder', targetFolderId);
    try {
      const fileData = await moveFileToFolder(drive, driveFileId, targetFolderId);
      console.log('File moved successfully:', fileData);
      fileUrl = fileData.webViewLink;
      folderPath = await getFolderPath(drive, targetFolderId);
      console.log('Folder path:', folderPath);
    } catch (error) {
      console.error('Failed to move file:', error.message);
      console.error('Full error:', JSON.stringify(error, null, 2));
      driveError = error.message;
      // Continue with Firestore update even if Drive operation fails
    }
  } else {
    console.log('Skipping file move - missing targetFolderId or driveFileId');
  }

  // Step 2: Share with users (if sharedWith provided)
  if (sharedWith.length > 0 && driveFileId) {
    try {
      shareResults = await shareFileWithUsers(drive, driveFileId, sharedWith);
    } catch (error) {
      console.error('Failed to share file:', error.message);
      // Continue with Firestore update even if sharing fails
    }
  }

  // Step 3: Get client and project info for metadata
  let clientInfo = null;
  let projectInfo = null;

  if (classification) {
    if (classification.clientId) {
      clientInfo = await getClientInfo(classification.clientId);
    }
    if (classification.projectId) {
      projectInfo = await getProjectInfo(classification.projectId);
    }
  }

  // Step 4: Update or create notes_metadata in Firestore
  // Filter out undefined/invalid emails from sharedWith
  const validSharedWith = (sharedWith || []).filter(s => s && s.email && typeof s.email === 'string' && s.email !== 'undefined');

  // Build noteData ensuring no undefined values (Firestore doesn't accept undefined)
  const noteData = {
    drive_file_id: driveFileId || null,
    drive_file_url: fileUrl || null,
    // Include meeting info if provided (for notes without Drive file yet)
    meeting: meeting ? {
      title: meeting.title || null,
      calendar_event_id: meeting.id || null,
      start_time: meeting.start || null,
      end_time: meeting.end || null,
      organizer: meeting.organizer || null,
      attendees: (meeting.attendees || []).map(a => a.email || a).filter(Boolean),
    } : null,
    classification: {
      type: classification?.type || 'uncategorized',
      client_id: classification?.clientId || null,
      client_name: clientInfo?.name || classification?.clientName || null,
      project_id: classification?.projectId || null,
      project_name: projectInfo?.project_name || classification?.projectName || null,
      confidence: classification?.confidence ?? 0,
      auto_classified: classification?.autoClassified ?? false,
      user_confirmed: true,
      confirmed_by: userEmail || null,
      confirmed_at: FieldValue.serverTimestamp(),
    },
    folder: {
      id: targetFolderId || null,
      path: folderPath || null,
    },
    sharing: {
      shared_with: validSharedWith.map(s => s.email),
      permission_level: validSharedWith[0]?.permission || 'reader',
    },
    tags: (tags || []).filter(t => t != null),
    updated_at: FieldValue.serverTimestamp(),
    updated_by: userEmail || null,
  };

  // Only add sharing timestamps if there are valid shares
  if (validSharedWith.length > 0) {
    noteData.sharing.shared_at = FieldValue.serverTimestamp();
    noteData.sharing.shared_by = userEmail || null;
  }

  // If noteId exists, update; otherwise create new
  if (noteId) {
    const noteRef = db.collection(NOTES_COLLECTION).doc(noteId);
    const existingNote = await noteRef.get();

    if (existingNote.exists) {
      // Merge with existing data
      await noteRef.update(noteData);
    } else {
      // Create new with provided ID
      noteData.created_at = FieldValue.serverTimestamp();
      noteData.processed_at = FieldValue.serverTimestamp();
      await noteRef.set(noteData);
    }
    noteMetadataId = noteId;
  } else {
    // Generate new ID
    noteData.created_at = FieldValue.serverTimestamp();
    noteData.processed_at = FieldValue.serverTimestamp();
    const docRef = await db.collection(NOTES_COLLECTION).add(noteData);
    noteMetadataId = docRef.id;
  }

  return {
    success: true,
    noteMetadataId,
    fileUrl: fileUrl || null,
    folderPath: folderPath || null,
    sharedWith: shareResults,
    driveWarning: driveError || null,
  };
}

/**
 * HTTP Cloud Function entry point
 */
functions.http('saveNote', async (req, res) => {
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
    // Get access token from Authorization header (for Drive operations)
    let accessToken = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    }

    console.log('=== saveNote called ===');
    console.log('Has access token:', !!accessToken);
    console.log('Access token length:', accessToken ? accessToken.length : 0);

    const {
      noteId,
      driveFileId,
      targetFolderId,
      classification,
      sharedWith,
      tags,
      userEmail,
      meeting,
    } = req.body;

    console.log('Request params:', {
      noteId,
      driveFileId,
      targetFolderId,
      userEmail,
      hasClassification: !!classification,
    });

    // Validate required fields
    if (!userEmail) {
      res.status(400).json({ error: 'Missing required field: userEmail' });
      return;
    }

    if (!validateEgenEmail(userEmail)) {
      res.status(403).json({ error: 'User email must be @egen.com or @egen.ai' });
      return;
    }

    // We need either a noteId, driveFileId, or meeting info to create a new entry
    if (!noteId && !driveFileId && !meeting) {
      res.status(400).json({ error: 'Must provide either noteId, driveFileId, or meeting info' });
      return;
    }

    // Validate sharedWith emails
    if (sharedWith && Array.isArray(sharedWith)) {
      for (const share of sharedWith) {
        if (!share.email) {
          res.status(400).json({ error: 'Each sharedWith entry must have an email' });
          return;
        }
      }
    }

    // Perform the save operation
    const result = await saveNote({
      noteId,
      driveFileId,
      targetFolderId,
      classification,
      sharedWith: sharedWith || [],
      tags: tags || [],
      userEmail,
      meeting,
      accessToken, // Pass user's token for Drive operations
    });

    res.status(200).json(result);

  } catch (error) {
    console.error('Save note error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// Export for testing
module.exports = { saveNote };
