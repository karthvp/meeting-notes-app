# Egen Meeting Notes Dashboard - Setup Guide

## Prerequisites

- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- Access to `karthik-patil-sandbox` GCP project

## Quick Start

### 1. Install Dependencies

```bash
cd dashboard
npm install
```

### 2. Configure Firebase

Create a `.env.local` file from the example:

```bash
cp .env.local.example .env.local
```

Get your Firebase config from the [Firebase Console](https://console.firebase.google.com/project/karthik-patil-sandbox/settings/general):

1. Go to Project Settings > General
2. Under "Your apps", add a Web app if none exists
3. Copy the config values to `.env.local`

Example `.env.local`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=karthik-patil-sandbox.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=karthik-patil-sandbox
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=karthik-patil-sandbox.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 3. Enable Firebase Authentication

1. Go to [Firebase Console > Authentication](https://console.firebase.google.com/project/karthik-patil-sandbox/authentication)
2. Click "Get Started" if not already enabled
3. Enable Google provider:
   - Click "Google" under Sign-in providers
   - Toggle "Enable"
   - Set a support email
   - Save

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Deploy to Firebase Hosting

Login to Firebase:
```bash
firebase login
```

Deploy with Firebase App Hosting (supports SSR):
```bash
firebase experiments:enable webframeworks
firebase init hosting  # Select "Use an existing project" and "karthik-patil-sandbox"
firebase deploy
```

## Project Structure

```
dashboard/
├── app/                    # Next.js App Router pages
│   ├── (dashboard)/        # Protected dashboard routes
│   │   ├── page.tsx        # Dashboard home
│   │   ├── notes/          # Notes list and detail
│   │   ├── clients/        # Clients list and detail
│   │   ├── projects/       # Projects list and detail
│   │   ├── uncategorized/  # Uncategorized notes queue
│   │   └── search/         # Search results
│   └── login/              # Login page
├── components/
│   ├── auth/               # Authentication components
│   ├── layout/             # Sidebar, header
│   ├── notes/              # Notes table, modals
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── firebase.ts         # Firebase client config
│   ├── firestore.ts        # Firestore queries
│   └── utils.ts            # Utilities
└── firebase.json           # Firebase hosting config
```

## Features

### Authentication
- Google Sign-In restricted to @egen.com domain
- Protected routes redirect to login

### Notes Management
- View all notes with sorting and filtering
- Categorize notes (assign client, project, type)
- Share notes with team members
- Search by title, content, client, or project

### Navigation
- Dashboard overview with stats
- Clients → Projects → Notes hierarchy
- Breadcrumb navigation
- Uncategorized queue for review

## Cloud Functions

The dashboard uses the existing Cloud Functions:

- `/classify` - AI-powered note classification
- `/update-note` - Update note metadata (to be deployed)

### Deploy update-note function

```bash
cd "../Desktop/Meeting notes app/functions/update-note"
npm install
npm run deploy
```

## Firestore Collections

- `clients` - Client records
- `projects` - Project records
- `notes_metadata` - Meeting notes
- `classification_rules` - Auto-classification rules
- `audit_log` - Change history

## Troubleshooting

### "Firebase can only be used on the client side"
Firebase is client-side only. Ensure you're not importing it in server components.

### Authentication errors
Check that:
1. Firebase Auth is enabled in console
2. Google provider is configured
3. Your domain is authorized in Firebase Console > Authentication > Settings

### Firestore permission denied
Ensure Firestore rules allow authenticated reads/writes:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
