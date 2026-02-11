/**
 * Egen Meeting Notes - /shareToSlack Cloud Function
 * Share meeting notes to Slack channels
 */

const functions = require('@google-cloud/functions-framework');
const { Firestore } = require('@google-cloud/firestore');
const { authenticateRequest } = require('../_shared/auth');
const { canUserAccessNote } = require('../_shared/note-access');

// Initialize Firestore
const db = new Firestore();

// Collections
const NOTES_COLLECTION = 'notes_metadata';
const USER_PREFS_COLLECTION = 'user_preferences';

/**
 * Get user's Slack tokens from Firestore
 */
async function getSlackTokens(userEmail) {
  const userDoc = await db.collection(USER_PREFS_COLLECTION).doc(userEmail).get();
  if (!userDoc.exists) {
    return null;
  }
  return userDoc.data().slack_tokens || null;
}

/**
 * Format note as Slack blocks
 */
function formatNoteAsSlackBlocks(note) {
  const title = note.meeting?.title || note.title || 'Meeting Notes';
  const rawDate = note.meeting?.start_time;
  const dateFromTimestamp =
    rawDate?.toDate?.() ||
    (typeof rawDate?._seconds === 'number' ? new Date(rawDate._seconds * 1000) : null);
  const parsedDate =
    dateFromTimestamp ||
    (rawDate ? new Date(rawDate) : null);
  const date =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? parsedDate.toLocaleDateString()
      : 'Unknown date';
  const client = note.classification?.client_name;
  const project = note.classification?.project_name;
  const summary = note.summary || note.enhanced_analysis?.summary;
  const actionItems = note.action_items || note.enhanced_analysis?.action_items || [];
  const decisions = note.key_decisions || note.enhanced_analysis?.key_decisions || [];

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: title,
        emoji: true,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*Date:* ${date}${client ? ` | *Client:* ${client}` : ''}${project ? ` | *Project:* ${project}` : ''}`,
        },
      ],
    },
  ];

  // Add summary if available
  if (summary) {
    blocks.push(
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Summary*\n${summary}`,
        },
      }
    );
  }

  // Add action items if available
  if (actionItems.length > 0) {
    blocks.push(
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Action Items*',
        },
      }
    );

    const actionItemsText = actionItems
      .map((item) => {
        const checkbox = item.status === 'completed' ? '✅' : '⬜';
        const assignee = item.assignee_name || item.assignee ? ` (@${item.assignee_name || item.assignee})` : '';
        const due = item.due_date ? ` - Due: ${item.due_date}` : '';
        return `${checkbox} ${item.task}${assignee}${due}`;
      })
      .join('\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: actionItemsText,
      },
    });
  }

  // Add key decisions if available
  if (decisions.length > 0) {
    blocks.push(
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Key Decisions*',
        },
      }
    );

    const decisionsText = decisions
      .map((d, i) => `${i + 1}. *${d.decision}*${d.context ? `\n   > ${d.context}` : ''}`)
      .join('\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: decisionsText,
      },
    });
  }

  // Add footer with link
  if (note.drive_file_id) {
    blocks.push(
      { type: 'divider' },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `<https://drive.google.com/file/d/${note.drive_file_id}|View full notes in Google Drive>`,
          },
        ],
      }
    );
  }

  return blocks;
}

/**
 * Post message to Slack channel
 */
async function postToSlack(accessToken, channelId, blocks, text) {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      channel: channelId,
      text, // Fallback text
      blocks,
    }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || 'Slack API error');
  }

  return data;
}

/**
 * Get list of Slack channels user can post to
 */
async function getSlackChannels(accessToken) {
  const response = await fetch(
    'https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || 'Failed to fetch Slack channels');
  }

  return data.channels.map((ch) => ({
    id: ch.id,
    name: ch.name,
    isPrivate: ch.is_private,
  }));
}

async function assertUserCanAccessNote(noteId, userEmail) {
  const noteDoc = await db.collection(NOTES_COLLECTION).doc(noteId).get();
  if (!noteDoc.exists) {
    throw new Error('Note not found');
  }

  const note = { id: noteDoc.id, ...noteDoc.data() };
  if (!canUserAccessNote(note, userEmail)) {
    const error = new Error('Not authorized for this note');
    error.code = 403;
    throw error;
  }

  return note;
}

/**
 * HTTP Cloud Function entry point
 */
functions.http('shareToSlack', async (req, res) => {
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
    // Handle GET request for listing channels
    if (req.method === 'GET') {
      const authContext = await authenticateRequest(req, res, {
        emailFields: [{ location: 'query', key: 'user_email' }],
      });
      if (!authContext) {
        return;
      }

      const { user_email } = req.query;

      if (!user_email) {
        res.status(400).json({ error: 'Missing user_email' });
        return;
      }

      const tokens = await getSlackTokens(authContext.email);
      if (!tokens) {
        res.status(401).json({
          error: 'Slack not connected',
          needsAuth: true,
        });
        return;
      }

      const channels = await getSlackChannels(tokens.access_token);
      res.status(200).json({ channels });
      return;
    }

    // Handle POST request for sharing
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const authContext = await authenticateRequest(req, res, {
      emailFields: [{ location: 'body', key: 'user_email' }],
    });
    if (!authContext) {
      return;
    }

    const { note_id, channel_id, user_email, custom_message } = req.body;

    if (!note_id || !channel_id || !user_email) {
      res.status(400).json({
        error: 'Missing required fields: note_id, channel_id, user_email',
      });
      return;
    }

    // Get Slack tokens
    const tokens = await getSlackTokens(authContext.email);
    if (!tokens) {
      res.status(401).json({
        error: 'Slack not connected',
        needsAuth: true,
      });
      return;
    }

    // Get note data
    const note = await assertUserCanAccessNote(note_id, authContext.email);

    // Format as Slack blocks
    const blocks = formatNoteAsSlackBlocks(note);
    const fallbackText = `Meeting Notes: ${note.meeting?.title || note.title || 'Untitled'}`;

    // Add custom message if provided
    if (custom_message) {
      blocks.unshift({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: custom_message,
        },
      });
    }

    // Post to Slack
    const result = await postToSlack(tokens.access_token, channel_id, blocks, fallbackText);

    // Update note with Slack share info
    await db.collection(NOTES_COLLECTION).doc(note_id).update({
      'sharing.slack_shares': Firestore.FieldValue.arrayUnion({
        channel_id,
        message_ts: result.ts,
        shared_at: new Date().toISOString(),
        shared_by: authContext.email,
      }),
      updated_at: Firestore.Timestamp.now(),
    });

    res.status(200).json({
      success: true,
      messageTs: result.ts,
      channel: channel_id,
    });
  } catch (error) {
    console.error('Slack share error:', error);

    if (error.message === 'Note not found') {
      res.status(404).json({
        success: false,
        error: error.message,
      });
      return;
    }

    if (error.code === 403) {
      res.status(403).json({
        success: false,
        error: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to share to Slack',
    });
  }
});

module.exports = { formatNoteAsSlackBlocks, postToSlack };
