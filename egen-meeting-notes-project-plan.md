# Egen Meeting Notes - Project Plan

> **A custom Granola.ai alternative built on Google Workspace**

**Project Owner:** [TBD]  
**Created:** February 4, 2025  
**Last Updated:** February 4, 2025  
**Status:** Planning

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Solution Overview](#solution-overview)
4. [Technical Architecture](#technical-architecture)
5. [User Interface Design](#user-interface-design)
6. [Data Models](#data-models)
7. [API Specifications](#api-specifications)
8. [Implementation Phases](#implementation-phases)
9. [Success Metrics](#success-metrics)
10. [Risks & Mitigations](#risks--mitigations)
11. [Open Questions](#open-questions)
12. [Appendix](#appendix)

---

## Executive Summary

### Goal
Build an internal tool that replicates Granola.ai's core functionality within Google Workspace, enabling Egen team members to automatically organize, share, and find meeting notes by client, project, and team.

### Why Build vs Buy?
- Granola.ai requires company-wide purchase decision (timeline uncertain)
- Custom solution integrates directly with existing GSuite infrastructure
- Can be tailored to Egen's specific client/project structure
- Full control over data and privacy

### Key Deliverables
1. **Chrome Extension** - Post-meeting popup for one-click note organization
2. **Next.js Dashboard** - Management interface for notes, folders, and rules
3. **Classification API** - Gemini-powered auto-categorization
4. **Learning System** - Improves accuracy based on user corrections

### Timeline
8 weeks to MVP, with iterative improvements thereafter.

### Tech Stack
- **Frontend:** Chrome Extension (Manifest V3), Next.js 16 (React 19, TypeScript, Tailwind CSS)
- **Backend:** Google Cloud Functions (Node.js)
- **AI:** Gemini 1.5 Pro via Vertex AI or AI Studio
- **Database:** Firestore (rules, patterns, metadata)
- **Storage:** Google Drive (notes)
- **APIs:** Google Calendar, Google Drive, Google Docs
- **UI Components:** Radix UI, TanStack React Query

---

## Problem Statement

### Current Pain Points

| Pain Point | Impact | Frequency |
|------------|--------|-----------|
| Gemini notes scattered in Drive | Can't find notes when needed | Every meeting |
| No client/project association | Manual organization required | Every meeting |
| Manual sharing workflow | Notes not reaching right people | Daily |
| Poor searchability | Time wasted searching | Multiple times/week |
| No centralized view | No visibility into team's meetings | Weekly |

### User Stories

**As a consultant, I want to:**
- Have my meeting notes automatically filed by client/project so I can find them later
- Share notes with my project team without manual effort
- Search across all my client meetings in one place

**As a project lead, I want to:**
- See all meeting notes for my project in one place
- Ensure my team has access to relevant meeting notes
- Review what was discussed in meetings I couldn't attend

**As an account manager, I want to:**
- Access all meeting notes for my client across all projects
- Share relevant notes with client stakeholders when needed
- Track meeting cadence and topics across the account

### What Granola Does Well
1. **Instant organization** - Notes auto-file to the right place
2. **Smart detection** - Recognizes clients/projects from context
3. **One-click sharing** - Pre-suggests the right recipients
4. **Learning system** - Gets smarter with use
5. **Clean UI** - Minimal friction, maximum clarity

---

## Solution Overview

### Core Concept

```
Meeting Ends → AI Classifies → User Confirms (1-click) → Auto-File & Share
```

### Key Features

#### 1. Intelligent Classification
- Analyze meeting title, description, attendees
- Match against known clients/projects
- Learn from user corrections
- Confidence scoring determines automation level

#### 2. Automatic Organization
- Hierarchical folder structure in Drive
- Consistent naming conventions
- Metadata tagging for search

#### 3. Smart Sharing
- Rules-based auto-sharing by project/team
- One-click sharing with suggested recipients
- Permission levels (viewer, commenter, editor)

#### 4. Unified Dashboard
- Browse notes by client, project, date
- Search across all meeting notes
- Manage classification rules
- Handle uncategorized items

### User Experience Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MEETING ENDS                                  │
│                            │                                         │
│                            ▼                                         │
│              ┌─────────────────────────┐                            │
│              │  Gemini creates notes   │                            │
│              │  in Drive               │                            │
│              └───────────┬─────────────┘                            │
│                          │                                           │
│                          ▼                                           │
│              ┌─────────────────────────┐                            │
│              │  Cloud Function         │                            │
│              │  detects new note       │                            │
│              └───────────┬─────────────┘                            │
│                          │                                           │
│                          ▼                                           │
│              ┌─────────────────────────┐                            │
│              │  Gemini Pro classifies  │                            │
│              │  meeting context        │                            │
│              └───────────┬─────────────┘                            │
│                          │                                           │
│           ┌──────────────┼──────────────┐                           │
│           │              │              │                            │
│           ▼              ▼              ▼                            │
│    ┌───────────┐  ┌───────────┐  ┌───────────┐                      │
│    │ High      │  │ Medium    │  │ Low       │                      │
│    │ Confidence│  │ Confidence│  │ Confidence│                      │
│    │ (>90%)    │  │ (70-90%)  │  │ (<70%)    │                      │
│    └─────┬─────┘  └─────┬─────┘  └─────┬─────┘                      │
│          │              │              │                             │
│          ▼              ▼              ▼                             │
│    ┌───────────┐  ┌───────────┐  ┌───────────┐                      │
│    │ Auto-file │  │ Show      │  │ Add to    │                      │
│    │ + Toast   │  │ Popup for │  │ Uncateg-  │                      │
│    │ with Undo │  │ Confirm   │  │ orized    │                      │
│    └───────────┘  └───────────┘  └───────────┘                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Technical Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER LAYER                                      │
│                                                                              │
│   ┌────────────────────────┐         ┌────────────────────────┐             │
│   │   Chrome Extension     │         │   Next.js Dashboard    │             │
│   │   ─────────────────    │         │   ─────────────────    │             │
│   │   • Post-meeting popup │         │   • Browse notes       │             │
│   │   • Quick actions      │         │   • Manage rules       │             │
│   │   • Notifications      │         │   • Bulk operations    │             │
│   └───────────┬────────────┘         └───────────┬────────────┘             │
│               │                                   │                          │
└───────────────┼───────────────────────────────────┼──────────────────────────┘
                │                                   │
                ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
│                        (Google Cloud Functions)                              │
│                                                                              │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│   │  /classify   │ │  /save-note  │ │   /share     │ │  /get-rules  │       │
│   │              │ │              │ │              │ │              │       │
│   │  POST        │ │  POST        │ │  POST        │ │  GET         │       │
│   │  Classify    │ │  Move note   │ │  Share note  │ │  Fetch user  │       │
│   │  meeting     │ │  to folder   │ │  with team   │ │  rules       │       │
│   └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                                              │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│   │ /save-rule   │ │  /feedback   │ │  /search     │ │  /process    │       │
│   │              │ │              │ │              │ │              │       │
│   │  POST        │ │  POST        │ │  GET         │ │  POST        │       │
│   │  Create/     │ │  Record user │ │  Search      │ │  Trigger     │       │
│   │  update rule │ │  correction  │ │  notes       │ │  processing  │       │
│   └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                │                   │                   │
                ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SERVICE LAYER                                     │
│                                                                              │
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│   │   Firestore      │  │   Google Drive   │  │   Gemini Pro     │          │
│   │   ────────────   │  │   ────────────   │  │   ────────────   │          │
│   │   • Rules        │  │   • Notes files  │  │   • Classification│          │
│   │   • Patterns     │  │   • Folder       │  │   • Summarization│          │
│   │   • Metadata     │  │     structure    │  │   • Extraction   │          │
│   │   • User prefs   │  │   • Sharing      │  │                  │          │
│   └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                              │
│   ┌──────────────────┐  ┌──────────────────┐                                │
│   │ Google Calendar  │  │   Google Docs    │                                │
│   │ ────────────     │  │   ────────────   │                                │
│   │ • Meeting data   │  │   • Note content │                                │
│   │ • Attendees      │  │   • Formatting   │                                │
│   │ • Timing         │  │                  │                                │
│   └──────────────────┘  └──────────────────┘                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Details

#### Chrome Extension (Manifest V3)
- **Purpose:** Post-meeting notification and quick actions
- **Triggers:** Calendar event end detection, Drive file watch
- **Permissions:** calendar.readonly, drive, identity, notifications
- **Tech:** HTML/CSS/JavaScript, Chrome APIs

#### Next.js Dashboard
- **Purpose:** Full management interface
- **Framework:** Next.js 16 with React 19, TypeScript, Tailwind CSS
- **Data Sources:** Firestore, Google Drive
- **Features:** CRUD operations, search, bulk actions, real-time updates
- **UI Components:** Radix UI primitives, TanStack React Query for data fetching
- **Access:** Web (responsive design)

#### Cloud Functions
- **Runtime:** Node.js 18 or Python 3.11
- **Triggers:** HTTP, Pub/Sub, Drive webhooks
- **Authentication:** Google Cloud IAM, Firebase Auth
- **Scaling:** Auto-scaling based on demand

#### Firestore Collections
- `rules` - Classification rules
- `patterns` - Learned patterns
- `notes_metadata` - Note metadata for quick search
- `user_preferences` - Per-user settings

---

## User Interface Design

### Chrome Extension - Post-Meeting Popup

```
┌──────────────────────────────────────────────────────────────────────┐
│  Egen Notes                                              [−] [×]     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  📅 Meeting ended: "Weekly Sync - Acme Data Platform"                │
│  🕐 Jan 15, 2025 • 45 min • 4 attendees                              │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 📝 Notes detected                                              │  │
│  │                                                                │  │
│  │ Key points:                                                    │  │
│  │ • Discussed Q1 timeline adjustments                            │  │
│  │ • Action: Bob to send updated architecture doc                 │  │
│  │ • Decision: Go with BigQuery over Snowflake                    │  │
│  │                                                                │  │
│  │ [View full notes ↗]                                            │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ───────────────────── Classification ─────────────────────          │
│                                                                      │
│  📁 Save to:                                                         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 📂 Clients / Acme Corp / Data Platform                    [▼]  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  👥 Share with:                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ [✓] Alice (Lead)           [✓] Bob (Engineer)                  │  │
│  │ [✓] Charlie (PM)           [ ] Add more...                     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  🏷️ Tags: [#acme] [#data-platform] [#q1] [+ Add tag]                 │
│                                                                      │
│  ┌────────────────────────┐  ┌────────────────────────┐             │
│  │     ✓ Save & Share     │  │     ⏸️ Review Later     │             │
│  └────────────────────────┘  └────────────────────────┘             │
│                                                                      │
│  ☐ Remember these settings for similar meetings                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Next.js Dashboard - Main View

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  🏠 Egen Meeting Notes                          🔍 Search...      [+ New Note]  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  📊 OVERVIEW                                                                    │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐    │
│  │    23      │ │     8      │ │     5      │ │     3      │ │     12     │    │
│  │ This Week  │ │ Acme Corp  │ │ Shared     │ │ Need Review│ │ Internal   │    │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘    │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  NAVIGATION          │  MEETING NOTES                                           │
│  ─────────────       │  ─────────────                                           │
│                      │                                                          │
│  📁 All Notes        │  Filter: [All ▼]  [This Week ▼]  [Any Project ▼]        │
│                      │                                                          │
│  📂 By Client        │  ┌─────────────────────────────────────────────────────┐ │
│  ├── 🏢 Acme Corp    │  │ ☐ │ 📝 Acme Data Platform Sync                      │ │
│  │   ├── Data Platf  │  │   │ Today 2:00 PM • 45 min                          │ │
│  │   └── Cloud Migr  │  │   │ 👥 Alice, Bob, Charlie                          │ │
│  ├── 🏢 Beta Ind     │  │   │ 📁 Acme Corp / Data Platform                    │ │
│  │   └── ML Pipeline │  │   │ 🏷️ #acme #data-platform #q1                      │ │
│  └── 🏢 Gamma Co     │  │   │                                                 │ │
│                      │  │   │ [View] [Share] [Move] [⋯]                       │ │
│  📂 By Team          │  └─────────────────────────────────────────────────────┘ │
│  ├── 🏠 Engineering  │                                                          │
│  ├── 🏠 Sales        │  ┌─────────────────────────────────────────────────────┐ │
│  └── 🏠 Leadership   │  │ ☐ │ 📝 Beta ML Pipeline Review                      │ │
│                      │  │   │ Today 11:00 AM • 30 min                         │ │
│  ⚠️ Uncategorized (3)│  │   │ 👥 Dana, Eve, Frank                             │ │
│                      │  │   │ 📁 Beta Industries / ML Pipeline                │ │
│  ─────────────       │  │   │ 🏷️ #beta #ml #architecture                       │ │
│                      │  │   │                                                 │ │
│  ⚙️ Settings         │  │   │ [View] [Share] [Move] [⋯]                       │ │
│  📋 Rules            │  └─────────────────────────────────────────────────────┘ │
│  📈 Analytics        │                                                          │
│                      │  ┌─────────────────────────────────────────────────────┐ │
│                      │  │ ☐ │ ⚠️ Uncategorized Meeting                        │ │
│                      │  │   │ Yesterday 4:00 PM • 20 min                      │ │
│                      │  │   │ 👥 john@newclient.com, sarah@egen.com           │ │
│                      │  │   │ 📁 ??? (Needs classification)                   │ │
│                      │  │   │                                                 │ │
│                      │  │   │ [Categorize] [Ignore] [Delete]                  │ │
│                      │  └─────────────────────────────────────────────────────┘ │
│                      │                                                          │
│                      │  [Select All] [Bulk Share] [Bulk Move] [Export]         │
│                      │                                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Next.js Dashboard - Rules Management

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  📋 Classification Rules                                        [+ New Rule]    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Active Rules (12)                                                              │
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  RULE: Acme Corp Meetings                                    [Edit] [⋯]   │  │
│  │  ─────────────────────────────────────────────────────────────────────    │  │
│  │  WHEN:                                                                    │  │
│  │    • Attendee domain contains: acme.com                                   │  │
│  │    • OR title contains: "Acme", "ACME"                                    │  │
│  │                                                                           │  │
│  │  THEN:                                                                    │  │
│  │    • File to: Clients / Acme Corp / [auto-detect project]                 │  │
│  │    • Share with: acme-team@egen.com                                       │  │
│  │    • Add tags: #acme                                                      │  │
│  │                                                                           │  │
│  │  Confidence: 95%  •  Applied 47 times  •  Last: Today                     │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  RULE: Engineering Standups                                  [Edit] [⋯]   │  │
│  │  ─────────────────────────────────────────────────────────────────────    │  │
│  │  WHEN:                                                                    │  │
│  │    • Title contains: "standup", "daily sync", "engineering sync"          │  │
│  │    • AND all attendees are @egen.com                                      │  │
│  │                                                                           │  │
│  │  THEN:                                                                    │  │
│  │    • File to: Internal / Engineering / Standups                           │  │
│  │    • Share with: engineering@egen.com                                     │  │
│  │    • Add tags: #engineering #standup                                      │  │
│  │                                                                           │  │
│  │  Confidence: 90%  •  Applied 23 times  •  Last: Yesterday                 │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  RULE: Sales Pipeline Meetings                               [Edit] [⋯]   │  │
│  │  ─────────────────────────────────────────────────────────────────────    │  │
│  │  WHEN:                                                                    │  │
│  │    • Organizer is: sales@egen.com                                         │  │
│  │    • OR title contains: "pipeline", "opportunity", "deal review"          │  │
│  │                                                                           │  │
│  │  THEN:                                                                    │  │
│  │    • File to: Internal / Sales                                            │  │
│  │    • Share with: sales@egen.com                                           │  │
│  │    • Add tags: #sales                                                     │  │
│  │                                                                           │  │
│  │  Confidence: 85%  •  Applied 15 times  •  Last: 3 days ago                │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Firestore Schema

#### Collection: `projects`
```javascript
{
  "id": "proj_acme_data_platform",
  "client_id": "client_acme",
  "client_name": "Acme Corp",
  "project_name": "Data Platform",
  "keywords": ["data platform", "lakehouse", "bigquery", "analytics"],
  "team": [
    {
      "email": "alice@egen.com",
      "role": "lead",
      "name": "Alice Johnson"
    },
    {
      "email": "bob@egen.com",
      "role": "engineer",
      "name": "Bob Smith"
    }
  ],
  "drive_folder_id": "1abc123...",
  "drive_folder_path": "Meeting Notes/Clients/Acme Corp/Data Platform",
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-15T10:30:00Z",
  "status": "active"
}
```

#### Collection: `clients`
```javascript
{
  "id": "client_acme",
  "name": "Acme Corp",
  "domains": ["acme.com", "acmecorp.com"],
  "keywords": ["acme", "acme corp", "acme corporation"],
  "account_manager": "sarah@egen.com",
  "drive_folder_id": "1xyz789...",
  "projects": ["proj_acme_data_platform", "proj_acme_cloud_migration"],
  "created_at": "2024-06-01T00:00:00Z",
  "status": "active"
}
```

#### Collection: `rules`
```javascript
{
  "id": "rule_001",
  "name": "Acme Corp Meetings",
  "priority": 10,
  "conditions": {
    "operator": "OR",
    "rules": [
      {
        "field": "attendee_domains",
        "operator": "contains",
        "value": "acme.com"
      },
      {
        "field": "title",
        "operator": "contains_any",
        "value": ["Acme", "ACME"]
      }
    ]
  },
  "actions": {
    "classify_as": "client",
    "client_id": "client_acme",
    "project_detection": "auto",
    "share_with": ["acme-team@egen.com"],
    "add_tags": ["#acme"],
    "folder_template": "Clients/{client_name}/{project_name}"
  },
  "confidence_boost": 0.15,
  "stats": {
    "times_applied": 47,
    "times_corrected": 2,
    "last_applied": "2025-01-15T14:30:00Z"
  },
  "created_by": "alice@egen.com",
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-10T09:00:00Z",
  "status": "active"
}
```

#### Collection: `notes_metadata`
```javascript
{
  "id": "note_20250115_143000",
  "drive_file_id": "1def456...",
  "drive_file_url": "https://docs.google.com/document/d/...",
  "meeting": {
    "calendar_event_id": "abc123...",
    "title": "Weekly Sync - Acme Data Platform",
    "start_time": "2025-01-15T14:00:00Z",
    "end_time": "2025-01-15T14:45:00Z",
    "duration_minutes": 45,
    "organizer": "alice@egen.com",
    "attendees": [
      {"email": "alice@egen.com", "name": "Alice Johnson", "internal": true},
      {"email": "bob@egen.com", "name": "Bob Smith", "internal": true},
      {"email": "john@acme.com", "name": "John Doe", "internal": false}
    ]
  },
  "classification": {
    "type": "client",
    "client_id": "client_acme",
    "client_name": "Acme Corp",
    "project_id": "proj_acme_data_platform",
    "project_name": "Data Platform",
    "confidence": 0.95,
    "rule_id": "rule_001",
    "auto_classified": true,
    "user_confirmed": true
  },
  "folder": {
    "id": "1ghi789...",
    "path": "Meeting Notes/Clients/Acme Corp/Data Platform"
  },
  "sharing": {
    "shared_with": ["alice@egen.com", "bob@egen.com", "acme-team@egen.com"],
    "permission_level": "commenter",
    "shared_at": "2025-01-15T14:50:00Z"
  },
  "tags": ["#acme", "#data-platform", "#q1"],
  "summary": {
    "key_points": [
      "Discussed Q1 timeline adjustments",
      "Decision: Go with BigQuery over Snowflake"
    ],
    "action_items": [
      {"assignee": "bob@egen.com", "task": "Send updated architecture doc", "due": "2025-01-17"}
    ]
  },
  "created_at": "2025-01-15T14:50:00Z",
  "updated_at": "2025-01-15T14:55:00Z",
  "processed_at": "2025-01-15T14:50:30Z"
}
```

#### Collection: `user_preferences`
```javascript
{
  "id": "alice@egen.com",
  "display_name": "Alice Johnson",
  "settings": {
    "auto_file_threshold": 0.90,
    "show_popup_threshold": 0.70,
    "default_share_permission": "commenter",
    "notification_preferences": {
      "popup_enabled": true,
      "email_digest": "daily",
      "slack_notifications": true
    }
  },
  "learned_patterns": [
    {
      "pattern": "meetings with john@newclient.com",
      "action": "file to Prospects/NewClient",
      "confidence": 0.85
    }
  ],
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z"
}
```

### Google Drive Folder Structure

```
📁 Meeting Notes/
├── 📁 Clients/
│   ├── 📁 Acme Corp/
│   │   ├── 📁 Data Platform/
│   │   │   ├── 📄 2025-01-15 - Weekly Sync.gdoc
│   │   │   ├── 📄 2025-01-10 - Architecture Review.gdoc
│   │   │   └── 📄 2025-01-05 - Kickoff Meeting.gdoc
│   │   └── 📁 Cloud Migration/
│   │       └── 📄 2025-01-12 - Planning Session.gdoc
│   ├── 📁 Beta Industries/
│   │   └── 📁 ML Pipeline/
│   │       └── 📄 2025-01-15 - ML Review.gdoc
│   └── 📁 _New Clients/
│       └── 📄 (temporary holding for new client meetings)
├── 📁 Internal/
│   ├── 📁 Engineering/
│   │   ├── 📁 Standups/
│   │   │   └── 📄 2025-01-15 - Daily Standup.gdoc
│   │   └── 📁 Retrospectives/
│   │       └── 📄 2025-01-10 - Sprint Retro.gdoc
│   ├── 📁 Sales/
│   │   └── 📄 2025-01-14 - Pipeline Review.gdoc
│   └── 📁 All Hands/
│       └── 📄 2025-01-13 - Monthly All Hands.gdoc
├── 📁 External/
│   └── 📁 Conferences/
│       └── 📄 2025-01-08 - GCP Next Planning.gdoc
└── 📁 _Uncategorized/
    └── 📄 (notes pending classification)
```

---

## API Specifications

### Cloud Function: `/classify`

**Purpose:** Classify a meeting based on its metadata

**Method:** POST

**Request:**
```json
{
  "meeting": {
    "title": "Weekly Sync - Acme Data Platform",
    "description": "Weekly sync to discuss project progress",
    "organizer": "alice@egen.com",
    "attendees": [
      {"email": "alice@egen.com", "name": "Alice Johnson"},
      {"email": "bob@egen.com", "name": "Bob Smith"},
      {"email": "john@acme.com", "name": "John Doe"}
    ],
    "start_time": "2025-01-15T14:00:00Z",
    "end_time": "2025-01-15T14:45:00Z"
  },
  "note_file_id": "1abc123..."
}
```

**Response:**
```json
{
  "classification": {
    "type": "client",
    "client": {
      "id": "client_acme",
      "name": "Acme Corp"
    },
    "project": {
      "id": "proj_acme_data_platform",
      "name": "Data Platform"
    },
    "confidence": 0.95,
    "matched_rule_id": "rule_001"
  },
  "suggested_actions": {
    "folder_path": "Meeting Notes/Clients/Acme Corp/Data Platform",
    "folder_id": "1ghi789...",
    "share_with": [
      {"email": "alice@egen.com", "role": "lead"},
      {"email": "bob@egen.com", "role": "engineer"},
      {"email": "acme-team@egen.com", "role": "team"}
    ],
    "tags": ["#acme", "#data-platform"]
  },
  "auto_apply": true
}
```

### Cloud Function: `/save-note`

**Purpose:** Move note to folder and apply metadata

**Method:** POST

**Request:**
```json
{
  "note_file_id": "1abc123...",
  "target_folder_id": "1ghi789...",
  "classification": {
    "type": "client",
    "client_id": "client_acme",
    "project_id": "proj_acme_data_platform"
  },
  "share_with": ["alice@egen.com", "bob@egen.com"],
  "permission_level": "commenter",
  "tags": ["#acme", "#data-platform"],
  "user_confirmed": true
}
```

**Response:**
```json
{
  "success": true,
  "note_metadata_id": "note_20250115_143000",
  "file_url": "https://docs.google.com/document/d/...",
  "folder_path": "Meeting Notes/Clients/Acme Corp/Data Platform",
  "shared_with": ["alice@egen.com", "bob@egen.com"]
}
```

### Cloud Function: `/feedback`

**Purpose:** Record user correction for learning

**Method:** POST

**Request:**
```json
{
  "note_metadata_id": "note_20250115_143000",
  "original_classification": {
    "type": "client",
    "client_id": "client_acme",
    "project_id": "proj_acme_data_platform",
    "confidence": 0.95
  },
  "corrected_classification": {
    "type": "client",
    "client_id": "client_acme",
    "project_id": "proj_acme_cloud_migration"
  },
  "correction_type": "project_change",
  "user": "alice@egen.com"
}
```

**Response:**
```json
{
  "success": true,
  "pattern_updated": true,
  "new_rule_suggested": false
}
```

### Gemini Classification Prompt

```
You are a meeting classifier for Egen, a consulting company.

CONTEXT:
- Egen works with multiple clients on various projects
- Meetings can be: client meetings, internal team meetings, external (non-client), or personal
- Each client has one or more projects with assigned team members

KNOWN CLIENTS AND PROJECTS:
{projects_yaml}

MEETING TO CLASSIFY:
- Title: {title}
- Description: {description}
- Organizer: {organizer}
- Attendees: {attendees}
- Date/Time: {datetime}

CLASSIFICATION RULES:
1. If any attendee's email domain matches a known client → likely client meeting
2. If title/description contains client or project keywords → match to that client/project
3. If all attendees are @egen.com → internal meeting
4. If attendees include external non-client domains → external meeting
5. Check historical patterns for similar meetings

OUTPUT (JSON only, no explanation):
{
  "meeting_type": "client" | "internal" | "external" | "personal",
  "client_id": "client_xxx" or null,
  "client_name": "Client Name" or null,
  "project_id": "proj_xxx" or null,
  "project_name": "Project Name" or null,
  "internal_team": "Engineering" | "Sales" | "Leadership" | null,
  "confidence": 0.0-1.0,
  "confidence_reasoning": "brief explanation",
  "suggested_folder_path": "Meeting Notes/...",
  "suggested_share_with": ["email1@", "email2@"],
  "suggested_tags": ["#tag1", "#tag2"],
  "is_new_client": true | false,
  "suggested_client_name": "if new client detected"
}

Be conservative with confidence scores:
- 0.95+ : Very clear match (known client domain + project keywords)
- 0.85-0.94: Good match (client domain or strong keyword match)
- 0.70-0.84: Probable match (some indicators but not definitive)
- Below 0.70: Uncertain, needs user input
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Goal:** Basic infrastructure and manual classification

#### Week 1: Setup & Core Infrastructure
- [ ] Set up GCP project with required APIs enabled
- [ ] Create Firestore database with initial schema
- [ ] Build initial folder structure in Google Drive
- [ ] Create `/classify` Cloud Function (basic version)
- [ ] Set up authentication (Google OAuth)
- [ ] Create initial projects/clients data in Firestore

#### Week 2: Next.js Dashboard
- [ ] Set up Next.js 16 project with TypeScript and Tailwind CSS
- [ ] Configure Firebase SDK and Firestore connection
- [ ] Build Notes list view with TanStack React Query
- [ ] Build Clients/Projects navigation with sidebar
- [ ] Implement manual "Categorize" modal
- [ ] Implement manual "Share" modal
- [ ] Add basic search functionality

**Deliverable:** Working dashboard where users can manually categorize and share notes

---

### Phase 2: Intelligent Classification (Weeks 3-4)

**Goal:** AI-powered auto-classification with confidence scoring

#### Week 3: Gemini Integration
- [ ] Integrate Gemini Pro API into `/classify` function
- [ ] Build comprehensive classification prompt
- [ ] Implement confidence scoring logic
- [ ] Create `/feedback` endpoint for corrections
- [ ] Build pattern learning system

#### Week 4: Automation Logic
- [ ] Set up Drive webhook to detect new Gemini notes
- [ ] Implement auto-filing for high-confidence matches
- [ ] Build uncategorized queue in dashboard
- [ ] Add confidence indicators to dashboard
- [ ] Implement "Remember this setting" functionality

**Deliverable:** Notes automatically classified with confidence scores; high-confidence notes auto-filed

---

### Phase 3: Chrome Extension (Weeks 5-6)

**Goal:** Post-meeting popup with one-click actions

#### Week 5: Extension Foundation
- [ ] Set up Chrome Extension project (Manifest V3)
- [ ] Implement Google OAuth in extension
- [ ] Build meeting end detection (Calendar API polling)
- [ ] Create basic popup UI
- [ ] Connect popup to Cloud Functions API

#### Week 6: Extension Polish
- [ ] Implement folder dropdown with search
- [ ] Build team member checkbox selection
- [ ] Add tag management
- [ ] Implement "Save & Share" action
- [ ] Add "Review Later" action
- [ ] Build toast notifications with undo

**Deliverable:** Working Chrome extension that shows popup after meetings

---

### Phase 4: Rules Engine & Sharing (Weeks 7-8)

**Goal:** Advanced rules management and auto-sharing

#### Week 7: Rules Engine
- [ ] Build rules management UI in Next.js Dashboard
- [ ] Implement rule creation/editing with form components
- [ ] Add rule testing functionality
- [ ] Build rule priority system
- [ ] Implement inheritance rules (project → client → default)

#### Week 8: Auto-Sharing & Polish
- [ ] Implement rules-based auto-sharing
- [ ] Add sharing notifications (email/Slack)
- [ ] Build bulk operations in dashboard
- [ ] Add analytics/stats view
- [ ] Performance optimization
- [ ] User documentation

**Deliverable:** Complete MVP with rules engine and auto-sharing

---

### Post-MVP Enhancements (Backlog)

#### Enhanced Notes Processing
- [ ] Extract action items from notes
- [ ] Create Google Tasks from action items
- [ ] Generate meeting summaries
- [ ] Highlight key decisions

#### Advanced Search
- [ ] Full-text search across all notes
- [ ] Search by attendee
- [ ] Date range filters
- [ ] Export search results

#### Integrations
- [ ] Slack notifications
- [ ] Email digest of recent notes
- [ ] Salesforce CRM integration
- [ ] Project management tool integration (Asana, Monday, etc.)

#### Mobile Experience
- [ ] Optimize Next.js Dashboard responsive design for mobile
- [ ] Push notifications
- [ ] Quick actions from notifications

---

## Success Metrics

### Primary Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to file notes | < 10 seconds | Average time from meeting end to note filed |
| Classification accuracy | > 90% | % of notes correctly auto-classified |
| User adoption | > 80% | % of team using the tool regularly |
| Note discoverability | < 30 seconds | Time to find a specific note |

### Secondary Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Auto-file rate | > 70% | % of notes filed without user intervention |
| Rule utilization | > 20 rules | Number of active classification rules |
| Search usage | Daily | Frequency of search feature usage |
| Uncategorized backlog | < 5 | Number of notes awaiting classification |

### Qualitative Goals
- Team members report spending less time organizing notes
- Notes are consistently shared with the right people
- Historical meeting context is easily accessible
- New team members can quickly find relevant project history

---

## Risks & Mitigations

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Gemini API rate limits | Medium | High | Implement caching, batch processing |
| Drive API quota exceeded | Low | High | Monitor usage, implement exponential backoff |
| Chrome Extension approval delays | Medium | Medium | Submit early, have fallback plan |
| Dashboard performance with large datasets | Medium | Medium | Implement pagination, optimize queries, use React Query caching |

### User Adoption Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Tool seen as extra work | Medium | High | Focus on one-click UX, show time savings |
| Poor initial classification accuracy | Medium | High | Manual review period, user feedback loop |
| Resistance to change | Medium | Medium | Involve users in design, gradual rollout |
| Incomplete project registry | High | Medium | Assign ownership, regular reviews |

### Data Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Incorrect sharing (privacy) | Low | High | Confirmation step, audit logging |
| Lost notes | Very Low | High | Notes remain in Drive, metadata backup |
| Stale project/client data | Medium | Medium | Regular reviews, easy update process |

---

## Open Questions

### Business Questions
1. **Who owns the project registry?** - Need someone responsible for keeping clients/projects updated
2. **What's the approval process for sharing rules?** - Who can create rules that auto-share with others?
3. **Should notes be shared externally with clients?** - Or always internal only?
4. **How do we handle confidential/sensitive meetings?** - Opt-out mechanism needed?

### Technical Questions
1. **Gemini API choice:** AI Studio (free tier) vs Vertex AI (production SLAs)?
2. **Extension distribution:** Chrome Web Store vs enterprise deployment?
3. **Notification channel:** Email, Slack, or both?
4. **Offline handling:** What happens if classification fails?

### UX Questions
1. **When should popup appear?** - Immediately after meeting, or wait for Gemini notes?
2. **How long to show toast notifications?** - And how long for undo window?
3. **Should we show confidence scores to users?** - Or hide the complexity?
4. **Bulk operation limits?** - How many notes can be moved/shared at once?

---

## Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| Classification | Determining the category (client/project/team) of a meeting |
| Confidence Score | AI's certainty about a classification (0-1) |
| Rule | A condition-action pair for auto-classifying meetings |
| Pattern | A learned association from user corrections |
| Auto-file | Automatically moving notes to folders without user intervention |

### B. Reference Links

- [Google Drive API Documentation](https://developers.google.com/drive/api)
- [Google Calendar API Documentation](https://developers.google.com/calendar/api)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Chrome Extension Developer Guide](https://developer.chrome.com/docs/extensions/)
- [Next.js Documentation](https://nextjs.org/docs)
- [TanStack React Query](https://tanstack.com/query/latest)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)

### C. Sample Classification Rules

```yaml
# High-confidence rules
rules:
  - name: "Client by Domain"
    condition: "attendee_domain IN known_client_domains"
    confidence_boost: +0.20
    
  - name: "Project by Keywords"
    condition: "title CONTAINS project_keywords"
    confidence_boost: +0.15
    
  - name: "Internal by All Egen"
    condition: "ALL attendees END WITH @egen.com"
    classify_as: "internal"
    confidence_boost: +0.25

# Lower-confidence rules
  - name: "Probable Client by Single External"
    condition: "EXACTLY ONE attendee NOT @egen.com"
    confidence_boost: +0.05
    
  - name: "Probable Internal by Title"
    condition: "title CONTAINS ['sync', 'standup', 'retro', '1:1']"
    classify_as: "internal"
    confidence_boost: +0.10
```

### D. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2025-02-04 | Claude/User | Initial draft |

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Answer open questions** (especially project registry ownership)
3. **Set up GCP project** and enable required APIs
4. **Create initial data** (clients, projects, team members)
5. **Begin Phase 1** implementation

---

*This document is a living plan and should be updated as the project progresses.*
