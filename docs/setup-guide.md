# Egen Meeting Notes - Setup Guide

This guide walks you through setting up the Egen Meeting Notes application for development and deployment.

## Prerequisites

Before starting, ensure you have:

- [ ] Google Cloud Platform account with billing enabled
- [ ] Google Workspace admin access (for OAuth consent)
- [ ] Node.js 18+ installed
- [ ] Google Cloud SDK (`gcloud`) installed
- [ ] Git installed

## Quick Start

### 1. Clone and Install

```bash
# Navigate to project
cd "Meeting notes app"

# Install dependencies for Cloud Functions
cd functions && npm install && cd ..

# Install dependencies for Firestore setup
cd infrastructure/firestore && npm install && cd ../..

# Install dependencies for Drive setup
cd infrastructure/drive && npm install && cd ../..
```

### 2. GCP Project Setup

```bash
# Authenticate with Google Cloud
gcloud auth login

# Run the setup script
cd infrastructure/gcp
chmod +x setup-project.sh
./setup-project.sh
```

This script will:
- Create the `egen-meeting-notes` GCP project
- Enable required APIs
- Create a service account
- Generate service account key
- Create Firestore database

### 3. Configure OAuth

```bash
# View OAuth configuration instructions
chmod +x configure-oauth.sh
./configure-oauth.sh
```

Follow the instructions to:
1. Configure OAuth consent screen for internal use
2. Create OAuth client credentials
3. Save credentials securely

### 4. Set Environment Variables

Create `.env` file in project root:

```bash
# GCP Configuration
GOOGLE_APPLICATION_CREDENTIALS=./infrastructure/gcp/service-account-key.json
GCP_PROJECT_ID=egen-meeting-notes
GCP_REGION=us-central1

# OAuth (from Step 3)
OAUTH_WEB_CLIENT_ID=your-client-id.apps.googleusercontent.com
OAUTH_WEB_CLIENT_SECRET=your-client-secret

# Function URLs (after deployment)
CLASSIFY_ENDPOINT=https://us-central1-egen-meeting-notes.cloudfunctions.net/classify
```

### 5. Seed Firestore Database

```bash
cd infrastructure/firestore
npm run seed
```

This creates:
- Sample clients (Acme Corp, Beta Industries, Gamma Technologies)
- Sample projects with team assignments
- Classification rules

### 6. Create Drive Folder Structure

```bash
cd infrastructure/drive
npm run setup
```

This creates:
- `Meeting Notes/` root folder
- Client and internal subfolders
- Proper sharing permissions

### 7. Deploy Cloud Functions

```bash
cd functions

# Deploy (unauthenticated for testing)
npm run deploy

# Or deploy with authentication
npm run deploy:prod
```

### 8. Verify Setup

Run integration tests:

```bash
cd tests
npm test
```

Test the classify endpoint:

```bash
curl -X POST https://us-central1-egen-meeting-notes.cloudfunctions.net/classify \
  -H "Content-Type: application/json" \
  -d '{
    "meeting": {
      "title": "Weekly Sync",
      "attendees": [
        {"email": "alice@egen.com"},
        {"email": "john@acme.com"}
      ]
    }
  }'
```

## Project Structure

```
Meeting notes app/
├── docs/                           # Documentation
│   ├── setup-guide.md             # This file
│   └── api-documentation.md       # API specs
├── functions/                      # Cloud Functions
│   ├── classify/                  # /classify function
│   │   ├── index.js              # Main function code
│   │   └── README.md             # Function documentation
│   └── package.json              # Dependencies
├── infrastructure/                 # Infrastructure setup
│   ├── gcp/                       # GCP project setup
│   │   ├── setup-project.sh      # Project creation script
│   │   └── configure-oauth.sh    # OAuth configuration guide
│   ├── firestore/                 # Database setup
│   │   ├── firestore.rules       # Security rules
│   │   ├── seed-data.js          # Seed data script
│   │   └── schema.md             # Schema documentation
│   └── drive/                     # Drive folder setup
│       ├── setup-folders.js      # Folder creation script
│       └── folder-structure.md   # Structure documentation
├── tests/                          # Test suites
│   ├── classify.test.js          # Unit tests
│   └── integration/              # Integration tests
└── week-1-plan.md                  # Implementation plan
```

## Development Workflow

### Local Development

1. Start the function locally:
   ```bash
   cd functions
   npm run dev
   ```

2. The function runs at `http://localhost:8080`

3. Test with curl or Postman

### Making Changes

1. Edit function code in `functions/classify/index.js`
2. Run tests: `npm test`
3. Deploy: `npm run deploy`

### Adding New Clients/Projects

1. **Via Firestore Console:**
   - Go to https://console.cloud.google.com/firestore
   - Add documents to `clients` or `projects` collection

2. **Via Seed Script:**
   - Edit `infrastructure/firestore/seed-data.js`
   - Run `npm run seed`

## Troubleshooting

### Authentication Errors

```
Error: Could not load the default credentials
```

**Solution:** Set `GOOGLE_APPLICATION_CREDENTIALS`:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"
```

### Firestore Permission Denied

```
Error: PERMISSION_DENIED: Missing or insufficient permissions
```

**Solution:**
1. Verify service account has `roles/datastore.user`
2. Check Firestore security rules

### Function Deployment Failed

```
Error: Build failed
```

**Solution:**
1. Check Node.js version matches `engines` in package.json
2. Verify all dependencies are installed
3. Check Cloud Build API is enabled

### Drive API Quota Exceeded

```
Error: Rate Limit Exceeded
```

**Solution:**
1. Implement exponential backoff
2. Request quota increase in GCP Console

## Next Steps

After Week 1 setup is complete:

- **Week 2:** Build AppSheet Dashboard
- **Week 3:** Integrate Gemini for AI classification
- **Week 4:** Add automation logic
- **Week 5-6:** Build Chrome Extension
- **Week 7-8:** Rules engine and auto-sharing

## Support

For issues:
1. Check this setup guide
2. Review error logs in GCP Console
3. Contact project team
