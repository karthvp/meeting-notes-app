# Egen Meeting Notes - API Documentation

## Overview

The Egen Meeting Notes API provides endpoints for classifying, organizing, and sharing meeting notes.

**Base URL:** `https://us-central1-egen-meeting-notes.cloudfunctions.net`

## Authentication

All endpoints require authentication via Google OAuth 2.0 or service account credentials.

### Headers
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

## Endpoints

### POST /classify

Classifies a meeting based on its metadata and returns suggested organization actions.

#### Request

```http
POST /classify HTTP/1.1
Host: us-central1-egen-meeting-notes.cloudfunctions.net
Content-Type: application/json
Authorization: Bearer <token>

{
  "meeting": {
    "title": "Weekly Sync - Acme Data Platform",
    "description": "Weekly sync to discuss project progress",
    "organizer": "alice@egen.com",
    "attendees": [
      {
        "email": "alice@egen.com",
        "name": "Alice Johnson"
      },
      {
        "email": "bob@egen.com",
        "name": "Bob Smith"
      },
      {
        "email": "john@acme.com",
        "name": "John Doe"
      }
    ],
    "start_time": "2025-01-15T14:00:00Z",
    "end_time": "2025-01-15T14:45:00Z"
  },
  "note_file_id": "1abc123..."
}
```

#### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `meeting` | object | Yes | Meeting metadata |
| `meeting.title` | string | Yes | Meeting title |
| `meeting.description` | string | No | Meeting description |
| `meeting.organizer` | string | No | Organizer email |
| `meeting.attendees` | array | No | List of attendees |
| `meeting.attendees[].email` | string | Yes | Attendee email |
| `meeting.attendees[].name` | string | No | Attendee name |
| `meeting.start_time` | string | No | ISO 8601 start time |
| `meeting.end_time` | string | No | ISO 8601 end time |
| `note_file_id` | string | No | Google Drive file ID |

#### Response

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
    "internal_team": null,
    "confidence": 0.95,
    "matched_rule_id": "rule_001"
  },
  "suggested_actions": {
    "folder_path": "Meeting Notes/Clients/Acme Corp/Data Platform",
    "folder_id": "1ghi789...",
    "share_with": [
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
    "tags": ["#acme", "#data-platform"]
  },
  "auto_apply": true,
  "match_info": {
    "clientMatchedBy": "domain",
    "projectMatchedBy": "keywords",
    "ruleConfidenceBoost": 0.25
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `classification.type` | string | Meeting type: `client`, `internal`, `external`, `uncategorized` |
| `classification.client` | object | Matched client (if type is `client`) |
| `classification.project` | object | Matched project (if found) |
| `classification.internal_team` | string | Detected team (if type is `internal`) |
| `classification.confidence` | number | Confidence score (0.0 - 1.0) |
| `classification.matched_rule_id` | string | ID of rule that matched (if any) |
| `suggested_actions.folder_path` | string | Suggested Drive folder path |
| `suggested_actions.folder_id` | string | Drive folder ID (if known) |
| `suggested_actions.share_with` | array | Suggested sharing recipients |
| `suggested_actions.tags` | array | Suggested tags |
| `auto_apply` | boolean | Whether to auto-apply classification |

#### Errors

| Code | Description |
|------|-------------|
| 400 | Missing required field |
| 401 | Unauthorized |
| 500 | Internal server error |

---

## Classification Types

### Client Meeting
- At least one attendee has email domain matching a known client
- Or meeting title contains client keywords

### Internal Meeting
- All attendees have @egen.com email addresses
- Subclassified by team when possible (Engineering, Sales, etc.)

### External Meeting
- Has external attendees that don't match any known client
- Typically conferences, vendor meetings, etc.

### Uncategorized
- Cannot determine meeting type
- Requires user intervention

---

## Confidence Scoring

Confidence is calculated based on match quality:

| Match Type | Confidence Boost |
|------------|-----------------|
| Base | 0.50 |
| Domain match | +0.30 |
| Client keywords | +0.20 |
| Project keywords | +0.15 |
| Rule match | +0.05 to +0.30 |
| All internal | +0.20 |

### Thresholds

| Confidence | Behavior |
|------------|----------|
| >= 0.90 | Auto-apply without confirmation |
| 0.70 - 0.89 | Show popup for confirmation |
| < 0.70 | Send to uncategorized queue |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| /classify | 100 requests/minute |

---

## Examples

### Example 1: Client Meeting

**Request:**
```bash
curl -X POST https://us-central1-egen-meeting-notes.cloudfunctions.net/classify \
  -H "Content-Type: application/json" \
  -d '{
    "meeting": {
      "title": "Acme Data Platform Review",
      "attendees": [
        {"email": "alice@egen.com"},
        {"email": "john@acme.com"}
      ]
    }
  }'
```

**Response:**
```json
{
  "classification": {
    "type": "client",
    "client": {"id": "client_acme", "name": "Acme Corp"},
    "project": {"id": "proj_acme_data_platform", "name": "Data Platform"},
    "confidence": 0.95
  },
  "auto_apply": true
}
```

### Example 2: Internal Meeting

**Request:**
```bash
curl -X POST https://us-central1-egen-meeting-notes.cloudfunctions.net/classify \
  -H "Content-Type: application/json" \
  -d '{
    "meeting": {
      "title": "Daily Standup",
      "attendees": [
        {"email": "alice@egen.com"},
        {"email": "bob@egen.com"}
      ]
    }
  }'
```

**Response:**
```json
{
  "classification": {
    "type": "internal",
    "internal_team": "Engineering",
    "confidence": 0.90
  },
  "suggested_actions": {
    "folder_path": "Meeting Notes/Internal/Engineering/Standups"
  },
  "auto_apply": true
}
```

### Example 3: Unknown External

**Request:**
```bash
curl -X POST https://us-central1-egen-meeting-notes.cloudfunctions.net/classify \
  -H "Content-Type: application/json" \
  -d '{
    "meeting": {
      "title": "Intro Call",
      "attendees": [
        {"email": "alice@egen.com"},
        {"email": "stranger@unknown.com"}
      ]
    }
  }'
```

**Response:**
```json
{
  "classification": {
    "type": "external",
    "confidence": 0.60
  },
  "suggested_actions": {
    "folder_path": "Meeting Notes/External"
  },
  "auto_apply": false
}
```

---

## Future Endpoints (Planned)

### POST /save-note
Move note to folder and apply metadata.

### POST /share
Share note with specified recipients.

### POST /feedback
Record user correction for learning.

### GET /rules
Get classification rules for user.

### POST /save-rule
Create or update classification rule.

### GET /search
Search across meeting notes.

---

## SDK Examples

### Node.js

```javascript
const fetch = require('node-fetch');

async function classifyMeeting(meeting) {
  const response = await fetch(
    'https://us-central1-egen-meeting-notes.cloudfunctions.net/classify',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ meeting }),
    }
  );

  return response.json();
}

// Usage
const result = await classifyMeeting({
  title: 'Weekly Sync',
  attendees: [
    { email: 'alice@egen.com' },
    { email: 'john@acme.com' },
  ],
});

console.log(result.classification);
```

### Python

```python
import requests

def classify_meeting(meeting, access_token):
    response = requests.post(
        'https://us-central1-egen-meeting-notes.cloudfunctions.net/classify',
        json={'meeting': meeting},
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
        }
    )
    return response.json()

# Usage
result = classify_meeting({
    'title': 'Weekly Sync',
    'attendees': [
        {'email': 'alice@egen.com'},
        {'email': 'john@acme.com'},
    ],
}, access_token)

print(result['classification'])
```
