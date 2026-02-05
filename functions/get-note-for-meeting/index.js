/**
 * Egen Meeting Notes - /get-note-for-meeting Cloud Function
 *
 * Finds a note in Firestore that matches a given meeting.
 * Also searches Google Drive directly in the user's Gemini folder.
 * Used by the Chrome extension to link Calendar meetings to Drive notes.
 */

const functions = require('@google-cloud/functions-framework');
const { Firestore } = require('@google-cloud/firestore');
const { google } = require('googleapis');

// Initialize Firestore
const db = new Firestore();

// Collections
const NOTES_COLLECTION = 'notes_metadata';
const USER_SETTINGS_COLLECTION = 'user_settings';

/**
 * Get authenticated Drive client using default credentials
 */
async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

/**
 * Calculate similarity between two strings
 */
function stringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  // Simple word overlap
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));
  const intersection = [...words1].filter(w => words2.has(w));
  const union = new Set([...words1, ...words2]);

  return intersection.length / union.size;
}

/**
 * Check if two dates are within a time window
 */
function datesWithinWindow(date1, date2, windowMinutes = 60) {
  if (!date1 || !date2) return false;

  const d1 = new Date(date1);
  const d2 = new Date(date2);

  const diffMs = Math.abs(d1 - d2);
  const diffMinutes = diffMs / (1000 * 60);

  return diffMinutes <= windowMinutes;
}

/**
 * Calculate attendee overlap
 */
function attendeeOverlap(attendees1, attendees2) {
  if (!attendees1?.length || !attendees2?.length) return 0;

  const emails1 = new Set(attendees1.map(a => (a.email || a).toLowerCase()));
  const emails2 = new Set(attendees2.map(a => (a.email || a).toLowerCase()));

  const intersection = [...emails1].filter(e => emails2.has(e));
  const union = new Set([...emails1, ...emails2]);

  return intersection.length / union.size;
}

/**
 * Get user settings to retrieve Gemini folder ID
 */
async function getUserSettings(userEmail) {
  if (!userEmail) return null;
  const doc = await db.collection(USER_SETTINGS_COLLECTION).doc(userEmail).get();
  return doc.exists ? doc.data() : null;
}

/**
 * Extract Google Drive file ID from a URL
 * Supports various Drive URL formats
 */
function extractDriveFileId(url) {
  if (!url) return null;

  // Match patterns like:
  // https://docs.google.com/document/d/FILE_ID/edit
  // https://drive.google.com/file/d/FILE_ID/view
  // https://drive.google.com/open?id=FILE_ID
  const patterns = [
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Check if meeting description contains a Drive link to notes
 */
async function checkDescriptionForDriveLink(meeting, drive) {
  const { description } = meeting;
  if (!description) return null;

  // Look for Google Drive URLs in the description
  const urlPattern = /https?:\/\/(?:docs|drive)\.google\.com\/[^\s"<>]+/gi;
  const urls = description.match(urlPattern);

  if (!urls || urls.length === 0) return null;

  for (const url of urls) {
    const fileId = extractDriveFileId(url);
    if (!fileId) continue;

    try {
      // Verify the file exists and get its details
      const response = await drive.files.get({
        fileId: fileId,
        fields: 'id, name, webViewLink, mimeType',
      });

      const file = response.data;

      // Check if it's a Google Doc (likely meeting notes)
      if (file.mimeType === 'application/vnd.google-apps.document') {
        return {
          driveFileId: file.id,
          driveFileUrl: file.webViewLink,
          driveFileName: file.name,
          matchScore: 1.0, // Perfect match - linked directly in calendar
          matchReasons: ['Direct link in calendar event description'],
          source: 'calendar_link',
        };
      }
    } catch (error) {
      // File not accessible or doesn't exist, continue to next URL
      console.log(`Could not access Drive file ${fileId}:`, error.message);
    }
  }

  return null;
}

/**
 * Search for matching notes in the Gemini Drive folder
 */
async function searchGeminiFolderForNote(drive, geminiFolderId, meeting) {
  if (!geminiFolderId) return null;

  const { title, start_time } = meeting;

  // Query for Google Docs in the Gemini folder
  // Modified in last 7 days to match the meeting
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const query = `'${geminiFolderId}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`;

  try {
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, webViewLink, createdTime, modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 50,
    });

    const files = response.data.files || [];

    if (files.length === 0) {
      return null;
    }

    // Score each file for match quality
    const candidates = [];

    for (const file of files) {
      let score = 0;
      const reasons = [];

      // Title similarity
      const similarity = stringSimilarity(title, file.name);
      score += similarity * 0.5;
      if (similarity > 0.3) {
        reasons.push(`Title match: ${Math.round(similarity * 100)}%`);
      }

      // Time proximity - check if file was created/modified around meeting time
      if (start_time && file.modifiedTime) {
        const meetingTime = new Date(start_time);
        const fileTime = new Date(file.modifiedTime);

        // Check if file was modified within a reasonable window
        if (datesWithinWindow(meetingTime, fileTime, 180)) { // 3 hours
          score += 0.3;
          reasons.push('Time proximity: within 3 hours');
        } else if (datesWithinWindow(meetingTime, fileTime, 1440)) { // 24 hours
          score += 0.15;
          reasons.push('Time proximity: within 24 hours');
        }
      }

      // Gemini notes often have specific naming patterns
      const lowerName = file.name.toLowerCase();
      if (lowerName.includes('meeting notes') || lowerName.includes('notes -')) {
        score += 0.1;
        reasons.push('Gemini naming pattern');
      }

      if (score > 0.3) {
        candidates.push({
          file,
          score,
          reasons,
        });
      }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length > 0 && candidates[0].score >= 0.4) {
      const best = candidates[0];
      return {
        driveFileId: best.file.id,
        driveFileUrl: best.file.webViewLink,
        driveFileName: best.file.name,
        matchScore: best.score,
        matchReasons: best.reasons,
        source: 'gemini_folder',
      };
    }

    return null;
  } catch (error) {
    console.error('Error searching Gemini folder:', error.message);
    return null;
  }
}

/**
 * Find note matching a meeting
 */
async function findNoteForMeeting(meeting, geminiFolderId = null, userEmail = null) {
  const { title, start_time, end_time, attendees, organizer, description } = meeting;

  // First, check if meeting description contains a direct Drive link
  if (description) {
    try {
      const drive = await getDriveClient();
      const calendarLinkResult = await checkDescriptionForDriveLink(meeting, drive);
      if (calendarLinkResult) {
        return {
          noteId: null, // Not in Firestore yet
          ...calendarLinkResult,
        };
      }
    } catch (error) {
      console.log('Error checking calendar description for Drive links:', error.message);
    }
  }

  // Next, try to find in Firestore
  // Query recent notes (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const snapshot = await db.collection(NOTES_COLLECTION)
    .where('created_at', '>=', sevenDaysAgo)
    .orderBy('created_at', 'desc')
    .limit(50)
    .get();

  // Score each note for match quality
  const candidates = [];

  for (const doc of snapshot.docs) {
    const note = { id: doc.id, ...doc.data() };
    let score = 0;
    const reasons = [];

    // Title similarity (weight: 40%)
    const noteTitleSources = [
      note.meeting?.title,
      note.drive_file_name,
    ].filter(Boolean);

    let bestTitleScore = 0;
    for (const noteTitle of noteTitleSources) {
      const similarity = stringSimilarity(title, noteTitle);
      if (similarity > bestTitleScore) {
        bestTitleScore = similarity;
      }
    }
    score += bestTitleScore * 0.4;
    if (bestTitleScore > 0.5) {
      reasons.push(`Title match: ${Math.round(bestTitleScore * 100)}%`);
    }

    // Time proximity (weight: 30%)
    const noteTime = note.meeting?.start_time?.toDate?.() || note.meeting?.start_time;
    if (noteTime && start_time) {
      if (datesWithinWindow(noteTime, start_time, 30)) {
        score += 0.3;
        reasons.push('Time match: within 30 min');
      } else if (datesWithinWindow(noteTime, start_time, 120)) {
        score += 0.15;
        reasons.push('Time match: within 2 hours');
      }
    }

    // Attendee overlap (weight: 30%)
    const noteAttendees = note.meeting?.attendees || [];
    if (attendees?.length && noteAttendees.length) {
      const overlap = attendeeOverlap(attendees, noteAttendees);
      score += overlap * 0.3;
      if (overlap > 0.3) {
        reasons.push(`Attendee overlap: ${Math.round(overlap * 100)}%`);
      }
    }

    // Organizer match (bonus)
    if (organizer && note.meeting?.organizer) {
      if (organizer.toLowerCase() === note.meeting.organizer.toLowerCase()) {
        score += 0.1;
        reasons.push('Organizer match');
      }
    }

    if (score > 0.3) {
      candidates.push({ note, score, reasons });
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Return best match from Firestore if score is high enough
  if (candidates.length > 0 && candidates[0].score >= 0.5) {
    const best = candidates[0];
    return {
      noteId: best.note.id,
      driveFileId: best.note.drive_file_id,
      driveFileUrl: best.note.drive_file_url,
      driveFileName: best.note.drive_file_name || best.note.meeting?.title,
      matchScore: best.score,
      matchReasons: best.reasons,
      classification: best.note.classification,
      status: best.note.status,
      source: 'firestore',
    };
  }

  // If no match in Firestore and we have a Gemini folder, search Drive directly
  let effectiveGeminiFolderId = geminiFolderId;

  // If no folder ID provided, try to get from user settings
  if (!effectiveGeminiFolderId && userEmail) {
    const settings = await getUserSettings(userEmail);
    effectiveGeminiFolderId = settings?.gemini_notes_folder_id;
  }

  if (effectiveGeminiFolderId) {
    try {
      const drive = await getDriveClient();
      const driveResult = await searchGeminiFolderForNote(drive, effectiveGeminiFolderId, meeting);

      if (driveResult) {
        return {
          noteId: null, // Not in Firestore yet
          ...driveResult,
        };
      }
    } catch (error) {
      console.error('Error searching Drive:', error.message);
    }
  }

  return null;
}

/**
 * HTTP Cloud Function entry point
 */
functions.http('getNoteForMeeting', async (req, res) => {
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
    const { meeting, geminiFolderId, userEmail } = req.body;

    if (!meeting) {
      res.status(400).json({ error: 'Missing required field: meeting' });
      return;
    }

    if (!meeting.title) {
      res.status(400).json({ error: 'Meeting must have a title' });
      return;
    }

    const result = await findNoteForMeeting(meeting, geminiFolderId, userEmail);

    if (result) {
      res.status(200).json({
        found: true,
        ...result,
      });
    } else {
      res.status(200).json({
        found: false,
        message: 'No matching note found for this meeting',
      });
    }

  } catch (error) {
    console.error('Get note for meeting error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// Export for testing
module.exports = { findNoteForMeeting };
