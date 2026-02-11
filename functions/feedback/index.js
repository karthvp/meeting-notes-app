/**
 * Egen Meeting Notes - /feedback Cloud Function
 *
 * Records user corrections for the learning system.
 *
 * This function handles:
 * 1. Recording corrections in the feedback collection
 * 2. Updating rule statistics when rules were involved
 * 3. Updating user learned patterns
 * 4. Suggesting new rules based on corrections
 */

const functions = require('@google-cloud/functions-framework');
const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { authenticateRequest, isEgenAiEmail } = require('../_shared/auth');
const { canUserAccessNote } = require('../_shared/note-access');

// Initialize Firestore
const db = new Firestore();

// Collections
const FEEDBACK_COLLECTION = 'feedback';
const RULES_COLLECTION = 'rules';
const USER_PREFS_COLLECTION = 'user_preferences';
const NOTES_COLLECTION = 'notes_metadata';

/**
 * Determine the type of correction made
 */
function determineCorrectionType(original, corrected) {
  const corrections = [];

  if (original.type !== corrected.type) {
    corrections.push('type_change');
  }

  if (original.clientId !== corrected.clientId) {
    corrections.push('client_change');
  }

  if (original.projectId !== corrected.projectId) {
    corrections.push('project_change');
  }

  if (original.internalTeam !== corrected.internalTeam) {
    corrections.push('team_change');
  }

  return corrections.length > 0 ? corrections : ['other'];
}

/**
 * Update rule statistics when a rule was corrected
 */
async function updateRuleStats(ruleId) {
  if (!ruleId) return;

  try {
    const ruleRef = db.collection(RULES_COLLECTION).doc(ruleId);
    await ruleRef.update({
      'stats.times_corrected': FieldValue.increment(1),
    });
  } catch (error) {
    console.error(`Failed to update rule stats for ${ruleId}:`, error);
  }
}

/**
 * Update or create a learned pattern for the user
 */
async function updateUserPattern(userEmail, meeting, correctedClassification) {
  try {
    const userRef = db.collection(USER_PREFS_COLLECTION).doc(userEmail);
    const userDoc = await userRef.get();

    // Build pattern description
    const patternParts = [];

    // Use external attendee domains as pattern
    const externalDomains = meeting.attendees
      ?.map((a) => (typeof a === 'string' ? a : a?.email))
      .filter((email) => !!email && !email.endsWith('@egen.ai'))
      .map((email) => email.split('@')[1])
      .filter(Boolean);

    if (externalDomains && externalDomains.length > 0) {
      patternParts.push(`attendees from ${[...new Set(externalDomains)].join(', ')}`);
    }

    // Use title keywords as pattern
    const titleKeywords = meeting.title?.split(/\s+/).filter(w => w.length > 3);
    if (titleKeywords && titleKeywords.length > 0) {
      patternParts.push(`title contains "${titleKeywords.slice(0, 3).join(', ')}"`);
    }

    if (patternParts.length === 0) return;

    const pattern = patternParts.join(' and ');
    let action = '';

    if (correctedClassification.type === 'client' && correctedClassification.clientId) {
      action = `classify as client: ${correctedClassification.clientName || correctedClassification.clientId}`;
      if (correctedClassification.projectId) {
        action += ` / ${correctedClassification.projectName || correctedClassification.projectId}`;
      }
    } else if (correctedClassification.type === 'internal') {
      action = `classify as internal: ${correctedClassification.internalTeam || 'General'}`;
    } else {
      action = `classify as ${correctedClassification.type}`;
    }

    const newPattern = {
      pattern,
      action,
      confidence: 0.7,
      times_applied: 0,
      last_applied: null,
      created_at: new Date().toISOString(),
    };

    if (userDoc.exists) {
      const userData = userDoc.data();
      const existingPatterns = userData.learned_patterns || [];

      // Check if similar pattern exists
      const existingIndex = existingPatterns.findIndex(
        p => p.pattern.toLowerCase() === pattern.toLowerCase()
      );

      if (existingIndex >= 0) {
        // Update existing pattern
        existingPatterns[existingIndex] = {
          ...existingPatterns[existingIndex],
          action,
          confidence: Math.min(0.95, existingPatterns[existingIndex].confidence + 0.05),
          times_applied: existingPatterns[existingIndex].times_applied + 1,
        };
      } else {
        // Add new pattern (limit to 50 patterns)
        existingPatterns.push(newPattern);
        if (existingPatterns.length > 50) {
          existingPatterns.shift();
        }
      }

      await userRef.update({
        learned_patterns: existingPatterns,
        updated_at: FieldValue.serverTimestamp(),
      });
    } else {
      // Create new user preferences with pattern
      await userRef.set({
        id: userEmail,
        display_name: userEmail.split('@')[0],
        settings: {
          auto_file_threshold: 0.90,
          show_popup_threshold: 0.70,
          default_share_permission: 'reader',
          notification_preferences: {
            popup_enabled: true,
            email_digest: 'daily',
            slack_notifications: false,
          },
        },
        learned_patterns: [newPattern],
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
    }

    return newPattern;
  } catch (error) {
    console.error('Failed to update user pattern:', error);
    return null;
  }
}

/**
 * Check if a new rule should be suggested
 */
async function checkForRuleSuggestion(feedbackHistory) {
  // If same correction has been made 3+ times, suggest a rule
  const threshold = 3;

  try {
    const recentFeedback = await db
      .collection(FEEDBACK_COLLECTION)
      .where('corrected_classification.clientId', '==', feedbackHistory.correctedClassification.clientId)
      .where('corrected_classification.projectId', '==', feedbackHistory.correctedClassification.projectId)
      .orderBy('created_at', 'desc')
      .limit(10)
      .get();

    if (recentFeedback.size >= threshold) {
      return {
        suggest: true,
        reason: `Similar correction made ${recentFeedback.size} times`,
        suggestedRule: {
          name: `Auto-suggested: ${feedbackHistory.correctedClassification.clientName || 'Classification'} Rule`,
          description: 'Rule suggested based on repeated user corrections',
          conditions: {
            operator: 'OR',
            rules: [
              // Add conditions based on meeting patterns
            ],
          },
          actions: {
            classify_as: feedbackHistory.correctedClassification.type,
            client_id: feedbackHistory.correctedClassification.clientId,
            project_id: feedbackHistory.correctedClassification.projectId,
          },
        },
      };
    }
  } catch (error) {
    // Index might not exist yet, return no suggestion
    console.log('Could not check for rule suggestion:', error.message);
  }

  return { suggest: false };
}

/**
 * Update note metadata with corrected classification
 */
async function updateNoteClassification(noteId, correctedClassification, userEmail) {
  if (!noteId) return;

  try {
    const noteRef = db.collection(NOTES_COLLECTION).doc(noteId);
    const noteDoc = await noteRef.get();

    if (noteDoc.exists) {
      await noteRef.update({
        'classification.type': correctedClassification.type,
        'classification.client_id': correctedClassification.clientId || null,
        'classification.client_name': correctedClassification.clientName || null,
        'classification.project_id': correctedClassification.projectId || null,
        'classification.project_name': correctedClassification.projectName || null,
        'classification.internal_team': correctedClassification.internalTeam || null,
        'classification.user_confirmed': true,
        'classification.confirmed_by': userEmail,
        'classification.confirmed_at': FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        updated_by: userEmail,
      });
    }
  } catch (error) {
    console.error('Failed to update note classification:', error);
  }
}

/**
 * Main feedback function
 */
async function recordFeedback(params) {
  const {
    noteId,
    originalClassification,
    correctedClassification,
    meeting,
    userEmail,
  } = params;

  // Determine correction type
  const correctionTypes = determineCorrectionType(originalClassification, correctedClassification);

  // Create feedback record
  const feedbackData = {
    noteId,
    originalClassification: {
      type: originalClassification.type,
      clientId: originalClassification.clientId || null,
      clientName: originalClassification.clientName || null,
      projectId: originalClassification.projectId || null,
      projectName: originalClassification.projectName || null,
      internalTeam: originalClassification.internalTeam || null,
      confidence: originalClassification.confidence || 0,
      ruleId: originalClassification.ruleId || null,
    },
    correctedClassification: {
      type: correctedClassification.type,
      clientId: correctedClassification.clientId || null,
      clientName: correctedClassification.clientName || null,
      projectId: correctedClassification.projectId || null,
      projectName: correctedClassification.projectName || null,
      internalTeam: correctedClassification.internalTeam || null,
    },
    correctionTypes,
    meeting: meeting
      ? {
          title: meeting.title,
          attendees:
            meeting.attendees?.map((a) => (typeof a === 'string' ? a : a?.email)).filter(Boolean) ||
            [],
        }
      : null,
    userEmail,
    created_at: FieldValue.serverTimestamp(),
  };

  // Save feedback
  const feedbackRef = await db.collection(FEEDBACK_COLLECTION).add(feedbackData);

  // Update rule stats if a rule was involved
  if (originalClassification.ruleId) {
    await updateRuleStats(originalClassification.ruleId);
  }

  // Update user learned patterns
  let patternUpdated = null;
  if (meeting) {
    patternUpdated = await updateUserPattern(userEmail, meeting, correctedClassification);
  }

  // Update note with corrected classification
  if (noteId) {
    await updateNoteClassification(noteId, correctedClassification, userEmail);
  }

  // Check if we should suggest a new rule
  const ruleSuggestion = await checkForRuleSuggestion(feedbackData);

  return {
    success: true,
    feedbackId: feedbackRef.id,
    correctionTypes,
    patternUpdated: patternUpdated !== null,
    newRuleSuggested: ruleSuggestion.suggest,
    ruleSuggestion: ruleSuggestion.suggest ? ruleSuggestion : undefined,
  };
}

async function assertUserCanAccessNote(noteId, userEmail) {
  if (!noteId) return;
  const noteRef = db.collection(NOTES_COLLECTION).doc(noteId);
  const noteDoc = await noteRef.get();
  if (!noteDoc.exists) {
    throw new Error('Note not found');
  }

  if (!canUserAccessNote(noteDoc.data(), userEmail)) {
    const permissionError = new Error('Not authorized for this note');
    permissionError.code = 403;
    throw permissionError;
  }
}

/**
 * HTTP Cloud Function entry point
 */
functions.http('feedback', async (req, res) => {
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
      originalClassification,
      correctedClassification,
      meeting,
      userEmail: requestUserEmail,
      user, // Legacy field name
    } = req.body;

    // Validate required fields
    if (!requestUserEmail && !user) {
      res.status(400).json({ error: 'Missing required field: userEmail' });
      return;
    }

    if (!isEgenAiEmail(authContext.email)) {
      res.status(403).json({ error: 'User email must be @egen.ai' });
      return;
    }

    if (!originalClassification) {
      res.status(400).json({ error: 'Missing required field: originalClassification' });
      return;
    }

    if (!correctedClassification) {
      res.status(400).json({ error: 'Missing required field: correctedClassification' });
      return;
    }

    await assertUserCanAccessNote(noteId, authContext.email);

    // Record feedback
    const result = await recordFeedback({
      noteId,
      originalClassification,
      correctedClassification,
      meeting,
      userEmail: authContext.email,
    });

    res.status(200).json(result);

  } catch (error) {
    console.error('Feedback error:', error);

    if (error.code === 403) {
      res.status(403).json({ error: error.message });
      return;
    }

    if (error.message === 'Note not found') {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// Export for testing
module.exports = { recordFeedback };
