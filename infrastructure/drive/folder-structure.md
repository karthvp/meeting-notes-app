# Google Drive Folder Structure

## Overview

The Egen Meeting Notes application uses a hierarchical folder structure in Google Drive to organize meeting notes by client, project, and meeting type.

## Folder Hierarchy

```
Meeting Notes/                          # Root folder
├── Clients/                            # All client-related notes
│   ├── _New Clients/                   # Temporary holding for new client meetings
│   ├── Acme Corp/                      # Client folder
│   │   ├── Data Platform/              # Project folder
│   │   └── Cloud Migration/            # Project folder
│   ├── Beta Industries/
│   │   └── ML Pipeline/
│   └── Gamma Technologies/
│       └── Analytics Dashboard/
├── Internal/                           # Internal team meetings
│   ├── Engineering/
│   │   ├── Standups/                   # Daily standups
│   │   └── Retrospectives/             # Sprint retros
│   ├── Sales/                          # Sales team meetings
│   └── All Hands/                      # Company-wide meetings
├── External/                           # Non-client external meetings
│   └── Conferences/                    # Conference notes
└── _Uncategorized/                     # Notes pending classification
```

## Folder Naming Conventions

### Client Folders
- **Format:** `{Client Name}/`
- **Examples:** `Acme Corp/`, `Beta Industries/`
- **Notes:** Use official client name, avoid abbreviations

### Project Folders
- **Format:** `{Project Name}/`
- **Examples:** `Data Platform/`, `ML Pipeline/`
- **Notes:** Use descriptive project name

### Internal Folders
- **Format:** `{Team Name}/` or `{Meeting Type}/`
- **Predefined:** Engineering, Sales, All Hands
- **Notes:** Can be expanded as needed

### Special Folders
- **`_New Clients/`** - Temporary holding for meetings with potential new clients
- **`_Uncategorized/`** - Notes that couldn't be auto-classified

The underscore prefix (`_`) keeps these folders at the top when sorted alphabetically.

## Note Naming Conventions

Notes should be named with the following format:
```
YYYY-MM-DD - {Meeting Title}.gdoc
```

**Examples:**
- `2025-01-15 - Weekly Sync.gdoc`
- `2025-01-10 - Architecture Review.gdoc`
- `2025-01-05 - Kickoff Meeting.gdoc`

## Sharing Permissions

### Root Folder
- Shared with entire `@egen.com` domain as **Writer**
- All subfolders inherit this permission

### Client Project Folders
- Optionally shared with specific team members as **Commenter**
- Project team lead can manage permissions

### Individual Notes
- Auto-shared with meeting attendees (internal only) as **Commenter**
- Can be shared with external parties on case-by-case basis

## Folder ID Reference

After running the setup script, folder IDs are stored in `folder-ids.json`:

```json
{
  "generated_at": "2025-02-04T00:00:00.000Z",
  "root_folder": "Meeting Notes",
  "folders": {
    "Meeting Notes": {
      "id": "1abc...",
      "webViewLink": "https://drive.google.com/..."
    },
    "Meeting Notes/Clients": {
      "id": "1def...",
      "webViewLink": "https://drive.google.com/..."
    }
    // ... more folders
  }
}
```

## Updating Folder Structure

To add new clients or projects:

1. **Via AppSheet Dashboard** (preferred)
   - Create new client/project in dashboard
   - Folder is automatically created

2. **Manually in Drive**
   - Create folder following naming conventions
   - Update Firestore with new folder ID

3. **Via API**
   - Use the `/create-folder` endpoint (coming in Week 2)

## Migration Notes

When migrating existing notes:
1. Create the full folder hierarchy first
2. Move notes to appropriate folders
3. Update `notes_metadata` collection with new folder paths
4. Verify sharing permissions are maintained
