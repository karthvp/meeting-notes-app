/**
 * Egen Meeting Notes - /classify Cloud Function
 * Phase 2: Gemini AI-powered classification with rule-based fallback
 *
 * This function classifies meeting notes using:
 * 1. Gemini AI for intelligent classification
 * 2. Rule-based fallback if AI fails
 * 3. Known clients/projects context for accurate matching
 */

const functions = require('@google-cloud/functions-framework');
const { Firestore } = require('@google-cloud/firestore');
const { VertexAI } = require('@google-cloud/vertexai');

// Configuration
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'karthik-patil-sandbox';
const LOCATION = 'us-central1';

// Lazy initialization for better cold start performance
let _db = null;
let _vertexAI = null;
let _generativeModel = null;

function getDb() {
  if (!_db) {
    _db = new Firestore();
  }
  return _db;
}

function getVertexAI() {
  if (!_vertexAI) {
    _vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });
  }
  return _vertexAI;
}

function getGenerativeModel() {
  if (!_generativeModel) {
    const vertexAI = getVertexAI();
    _generativeModel = vertexAI.getGenerativeModel({
      model: 'gemini-2.0-flash-001',
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent classification
        maxOutputTokens: 1024,
      },
    });
  }
  return _generativeModel;
}


// Collections
const CLIENTS_COLLECTION = 'clients';
const PROJECTS_COLLECTION = 'projects';
const RULES_COLLECTION = 'rules';

/**
 * Extract domains from email addresses
 */
function extractDomains(emails) {
  return [...new Set(emails.map(email => email.split('@')[1]?.toLowerCase()).filter(Boolean))];
}

/**
 * Check if all attendees are internal (egen.com)
 */
function areAllAttendeesInternal(attendees) {
  return attendees.every(a => a.email?.toLowerCase().endsWith('@egen.com'));
}

/**
 * Check if text contains any of the keywords (case-insensitive)
 */
function containsKeywords(text, keywords) {
  if (!text || !keywords || keywords.length === 0) return false;
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Fetch all active clients with their data
 */
async function getActiveClients() {
  const db = getDb();
  const snapshot = await db.collection(CLIENTS_COLLECTION)
    .where('status', '==', 'active')
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * Fetch all active projects
 */
async function getActiveProjects() {
  const db = getDb();
  const snapshot = await db.collection(PROJECTS_COLLECTION)
    .where('status', '==', 'active')
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * Build the Gemini prompt with context
 */
function buildGeminiPrompt(meeting, clients, projects, attendeeDomains) {
  const clientContext = clients.map(c => ({
    id: c.id,
    name: c.name,
    domains: c.domains || [],
    keywords: c.keywords || [],
  }));

  const projectContext = projects.map(p => ({
    id: p.id,
    name: p.project_name,
    client_id: p.client_id,
    keywords: p.keywords || [],
  }));

  const attendeeList = meeting.attendees?.map(a =>
    `${a.name || 'Unknown'} <${a.email}>`
  ).join(', ') || 'No attendees';

  const prompt = `You are a meeting classification assistant for Egen Solutions (domain: egen.com).
Classify the following meeting based on the context provided.

## Known Clients
${JSON.stringify(clientContext, null, 2)}

## Known Projects (by client_id)
${JSON.stringify(projectContext, null, 2)}

## Meeting to Classify
- Title: ${meeting.title || 'No title'}
- Description: ${meeting.description || 'No description'}
- Organizer: ${meeting.organizer || 'Unknown'}
- Attendees: ${attendeeList}
- Attendee Domains (external): ${attendeeDomains.filter(d => d !== 'egen.com').join(', ') || 'None'}

## Classification Rules
1. If any attendee email domain matches a client's domains, classify as "client" meeting
2. If meeting title/description contains client keywords, classify as "client" meeting
3. If all attendees are from egen.com, classify as "internal" meeting
4. If external attendees but no client match, classify as "external" meeting
5. Look for project keywords in title/description to identify specific project

## Response Format
Respond with ONLY a JSON object (no markdown, no explanation before/after):
{
  "type": "client" | "internal" | "external" | "uncategorized",
  "client_id": "matching_client_id_or_null",
  "client_name": "matching_client_name_or_null",
  "project_id": "matching_project_id_or_null",
  "project_name": "matching_project_name_or_null",
  "internal_team": "Engineering" | "Sales" | "All Hands" | null,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this classification was chosen"
}`;

  return prompt;
}

/**
 * Build prompt for enhanced note analysis (summary, action items, key decisions)
 */
function buildEnhancedAnalysisPrompt(meeting, noteContent) {
  const attendeeList = meeting.attendees?.map(a =>
    `${a.name || 'Unknown'} <${a.email}>`
  ).join(', ') || 'No attendees';

  const content = noteContent || meeting.description || '';

  const prompt = `You are an AI assistant that analyzes meeting notes to extract key information.

## Meeting Information
- Title: ${meeting.title || 'Untitled Meeting'}
- Date: ${meeting.start_time || 'Unknown'}
- Organizer: ${meeting.organizer || 'Unknown'}
- Attendees: ${attendeeList}

## Meeting Notes/Description
${content || 'No content provided'}

## Your Task
Analyze the meeting information and extract:

1. **Summary**: Write a concise 2-3 sentence summary of what the meeting was about and key outcomes.

2. **Action Items**: Extract any action items, tasks, or follow-ups mentioned. For each, identify:
   - The task description
   - Who is assigned (if mentioned, use email or name from attendees)
   - Due date (if mentioned)
   - Priority (high/medium/low based on context)

3. **Key Decisions**: Extract any decisions that were made during the meeting.

## Response Format
Respond with ONLY a JSON object (no markdown, no explanation):
{
  "summary": "Concise 2-3 sentence meeting summary",
  "action_items": [
    {
      "id": "ai_1",
      "task": "Description of the action item",
      "assignee": "email@example.com or null",
      "assignee_name": "Person Name or null",
      "due_date": "YYYY-MM-DD or null",
      "priority": "high" | "medium" | "low",
      "status": "pending"
    }
  ],
  "key_decisions": [
    {
      "id": "kd_1",
      "decision": "What was decided",
      "context": "Brief context or rationale",
      "decided_by": "Who made or approved the decision (if known)"
    }
  ]
}

If no action items or decisions are found, return empty arrays.
If there's not enough content to generate a meaningful summary, return a brief description based on the title.`;

  return prompt;
}

/**
 * Parse enhanced analysis response
 */
function parseEnhancedAnalysisResponse(responseText) {
  try {
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);

    return {
      success: true,
      data: {
        summary: parsed.summary || null,
        action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
        key_decisions: Array.isArray(parsed.key_decisions) ? parsed.key_decisions : [],
      }
    };
  } catch (error) {
    console.error('Failed to parse enhanced analysis response:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Call Gemini for enhanced note analysis
 */
async function analyzeNoteContent(meeting, noteContent) {
  try {
    const prompt = buildEnhancedAnalysisPrompt(meeting, noteContent);
    const model = getGenerativeModel();
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No text in Gemini response for analysis');
    }

    const parsed = parseEnhancedAnalysisResponse(text);

    if (parsed.success) {
      return {
        success: true,
        ...parsed.data,
      };
    } else {
      throw new Error(parsed.error);
    }
  } catch (error) {
    console.error('Enhanced analysis failed:', error.message);
    return {
      success: false,
      summary: null,
      action_items: [],
      key_decisions: [],
      error: error.message,
    };
  }
}

/**
 * Parse Gemini response safely
 */
function parseGeminiResponse(responseText) {
  try {
    // Clean up the response - remove markdown code blocks if present
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (!parsed.type || typeof parsed.confidence !== 'number') {
      throw new Error('Missing required fields in AI response');
    }

    return {
      success: true,
      data: {
        type: parsed.type,
        client: parsed.client_id ? {
          id: parsed.client_id,
          name: parsed.client_name || null,
        } : null,
        project: parsed.project_id ? {
          id: parsed.project_id,
          name: parsed.project_name || null,
        } : null,
        internal_team: parsed.internal_team || null,
        confidence: Math.min(0.99, Math.max(0, parsed.confidence)),
        ai_reasoning: parsed.reasoning || null,
      }
    };
  } catch (error) {
    console.error('Failed to parse Gemini response:', error.message);
    console.error('Raw response:', responseText);
    return { success: false, error: error.message };
  }
}

/**
 * Call Gemini for classification
 */
async function classifyWithGemini(meeting, clients, projects, attendeeDomains) {
  try {
    const prompt = buildGeminiPrompt(meeting, clients, projects, attendeeDomains);
    const model = getGenerativeModel();
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No text in Gemini response');
    }

    const parsed = parseGeminiResponse(text);

    if (parsed.success) {
      return {
        success: true,
        classification: parsed.data,
        usedAI: true,
      };
    } else {
      throw new Error(parsed.error);
    }
  } catch (error) {
    console.error('Gemini classification failed:', error.message);
    return {
      success: false,
      error: error.message,
      usedAI: false,
    };
  }
}

// ============================================================
// Rule-based fallback functions (existing logic)
// ============================================================

/**
 * Find matching client by attendee domains
 */
async function findClientByDomain(domains, clients) {
  if (!domains || domains.length === 0) return null;

  for (const client of clients) {
    const clientDomains = client.domains || [];
    const matchingDomain = domains.find(d => clientDomains.includes(d));
    if (matchingDomain) {
      return { ...client, matchedDomain: matchingDomain };
    }
  }

  return null;
}

/**
 * Find matching client by title keywords
 */
function findClientByKeywords(title, clients) {
  if (!title) return null;

  for (const client of clients) {
    if (containsKeywords(title, client.keywords)) {
      return { ...client, matchedBy: 'keywords' };
    }
  }

  return null;
}

/**
 * Find matching project for a client
 */
function findProject(clientId, title, description, projects) {
  if (!clientId) return null;

  const clientProjects = projects.filter(p => p.client_id === clientId);
  const searchText = `${title || ''} ${description || ''}`;

  // First try to match by keywords
  for (const project of clientProjects) {
    if (containsKeywords(searchText, project.keywords)) {
      return { ...project, matchedBy: 'keywords' };
    }
  }

  // If only one project exists, return it as default
  if (clientProjects.length === 1) {
    return { ...clientProjects[0], matchedBy: 'default' };
  }

  return null;
}

/**
 * Load and apply classification rules
 * Returns the matched rule along with any auto-share configuration
 */
async function applyRules(meeting, attendeeDomains) {
  const db = getDb();
  const rulesSnapshot = await db.collection(RULES_COLLECTION)
    .where('status', '==', 'active')
    .orderBy('priority', 'desc')
    .get();

  for (const doc of rulesSnapshot.docs) {
    const rule = doc.data();
    const ruleId = doc.id;

    if (evaluateRule(rule, meeting, attendeeDomains)) {
      // Extract auto-share config if present
      const autoShare = rule.actions?.share_with?.length > 0 ? {
        emails: rule.actions.share_with,
        permission: 'reader',
        triggered_by_rule: ruleId,
      } : null;

      return { rule, ruleId, autoShare };
    }
  }

  return null;
}

/**
 * Evaluate a single rule against meeting data
 */
function evaluateRule(rule, meeting, attendeeDomains) {
  const conditions = rule.conditions;
  if (!conditions || !conditions.rules) return false;

  const results = conditions.rules.map(condition =>
    evaluateCondition(condition, meeting, attendeeDomains)
  );

  if (conditions.operator === 'AND') {
    return results.every(r => r);
  } else {
    return results.some(r => r);
  }
}

/**
 * Evaluate a single condition
 */
function evaluateCondition(condition, meeting, attendeeDomains) {
  const { field, operator, value } = condition;

  switch (field) {
    case 'title':
      return evaluateTextCondition(meeting.title, operator, value);

    case 'description':
      return evaluateTextCondition(meeting.description, operator, value);

    case 'attendee_domains':
      if (operator === 'contains' || operator === 'intersects') {
        return attendeeDomains.some(d => value.includes?.(d) || d === value);
      }
      return false;

    case 'all_attendees_domain':
      if (operator === 'equals') {
        return attendeeDomains.length > 0 &&
          attendeeDomains.every(d => d === value);
      }
      return false;

    case 'organizer':
      if (operator === 'equals') {
        return meeting.organizer?.toLowerCase() === value.toLowerCase();
      }
      if (operator === 'ends_with') {
        return meeting.organizer?.toLowerCase().endsWith(value.toLowerCase());
      }
      return false;

    default:
      return false;
  }
}

/**
 * Evaluate text-based conditions
 */
function evaluateTextCondition(text, operator, value) {
  if (!text) return false;
  const lowerText = text.toLowerCase();

  switch (operator) {
    case 'contains':
      return lowerText.includes(value.toLowerCase());

    case 'contains_any':
      return Array.isArray(value) &&
        value.some(v => lowerText.includes(v.toLowerCase()));

    case 'equals':
      return lowerText === value.toLowerCase();

    case 'starts_with':
      return lowerText.startsWith(value.toLowerCase());

    default:
      return false;
  }
}

/**
 * Detect internal team based on meeting context
 */
function detectInternalTeam(meeting) {
  const title = (meeting.title || '').toLowerCase();
  const description = (meeting.description || '').toLowerCase();
  const searchText = `${title} ${description}`;

  if (/standup|sprint|retro|architecture|code review|tech|engineering|developer/.test(searchText)) {
    return 'Engineering';
  }

  if (/pipeline|opportunity|deal|prospect|sales|revenue|quota/.test(searchText)) {
    return 'Sales';
  }

  if (/all hands|company|town hall|quarterly/.test(searchText)) {
    return 'All Hands';
  }

  return null;
}

/**
 * Rule-based classification (fallback)
 */
async function classifyWithRules(meeting, clients, projects, attendeeDomains, externalDomains, allInternal) {
  const matchInfo = {
    allInternal,
    clientMatchedBy: null,
    projectMatchedBy: null,
    ruleConfidenceBoost: 0,
    type: 'uncategorized',
  };

  const result = {
    type: 'uncategorized',
    client: null,
    project: null,
    internal_team: null,
    confidence: 0.5,
    matched_rule_id: null,
  };

  // Step 1: Try to apply rules first
  const ruleMatch = await applyRules(meeting, attendeeDomains);
  if (ruleMatch) {
    matchInfo.ruleConfidenceBoost = ruleMatch.rule.confidence_boost || 0;
    result.matched_rule_id = ruleMatch.ruleId;

    const actions = ruleMatch.rule.actions;
    if (actions.classify_as) {
      matchInfo.type = actions.classify_as;
      result.type = actions.classify_as;
    }
    if (actions.team) {
      result.internal_team = actions.team;
    }
  }

  // Step 2: Try to find client by domain
  if (result.type !== 'internal' && externalDomains.length > 0) {
    const clientByDomain = await findClientByDomain(externalDomains, clients);
    if (clientByDomain) {
      matchInfo.clientMatchedBy = 'domain';
      matchInfo.type = 'client';
      result.type = 'client';
      result.client = {
        id: clientByDomain.id,
        name: clientByDomain.name,
      };

      const project = findProject(clientByDomain.id, meeting.title, meeting.description, projects);
      if (project) {
        matchInfo.projectMatchedBy = project.matchedBy;
        result.project = {
          id: project.id,
          name: project.project_name,
        };
      }
    }
  }

  // Step 3: Try to find client by keywords
  if (!result.client) {
    const clientByKeywords = findClientByKeywords(meeting.title, clients);
    if (clientByKeywords) {
      matchInfo.clientMatchedBy = 'keywords';
      matchInfo.type = 'client';
      result.type = 'client';
      result.client = {
        id: clientByKeywords.id,
        name: clientByKeywords.name,
      };

      const project = findProject(clientByKeywords.id, meeting.title, meeting.description, projects);
      if (project) {
        matchInfo.projectMatchedBy = project.matchedBy;
        result.project = {
          id: project.id,
          name: project.project_name,
        };
      }
    }
  }

  // Step 4: If all internal, classify as internal meeting
  if (allInternal && result.type === 'uncategorized') {
    matchInfo.type = 'internal';
    result.type = 'internal';
    result.internal_team = detectInternalTeam(meeting);
  }

  // Step 5: If has external non-client attendees, classify as external
  if (externalDomains.length > 0 && result.type === 'uncategorized') {
    matchInfo.type = 'external';
    result.type = 'external';
  }

  // Calculate confidence
  let confidence = 0.5;
  if (matchInfo.clientMatchedBy === 'domain') confidence += 0.30;
  if (matchInfo.clientMatchedBy === 'keywords') confidence += 0.20;
  if (matchInfo.projectMatchedBy === 'keywords') confidence += 0.15;
  else if (matchInfo.projectMatchedBy === 'default') confidence += 0.05;
  if (matchInfo.ruleConfidenceBoost) confidence += matchInfo.ruleConfidenceBoost;
  if (matchInfo.allInternal && matchInfo.type === 'internal') confidence += 0.20;

  result.confidence = Math.min(0.99, confidence);

  return { result, matchInfo };
}

/**
 * Main classify function
 */
async function classify(meeting, noteFileId, noteContent = null) {
  const attendees = meeting.attendees || [];
  const attendeeEmails = attendees.map(a => a.email).filter(Boolean);
  const attendeeDomains = extractDomains(attendeeEmails);
  const externalDomains = attendeeDomains.filter(d => d !== 'egen.com');
  const allInternal = areAllAttendeesInternal(attendees);

  // Fetch clients and projects for context
  const [clients, projects] = await Promise.all([
    getActiveClients(),
    getActiveProjects(),
  ]);

  // Result object
  const result = {
    classification: {
      type: 'uncategorized',
      client: null,
      project: null,
      internal_team: null,
      confidence: 0.5,
      matched_rule_id: null,
      ai_reasoning: null,
    },
    suggested_actions: {
      folder_path: 'Meeting Notes/_Uncategorized',
      folder_id: null,
      share_with: [],
      tags: [],
    },
    auto_apply: false,
    auto_share: null, // Auto-sharing config from matched rules
    match_info: {},
    classification_method: 'none',
    // Enhanced analysis fields
    enhanced_analysis: {
      summary: null,
      action_items: [],
      key_decisions: [],
    },
  };

  // Try Gemini AI classification first
  const geminiResult = await classifyWithGemini(meeting, clients, projects, attendeeDomains);

  if (geminiResult.success) {
    // Use AI classification
    result.classification = {
      ...geminiResult.classification,
      matched_rule_id: null,
    };
    result.classification_method = 'gemini_ai';
    result.match_info = {
      allInternal,
      usedAI: true,
      aiConfidence: geminiResult.classification.confidence,
    };
  } else {
    // Fall back to rule-based classification
    console.log('Falling back to rule-based classification');
    const ruleResult = await classifyWithRules(
      meeting, clients, projects, attendeeDomains, externalDomains, allInternal
    );

    result.classification = {
      ...ruleResult.result,
      ai_reasoning: `Rule-based fallback: ${geminiResult.error || 'AI classification failed'}`,
    };
    result.classification_method = 'rule_based';
    result.match_info = {
      ...ruleResult.matchInfo,
      usedAI: false,
      aiFallbackReason: geminiResult.error,
    };
  }

  // Set folder path based on classification
  if (result.classification.type === 'client' && result.classification.client) {
    const clientName = result.classification.client.name;
    const projectName = result.classification.project?.name;
    if (projectName) {
      result.suggested_actions.folder_path = `Meeting Notes/Clients/${clientName}/${projectName}`;
    } else {
      result.suggested_actions.folder_path = `Meeting Notes/Clients/${clientName}`;
    }
  } else if (result.classification.type === 'internal') {
    const team = result.classification.internal_team;
    result.suggested_actions.folder_path = team
      ? `Meeting Notes/Internal/${team}`
      : 'Meeting Notes/Internal';
  } else if (result.classification.type === 'external') {
    result.suggested_actions.folder_path = 'Meeting Notes/External';
  }

  // Determine if should auto-apply (high confidence)
  result.auto_apply = result.classification.confidence >= 0.90;

  // Add internal attendees to share suggestions
  const internalAttendees = attendees
    .filter(a => a.email?.endsWith('@egen.com'))
    .map(a => ({ email: a.email, role: 'attendee', name: a.name }));
  result.suggested_actions.share_with = internalAttendees;

  // Deduplicate share_with by email
  const seenEmails = new Set();
  result.suggested_actions.share_with = result.suggested_actions.share_with.filter(s => {
    if (seenEmails.has(s.email)) return false;
    seenEmails.add(s.email);
    return true;
  });

  // Check for auto-share from matching rules (if confidence > 90%)
  // This happens for both AI and rule-based classification
  if (result.classification.confidence >= 0.90) {
    const ruleMatch = await applyRules(meeting, attendeeDomains);
    if (ruleMatch?.autoShare) {
      result.auto_share = ruleMatch.autoShare;
      // Add rule-triggered shares to suggestions as well
      const ruleShareEmails = ruleMatch.autoShare.emails || [];
      for (const email of ruleShareEmails) {
        if (!seenEmails.has(email)) {
          result.suggested_actions.share_with.push({
            email,
            role: 'rule',
            name: null,
          });
          seenEmails.add(email);
        }
      }
    }
  }

  // Run enhanced analysis to extract summary, action items, and key decisions
  const enhancedAnalysis = await analyzeNoteContent(meeting, noteContent);
  if (enhancedAnalysis.success) {
    result.enhanced_analysis = {
      summary: enhancedAnalysis.summary,
      action_items: enhancedAnalysis.action_items,
      key_decisions: enhancedAnalysis.key_decisions,
    };
  }

  return result;
}

/**
 * HTTP Cloud Function entry point
 */
functions.http('classify', async (req, res) => {
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
    const { meeting, note_file_id, note_content } = req.body;

    // Validate request
    if (!meeting) {
      res.status(400).json({ error: 'Missing required field: meeting' });
      return;
    }

    if (!meeting.title) {
      res.status(400).json({ error: 'Missing required field: meeting.title' });
      return;
    }

    // Perform classification with optional note content for enhanced analysis
    const result = await classify(meeting, note_file_id, note_content);

    // Return result
    res.status(200).json(result);

  } catch (error) {
    console.error('Classification error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// Export for testing
module.exports = { classify, analyzeNoteContent };
