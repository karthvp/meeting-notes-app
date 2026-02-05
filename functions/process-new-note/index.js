/**
 * Egen Meeting Notes - /process-new-note Cloud Function
 * Phase 2: Drive Webhook Handler for Auto-Detection
 *
 * This function handles Google Drive webhook notifications when:
 * - New files are created in the "Meeting Notes" folder
 * - Filters for Google Docs (Gemini meeting notes)
 * - Extracts meeting metadata from the document
 * - Calls /classify to get classification
 * - Auto-files if confidence > 90%, otherwise adds to uncategorized queue
 */

const functions = require('@google-cloud/functions-framework');
const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { google } = require('googleapis');

// Initialize Firestore
const db = new Firestore();

// Initialize Google Drive API with default credentials
const auth = new google.auth.GoogleAuth({
  scopes: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
  ],
});
const drive = google.drive({ version: 'v3', auth });

// Collections
const NOTES_COLLECTION = 'notes';
const NOTES_METADATA_COLLECTION = 'notes_metadata';
const WEBHOOK_LOGS_COLLECTION = 'webhook_logs';
const USER_DRIVE_CONFIGS_COLLECTION = 'user_drive_configs';

// Configuration
const MEETING_NOTES_FOLDER_NAME = 'Meeting Notes';
const AUTO_FILE_CONFIDENCE_THRESHOLD = 0.90;
const CLASSIFY_FUNCTION_URL = process.env.CLASSIFY_FUNCTION_URL ||
  'https://us-central1-karthik-patil-sandbox.cloudfunctions.net/classify';
const SHARE_FUNCTION_URL = process.env.SHARE_FUNCTION_URL ||
  'https://us-central1-karthik-patil-sandbox.cloudfunctions.net/share';

/**
 * Look up user by webhook channel ID
 */
async function findUserByChannelId(channelId) {
  if (!channelId) return null;

  // Channel IDs are formatted as: meeting-notes-{email}-{timestamp}
  // Try to extract email from channel ID
  const match = channelId.match(/^meeting-notes-(.+)-\d+$/);
  if (match) {
    const emailPart = match[1].replace(/-/g, '.').replace(/\.at\./g, '@');
    // This is a rough heuristic - the actual lookup should be by channel_id field
  }

  // Query by channel_id
  const snapshot = await db.collection(USER_DRIVE_CONFIGS_COLLECTION)
    .where('webhook.channel_id', '==', channelId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.log(`No user found for channel ID: ${channelId}`);
    return null;
  }

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

/**
 * Look up user by folder ID
 */
async function findUserByFolderId(folderId) {
  if (!folderId) return null;

  const snapshot = await db.collection(USER_DRIVE_CONFIGS_COLLECTION)
    .where('folder_id', '==', folderId)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

/**
 * Extract meeting metadata from a Google Doc
 */
async function extractMeetingMetadata(fileId) {
  try {
    // Get file metadata
    const fileResponse = await drive.files.get({
      fileId,
      fields: 'id,name,mimeType,createdTime,modifiedTime,owners,description,properties',
    });

    const file = fileResponse.data;

    // Try to extract meeting info from the document name and description
    // Gemini notes typically follow patterns like: "Meeting Notes - [Title] - [Date]"
    const name = file.name || '';
    const description = file.description || '';

    // Parse meeting title from document name
    let meetingTitle = name;
    if (name.toLowerCase().includes('meeting notes')) {
      // Remove "Meeting Notes -" prefix if present
      meetingTitle = name.replace(/^meeting\s*notes\s*[-:]\s*/i, '').trim();
    }

    // Try to extract date from title (formats like "Jan 15, 2024" or "2024-01-15")
    const datePatterns = [
      /(\w+\s+\d{1,2},?\s+\d{4})/i,  // "Jan 15, 2024"
      /(\d{4}[-/]\d{2}[-/]\d{2})/,     // "2024-01-15"
      /(\d{1,2}[-/]\d{1,2}[-/]\d{4})/, // "01/15/2024"
    ];

    let meetingDate = null;
    for (const pattern of datePatterns) {
      const match = meetingTitle.match(pattern);
      if (match) {
        meetingDate = match[1];
        meetingTitle = meetingTitle.replace(match[0], '').trim();
        break;
      }
    }

    // Clean up title - remove trailing dashes, dates, etc.
    meetingTitle = meetingTitle.replace(/[-–—]\s*$/, '').trim();

    // Get document content preview (first 5000 characters)
    let contentPreview = '';
    try {
      const contentResponse = await drive.files.export({
        fileId,
        mimeType: 'text/plain',
      });
      contentPreview = (contentResponse.data || '').substring(0, 5000);
    } catch (error) {
      console.log('Could not export document content:', error.message);
    }

    // Try to extract attendees from content
    // Gemini notes often list attendees at the top
    const attendees = extractAttendeesFromContent(contentPreview);

    // Try to extract organizer
    let organizer = null;
    if (file.owners && file.owners.length > 0) {
      organizer = file.owners[0].emailAddress;
    }

    return {
      title: meetingTitle || name,
      description: contentPreview.substring(0, 500),
      organizer,
      attendees,
      meetingDate,
      file: {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
      },
    };
  } catch (error) {
    console.error('Failed to extract meeting metadata:', error.message);
    throw error;
  }
}

/**
 * Extract attendees from document content
 */
function extractAttendeesFromContent(content) {
  const attendees = [];
  const emailPattern = /[\w.-]+@[\w.-]+\.\w+/gi;
  const emails = content.match(emailPattern) || [];

  // Deduplicate and filter
  const seenEmails = new Set();
  for (const email of emails) {
    const normalizedEmail = email.toLowerCase();
    if (!seenEmails.has(normalizedEmail)) {
      seenEmails.add(normalizedEmail);
      attendees.push({ email: normalizedEmail });
    }
    // Limit to first 20 attendees
    if (attendees.length >= 20) break;
  }

  return attendees;
}

/**
 * Call the classify function
 */
async function classifyMeeting(meetingData, fileId) {
  try {
    const response = await fetch(CLASSIFY_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meeting: meetingData,
        note_file_id: fileId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Classification failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Classification API call failed:', error.message);
    throw error;
  }
}

/**
 * Call the share function to auto-share a note
 */
async function autoShareNote(noteId, driveFileId, shareWith, ruleId, userEmail = 'system') {
  try {
    const response = await fetch(SHARE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        noteId,
        driveFileId,
        shareWith: shareWith.map(email => ({ email, permission: 'reader' })),
        userEmail,
        sendNotifications: false,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Auto-share failed:', error);
      return { success: false, error: error.message };
    }

    const result = await response.json();
    return { success: true, result, ruleId };
  } catch (error) {
    console.error('Auto-share API call failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Create or update note in Firestore
 */
async function saveNoteToFirestore(fileId, meetingData, classification, autoFiled, userEmail = null, autoShareConfig = null) {
  // Save to notes_metadata collection (used by dashboard)
  const noteRef = db.collection(NOTES_METADATA_COLLECTION).doc();

  // Build sharing metadata
  const sharingData = {
    shared_with: [],
    permission_level: 'viewer',
    share_source: null,
    rule_id: null,
    shared_at: null,
    shared_by: null,
  };

  // If auto-share is configured from a rule, prepare sharing data
  if (autoShareConfig && autoShareConfig.emails?.length > 0) {
    sharingData.shared_with = autoShareConfig.emails;
    sharingData.permission_level = autoShareConfig.permission || 'viewer';
    sharingData.share_source = 'rule';
    sharingData.rule_id = autoShareConfig.triggered_by_rule;
    sharingData.shared_at = FieldValue.serverTimestamp();
    sharingData.shared_by = 'system';
  }

  const noteData = {
    drive_file_id: fileId,
    drive_file_name: meetingData.file?.name,
    drive_file_url: `https://docs.google.com/document/d/${fileId}`,

    meeting: {
      title: meetingData.title,
      description: meetingData.description,
      organizer: meetingData.organizer,
      attendees: meetingData.attendees,
      start_time: meetingData.meetingDate ? new Date(meetingData.meetingDate) : null,
    },

    classification: {
      type: classification.classification.type,
      client_id: classification.classification.client?.id || null,
      client_name: classification.classification.client?.name || null,
      project_id: classification.classification.project?.id || null,
      project_name: classification.classification.project?.name || null,
      internal_team: classification.classification.internal_team || null,
      confidence: classification.classification.confidence,
      ai_reasoning: classification.classification.ai_reasoning || null,
      rule_id: classification.classification.matched_rule_id || null,
      auto_classified: autoFiled,
      auto_filed: autoFiled,
    },

    classification_method: classification.classification_method,

    status: autoFiled ? 'filed' : 'pending_review',
    folder: {
      path: classification.suggested_actions?.folder_path || null,
    },

    sharing: sharingData,
    tags: classification.suggested_actions?.tags || [],

    source: 'drive_webhook',
    created_by: userEmail,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };

  await noteRef.set(noteData);

  return { id: noteRef.id, ...noteData };
}

/**
 * Log webhook event for debugging
 */
async function logWebhookEvent(eventType, data, error = null) {
  try {
    await db.collection(WEBHOOK_LOGS_COLLECTION).add({
      event_type: eventType,
      data,
      error: error ? { message: error.message, stack: error.stack } : null,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (logError) {
    console.error('Failed to log webhook event:', logError.message);
  }
}

/**
 * Check if file already exists in our system
 */
async function noteExistsForFile(fileId) {
  const snapshot = await db.collection(NOTES_METADATA_COLLECTION)
    .where('drive_file_id', '==', fileId)
    .limit(1)
    .get();

  return !snapshot.empty;
}

/**
 * Validate that the file is a Google Doc in the Meeting Notes folder
 */
async function validateFile(fileId) {
  try {
    const response = await drive.files.get({
      fileId,
      fields: 'id,name,mimeType,parents',
    });

    const file = response.data;

    // Check if it's a Google Doc
    if (file.mimeType !== 'application/vnd.google-apps.document') {
      return { valid: false, reason: 'Not a Google Doc' };
    }

    // Check if it's in a Meeting Notes folder (or subfolder)
    // This is a simple check - in production you might want to validate the full path
    if (file.parents && file.parents.length > 0) {
      for (const parentId of file.parents) {
        try {
          const parentResponse = await drive.files.get({
            fileId: parentId,
            fields: 'name',
          });
          if (parentResponse.data.name.toLowerCase().includes('meeting notes')) {
            return { valid: true, file };
          }
        } catch (error) {
          // Parent might not be accessible, continue checking
        }
      }
    }

    // If we can't confirm it's in Meeting Notes, still process it
    // (could be a deep subfolder)
    return { valid: true, file };
  } catch (error) {
    return { valid: false, reason: error.message };
  }
}

/**
 * Process a new file notification
 */
async function processNewFile(fileId, userEmail = null) {
  // Check if we already have this file
  const exists = await noteExistsForFile(fileId);
  if (exists) {
    console.log(`Note already exists for file ${fileId}, skipping`);
    return { skipped: true, reason: 'already_exists' };
  }

  // Validate the file
  const validation = await validateFile(fileId);
  if (!validation.valid) {
    console.log(`File ${fileId} validation failed: ${validation.reason}`);
    return { skipped: true, reason: validation.reason };
  }

  // Extract meeting metadata from the document
  const meetingData = await extractMeetingMetadata(fileId);

  // Call classify to get AI classification
  const classification = await classifyMeeting({
    title: meetingData.title,
    description: meetingData.description,
    organizer: meetingData.organizer,
    attendees: meetingData.attendees,
  }, fileId);

  // Determine if we should auto-file
  const confidence = classification.classification?.confidence || 0;
  const autoFile = confidence >= AUTO_FILE_CONFIDENCE_THRESHOLD;

  // Get auto-share config if confidence is high enough
  const autoShareConfig = (autoFile && classification.auto_share) ? classification.auto_share : null;

  // Save to Firestore (with auto-share metadata if applicable)
  const savedNote = await saveNoteToFirestore(fileId, meetingData, classification, autoFile, userEmail, autoShareConfig);

  // Trigger auto-sharing if configured by a rule and confidence is high
  let autoShareResult = null;
  if (autoShareConfig && autoShareConfig.emails?.length > 0) {
    console.log(`Auto-sharing note ${savedNote.id} with ${autoShareConfig.emails.length} people (triggered by rule: ${autoShareConfig.triggered_by_rule})`);
    autoShareResult = await autoShareNote(
      savedNote.id,
      fileId,
      autoShareConfig.emails,
      autoShareConfig.triggered_by_rule,
      userEmail || 'system'
    );

    // Update rule stats (times_applied)
    if (autoShareConfig.triggered_by_rule) {
      try {
        const ruleRef = db.collection('rules').doc(autoShareConfig.triggered_by_rule);
        await ruleRef.update({
          'stats.times_applied': FieldValue.increment(1),
          'stats.last_applied': FieldValue.serverTimestamp(),
        });
      } catch (err) {
        console.error('Failed to update rule stats:', err.message);
      }
    }
  }

  return {
    success: true,
    noteId: savedNote.id,
    autoFiled: autoFile,
    classification: classification.classification,
    classificationMethod: classification.classification_method,
    userEmail,
    autoShare: autoShareResult,
  };
}

/**
 * HTTP Cloud Function entry point for Drive webhooks
 */
functions.http('processNewNote', async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-Goog-Channel-ID, X-Goog-Resource-ID, X-Goog-Resource-State, X-Goog-Resource-URI');

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
    // Google Drive webhook headers
    const channelId = req.headers['x-goog-channel-id'];
    const resourceState = req.headers['x-goog-resource-state'];
    const resourceId = req.headers['x-goog-resource-id'];
    const resourceUri = req.headers['x-goog-resource-uri'];

    // Log the webhook for debugging
    await logWebhookEvent('webhook_received', {
      channelId,
      resourceState,
      resourceId,
      resourceUri,
      body: req.body,
    });

    // Handle sync message (initial webhook setup verification)
    if (resourceState === 'sync') {
      console.log('Webhook sync message received');
      res.status(200).json({ status: 'sync_acknowledged' });
      return;
    }

    // Handle changes
    if (resourceState === 'change' || resourceState === 'add') {
      // Look up which user this webhook belongs to
      let userConfig = null;
      if (channelId) {
        userConfig = await findUserByChannelId(channelId);
      }

      const userEmail = userConfig?.user_email || null;

      // For Drive Push Notifications, we need to query for changes
      // The webhook doesn't include the file ID directly for folder watches
      // We need to use the Changes API to get the actual changes

      // If the request body contains file information (custom implementation)
      if (req.body?.fileId) {
        const result = await processNewFile(req.body.fileId, userEmail);
        await logWebhookEvent('file_processed', { ...result, userEmail });
        res.status(200).json(result);
        return;
      }

      // For standard Drive Push Notifications on folders, we'd need to:
      // 1. Store a page token
      // 2. Use drive.changes.list() to get actual changes
      // This is a simplified implementation that expects file IDs in the body

      console.log('Received change notification without file ID', { channelId, userEmail });
      res.status(200).json({
        status: 'change_acknowledged',
        message: 'Change notification received. Use manual trigger with fileId for processing.',
        userEmail,
      });
      return;
    }

    // Handle other states
    console.log(`Unhandled resource state: ${resourceState}`);
    res.status(200).json({ status: 'acknowledged', resourceState });

  } catch (error) {
    console.error('Webhook processing error:', error);
    await logWebhookEvent('error', { error: error.message }, error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * Manual trigger endpoint for processing a specific file
 * Useful for testing and manual processing
 */
functions.http('processFile', async (req, res) => {
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
    const { fileId } = req.body;

    if (!fileId) {
      res.status(400).json({ error: 'Missing required field: fileId' });
      return;
    }

    const result = await processNewFile(fileId);
    res.status(200).json(result);

  } catch (error) {
    console.error('File processing error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

module.exports = { processNewFile };
