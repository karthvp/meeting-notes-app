/**
 * Centralized type exports for Egen Meeting Notes
 *
 * This file re-exports types from various modules to provide a single import point.
 * New code can import from '@/lib/types' for convenience.
 *
 * Example:
 *   import { Note, Client, Project, ClassifyResponse } from '@/lib/types';
 */

// ============================================================
// Firestore Types (Domain Models)
// ============================================================

export type {
  // Core entities
  Client,
  Project,
  Note,
  ClassificationRule,
  NoteTemplate,

  // Meeting related
  MeetingInfo,
  MeetingData,
  Attendee,
  TeamMember,

  // Classification related
  Classification,
  ClassificationResult,

  // Note components
  ActionItem,
  KeyDecision,
  EnhancedAnalysis,
  FolderInfo,
  SharingInfo,

  // Templates
  TemplateSection,
} from '../firestore';

// ============================================================
// API Types (Request/Response)
// ============================================================

export type {
  // Error handling
  ApiError,

  // Classification API
  ClassifyRequest,
  ClassifyResponse,
  ClassifyWithAnalysisRequest,
  ClassifyWithAnalysisResponse,

  // Save Note API
  SaveNoteRequest,
  SaveNoteResponse,

  // Share API
  ShareRequest,
  ShareResponse,

  // Feedback API
  FeedbackRequest,
  FeedbackResponse,

  // Update Note API
  UpdateNoteRequest,
  UpdateNoteResponse,

  // Drive Webhook API
  DriveWebhookConfig,
  RegisterWebhookRequest,
  RegisterWebhookResponse,

  // Bulk Operations
  BulkCategorizeRequest,
  BulkShareRequest,
  BulkAddTagsRequest,
  BulkOperationResponse,

  // Google Tasks API
  CreateGoogleTaskRequest,
  CreateGoogleTaskResponse,

  // Search API
  SearchResult,
  SearchResponse,
  SearchFilters,

  // Slack API
  SlackChannel,
  GetSlackChannelsResponse,
  ShareToSlackRequest,
  ShareToSlackResponse,

  // Chat API
  ChatSource,
  ChatRequest,
  ChatResponse,

  // Import API
  ImportFromDriveRequest,
  ImportFromDriveResponse,
  ImportedNote,
  SkippedNote,
  ImportError,
} from '../api';

// ============================================================
// Dashboard-specific Types
// ============================================================

/**
 * Stats shown on the dashboard home page
 */
export interface DashboardStats {
  totalNotes: number;
  notesThisWeek: number;
  uncategorizedCount: number;
  clientCount: number;
  projectCount: number;
  sharedNotesCount: number;
}

/**
 * Filter options for the notes table
 */
export interface NotesFilterOptions {
  type?: string;
  clientId?: string;
  projectId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  hasActionItems?: boolean;
  searchQuery?: string;
}

/**
 * Pagination state
 */
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Sort configuration
 */
export interface SortConfig<T extends string = string> {
  field: T;
  direction: 'asc' | 'desc';
}

/**
 * Common status types used across the app
 */
export type EntityStatus = 'active' | 'inactive' | 'archived';
export type ProjectStatus = 'active' | 'completed' | 'on_hold';
export type RuleStatus = 'active' | 'disabled' | 'testing';
export type ActionItemStatus = 'pending' | 'completed' | 'cancelled';
export type Priority = 'high' | 'medium' | 'low';
export type NoteType = 'client' | 'internal' | 'external' | 'personal' | 'uncategorized';
export type PermissionLevel = 'viewer' | 'commenter' | 'editor' | 'reader' | 'writer';
