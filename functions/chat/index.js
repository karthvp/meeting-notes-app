/**
 * Egen Meeting Notes - /chat Cloud Function
 * AI-powered chat about meeting notes using RAG approach
 */

const functions = require('@google-cloud/functions-framework');
const { Firestore } = require('@google-cloud/firestore');
const { VertexAI } = require('@google-cloud/vertexai');

// Initialize Firestore
const db = new Firestore();

// Initialize Vertex AI
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'karthik-patil-sandbox';
const LOCATION = 'us-central1';
const vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });

// Use Gemini 2.0 Flash for chat
const generativeModel = vertexAI.getGenerativeModel({
  model: 'gemini-2.0-flash-001',
  generationConfig: {
    temperature: 0.3,
    maxOutputTokens: 2048,
  },
});

// Collections
const NOTES_COLLECTION = 'notes_metadata';
const CHAT_SESSIONS_COLLECTION = 'chat_sessions';

/**
 * Find relevant notes based on query
 */
async function findRelevantNotes(query, userEmail, limit = 10) {
  const notesRef = db.collection(NOTES_COLLECTION);
  const snapshot = await notesRef
    .orderBy('created_at', 'desc')
    .limit(100)
    .get();

  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

  const scoredNotes = [];

  for (const doc of snapshot.docs) {
    const note = { id: doc.id, ...doc.data() };

    // Build searchable content
    const title = (note.meeting?.title || note.title || '').toLowerCase();
    const summary = (note.summary || note.enhanced_analysis?.summary || '').toLowerCase();
    const actionItems = (note.action_items || note.enhanced_analysis?.action_items || [])
      .map((i) => i.task.toLowerCase())
      .join(' ');
    const decisions = (note.key_decisions || note.enhanced_analysis?.key_decisions || [])
      .map((d) => d.decision.toLowerCase())
      .join(' ');
    const client = (note.classification?.client_name || '').toLowerCase();
    const project = (note.classification?.project_name || '').toLowerCase();

    const searchText = `${title} ${summary} ${actionItems} ${decisions} ${client} ${project}`;

    // Calculate relevance score
    let score = 0;
    queryTerms.forEach((term) => {
      if (title.includes(term)) score += 5;
      if (summary.includes(term)) score += 3;
      if (client.includes(term)) score += 4;
      if (project.includes(term)) score += 4;
      if (actionItems.includes(term)) score += 2;
      if (decisions.includes(term)) score += 2;
    });

    if (score > 0) {
      scoredNotes.push({ note, score });
    }
  }

  // Sort by score and return top matches
  scoredNotes.sort((a, b) => b.score - a.score);
  return scoredNotes.slice(0, limit).map((s) => s.note);
}

/**
 * Format notes as context for AI
 */
function formatNotesAsContext(notes) {
  return notes
    .map((note, i) => {
      const title = note.meeting?.title || note.title || 'Untitled';
      const date = note.meeting?.start_time
        ? new Date(note.meeting.start_time._seconds * 1000).toLocaleDateString()
        : 'Unknown date';
      const client = note.classification?.client_name || 'N/A';
      const project = note.classification?.project_name || 'N/A';
      const summary = note.summary || note.enhanced_analysis?.summary || 'No summary';
      const actionItems = (note.action_items || note.enhanced_analysis?.action_items || [])
        .map((i) => `- ${i.task} (${i.status})`)
        .join('\n');
      const decisions = (note.key_decisions || note.enhanced_analysis?.key_decisions || [])
        .map((d) => `- ${d.decision}`)
        .join('\n');

      return `
### Meeting ${i + 1}: ${title}
- Date: ${date}
- Client: ${client}
- Project: ${project}

**Summary:** ${summary}

${actionItems ? `**Action Items:**\n${actionItems}` : ''}
${decisions ? `**Key Decisions:**\n${decisions}` : ''}
`;
    })
    .join('\n---\n');
}

/**
 * Build the chat prompt
 */
function buildChatPrompt(query, notesContext, conversationHistory) {
  const historyText = conversationHistory
    .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');

  return `You are an AI assistant helping users understand their meeting notes from Egen Solutions.
You have access to the following meeting notes as context:

${notesContext}

${historyText ? `Previous conversation:\n${historyText}\n\n` : ''}

User's question: ${query}

Instructions:
- Answer questions based on the meeting notes provided
- If the information isn't in the notes, say so clearly
- Reference specific meetings when relevant (e.g., "In the meeting on [date]...")
- Be concise but thorough
- If asked about action items, list them with their status
- If asked about decisions, explain the context

Respond in a helpful, conversational manner:`;
}

/**
 * Generate chat response
 */
async function generateResponse(query, notesContext, conversationHistory) {
  const prompt = buildChatPrompt(query, notesContext, conversationHistory);

  const result = await generativeModel.generateContent(prompt);
  const response = result.response;
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

  return text || "I couldn't generate a response. Please try again.";
}

/**
 * Save chat session to Firestore
 */
async function saveChatMessage(sessionId, message) {
  const sessionRef = db.collection(CHAT_SESSIONS_COLLECTION).doc(sessionId);
  const sessionDoc = await sessionRef.get();

  if (sessionDoc.exists) {
    await sessionRef.update({
      messages: Firestore.FieldValue.arrayUnion(message),
      updated_at: Firestore.Timestamp.now(),
    });
  } else {
    await sessionRef.set({
      messages: [message],
      created_at: Firestore.Timestamp.now(),
      updated_at: Firestore.Timestamp.now(),
    });
  }
}

/**
 * Get chat history
 */
async function getChatHistory(sessionId) {
  const sessionRef = db.collection(CHAT_SESSIONS_COLLECTION).doc(sessionId);
  const sessionDoc = await sessionRef.get();

  if (!sessionDoc.exists) {
    return [];
  }

  return sessionDoc.data().messages || [];
}

/**
 * HTTP Cloud Function entry point
 */
functions.http('chat', async (req, res) => {
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
    const { query, session_id, user_email, include_history = true } = req.body;

    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      res.status(400).json({ error: 'Query must be at least 2 characters' });
      return;
    }

    const sessionId = session_id || `session_${Date.now()}`;

    // Get conversation history if requested
    const history = include_history ? await getChatHistory(sessionId) : [];

    // Find relevant notes
    const relevantNotes = await findRelevantNotes(query.trim(), user_email);

    if (relevantNotes.length === 0) {
      const noDataResponse = "I couldn't find any meeting notes related to your question. Try asking about specific meetings, clients, projects, or action items.";

      // Save messages
      await saveChatMessage(sessionId, { role: 'user', content: query, timestamp: new Date().toISOString() });
      await saveChatMessage(sessionId, { role: 'assistant', content: noDataResponse, timestamp: new Date().toISOString() });

      res.status(200).json({
        response: noDataResponse,
        session_id: sessionId,
        sources: [],
      });
      return;
    }

    // Format notes as context
    const notesContext = formatNotesAsContext(relevantNotes);

    // Generate response
    const aiResponse = await generateResponse(query.trim(), notesContext, history);

    // Save messages
    await saveChatMessage(sessionId, { role: 'user', content: query, timestamp: new Date().toISOString() });
    await saveChatMessage(sessionId, { role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() });

    // Return response with source references
    const sources = relevantNotes.map((note) => ({
      id: note.id,
      title: note.meeting?.title || note.title || 'Untitled',
      date: note.meeting?.start_time
        ? new Date(note.meeting.start_time._seconds * 1000).toISOString()
        : null,
      client: note.classification?.client_name,
    }));

    res.status(200).json({
      response: aiResponse,
      session_id: sessionId,
      sources,
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to generate response',
      message: error.message,
    });
  }
});

module.exports = { generateResponse, findRelevantNotes };
