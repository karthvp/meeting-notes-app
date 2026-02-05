/**
 * Egen Meeting Notes - /import-from-drive Cloud Function
 *
 * Scans entire Google Drive for Gemini meeting notes and imports them
 * as uncategorized notes in Firestore.
 *
 * This function handles:
 * 1. Searching Drive for documents with "Meeting notes" in the name
 * 2. Filtering out already imported notes
 * 3. Creating new uncategorized notes in Firestore
 */

const functions = require('@google-cloud/functions-framework');
const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { google } = require('googleapis');

// Initialize Firestore
const db = new Firestore();

// Collections
const NOTES_COLLECTION = 'notes_metadata';

/**
 * Validate @egen.com or @egen.ai email
 */
function validateEgenEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const lower = email.toLowerCase();
  return lower.endsWith('@egen.com') || lower.endsWith('@egen.ai');
}

/**
 * Get authenticated Drive client using user's access token
 */
function getDriveClient(accessToken) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Search Drive for Gemini meeting notes
 */
async function searchForMeetingNotes(drive) {
  const meetingNotes = [];
  let pageToken = null;

  // Search for Google Docs with "Meeting notes" in the name
  // This captures Gemini's auto-generated meeting notes
  const query = "mimeType='application/vnd.google-apps.document' and name contains 'Meeting notes' and trashed=false";

  do {
    const response = await drive.files.list({
      q: query,
      fields: 'nextPageToken, files(id, name, createdTime, modifiedTime, webViewLink, owners)',
      pageSize: 100,
      pageToken: pageToken,
      orderBy: 'modifiedTime desc',
    });

    if (response.data.files) {
      meetingNotes.push(...response.data.files);
    }

    pageToken = response.data.nextPageToken;
  } while (pageToken);

  return meetingNotes;
}

/**
 * Get existing note IDs from Firestore by drive_file_id
 */
async function getExistingDriveFileIds() {
  const existingIds = new Set();

  const snapshot = await db.collection(NOTES_COLLECTION)
    .where('drive_file_id', '!=', null)
    .select('drive_file_id')
    .get();

  snapshot.forEach(doc => {
    const driveFileId = doc.data().drive_file_id;
    if (driveFileId) {
      existingIds.add(driveFileId);
    }
  });

  return existingIds;
}

/**
 * Extract meeting info from note name
 * Gemini notes typically named: "Meeting notes - [Title] - [Date]"
 */
function parseMeetingNoteName(name) {
  // Try to extract date from name
  const dateMatch = name.match(/(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/);

  // Try to extract title (between "Meeting notes -" and date)
  let title = name;
  if (name.toLowerCase().startsWith('meeting notes')) {
    title = name.replace(/^meeting notes\s*[-:]\s*/i, '').trim();
  }

  return {
    title: title || name,
    extractedDate: dateMatch ? dateMatch[1] : null,
  };
}

/**
 * Create note metadata in Firestore
 */
async function createNoteMetadata(file, userEmail) {
  const { title, extractedDate } = parseMeetingNoteName(file.name);

  const noteData = {
    drive_file_id: file.id,
    drive_file_url: file.webViewLink,
    meeting: {
      title: title,
      start_time: file.createdTime ? new Date(file.createdTime) : null,
    },
    classification: {
      type: 'uncategorized',
      confidence: 0,
      auto_classified: false,
      user_confirmed: false,
    },
    folder: {
      id: null,
      path: null,
    },
    sharing: {
      shared_with: [],
      permission_level: null,
      shared_at: null,
      shared_by: null,
    },
    tags: ['imported'],
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    processed_at: FieldValue.serverTimestamp(),
    imported_by: userEmail,
    imported_at: FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection(NOTES_COLLECTION).add(noteData);
  return {
    id: docRef.id,
    driveFileId: file.id,
    title: title,
  };
}

/**
 * Main import function
 */
async function importFromDrive(accessToken, userEmail) {
  const drive = getDriveClient(accessToken);

  // Step 1: Search for meeting notes in Drive
  console.log('Searching for meeting notes in Drive...');
  const driveNotes = await searchForMeetingNotes(drive);
  console.log(`Found ${driveNotes.length} meeting notes in Drive`);

  // Step 2: Get already imported note IDs
  console.log('Checking for already imported notes...');
  const existingIds = await getExistingDriveFileIds();
  console.log(`Found ${existingIds.size} already imported notes`);

  // Step 3: Filter to only new notes
  const newNotes = driveNotes.filter(file => !existingIds.has(file.id));
  console.log(`${newNotes.length} new notes to import`);

  // Step 4: Import notes in parallel (batch processing for better performance)
  const imported = [];
  const skipped = [];
  const errors = [];

  // Process in parallel with Promise.allSettled to handle individual failures
  const importPromises = newNotes.map(file =>
    createNoteMetadata(file, userEmail)
      .then(result => ({ status: 'fulfilled', file, result }))
      .catch(error => ({ status: 'rejected', file, error: error.message }))
  );

  const results = await Promise.all(importPromises);

  for (const item of results) {
    if (item.status === 'fulfilled') {
      imported.push(item.result);
    } else {
      console.error(`Failed to import note ${item.file.id}:`, item.error);
      errors.push({
        driveFileId: item.file.id,
        name: item.file.name,
        error: item.error,
      });
    }
  }

  // Notes that were already in the system
  const skippedNotes = driveNotes.filter(file => existingIds.has(file.id));
  skippedNotes.forEach(file => {
    skipped.push({
      driveFileId: file.id,
      name: file.name,
      reason: 'Already imported',
    });
  });

  return {
    success: true,
    summary: {
      totalFound: driveNotes.length,
      imported: imported.length,
      skipped: skipped.length,
      errors: errors.length,
    },
    imported,
    skipped,
    errors,
  };
}

/**
 * HTTP Cloud Function entry point
 */
functions.http('importFromDrive', async (req, res) => {
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
    // Get access token from Authorization header (preferred) or body (fallback)
    let accessToken = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    } else {
      // Fallback to body for backward compatibility
      accessToken = req.body.accessToken;
    }

    const { userEmail } = req.body;

    // Validate required fields
    if (!accessToken) {
      res.status(400).json({ error: 'Missing required field: accessToken (use Authorization header or body)' });
      return;
    }

    if (!userEmail) {
      res.status(400).json({ error: 'Missing required field: userEmail' });
      return;
    }

    if (!validateEgenEmail(userEmail)) {
      res.status(403).json({ error: 'User email must be @egen.com or @egen.ai' });
      return;
    }

    // Perform the import
    const result = await importFromDrive(accessToken, userEmail);

    res.status(200).json(result);

  } catch (error) {
    console.error('Import error:', error);

    // Check for auth errors
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      res.status(401).json({
        error: 'Authentication failed',
        message: 'Please re-authenticate with Google Drive',
        needsReauth: true,
      });
      return;
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// Export for testing
module.exports = { importFromDrive };
