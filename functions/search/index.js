/**
 * Egen Meeting Notes - /search Cloud Function
 * Full-text search across all notes
 */

const functions = require('@google-cloud/functions-framework');
const { Firestore } = require('@google-cloud/firestore');

// Initialize Firestore
const db = new Firestore();

// Notes metadata collection
const NOTES_COLLECTION = 'notes_metadata';

/**
 * Search notes by query string
 * Searches across title, summary, content, and action items
 */
async function searchNotes(query, options = {}) {
  const {
    userEmail,
    limit = 50,
    includeContent = false,
    filters = {},
  } = options;

  // Get all notes (in production, you'd want to use a proper search index)
  const notesRef = db.collection(NOTES_COLLECTION);
  let q = notesRef.orderBy('created_at', 'desc').limit(500);

  const snapshot = await q.get();
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(Boolean);

  const results = [];

  for (const doc of snapshot.docs) {
    const note = { id: doc.id, ...doc.data() };

    // Build searchable text
    const searchableFields = [
      note.meeting?.title || note.title || '',
      note.summary || note.enhanced_analysis?.summary || '',
      note.meeting?.description || '',
      note.classification?.client_name || '',
      note.classification?.project_name || '',
      ...(note.action_items || []).map(i => i.task),
      ...(note.key_decisions || []).map(d => d.decision),
      ...(note.tags || []),
    ];

    if (includeContent && note.content) {
      searchableFields.push(note.content);
    }

    const searchText = searchableFields.join(' ').toLowerCase();

    // Check if all query terms are found
    const matchesAll = queryTerms.every(term => searchText.includes(term));

    if (!matchesAll) continue;

    // Apply additional filters
    if (filters.type && note.classification?.type !== filters.type) continue;
    if (filters.clientId && note.classification?.client_id !== filters.clientId) continue;
    if (filters.attendeeEmail) {
      const hasAttendee = (note.meeting?.attendees || []).some(
        a => a.email?.toLowerCase() === filters.attendeeEmail.toLowerCase()
      );
      if (!hasAttendee) continue;
    }
    if (filters.dateFrom) {
      const noteDate = note.meeting?.start_time?.toDate?.() || note.created_at?.toDate?.();
      if (noteDate && noteDate < new Date(filters.dateFrom)) continue;
    }
    if (filters.dateTo) {
      const noteDate = note.meeting?.start_time?.toDate?.() || note.created_at?.toDate?.();
      if (noteDate && noteDate > new Date(filters.dateTo)) continue;
    }

    // Calculate relevance score based on where matches occur
    let score = 0;
    const title = (note.meeting?.title || note.title || '').toLowerCase();
    const summary = (note.summary || note.enhanced_analysis?.summary || '').toLowerCase();

    queryTerms.forEach(term => {
      if (title.includes(term)) score += 10;
      if (summary.includes(term)) score += 5;
      if ((note.classification?.client_name || '').toLowerCase().includes(term)) score += 3;
      if ((note.classification?.project_name || '').toLowerCase().includes(term)) score += 3;
    });

    // Calculate snippets showing matches
    const snippets = [];
    const snippetLength = 150;

    searchableFields.forEach(field => {
      if (!field) return;
      const fieldLower = field.toLowerCase();
      queryTerms.forEach(term => {
        const idx = fieldLower.indexOf(term);
        if (idx !== -1) {
          const start = Math.max(0, idx - 50);
          const end = Math.min(field.length, idx + term.length + 100);
          let snippet = field.substring(start, end);
          if (start > 0) snippet = '...' + snippet;
          if (end < field.length) snippet = snippet + '...';
          if (!snippets.includes(snippet) && snippets.length < 3) {
            snippets.push(snippet);
          }
        }
      });
    });

    results.push({
      id: note.id,
      title: note.meeting?.title || note.title || 'Untitled',
      date: note.meeting?.start_time || note.created_at,
      client: note.classification?.client_name,
      project: note.classification?.project_name,
      type: note.classification?.type || 'uncategorized',
      summary: note.summary || note.enhanced_analysis?.summary,
      snippets,
      score,
    });
  }

  // Sort by relevance score
  results.sort((a, b) => b.score - a.score);

  return {
    results: results.slice(0, limit),
    total: results.length,
    query,
    took: Date.now(), // Would calculate actual time in production
  };
}

/**
 * HTTP Cloud Function entry point
 */
functions.http('search', async (req, res) => {
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
    // Support both GET and POST
    const params = req.method === 'GET' ? req.query : req.body;
    const {
      q,
      query = q,
      limit = 50,
      include_content = false,
      type,
      client_id,
      attendee_email,
      date_from,
      date_to,
      user_email,
    } = params;

    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      res.status(400).json({
        error: 'Query must be at least 2 characters',
        results: [],
        total: 0,
      });
      return;
    }

    const options = {
      userEmail: user_email,
      limit: parseInt(limit, 10) || 50,
      includeContent: include_content === true || include_content === 'true',
      filters: {
        type,
        clientId: client_id,
        attendeeEmail: attendee_email,
        dateFrom: date_from,
        dateTo: date_to,
      },
    };

    const results = await searchNotes(query.trim(), options);

    res.status(200).json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error.message,
      results: [],
      total: 0,
    });
  }
});

module.exports = { searchNotes };
