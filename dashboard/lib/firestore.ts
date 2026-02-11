'use client';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  addDoc,
  deleteDoc,
  Timestamp,
  limit,
  startAfter,
  DocumentSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';

// Types matching Firestore schema
export interface Client {
  id: string;
  name: string;
  domains?: string[];
  keywords?: string[];
  account_manager?: string;
  drive_folder_id?: string;
  projects?: string[];
  created_at?: Timestamp;
  updated_at?: Timestamp;
  status?: 'active' | 'inactive';
}

export interface TeamMember {
  email: string;
  role: string;
  name: string;
}

export interface Project {
  id: string;
  client_id: string;
  client_name?: string;
  project_name: string;
  keywords?: string[];
  team?: TeamMember[];
  drive_folder_id?: string;
  drive_folder_path?: string;
  created_at?: Timestamp;
  updated_at?: Timestamp;
  status?: 'active' | 'completed' | 'on_hold';
}

export interface Attendee {
  email: string;
  name?: string;
  internal?: boolean;
}

export interface MeetingInfo {
  calendar_event_id?: string;
  title: string;
  description?: string;
  start_time?: Timestamp;
  end_time?: Timestamp;
  duration_minutes?: number;
  organizer?: string;
  attendees?: Attendee[];
  attendee_emails?: string[];
}

export interface Classification {
  type: 'client' | 'internal' | 'external' | 'personal' | 'uncategorized';
  client_id?: string | null;
  client_name?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  internal_team?: string | null;
  confidence: number;
  rule_id?: string | null;
  ai_reasoning?: string | null;
  auto_classified?: boolean;
  auto_filed?: boolean;
  user_confirmed?: boolean;
  confirmed_by?: string;
  confirmed_at?: Timestamp;
}

export interface FolderInfo {
  id?: string | null;
  path?: string | null;
}

export interface SharingInfo {
  shared_with?: string[];
  permission_level?: 'viewer' | 'commenter' | 'editor';
  shared_at?: Timestamp | null;
  shared_by?: string | null;
}

export interface ActionItem {
  id: string;
  task: string;
  assignee?: string | null;
  assignee_name?: string | null;
  due_date?: string | null;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'completed' | 'cancelled';
  completed_at?: Timestamp | null;
  google_task_id?: string | null;
}

export interface KeyDecision {
  id: string;
  decision: string;
  context?: string | null;
  decided_by?: string | null;
}

export interface EnhancedAnalysis {
  summary?: string | null;
  action_items?: ActionItem[];
  key_decisions?: KeyDecision[];
  analyzed_at?: Timestamp | null;
}

// Note Templates
export interface NoteTemplate {
  id: string;
  name: string;
  description?: string;
  category: 'client' | 'internal' | 'external' | 'general';
  sections: TemplateSection[];
  auto_apply_rules?: {
    keywords?: string[];
    meeting_types?: string[];
    attendee_domains?: string[];
  };
  created_by?: string;
  created_at?: Timestamp;
  updated_at?: Timestamp;
  is_default?: boolean;
}

export interface TemplateSection {
  id: string;
  title: string;
  placeholder?: string;
  type: 'text' | 'list' | 'checkbox-list';
  required?: boolean;
  order: number;
}

export interface Note {
  id: string;
  drive_file_id?: string;
  drive_file_url?: string;
  meeting?: MeetingInfo;
  classification?: Classification;
  folder?: FolderInfo;
  sharing?: SharingInfo;
  tags?: string[];
  // Enhanced analysis fields
  summary?: string | null;
  action_items?: ActionItem[];
  key_decisions?: KeyDecision[];
  enhanced_analysis?: EnhancedAnalysis;
  created_at?: Timestamp;
  updated_at?: Timestamp;
  processed_at?: Timestamp;
  // Legacy fields for backwards compatibility
  title?: string;
  content?: string;
  clientId?: string;
  projectId?: string;
  noteType?: string;
  confidence?: number;
  sharedWith?: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
  driveFileId?: string;
}

export interface ClassificationRule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  conditions?: {
    operator: 'AND' | 'OR';
    rules: Array<{
      field: string;
      operator: string;
      value: string | string[];
    }>;
  };
  actions?: {
    classify_as?: string;
    client_id?: string;
    project_id?: string;
    team?: string;
    folder_path?: string;
    share_with?: string[];
    add_tags?: string[];
  };
  confidence_boost?: number;
  stats?: {
    times_applied: number;
    times_corrected: number;
    last_applied?: Timestamp | null;
  };
  created_by?: string;
  created_at?: Timestamp;
  updated_at?: Timestamp;
  status?: 'active' | 'disabled' | 'testing';
}

export interface MeetingData {
  title: string;
  description?: string;
  organizer?: string;
  attendees?: Attendee[];
  start_time?: string;
  end_time?: string;
}

function normalizeAttendeeEmails(attendees?: Array<Attendee | string>): string[] {
  if (!attendees) return [];
  const emails = attendees
    .map((attendee) => (typeof attendee === 'string' ? attendee : attendee?.email))
    .map((email) => email?.trim().toLowerCase())
    .filter(Boolean) as string[];

  return [...new Set(emails)];
}

export interface ClassificationResult {
  classification: {
    type: string;
    client?: { id: string; name: string } | null;
    project?: { id: string; name: string } | null;
    internal_team?: string | null;
    confidence: number;
    matched_rule_id?: string | null;
    ai_reasoning?: string | null;
  };
  suggested_actions: {
    folder_path: string;
    folder_id?: string | null;
    share_with: Array<{ email: string; role: string; name?: string }>;
    tags: string[];
  };
  auto_apply: boolean;
  classification_method?: 'gemini_ai' | 'rule_based' | 'none';
}

// Clients
export async function getClients(): Promise<Client[]> {
  const db = getFirebaseDb();
  const clientsRef = collection(db, 'clients');
  // Query without orderBy to avoid needing composite index, sort client-side
  const snapshot = await getDocs(query(clientsRef, where('status', '==', 'active')));
  const clients = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Client[];
  // Sort by name client-side
  return clients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function getClient(clientId: string): Promise<Client | null> {
  const db = getFirebaseDb();
  const clientRef = doc(db, 'clients', clientId);
  const snapshot = await getDoc(clientRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Client;
}

// Projects
export async function getProjects(clientId?: string): Promise<Project[]> {
  const db = getFirebaseDb();
  const projectsRef = collection(db, 'projects');
  // Query without orderBy to avoid needing composite index, sort client-side
  let q;
  if (clientId) {
    q = query(
      projectsRef,
      where('client_id', '==', clientId),
      where('status', '==', 'active')
    );
  } else {
    q = query(projectsRef, where('status', '==', 'active'));
  }
  const snapshot = await getDocs(q);
  const projects = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Project[];
  // Sort by project_name client-side
  return projects.sort((a, b) => (a.project_name || '').localeCompare(b.project_name || ''));
}

export async function getProject(projectId: string): Promise<Project | null> {
  const db = getFirebaseDb();
  const projectRef = doc(db, 'projects', projectId);
  const snapshot = await getDoc(projectRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Project;
}

// Notes
export async function getNotes(filters?: {
  clientId?: string;
  projectId?: string;
  noteType?: string;
  uncategorizedOnly?: boolean;
  limit?: number;
  startAfterDoc?: DocumentSnapshot;
}): Promise<Note[]> {
  const db = getFirebaseDb();
  const notesRef = collection(db, 'notes_metadata');
  const constraints: any[] = [];

  if (filters?.clientId) {
    constraints.push(where('classification.client_id', '==', filters.clientId));
  }
  if (filters?.projectId) {
    constraints.push(where('classification.project_id', '==', filters.projectId));
  }
  if (filters?.noteType) {
    constraints.push(where('classification.type', '==', filters.noteType));
  }
  if (filters?.uncategorizedOnly) {
    constraints.push(where('classification.type', '==', 'uncategorized'));
  }

  // Default ordering by created_at (meeting.start_time can be null for imported notes)
  constraints.push(orderBy('created_at', 'desc'));

  if (filters?.limit) {
    constraints.push(limit(filters.limit));
  }

  if (filters?.startAfterDoc) {
    constraints.push(startAfter(filters.startAfterDoc));
  }

  const q = query(notesRef, ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Note[];
}

export async function getNote(noteId: string): Promise<Note | null> {
  const db = getFirebaseDb();
  const noteRef = doc(db, 'notes_metadata', noteId);
  const snapshot = await getDoc(noteRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Note;
}

export async function updateNote(
  noteId: string,
  updates: Partial<Note>
): Promise<void> {
  const db = getFirebaseDb();
  const noteRef = doc(db, 'notes_metadata', noteId);

  const normalizedUpdates: Partial<Note> = { ...updates };
  if (updates.meeting?.attendees) {
    normalizedUpdates.meeting = {
      ...updates.meeting,
      attendee_emails: normalizeAttendeeEmails(updates.meeting.attendees),
    };
  }

  await updateDoc(noteRef, {
    ...normalizedUpdates,
    updated_at: Timestamp.now(),
  });
}

// New functions for Part 3

/**
 * Create a new note in Firestore
 */
export async function createNote(data: Partial<Note>): Promise<string> {
  const db = getFirebaseDb();
  const notesRef = collection(db, 'notes_metadata');

  const noteData = {
    ...data,
    meeting: data.meeting
      ? {
          ...data.meeting,
          attendee_emails: normalizeAttendeeEmails(data.meeting.attendees as Attendee[]),
        }
      : undefined,
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
    processed_at: Timestamp.now(),
    classification: data.classification || {
      type: 'uncategorized',
      confidence: 0,
      auto_classified: false,
      user_confirmed: false,
    },
  };

  const docRef = await addDoc(notesRef, noteData);
  return docRef.id;
}

/**
 * Delete a note from Firestore
 */
export async function deleteNote(noteId: string): Promise<void> {
  const db = getFirebaseDb();
  const noteRef = doc(db, 'notes_metadata', noteId);
  await deleteDoc(noteRef);
}

/**
 * Get uncategorized notes
 */
export async function getUncategorizedNotes(limitCount?: number): Promise<Note[]> {
  const db = getFirebaseDb();
  const notesRef = collection(db, 'notes_metadata');

  // Query without orderBy to avoid needing composite index, sort client-side
  const q = query(
    notesRef,
    where('classification.type', '==', 'uncategorized')
  );

  const snapshot = await getDocs(q);
  let notes = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Note[];

  // Sort by created_at descending client-side
  notes.sort((a, b) => {
    const aTime = a.created_at?.toMillis?.() || 0;
    const bTime = b.created_at?.toMillis?.() || 0;
    return bTime - aTime;
  });

  if (limitCount) {
    notes = notes.slice(0, limitCount);
  }

  return notes;
}

/**
 * Get notes created within a date range
 */
export async function getNotesInDateRange(
  startDate: Date,
  endDate: Date,
  clientId?: string
): Promise<Note[]> {
  const db = getFirebaseDb();
  const notesRef = collection(db, 'notes_metadata');

  const constraints: any[] = [
    where('meeting.start_time', '>=', Timestamp.fromDate(startDate)),
    where('meeting.start_time', '<=', Timestamp.fromDate(endDate)),
    orderBy('meeting.start_time', 'desc'),
  ];

  if (clientId) {
    constraints.push(where('classification.client_id', '==', clientId));
  }

  const q = query(notesRef, ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Note[];
}

/**
 * Get notes this week
 */
export async function getNotesThisWeek(): Promise<Note[]> {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
  startOfWeek.setHours(0, 0, 0, 0);

  return getNotesInDateRange(startOfWeek, now);
}

/**
 * Get note counts by client
 */
export async function getNoteCountsByClient(): Promise<Record<string, number>> {
  const db = getFirebaseDb();
  const notesRef = collection(db, 'notes_metadata');

  // Get all notes with client_id
  const q = query(
    notesRef,
    where('classification.type', '==', 'client')
  );

  const snapshot = await getDocs(q);
  const counts: Record<string, number> = {};

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const clientId = data.classification?.client_id;
    if (clientId) {
      counts[clientId] = (counts[clientId] || 0) + 1;
    }
  });

  return counts;
}

/**
 * Get recently shared notes
 */
export async function getRecentlySharedNotes(limitCount: number = 10): Promise<Note[]> {
  const db = getFirebaseDb();
  const notesRef = collection(db, 'notes_metadata');

  // This requires a composite index on sharing.shared_at
  const q = query(
    notesRef,
    orderBy('sharing.shared_at', 'desc'),
    limit(limitCount)
  );

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }) as Note)
      .filter((note) => note.sharing?.shared_with && note.sharing.shared_with.length > 0);
  } catch (error) {
    // Index might not exist, fallback to simpler query
    console.warn('Index for shared notes may not exist:', error);
    return [];
  }
}

/**
 * Update note classification
 */
export async function updateNoteClassification(
  noteId: string,
  classification: Partial<Classification>,
  userEmail: string
): Promise<void> {
  const db = getFirebaseDb();
  const noteRef = doc(db, 'notes_metadata', noteId);

  const updates: Record<string, any> = {
    updated_at: Timestamp.now(),
  };

  // Update each classification field individually
  Object.entries(classification).forEach(([key, value]) => {
    updates[`classification.${key}`] = value;
  });

  // Mark as user confirmed
  updates['classification.user_confirmed'] = true;
  updates['classification.confirmed_by'] = userEmail;
  updates['classification.confirmed_at'] = Timestamp.now();

  await updateDoc(noteRef, updates);
}

/**
 * Update note sharing
 */
export async function updateNoteSharing(
  noteId: string,
  sharedWith: string[],
  userEmail: string,
  permissionLevel: 'viewer' | 'commenter' | 'editor' = 'viewer'
): Promise<void> {
  const db = getFirebaseDb();
  const noteRef = doc(db, 'notes_metadata', noteId);

  await updateDoc(noteRef, {
    'sharing.shared_with': sharedWith,
    'sharing.permission_level': permissionLevel,
    'sharing.shared_at': Timestamp.now(),
    'sharing.shared_by': userEmail,
    updated_at: Timestamp.now(),
  });
}

// Classification Rules
export async function getRules(): Promise<ClassificationRule[]> {
  const db = getFirebaseDb();
  const rulesRef = collection(db, 'rules');
  // Query without orderBy to avoid needing composite index, sort client-side
  const snapshot = await getDocs(
    query(rulesRef, where('status', '==', 'active'))
  );
  const rules = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ClassificationRule[];
  // Sort by priority descending client-side
  return rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

export async function getRule(ruleId: string): Promise<ClassificationRule | null> {
  const db = getFirebaseDb();
  const ruleRef = doc(db, 'rules', ruleId);
  const snapshot = await getDoc(ruleRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as ClassificationRule;
}

// Dashboard Statistics
export interface DashboardStats {
  totalNotesThisWeek: number;
  notesByClient: Array<{ clientId: string; clientName: string; count: number }>;
  uncategorizedCount: number;
  recentlySharedCount: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const [
      notesThisWeek,
      uncategorizedNotes,
      clients,
      noteCounts,
    ] = await Promise.all([
      getNotesThisWeek(),
      getUncategorizedNotes(),
      getClients(),
      getNoteCountsByClient(),
    ]);

    const notesByClient = clients
      .filter((client) => noteCounts[client.id])
      .map((client) => ({
        clientId: client.id,
        clientName: client.name,
        count: noteCounts[client.id] || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 clients

    const sharedThisWeek = notesThisWeek.filter(
      (note) => note.sharing?.shared_with && note.sharing.shared_with.length > 0
    );

    return {
      totalNotesThisWeek: notesThisWeek.length,
      notesByClient,
      uncategorizedCount: uncategorizedNotes.length,
      recentlySharedCount: sharedThisWeek.length,
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      totalNotesThisWeek: 0,
      notesByClient: [],
      uncategorizedCount: 0,
      recentlySharedCount: 0,
    };
  }
}

// Utility to convert Firestore timestamp to Date
export function timestampToDate(timestamp?: Timestamp): Date | null {
  if (!timestamp) return null;
  return timestamp.toDate();
}

// Get note title (from meeting or fallback)
export function getNoteTitle(note: Note): string {
  return note.meeting?.title || note.title || 'Untitled Note';
}

// Get note client name
export function getNoteClientName(note: Note): string | null {
  return note.classification?.client_name || null;
}

// Get note project name
export function getNoteProjectName(note: Note): string | null {
  return note.classification?.project_name || null;
}

// Get note type label
export function getNoteTypeLabel(note: Note): string {
  const type = note.classification?.type || 'uncategorized';
  const labels: Record<string, string> = {
    client: 'Client',
    internal: 'Internal',
    external: 'External',
    personal: 'Personal',
    uncategorized: 'Uncategorized',
  };
  return labels[type] || type;
}

// ============================================================
// Classification Rules CRUD Operations
// ============================================================

/**
 * Get all rules (with optional status filter)
 */
export async function getAllRules(status?: 'active' | 'disabled' | 'testing'): Promise<ClassificationRule[]> {
  const db = getFirebaseDb();
  const rulesRef = collection(db, 'rules');

  // Query without orderBy to avoid needing composite index, sort client-side
  let q;
  if (status) {
    q = query(rulesRef, where('status', '==', status));
  } else {
    q = query(rulesRef);
  }

  const snapshot = await getDocs(q);
  const rules = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ClassificationRule[];
  // Sort by priority descending client-side
  return rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

/**
 * Create a new classification rule
 */
export async function createRule(rule: Omit<ClassificationRule, 'id'>): Promise<string> {
  const db = getFirebaseDb();
  const rulesRef = collection(db, 'rules');

  const ruleData = {
    ...rule,
    stats: {
      times_applied: 0,
      times_corrected: 0,
      last_applied: null,
    },
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
  };

  const docRef = await addDoc(rulesRef, ruleData);
  return docRef.id;
}

/**
 * Update an existing rule
 */
export async function updateRule(
  ruleId: string,
  updates: Partial<ClassificationRule>
): Promise<void> {
  const db = getFirebaseDb();
  const ruleRef = doc(db, 'rules', ruleId);

  await updateDoc(ruleRef, {
    ...updates,
    updated_at: Timestamp.now(),
  });
}

/**
 * Delete a rule
 */
export async function deleteRule(ruleId: string): Promise<void> {
  const db = getFirebaseDb();
  const ruleRef = doc(db, 'rules', ruleId);
  await deleteDoc(ruleRef);
}

/**
 * Duplicate a rule
 */
export async function duplicateRule(ruleId: string): Promise<string> {
  const db = getFirebaseDb();
  const ruleRef = doc(db, 'rules', ruleId);
  const ruleDoc = await getDoc(ruleRef);

  if (!ruleDoc.exists()) {
    throw new Error('Rule not found');
  }

  const originalRule = ruleDoc.data() as ClassificationRule;

  const newRule: Omit<ClassificationRule, 'id'> = {
    name: `${originalRule.name} (Copy)`,
    description: originalRule.description,
    priority: originalRule.priority,
    conditions: originalRule.conditions,
    actions: originalRule.actions,
    confidence_boost: originalRule.confidence_boost,
    status: 'disabled', // Start as disabled
    created_by: originalRule.created_by,
  };

  return createRule(newRule);
}

/**
 * Toggle rule status
 */
export async function toggleRuleStatus(
  ruleId: string,
  status: 'active' | 'disabled' | 'testing'
): Promise<void> {
  const db = getFirebaseDb();
  const ruleRef = doc(db, 'rules', ruleId);

  await updateDoc(ruleRef, {
    status,
    updated_at: Timestamp.now(),
  });
}

/**
 * Update rule stats after being applied
 */
export async function updateRuleStats(
  ruleId: string,
  applied: boolean,
  corrected: boolean = false
): Promise<void> {
  const db = getFirebaseDb();
  const ruleRef = doc(db, 'rules', ruleId);
  const ruleDoc = await getDoc(ruleRef);

  if (!ruleDoc.exists()) return;

  const currentStats = ruleDoc.data().stats || {
    times_applied: 0,
    times_corrected: 0,
  };

  const updates: Record<string, any> = {
    updated_at: Timestamp.now(),
  };

  if (applied) {
    updates['stats.times_applied'] = currentStats.times_applied + 1;
    updates['stats.last_applied'] = Timestamp.now();
  }

  if (corrected) {
    updates['stats.times_corrected'] = currentStats.times_corrected + 1;
  }

  await updateDoc(ruleRef, updates);
}

/**
 * Get notes that match a rule's conditions (for testing)
 */
export async function getNotesMatchingRule(
  ruleId: string,
  limitCount: number = 10
): Promise<Note[]> {
  // This is a simplified version - actual rule matching
  // should be done server-side in the classify function
  const rule = await getRule(ruleId);
  if (!rule) return [];

  // Get recent notes for testing
  const db = getFirebaseDb();
  const notesRef = collection(db, 'notes_metadata');
  const q = query(
    notesRef,
    orderBy('created_at', 'desc'),
    limit(limitCount * 2) // Get extra to filter
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Note[];
}

// ============================================================
// Bulk Operations
// ============================================================

/**
 * Update classification for multiple notes using batch writes for better performance
 */
export async function bulkUpdateNoteClassifications(
  noteIds: string[],
  classification: Partial<Classification>,
  userEmail: string
): Promise<{ success: string[]; failed: string[] }> {
  const db = getFirebaseDb();
  const success: string[] = [];
  const failed: string[] = [];

  // Firestore batch writes are limited to 500 operations
  const BATCH_SIZE = 500;

  for (let i = 0; i < noteIds.length; i += BATCH_SIZE) {
    const batchIds = noteIds.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    try {
      for (const noteId of batchIds) {
        const noteRef = doc(db, 'notes_metadata', noteId);
        const updates: Record<string, any> = {
          updated_at: Timestamp.now(),
        };

        // Update each classification field individually
        Object.entries(classification).forEach(([key, value]) => {
          updates[`classification.${key}`] = value;
        });

        // Mark as user confirmed
        updates['classification.user_confirmed'] = true;
        updates['classification.confirmed_by'] = userEmail;
        updates['classification.confirmed_at'] = Timestamp.now();

        batch.update(noteRef, updates);
      }

      await batch.commit();
      success.push(...batchIds);
    } catch (error) {
      console.error(`Failed to update batch starting at ${i}:`, error);
      // Fallback to individual updates for this batch
      for (const noteId of batchIds) {
        try {
          await updateNoteClassification(noteId, classification, userEmail);
          success.push(noteId);
        } catch (err) {
          console.error(`Failed to update note ${noteId}:`, err);
          failed.push(noteId);
        }
      }
    }
  }

  return { success, failed };
}

/**
 * Update sharing for multiple notes using batch writes for better performance
 */
export async function bulkUpdateNoteSharing(
  noteIds: string[],
  sharedWith: string[],
  userEmail: string,
  permissionLevel: 'viewer' | 'commenter' | 'editor' = 'viewer'
): Promise<{ success: string[]; failed: string[] }> {
  const db = getFirebaseDb();
  const success: string[] = [];
  const failed: string[] = [];

  // Firestore batch writes are limited to 500 operations
  const BATCH_SIZE = 500;

  for (let i = 0; i < noteIds.length; i += BATCH_SIZE) {
    const batchIds = noteIds.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    try {
      for (const noteId of batchIds) {
        const noteRef = doc(db, 'notes_metadata', noteId);
        batch.update(noteRef, {
          'sharing.shared_with': sharedWith,
          'sharing.permission_level': permissionLevel,
          'sharing.shared_at': Timestamp.now(),
          'sharing.shared_by': userEmail,
          updated_at: Timestamp.now(),
        });
      }

      await batch.commit();
      success.push(...batchIds);
    } catch (error) {
      console.error(`Failed to update sharing batch starting at ${i}:`, error);
      // Fallback to individual updates for this batch
      for (const noteId of batchIds) {
        try {
          await updateNoteSharing(noteId, sharedWith, userEmail, permissionLevel);
          success.push(noteId);
        } catch (err) {
          console.error(`Failed to update sharing for note ${noteId}:`, err);
          failed.push(noteId);
        }
      }
    }
  }

  return { success, failed };
}

/**
 * Update a specific action item's status
 */
export async function updateActionItemStatus(
  noteId: string,
  actionItemId: string,
  status: 'pending' | 'completed' | 'cancelled'
): Promise<void> {
  const db = getFirebaseDb();
  const noteRef = doc(db, 'notes_metadata', noteId);
  const noteDoc = await getDoc(noteRef);

  if (!noteDoc.exists()) {
    throw new Error('Note not found');
  }

  const data = noteDoc.data();
  const actionItems = data.action_items || [];

  const updatedItems = actionItems.map((item: ActionItem) => {
    if (item.id === actionItemId) {
      return {
        ...item,
        status,
        completed_at: status === 'completed' ? Timestamp.now() : null,
      };
    }
    return item;
  });

  await updateDoc(noteRef, {
    action_items: updatedItems,
    updated_at: Timestamp.now(),
  });
}

// ============================================================
// Note Templates CRUD Operations
// ============================================================

/**
 * Get all note templates
 */
export async function getTemplates(): Promise<NoteTemplate[]> {
  const db = getFirebaseDb();
  const templatesRef = collection(db, 'templates');
  const q = query(templatesRef, orderBy('name'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as NoteTemplate[];
}

/**
 * Get a single template by ID
 */
export async function getTemplate(templateId: string): Promise<NoteTemplate | null> {
  const db = getFirebaseDb();
  const templateRef = doc(db, 'templates', templateId);
  const snapshot = await getDoc(templateRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as NoteTemplate;
}

/**
 * Create a new template
 */
export async function createTemplate(
  template: Omit<NoteTemplate, 'id'>
): Promise<string> {
  const db = getFirebaseDb();
  const templatesRef = collection(db, 'templates');
  const docRef = await addDoc(templatesRef, {
    ...template,
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
  });
  return docRef.id;
}

/**
 * Update a template
 */
export async function updateTemplate(
  templateId: string,
  updates: Partial<NoteTemplate>
): Promise<void> {
  const db = getFirebaseDb();
  const templateRef = doc(db, 'templates', templateId);
  await updateDoc(templateRef, {
    ...updates,
    updated_at: Timestamp.now(),
  });
}

/**
 * Delete a template
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  const db = getFirebaseDb();
  const templateRef = doc(db, 'templates', templateId);
  await deleteDoc(templateRef);
}

/**
 * Get templates by category
 */
export async function getTemplatesByCategory(
  category: NoteTemplate['category']
): Promise<NoteTemplate[]> {
  const db = getFirebaseDb();
  const templatesRef = collection(db, 'templates');
  const q = query(
    templatesRef,
    where('category', '==', category),
    orderBy('name')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as NoteTemplate[];
}

/**
 * Find matching template for a meeting
 */
export async function findMatchingTemplate(
  meeting: { title?: string; attendees?: { email: string }[] }
): Promise<NoteTemplate | null> {
  const templates = await getTemplates();
  const title = (meeting.title || '').toLowerCase();
  const attendeeDomains = (meeting.attendees || [])
    .map((a) => a.email.split('@')[1]?.toLowerCase())
    .filter(Boolean);

  for (const template of templates) {
    const rules = template.auto_apply_rules;
    if (!rules) continue;

    // Check keywords
    if (rules.keywords?.some((kw) => title.includes(kw.toLowerCase()))) {
      return template;
    }

    // Check attendee domains
    if (rules.attendee_domains?.some((d) => attendeeDomains.includes(d.toLowerCase()))) {
      return template;
    }
  }

  // Return default template if no match
  return templates.find((t) => t.is_default) || null;
}

/**
 * Link a Google Task ID to an action item
 */
export async function linkGoogleTaskToActionItem(
  noteId: string,
  actionItemId: string,
  googleTaskId: string
): Promise<void> {
  const db = getFirebaseDb();
  const noteRef = doc(db, 'notes_metadata', noteId);
  const noteDoc = await getDoc(noteRef);

  if (!noteDoc.exists()) {
    throw new Error('Note not found');
  }

  const data = noteDoc.data();
  const actionItems = data.action_items || [];

  const updatedItems = actionItems.map((item: ActionItem) => {
    if (item.id === actionItemId) {
      return {
        ...item,
        google_task_id: googleTaskId,
      };
    }
    return item;
  });

  await updateDoc(noteRef, {
    action_items: updatedItems,
    updated_at: Timestamp.now(),
  });
}

/**
 * Add tags to multiple notes
 */
export async function bulkAddTags(
  noteIds: string[],
  tags: string[],
  userEmail: string
): Promise<{ success: string[]; failed: string[] }> {
  const db = getFirebaseDb();
  const success: string[] = [];
  const failed: string[] = [];

  for (const noteId of noteIds) {
    try {
      const noteRef = doc(db, 'notes_metadata', noteId);
      const noteDoc = await getDoc(noteRef);

      if (noteDoc.exists()) {
        const currentTags = noteDoc.data().tags || [];
        const newTags = [...new Set([...currentTags, ...tags])];

        await updateDoc(noteRef, {
          tags: newTags,
          updated_at: Timestamp.now(),
          updated_by: userEmail,
        });
        success.push(noteId);
      } else {
        failed.push(noteId);
      }
    } catch (error) {
      console.error(`Failed to add tags to note ${noteId}:`, error);
      failed.push(noteId);
    }
  }

  return { success, failed };
}

// ============================================================
// User Settings CRUD Operations
// ============================================================

export interface UserSettings {
  gemini_notes_folder_id?: string | null;
  gemini_notes_folder_url?: string | null;
  gemini_notes_folder_name?: string | null;
  updated_at?: Timestamp;
}

/**
 * Get user settings from Firestore
 */
export async function getUserSettings(userEmail: string): Promise<UserSettings | null> {
  if (!userEmail) return null;

  const db = getFirebaseDb();
  const settingsRef = doc(db, 'user_settings', userEmail);
  const snapshot = await getDoc(settingsRef);

  if (!snapshot.exists()) return null;
  return snapshot.data() as UserSettings;
}

/**
 * Save user settings to Firestore
 */
export async function saveUserSettings(
  userEmail: string,
  settings: Partial<UserSettings>
): Promise<void> {
  if (!userEmail) throw new Error('User email is required');

  const db = getFirebaseDb();
  const settingsRef = doc(db, 'user_settings', userEmail);
  const snapshot = await getDoc(settingsRef);

  const settingsData = {
    ...settings,
    updated_at: Timestamp.now(),
  };

  if (snapshot.exists()) {
    await updateDoc(settingsRef, settingsData);
  } else {
    const { setDoc } = await import('firebase/firestore');
    await setDoc(settingsRef, settingsData);
  }
}

// ============================================================
// Client CRUD Operations
// ============================================================

/**
 * Create a new client
 */
export async function createClient(
  client: Omit<Client, 'id'>
): Promise<string> {
  const db = getFirebaseDb();
  const clientsRef = collection(db, 'clients');

  const clientData = {
    ...client,
    status: client.status || 'active',
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
  };

  const docRef = await addDoc(clientsRef, clientData);
  return docRef.id;
}

/**
 * Update an existing client
 */
export async function updateClient(
  clientId: string,
  updates: Partial<Client>
): Promise<void> {
  const db = getFirebaseDb();
  const clientRef = doc(db, 'clients', clientId);

  await updateDoc(clientRef, {
    ...updates,
    updated_at: Timestamp.now(),
  });
}

/**
 * Soft delete a client (set status to inactive)
 */
export async function deleteClient(clientId: string): Promise<void> {
  const db = getFirebaseDb();
  const clientRef = doc(db, 'clients', clientId);

  await updateDoc(clientRef, {
    status: 'inactive',
    updated_at: Timestamp.now(),
  });
}

// ============================================================
// Project CRUD Operations
// ============================================================

/**
 * Create a new project
 */
export async function createProject(
  project: Omit<Project, 'id'>
): Promise<string> {
  const db = getFirebaseDb();
  const projectsRef = collection(db, 'projects');

  const projectData = {
    ...project,
    status: project.status || 'active',
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
  };

  const docRef = await addDoc(projectsRef, projectData);
  return docRef.id;
}

/**
 * Update an existing project
 */
export async function updateProject(
  projectId: string,
  updates: Partial<Project>
): Promise<void> {
  const db = getFirebaseDb();
  const projectRef = doc(db, 'projects', projectId);

  await updateDoc(projectRef, {
    ...updates,
    updated_at: Timestamp.now(),
  });
}

/**
 * Soft delete a project (set status to inactive/completed)
 */
export async function deleteProject(projectId: string): Promise<void> {
  const db = getFirebaseDb();
  const projectRef = doc(db, 'projects', projectId);

  await updateDoc(projectRef, {
    status: 'completed',
    updated_at: Timestamp.now(),
  });
}
