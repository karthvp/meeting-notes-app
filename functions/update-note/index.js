/**
 * Egen Meeting Notes - /update-note Cloud Function
 * Week 2: Updates note metadata (categorization, sharing)
 *
 * This function handles:
 * 1. Updating note classification (client, project, type)
 * 2. Managing note sharing
 * 3. Audit logging of changes
 */

const functions = require('@google-cloud/functions-framework');
const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { authenticateRequest, isEgenAiEmail } = require('../_shared/auth');
const { canUserAccessNote } = require('../_shared/note-access');

// Initialize Firestore
const db = new Firestore();

// Collections
const NOTES_COLLECTION = 'notes_metadata';
const AUDIT_COLLECTION = 'audit_log';

/**
 * Validate array of @egen.ai emails
 */
function validateEgenEmails(emails) {
  if (!Array.isArray(emails)) return false;
  return emails.every(isEgenAiEmail);
}

/**
 * Create audit log entry
 */
async function createAuditLog(noteId, action, changes, userEmail) {
  try {
    await db.collection(AUDIT_COLLECTION).add({
      noteId,
      action,
      changes,
      userEmail,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging shouldn't block the main operation
  }
}

/**
 * Update note classification
 */
async function updateClassification(noteId, updates, userEmail) {
  const noteRef = db.collection(NOTES_COLLECTION).doc(noteId);
  const noteDoc = await noteRef.get();

  if (!noteDoc.exists) {
    throw new Error('Note not found');
  }

  const currentData = noteDoc.data();
  const validUpdates = {};
  const changes = {};

  // Validate and apply clientId
  if (updates.clientId !== undefined) {
    if (updates.clientId === null || updates.clientId === '') {
      validUpdates.clientId = null;
      changes.clientId = { from: currentData.clientId, to: null };
    } else if (typeof updates.clientId === 'string') {
      validUpdates.clientId = updates.clientId;
      changes.clientId = { from: currentData.clientId, to: updates.clientId };
    }
  }

  // Validate and apply projectId
  if (updates.projectId !== undefined) {
    if (updates.projectId === null || updates.projectId === '') {
      validUpdates.projectId = null;
      changes.projectId = { from: currentData.projectId, to: null };
    } else if (typeof updates.projectId === 'string') {
      validUpdates.projectId = updates.projectId;
      changes.projectId = { from: currentData.projectId, to: updates.projectId };
    }
  }

  // Validate and apply noteType
  const validNoteTypes = ['meeting', 'kickoff', 'status', 'planning', 'review', 'internal', 'other'];
  if (updates.noteType !== undefined) {
    if (updates.noteType === null || updates.noteType === '') {
      validUpdates.noteType = null;
      changes.noteType = { from: currentData.noteType, to: null };
    } else if (validNoteTypes.includes(updates.noteType)) {
      validUpdates.noteType = updates.noteType;
      changes.noteType = { from: currentData.noteType, to: updates.noteType };
    } else {
      throw new Error(`Invalid noteType. Must be one of: ${validNoteTypes.join(', ')}`);
    }
  }

  // Add metadata
  validUpdates.updatedAt = FieldValue.serverTimestamp();
  validUpdates.updatedBy = userEmail;

  // Only update if there are changes
  if (Object.keys(changes).length === 0) {
    return { message: 'No changes to apply' };
  }

  await noteRef.update(validUpdates);

  // Create audit log
  await createAuditLog(noteId, 'classification_update', changes, userEmail);

  return {
    message: 'Classification updated successfully',
    changes,
  };
}

/**
 * Update note sharing
 */
async function updateSharing(noteId, sharedWith, userEmail) {
  const noteRef = db.collection(NOTES_COLLECTION).doc(noteId);
  const noteDoc = await noteRef.get();

  if (!noteDoc.exists) {
    throw new Error('Note not found');
  }

  // Validate all emails are @egen.ai
  if (!validateEgenEmails(sharedWith)) {
    throw new Error('All emails must be @egen.ai addresses');
  }

  const currentData = noteDoc.data();
  const changes = {
    sharedWith: {
      from: currentData.sharedWith || [],
      to: sharedWith,
    },
  };

  await noteRef.update({
    sharedWith,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: userEmail,
  });

  // Create audit log
  await createAuditLog(noteId, 'sharing_update', changes, userEmail);

  return {
    message: 'Sharing updated successfully',
    sharedWith,
  };
}

/**
 * Get note by ID
 */
async function getNote(noteId) {
  const noteRef = db.collection(NOTES_COLLECTION).doc(noteId);
  const noteDoc = await noteRef.get();

  if (!noteDoc.exists) {
    throw new Error('Note not found');
  }

  return {
    id: noteDoc.id,
    ...noteDoc.data(),
  };
}

async function assertUserCanAccessNote(noteId, userEmail) {
  const noteRef = db.collection(NOTES_COLLECTION).doc(noteId);
  const noteDoc = await noteRef.get();
  if (!noteDoc.exists) {
    throw new Error('Note not found');
  }

  if (!canUserAccessNote(noteDoc.data(), userEmail)) {
    const error = new Error('Not authorized for this note');
    error.code = 403;
    throw error;
  }
}

/**
 * HTTP Cloud Function entry point
 */
functions.http('updateNote', async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const authContext = await authenticateRequest(req, res, {
      emailFields: [
        { location: 'body', key: 'userEmail' },
        { location: 'query', key: 'userEmail' },
      ],
    });
    if (!authContext) {
      return;
    }

    // GET - Retrieve note
    if (req.method === 'GET') {
      const noteId = req.query.id;
      if (!noteId) {
        res.status(400).json({ error: 'Missing required parameter: id' });
        return;
      }

      await assertUserCanAccessNote(noteId, authContext.email);
      const note = await getNote(noteId);
      res.status(200).json(note);
      return;
    }

    // POST - Update note
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const {
      noteId,
      action,
      classification,
      sharedWith,
      userEmail: requestUserEmail,
    } = req.body;
    const userEmail = authContext.email;

    // Validate required fields
    if (!noteId) {
      res.status(400).json({ error: 'Missing required field: noteId' });
      return;
    }

    if (!requestUserEmail) {
      res.status(400).json({ error: 'Missing required field: userEmail' });
      return;
    }

    if (!isEgenAiEmail(userEmail)) {
      res.status(403).json({ error: 'User email must be @egen.ai' });
      return;
    }

    await assertUserCanAccessNote(noteId, userEmail);

    // Determine action
    const updateAction = action || 'update';

    let result;
    switch (updateAction) {
      case 'classification':
      case 'categorize':
        if (!classification) {
          res.status(400).json({ error: 'Missing required field: classification' });
          return;
        }
        result = await updateClassification(noteId, classification, userEmail);
        break;

      case 'share':
      case 'sharing':
        if (!Array.isArray(sharedWith)) {
          res.status(400).json({ error: 'Missing or invalid field: sharedWith (must be array)' });
          return;
        }
        result = await updateSharing(noteId, sharedWith, userEmail);
        break;

      case 'update':
        // Combined update - both classification and sharing
        result = { updates: [] };
        if (classification) {
          const classResult = await updateClassification(noteId, classification, userEmail);
          result.updates.push({ action: 'classification', ...classResult });
        }
        if (Array.isArray(sharedWith)) {
          const shareResult = await updateSharing(noteId, sharedWith, userEmail);
          result.updates.push({ action: 'sharing', ...shareResult });
        }
        if (result.updates.length === 0) {
          res.status(400).json({ error: 'No updates provided' });
          return;
        }
        break;

      default:
        res.status(400).json({ error: `Unknown action: ${updateAction}` });
        return;
    }

    res.status(200).json(result);

  } catch (error) {
    console.error('Update note error:', error);

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
module.exports = { updateClassification, updateSharing, getNote };
