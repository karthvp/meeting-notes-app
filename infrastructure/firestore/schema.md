# Firestore Schema Documentation

## Overview

Egen Meeting Notes uses Firestore in Native mode with the following collections:

1. **clients** - Client organizations
2. **projects** - Client projects
3. **rules** - Classification rules
4. **notes_metadata** - Meeting note metadata
5. **user_preferences** - Per-user settings

---

## Collections

### 1. `clients`

Stores information about client organizations.

```typescript
interface Client {
  id: string;                    // Document ID: "client_xxx"
  name: string;                  // "Acme Corp"
  domains: string[];             // ["acme.com", "acmecorp.com"]
  keywords: string[];            // ["acme", "acme corp"]
  account_manager: string;       // "sarah@egen.com"
  drive_folder_id: string;       // Google Drive folder ID
  projects: string[];            // ["proj_xxx", "proj_yyy"]
  created_at: Timestamp;
  updated_at: Timestamp;
  status: "active" | "inactive";
}
```

**Indexes:**
- `status` (for filtering active clients)
- `domains` (array-contains for domain lookup)
- `account_manager` (for filtering by account manager)

---

### 2. `projects`

Stores client project details.

```typescript
interface Project {
  id: string;                    // Document ID: "proj_xxx"
  client_id: string;             // Reference to client: "client_xxx"
  client_name: string;           // Denormalized: "Acme Corp"
  project_name: string;          // "Data Platform"
  keywords: string[];            // ["data platform", "bigquery"]
  team: TeamMember[];            // Project team
  drive_folder_id: string;       // Google Drive folder ID
  drive_folder_path: string;     // "Meeting Notes/Clients/Acme Corp/Data Platform"
  created_at: Timestamp;
  updated_at: Timestamp;
  status: "active" | "completed" | "on_hold";
}

interface TeamMember {
  email: string;                 // "alice@egen.com"
  role: string;                  // "lead", "engineer", "analyst"
  name: string;                  // "Alice Johnson"
}
```

**Indexes:**
- `client_id` (for filtering by client)
- `status` (for filtering active projects)
- `team.email` (array-contains for team lookup)
- `keywords` (array-contains for keyword search)

---

### 3. `rules`

Stores classification rules for auto-categorization.

```typescript
interface Rule {
  id: string;                    // Document ID: "rule_xxx"
  name: string;                  // "Acme Corp Meetings"
  description: string;           // Human-readable description
  priority: number;              // Higher = checked first (0-100)
  conditions: RuleConditions;    // When to apply
  actions: RuleActions;          // What to do
  confidence_boost: number;      // Added to base confidence (0-0.5)
  stats: RuleStats;              // Usage statistics
  created_by: string;            // "alice@egen.com" or "system"
  created_at: Timestamp;
  updated_at: Timestamp;
  status: "active" | "disabled" | "testing";
}

interface RuleConditions {
  operator: "AND" | "OR";
  rules: Condition[];
}

interface Condition {
  field: string;                 // "title", "attendee_domains", etc.
  operator: string;              // "contains", "equals", "intersects", etc.
  value: string | string[];      // Match value(s)
}

interface RuleActions {
  classify_as: "client" | "internal" | "external" | "personal";
  client_id?: string;            // Specific client or "from_domain"
  client_detection?: "from_domain" | "from_keywords";
  project_id?: string;           // Specific project
  project_detection?: "auto" | "from_keywords";
  team?: string;                 // "Engineering", "Sales", etc.
  team_detection?: "auto";
  folder_path?: string;          // Specific folder path
  folder_template?: string;      // "Internal/{team}" template
  share_with?: string[];         // Emails to share with
  add_tags?: string[];           // Tags to add
}

interface RuleStats {
  times_applied: number;
  times_corrected: number;
  last_applied: Timestamp | null;
}
```

**Indexes:**
- `status, priority` (composite for active rule lookup)
- `created_by` (for filtering user-created rules)

---

### 4. `notes_metadata`

Stores metadata about meeting notes (the actual notes are in Google Drive).

```typescript
interface NoteMetadata {
  id: string;                    // Document ID: "note_xxx"
  drive_file_id: string;         // Google Drive file ID
  drive_file_url: string;        // Full URL to the document
  meeting: MeetingInfo;          // Meeting details
  classification: Classification; // How the note was classified
  folder: FolderInfo;            // Where the note is stored
  sharing: SharingInfo;          // Sharing details
  tags: string[];                // ["#acme", "#data-platform"]
  summary?: NoteSummary;         // Optional AI-generated summary
  created_at: Timestamp;
  updated_at: Timestamp;
  processed_at: Timestamp;
}

interface MeetingInfo {
  calendar_event_id?: string;    // Calendar event ID
  title: string;                 // Meeting title
  description?: string;          // Meeting description
  start_time: Timestamp;
  end_time: Timestamp;
  duration_minutes: number;
  organizer: string;             // Organizer email
  attendees: Attendee[];
}

interface Attendee {
  email: string;
  name?: string;
  internal: boolean;             // @egen.com = true
}

interface Classification {
  type: "client" | "internal" | "external" | "personal" | "uncategorized";
  client_id?: string;
  client_name?: string;
  project_id?: string;
  project_name?: string;
  internal_team?: string;        // "Engineering", "Sales", etc.
  confidence: number;            // 0.0 - 1.0
  rule_id?: string;              // Which rule matched
  auto_classified: boolean;
  user_confirmed: boolean;
  confirmed_by?: string;
  confirmed_at?: Timestamp;
}

interface FolderInfo {
  id: string;                    // Drive folder ID
  path: string;                  // "Meeting Notes/Clients/Acme Corp/Data Platform"
}

interface SharingInfo {
  shared_with: string[];         // Emails
  permission_level: "viewer" | "commenter" | "editor";
  shared_at?: Timestamp;
  shared_by?: string;
}

interface NoteSummary {
  key_points: string[];
  action_items: ActionItem[];
  decisions?: string[];
}

interface ActionItem {
  assignee?: string;
  task: string;
  due?: string;                  // ISO date
}
```

**Indexes:**
- `classification.type` (for filtering by type)
- `classification.client_id` (for filtering by client)
- `classification.project_id` (for filtering by project)
- `meeting.organizer` (for filtering user's meetings)
- `meeting.start_time` (for date range queries)
- `tags` (array-contains for tag filtering)
- `classification.type, meeting.start_time` (composite)

---

### 5. `user_preferences`

Stores per-user settings and learned patterns.

```typescript
interface UserPreferences {
  id: string;                    // Document ID = user email
  display_name: string;          // "Alice Johnson"
  settings: UserSettings;
  learned_patterns: LearnedPattern[];
  created_at: Timestamp;
  updated_at: Timestamp;
}

interface UserSettings {
  auto_file_threshold: number;   // 0.90 - auto-file if confidence >= this
  show_popup_threshold: number;  // 0.70 - show popup if confidence >= this
  default_share_permission: "viewer" | "commenter" | "editor";
  notification_preferences: NotificationPrefs;
}

interface NotificationPrefs {
  popup_enabled: boolean;
  email_digest: "none" | "daily" | "weekly";
  slack_notifications: boolean;
}

interface LearnedPattern {
  pattern: string;               // Description of pattern
  action: string;                // What action to take
  confidence: number;            // Learned confidence
  times_applied: number;
  last_applied: Timestamp;
}
```

---

## Security Rules Summary

| Collection | Read | Write |
|------------|------|-------|
| clients | Egen users | Egen users |
| projects | Egen users | Egen users |
| rules | Egen users | Egen users (admin in prod) |
| notes_metadata | Egen users (own/shared) | Egen users |
| user_preferences | Own only | Own only |

See `firestore.rules` for full implementation.

---

## Composite Indexes

Create these indexes in the Firebase Console or using `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "rules",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "priority", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "notes_metadata",
      "fields": [
        { "fieldPath": "classification.type", "order": "ASCENDING" },
        { "fieldPath": "meeting.start_time", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "notes_metadata",
      "fields": [
        { "fieldPath": "classification.client_id", "order": "ASCENDING" },
        { "fieldPath": "meeting.start_time", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "projects",
      "fields": [
        { "fieldPath": "client_id", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ]
}
```
