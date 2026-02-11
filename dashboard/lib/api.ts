'use client';

import type {
  MeetingData,
  ClassificationResult,
  Classification,
  Attendee,
} from './firestore';

// API Base URL - configured via environment variable
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'https://us-central1-karthik-patil-sandbox.cloudfunctions.net';

/**
 * API Error class for better error handling
 */
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}/${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Check content type before parsing
  const contentType = response.headers.get('content-type');

  if (!contentType || !contentType.includes('application/json')) {
    // Response is not JSON (likely an HTML error page)
    const text = await response.text();
    console.error('API returned non-JSON response:', text.substring(0, 200));
    throw new ApiError(
      `API error: Server returned non-JSON response (status ${response.status})`,
      response.status,
      'INVALID_RESPONSE'
    );
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      data.message || data.error || 'An error occurred',
      response.status,
      data.code
    );
  }

  return data as T;
}

// ============================================================
// /classify API
// ============================================================

export interface ClassifyRequest {
  meeting: MeetingData;
  note_file_id?: string;
}

export interface ClassifyResponse extends ClassificationResult {
  match_info?: {
    allInternal: boolean;
    clientMatchedBy?: string | null;
    projectMatchedBy?: string | null;
    ruleConfidenceBoost?: number;
    type: string;
    usedAI?: boolean;
    aiConfidence?: number;
    aiFallbackReason?: string;
  };
}

/**
 * Call the /classify Cloud Function to get AI classification suggestions
 */
export async function classifyNote(
  meeting: MeetingData,
  noteFileId?: string
): Promise<ClassifyResponse> {
  return apiFetch<ClassifyResponse>('classify', {
    method: 'POST',
    body: JSON.stringify({
      meeting,
      note_file_id: noteFileId,
    }),
  });
}

// ============================================================
// /save-note API
// ============================================================

export interface SaveNoteRequest {
  noteId?: string;
  driveFileId?: string;
  targetFolderId?: string;
  classification?: {
    type: string;
    clientId?: string | null;
    clientName?: string | null;
    projectId?: string | null;
    projectName?: string | null;
    confidence?: number;
    autoClassified?: boolean;
  };
  sharedWith?: Array<{ email: string; permission?: string }>;
  tags?: string[];
  userEmail: string;
  accessToken?: string; // Optional: for Drive file operations
}

export interface SaveNoteResponse {
  success: boolean;
  noteMetadataId: string;
  fileUrl?: string | null;
  folderPath?: string | null;
  sharedWith?: Array<{ email: string; success: boolean; error?: string }>;
  driveWarning?: string | null;
}

/**
 * Call the /save-note Cloud Function to save and file a note
 * If accessToken is provided, it's sent in the Authorization header for Drive operations
 */
export async function saveNote(request: SaveNoteRequest): Promise<SaveNoteResponse> {
  const { accessToken, ...bodyParams } = request;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const url = `${API_BASE_URL}/saveNote`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyParams),
  });

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    console.error('API returned non-JSON response:', text.substring(0, 200));
    throw new ApiError(
      `API error: Server returned non-JSON response (status ${response.status})`,
      response.status,
      'INVALID_RESPONSE'
    );
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      data.message || data.error || 'An error occurred',
      response.status,
      data.code
    );
  }

  return data as SaveNoteResponse;
}

// ============================================================
// /share API
// ============================================================

export interface ShareRequest {
  noteId?: string;
  driveFileId?: string;
  shareWith: Array<{ email: string; permission?: 'reader' | 'commenter' | 'writer' }>;
  userEmail: string;
  sendNotifications?: boolean;
  action?: 'add' | 'remove';
}

export interface ShareResponse {
  success: boolean;
  sharedWith: Array<{
    email: string;
    permission?: string;
    success: boolean;
    permissionId?: string;
    updated?: boolean;
    removed?: boolean;
    error?: string;
  }>;
  noteId?: string;
  driveFileId?: string;
}

/**
 * Call the /share Cloud Function to share a note with team members
 */
export async function shareNote(request: ShareRequest): Promise<ShareResponse> {
  return apiFetch<ShareResponse>('share', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Unshare a note from specified users
 */
export async function unshareNote(
  noteId: string,
  emails: string[],
  userEmail: string
): Promise<ShareResponse> {
  return shareNote({
    noteId,
    shareWith: emails.map((email) => ({ email })),
    userEmail,
    action: 'remove',
  });
}

// ============================================================
// /feedback API
// ============================================================

export interface FeedbackRequest {
  noteId?: string;
  originalClassification: {
    type: string;
    clientId?: string | null;
    clientName?: string | null;
    projectId?: string | null;
    projectName?: string | null;
    internalTeam?: string | null;
    confidence?: number;
    ruleId?: string | null;
  };
  correctedClassification: {
    type: string;
    clientId?: string | null;
    clientName?: string | null;
    projectId?: string | null;
    projectName?: string | null;
    internalTeam?: string | null;
  };
  meeting?: {
    title: string;
    attendees?: string[];
  };
  userEmail: string;
}

export interface FeedbackResponse {
  success: boolean;
  feedbackId: string;
  correctionTypes: string[];
  patternUpdated: boolean;
  newRuleSuggested: boolean;
  ruleSuggestion?: {
    suggest: boolean;
    reason?: string;
    suggestedRule?: {
      name: string;
      description: string;
      conditions: object;
      actions: object;
    };
  };
}

/**
 * Call the /feedback Cloud Function to record a user correction
 */
export async function submitFeedback(
  request: FeedbackRequest
): Promise<FeedbackResponse> {
  return apiFetch<FeedbackResponse>('feedback', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Helper to record a classification correction
 */
export async function recordClassificationCorrection(
  noteId: string,
  originalClassification: Classification,
  correctedClassification: Partial<Classification>,
  meeting: { title: string; attendees?: Attendee[] } | undefined,
  userEmail: string
): Promise<FeedbackResponse> {
  return submitFeedback({
    noteId,
    originalClassification: {
      type: originalClassification.type,
      clientId: originalClassification.client_id,
      clientName: originalClassification.client_name,
      projectId: originalClassification.project_id,
      projectName: originalClassification.project_name,
      internalTeam: originalClassification.internal_team,
      confidence: originalClassification.confidence,
      ruleId: originalClassification.rule_id,
    },
    correctedClassification: {
      type: correctedClassification.type || originalClassification.type,
      clientId: correctedClassification.client_id,
      clientName: correctedClassification.client_name,
      projectId: correctedClassification.project_id,
      projectName: correctedClassification.project_name,
      internalTeam: correctedClassification.internal_team,
    },
    meeting: meeting
      ? {
          title: meeting.title,
          attendees: meeting.attendees?.map((a) => a.email),
        }
      : undefined,
    userEmail,
  });
}

// ============================================================
// /update-note API (for legacy support)
// ============================================================

export interface UpdateNoteRequest {
  noteId: string;
  action?: 'classification' | 'categorize' | 'share' | 'sharing' | 'update';
  classification?: {
    clientId?: string | null;
    projectId?: string | null;
    noteType?: string | null;
  };
  sharedWith?: string[];
  userEmail: string;
}

export interface UpdateNoteResponse {
  message: string;
  changes?: Record<string, { from: any; to: any }>;
  updates?: Array<{
    action: string;
    message: string;
    changes?: Record<string, { from: any; to: any }>;
    sharedWith?: string[];
  }>;
}

/**
 * Call the /update-note Cloud Function
 */
export async function updateNoteViaApi(
  request: UpdateNoteRequest
): Promise<UpdateNoteResponse> {
  return apiFetch<UpdateNoteResponse>('updateNote', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Check if the API is reachable
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    // Make a simple OPTIONS request to check connectivity
    const response = await fetch(`${API_BASE_URL}/classify`, {
      method: 'OPTIONS',
    });
    return response.ok || response.status === 204;
  } catch {
    return false;
  }
}

/**
 * Get the confidence level label
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.9) return 'High';
  if (confidence >= 0.7) return 'Medium';
  if (confidence >= 0.5) return 'Low';
  return 'Very Low';
}

/**
 * Get the confidence color class for styling
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'text-green-600 bg-green-50';
  if (confidence >= 0.7) return 'text-yellow-600 bg-yellow-50';
  if (confidence >= 0.5) return 'text-orange-600 bg-orange-50';
  return 'text-red-600 bg-red-50';
}

/**
 * Format confidence as percentage
 */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

// ============================================================
// Drive Webhook API
// ============================================================

export interface DriveWebhookConfig {
  configured: boolean;
  folderId?: string;
  folderName?: string;
  status?: 'active' | 'disconnected' | 'expired';
  webhookExpiration?: string | null;
}

export interface RegisterWebhookRequest {
  folderId: string;
  folderName?: string;
  accessToken: string;
  userEmail: string;
}

export interface RegisterWebhookResponse {
  success: boolean;
  message: string;
  channelId?: string;
  resourceId?: string;
  expiration?: string;
  error?: string;
}

/**
 * Get user's Drive webhook configuration
 */
export async function getDriveWebhookConfig(
  userEmail: string
): Promise<DriveWebhookConfig> {
  return apiFetch<DriveWebhookConfig>(
    `getDriveWebhookConfig?userEmail=${encodeURIComponent(userEmail)}`,
    { method: 'GET' }
  );
}

/**
 * Register a Drive webhook for the user's folder
 */
export async function registerDriveWebhook(
  request: RegisterWebhookRequest
): Promise<RegisterWebhookResponse> {
  return apiFetch<RegisterWebhookResponse>('registerDriveWebhook', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Unregister the user's Drive webhook
 */
export async function unregisterDriveWebhook(
  accessToken: string,
  userEmail: string
): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>('unregisterDriveWebhook', {
    method: 'POST',
    body: JSON.stringify({ accessToken, userEmail }),
  });
}

// ============================================================
// Bulk Operations API
// ============================================================

export interface BulkCategorizeRequest {
  noteIds: string[];
  classification: {
    type: string;
    clientId?: string | null;
    clientName?: string | null;
    projectId?: string | null;
    projectName?: string | null;
  };
  userEmail: string;
}

export interface BulkShareRequest {
  noteIds: string[];
  shareWith: Array<{ email: string; permission?: 'reader' | 'commenter' | 'writer' }>;
  userEmail: string;
  sendNotifications?: boolean;
}

export interface BulkAddTagsRequest {
  noteIds: string[];
  tags: string[];
  userEmail: string;
}

export interface BulkOperationResponse {
  success: boolean;
  results: {
    successful: string[];
    failed: Array<{ noteId: string; error: string }>;
  };
}

/**
 * Bulk categorize multiple notes
 */
export async function bulkCategorize(
  request: BulkCategorizeRequest
): Promise<BulkOperationResponse> {
  // For now, this is handled client-side via Firestore
  // Could be moved to a Cloud Function for better performance
  return {
    success: true,
    results: {
      successful: request.noteIds,
      failed: [],
    },
  };
}

/**
 * Bulk share multiple notes
 */
export async function bulkShare(
  request: BulkShareRequest
): Promise<BulkOperationResponse> {
  // Share all notes in parallel using Promise.all
  const sharePromises = request.noteIds.map(async (noteId) => {
    try {
      await shareNote({
        noteId,
        shareWith: request.shareWith,
        userEmail: request.userEmail,
        sendNotifications: request.sendNotifications,
      });
      return { noteId, success: true };
    } catch (error) {
      return {
        noteId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  const shareResults = await Promise.all(sharePromises);

  const results: BulkOperationResponse = {
    success: true,
    results: {
      successful: [],
      failed: [],
    },
  };

  for (const result of shareResults) {
    if (result.success) {
      results.results.successful.push(result.noteId);
    } else {
      results.results.failed.push({
        noteId: result.noteId,
        error: result.error || 'Unknown error',
      });
    }
  }

  results.success = results.results.failed.length === 0;
  return results;
}

/**
 * Bulk add tags to multiple notes
 * (Handled client-side via Firestore)
 */
export async function bulkAddTags(
  request: BulkAddTagsRequest
): Promise<BulkOperationResponse> {
  return {
    success: true,
    results: {
      successful: request.noteIds,
      failed: [],
    },
  };
}

// ============================================================
// Google Tasks API
// ============================================================

export interface CreateGoogleTaskRequest {
  noteId: string;
  actionItemId: string;
  title: string;
  notes?: string;
  due?: string;
}

export interface CreateGoogleTaskResponse {
  success: boolean;
  taskId?: string;
  taskUrl?: string;
  error?: string;
}

/**
 * Create a Google Task from an action item
 */
export async function createGoogleTask(
  request: CreateGoogleTaskRequest
): Promise<CreateGoogleTaskResponse> {
  return apiFetch<CreateGoogleTaskResponse>('createTask', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Create multiple Google Tasks from action items
 */
export async function createGoogleTasksBatch(
  noteId: string,
  actionItems: Array<{ id: string; title: string; notes?: string; due?: string }>
): Promise<Array<CreateGoogleTaskResponse>> {
  const results: CreateGoogleTaskResponse[] = [];

  for (const item of actionItems) {
    try {
      const result = await createGoogleTask({
        noteId,
        actionItemId: item.id,
        title: item.title,
        notes: item.notes,
        due: item.due,
      });
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

// ============================================================
// Enhanced Classification API (with summaries, action items, decisions)
// ============================================================

export interface EnhancedAnalysis {
  summary: string | null;
  action_items: Array<{
    id: string;
    task: string;
    assignee?: string | null;
    assignee_name?: string | null;
    due_date?: string | null;
    priority: 'high' | 'medium' | 'low';
    status: 'pending' | 'completed' | 'cancelled';
  }>;
  key_decisions: Array<{
    id: string;
    decision: string;
    context?: string | null;
    decided_by?: string | null;
  }>;
}

export interface ClassifyWithAnalysisRequest {
  meeting: MeetingData;
  note_file_id?: string;
  note_content?: string;
}

export interface ClassifyWithAnalysisResponse extends ClassifyResponse {
  enhanced_analysis?: EnhancedAnalysis;
}

/**
 * Call the /classify Cloud Function with enhanced analysis
 */
export async function classifyNoteWithAnalysis(
  meeting: MeetingData,
  noteContent?: string,
  noteFileId?: string
): Promise<ClassifyWithAnalysisResponse> {
  return apiFetch<ClassifyWithAnalysisResponse>('classify', {
    method: 'POST',
    body: JSON.stringify({
      meeting,
      note_file_id: noteFileId,
      note_content: noteContent,
    }),
  });
}

// ============================================================
// Full-Text Search API
// ============================================================

export interface SearchResult {
  id: string;
  title: string;
  date: any;
  client?: string | null;
  project?: string | null;
  type: string;
  summary?: string | null;
  snippets: string[];
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

export interface SearchFilters {
  type?: string;
  clientId?: string;
  attendeeEmail?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Full-text search across all notes
 */
export async function searchNotes(
  query: string,
  options: {
    limit?: number;
    includeContent?: boolean;
    filters?: SearchFilters;
  } = {}
): Promise<SearchResponse> {
  const params = new URLSearchParams();
  params.append('q', query);
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.includeContent) params.append('include_content', 'true');
  if (options.filters?.type) params.append('type', options.filters.type);
  if (options.filters?.clientId) params.append('client_id', options.filters.clientId);
  if (options.filters?.attendeeEmail) params.append('attendee_email', options.filters.attendeeEmail);
  if (options.filters?.dateFrom) params.append('date_from', options.filters.dateFrom);
  if (options.filters?.dateTo) params.append('date_to', options.filters.dateTo);

  return apiFetch<SearchResponse>(`search?${params.toString()}`, {
    method: 'GET',
  });
}

// ============================================================
// Slack Integration API
// ============================================================

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
}

export interface GetSlackChannelsResponse {
  channels: SlackChannel[];
}

export interface ShareToSlackRequest {
  noteId: string;
  channelId: string;
  userEmail: string;
  customMessage?: string;
}

export interface ShareToSlackResponse {
  success: boolean;
  messageTs?: string;
  channel?: string;
  error?: string;
  needsAuth?: boolean;
}

/**
 * Get list of Slack channels user can post to
 */
export async function getSlackChannels(userEmail: string): Promise<GetSlackChannelsResponse> {
  return apiFetch<GetSlackChannelsResponse>(
    `shareToSlack?user_email=${encodeURIComponent(userEmail)}`,
    { method: 'GET' }
  );
}

/**
 * Share a note to a Slack channel
 */
export async function shareToSlack(request: ShareToSlackRequest): Promise<ShareToSlackResponse> {
  return apiFetch<ShareToSlackResponse>('shareToSlack', {
    method: 'POST',
    body: JSON.stringify({
      note_id: request.noteId,
      channel_id: request.channelId,
      user_email: request.userEmail,
      custom_message: request.customMessage,
    }),
  });
}

// ============================================================
// AI Chat API
// ============================================================

export interface ChatSource {
  id: string;
  title: string;
  date?: string | null;
  client?: string | null;
}

export interface ChatRequest {
  query: string;
  sessionId?: string;
  userEmail: string;
  includeHistory?: boolean;
}

export interface ChatResponse {
  response: string;
  session_id: string;
  sources: ChatSource[];
}

/**
 * Send a chat message to the AI
 */
export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  return apiFetch<ChatResponse>('chat', {
    method: 'POST',
    body: JSON.stringify({
      query: request.query,
      session_id: request.sessionId,
      user_email: request.userEmail,
      include_history: request.includeHistory ?? true,
    }),
  });
}

// ============================================================
// Import from Drive API
// ============================================================

export interface ImportFromDriveRequest {
  accessToken: string;
  userEmail: string;
  folderId: string;
}

/**
 * Import meeting notes from Google Drive
 * Uses Authorization header for access token (more secure than body)
 */
export async function importFromDriveSecure(
  request: ImportFromDriveRequest
): Promise<ImportFromDriveResponse> {
  const url = `${API_BASE_URL}/importFromDrive`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${request.accessToken}`,
    },
    body: JSON.stringify({
      userEmail: request.userEmail,
      folderId: request.folderId,
    }),
  });

  const contentType = response.headers.get('content-type');

  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    console.error('API returned non-JSON response:', text.substring(0, 200));
    throw new ApiError(
      `API error: Server returned non-JSON response (status ${response.status})`,
      response.status,
      'INVALID_RESPONSE'
    );
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      data.message || data.error || 'An error occurred',
      response.status,
      data.code
    );
  }

  return data as ImportFromDriveResponse;
}

export interface ImportedNote {
  id: string;
  driveFileId: string;
  title: string;
}

export interface SkippedNote {
  driveFileId: string;
  name: string;
  reason: string;
}

export interface ImportError {
  driveFileId: string;
  name: string;
  error: string;
}

export interface ImportFromDriveResponse {
  success: boolean;
  summary: {
    totalFound: number;
    imported: number;
    skipped: number;
    errors: number;
  };
  imported: ImportedNote[];
  skipped: SkippedNote[];
  errors: ImportError[];
  needsReauth?: boolean;
}

/**
 * Import meeting notes from Google Drive
 */
export async function importFromDrive(
  request: ImportFromDriveRequest
): Promise<ImportFromDriveResponse> {
  return apiFetch<ImportFromDriveResponse>('importFromDrive', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
