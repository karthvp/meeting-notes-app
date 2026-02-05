/**
 * Egen Meeting Notes - /createTask Cloud Function
 * Creates Google Tasks from action items extracted from meeting notes
 */

const functions = require('@google-cloud/functions-framework');
const { Firestore } = require('@google-cloud/firestore');
const { google } = require('googleapis');

// Initialize Firestore
const db = new Firestore();

// Notes metadata collection
const NOTES_COLLECTION = 'notes_metadata';
const USER_PREFS_COLLECTION = 'user_preferences';

/**
 * Get user's OAuth tokens from Firestore
 */
async function getUserTokens(userEmail) {
  const userDoc = await db.collection(USER_PREFS_COLLECTION).doc(userEmail).get();
  if (!userDoc.exists) {
    return null;
  }
  return userDoc.data().oauth_tokens || null;
}

/**
 * Create Google Tasks API client with user's OAuth tokens
 */
async function getTasksClient(userEmail) {
  const tokens = await getUserTokens(userEmail);
  if (!tokens) {
    throw new Error('User not authenticated with Google');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials(tokens);

  return google.tasks({ version: 'v1', auth: oauth2Client });
}

/**
 * Create a Google Task
 */
async function createTask(tasksClient, taskData) {
  const taskList = '@default'; // Use default task list

  const task = {
    title: taskData.title,
    notes: taskData.notes || undefined,
    due: taskData.due ? new Date(taskData.due).toISOString() : undefined,
  };

  const response = await tasksClient.tasks.insert({
    tasklist: taskList,
    requestBody: task,
  });

  return response.data;
}

/**
 * Update note with Google Task ID
 */
async function linkTaskToActionItem(noteId, actionItemId, googleTaskId) {
  const noteRef = db.collection(NOTES_COLLECTION).doc(noteId);
  const noteDoc = await noteRef.get();

  if (!noteDoc.exists) {
    throw new Error('Note not found');
  }

  const data = noteDoc.data();
  const actionItems = data.action_items || [];

  const updatedItems = actionItems.map((item) => {
    if (item.id === actionItemId) {
      return {
        ...item,
        google_task_id: googleTaskId,
      };
    }
    return item;
  });

  await noteRef.update({
    action_items: updatedItems,
    updated_at: Firestore.Timestamp.now(),
  });
}

/**
 * HTTP Cloud Function entry point
 */
functions.http('createTask', async (req, res) => {
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
    const { noteId, actionItemId, title, notes, due, userEmail } = req.body;

    // Validate required fields
    if (!noteId || !actionItemId || !title) {
      res.status(400).json({
        error: 'Missing required fields: noteId, actionItemId, title',
      });
      return;
    }

    // Get user email from request or extract from auth
    const email = userEmail || req.body.user_email;
    if (!email) {
      res.status(400).json({ error: 'Missing userEmail' });
      return;
    }

    // Get Tasks API client
    let tasksClient;
    try {
      tasksClient = await getTasksClient(email);
    } catch (authError) {
      console.error('Authentication error:', authError);
      res.status(401).json({
        success: false,
        error: 'Google Tasks authentication required. Please sign in with Google.',
      });
      return;
    }

    // Create the task
    const task = await createTask(tasksClient, {
      title,
      notes,
      due,
    });

    // Link task to action item in Firestore
    await linkTaskToActionItem(noteId, actionItemId, task.id);

    res.status(200).json({
      success: true,
      taskId: task.id,
      taskUrl: task.selfLink,
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create Google Task',
    });
  }
});

module.exports = { createTask };
