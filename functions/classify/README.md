# /classify Cloud Function

Classifies meeting notes based on attendees, title, and rules.

## API Specification

### Endpoint
```
POST /classify
```

### Request Body
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

### Response
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
      {"email": "alice@egen.com", "role": "lead"},
      {"email": "bob@egen.com", "role": "engineer"}
    ],
    "tags": ["#acme", "#data-platform"]
  },
  "auto_apply": true
}
```

## Classification Logic

### Meeting Types
- **client** - Meeting with external client attendees
- **internal** - Meeting with only @egen.com attendees
- **external** - Meeting with external non-client attendees
- **uncategorized** - Unable to determine meeting type

### Classification Priority
1. Apply explicit rules from Firestore
2. Match client by attendee email domain
3. Match client by title keywords
4. Classify as internal if all @egen.com
5. Classify as external if has unknown external domains
6. Default to uncategorized

### Confidence Scoring
- Base confidence: 0.50
- Domain match: +0.30
- Keyword match: +0.20
- Project keyword match: +0.15
- Rule confidence boost: +0.05 to +0.30
- All internal for internal meeting: +0.20

### Auto-Apply Threshold
- Confidence >= 0.90: `auto_apply: true`
- Confidence < 0.90: `auto_apply: false` (requires user confirmation)

## Local Development

### Prerequisites
- Node.js 18+
- GCP project with Firestore
- Service account credentials

### Setup
```bash
cd functions
npm install

# Set credentials
export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"
```

### Run Locally
```bash
npm run dev
```

Server starts at `http://localhost:8080`

### Test Request
```bash
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -d '{
    "meeting": {
      "title": "Weekly Sync - Acme Data Platform",
      "attendees": [
        {"email": "alice@egen.com"},
        {"email": "john@acme.com"}
      ]
    }
  }'
```

## Deployment

### Deploy (unauthenticated - for testing)
```bash
npm run deploy
```

### Deploy (authenticated - production)
```bash
npm run deploy:prod
```

### Manual deployment
```bash
gcloud functions deploy classify \
  --runtime nodejs18 \
  --trigger-http \
  --entry-point classify \
  --source=classify \
  --project=egen-meeting-notes \
  --region=us-central1
```

## Future Enhancements (Phase 2)

- Gemini Pro integration for AI-powered classification
- Learning from user corrections
- More sophisticated confidence scoring
- Historical pattern matching
