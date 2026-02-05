/**
 * Egen Meeting Notes - Google Drive Folder Setup Script
 * Day 3: Create folder hierarchy in Google Drive
 *
 * Prerequisites:
 * - Node.js 18+
 * - Google APIs client library
 * - OAuth credentials with Drive access
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"
 *   node setup-folders.js
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Configuration
const ROOT_FOLDER_NAME = 'Meeting Notes';
const SHARE_WITH_DOMAIN = 'egen.com'; // Share with all @egen.com users

// Folder structure definition
const FOLDER_STRUCTURE = {
  name: ROOT_FOLDER_NAME,
  children: [
    {
      name: 'Clients',
      children: [
        { name: '_New Clients' },
        // Sample client folders (matching seed data)
        {
          name: 'Acme Corp',
          children: [
            { name: 'Data Platform' },
            { name: 'Cloud Migration' },
          ],
        },
        {
          name: 'Beta Industries',
          children: [{ name: 'ML Pipeline' }],
        },
        {
          name: 'Gamma Technologies',
          children: [{ name: 'Analytics Dashboard' }],
        },
      ],
    },
    {
      name: 'Internal',
      children: [
        {
          name: 'Engineering',
          children: [{ name: 'Standups' }, { name: 'Retrospectives' }],
        },
        { name: 'Sales' },
        { name: 'All Hands' },
      ],
    },
    {
      name: 'External',
      children: [{ name: 'Conferences' }],
    },
    {
      name: '_Uncategorized',
    },
  ],
};

// Store folder IDs for reference
const folderIds = {};

/**
 * Initialize Google Drive API client
 */
async function initializeDriveClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const authClient = await auth.getClient();
  return google.drive({ version: 'v3', auth: authClient });
}

/**
 * Create a folder in Google Drive
 */
async function createFolder(drive, name, parentId = null) {
  const fileMetadata = {
    name: name,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  const response = await drive.files.create({
    resource: fileMetadata,
    fields: 'id, name, webViewLink',
  });

  return response.data;
}

/**
 * Check if folder already exists
 */
async function findFolder(drive, name, parentId = null) {
  let query = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name, webViewLink)',
    spaces: 'drive',
  });

  return response.data.files[0] || null;
}

/**
 * Set folder permissions for domain sharing
 */
async function shareFolderWithDomain(drive, folderId, domain) {
  try {
    await drive.permissions.create({
      fileId: folderId,
      resource: {
        type: 'domain',
        role: 'writer',
        domain: domain,
      },
      sendNotificationEmail: false,
    });
    console.log(`    Shared with @${domain}`);
  } catch (error) {
    // Domain sharing might not be allowed for all accounts
    console.log(`    Note: Domain sharing not available (${error.message})`);
  }
}

/**
 * Recursively create folder structure
 */
async function createFolderStructure(drive, structure, parentId = null, depth = 0) {
  const indent = '  '.repeat(depth);
  const folderPath = parentId ? `${folderIds[parentId]?.path || ''}/${structure.name}` : structure.name;

  // Check if folder exists
  let folder = await findFolder(drive, structure.name, parentId);

  if (folder) {
    console.log(`${indent}[EXISTS] ${structure.name}`);
  } else {
    folder = await createFolder(drive, structure.name, parentId);
    console.log(`${indent}[CREATED] ${structure.name}`);

    // Share root folder with domain
    if (depth === 0) {
      await shareFolderWithDomain(drive, folder.id, SHARE_WITH_DOMAIN);
    }
  }

  // Store folder info
  folderIds[folder.id] = {
    name: structure.name,
    path: folderPath,
    webViewLink: folder.webViewLink,
  };

  // Store by path for easy lookup
  folderIds[folderPath] = {
    id: folder.id,
    name: structure.name,
    webViewLink: folder.webViewLink,
  };

  // Create children
  if (structure.children) {
    for (const child of structure.children) {
      await createFolderStructure(drive, child, folder.id, depth + 1);
    }
  }

  return folder;
}

/**
 * Save folder IDs to a reference file
 */
function saveFolderIds(outputPath) {
  const referenceData = {
    generated_at: new Date().toISOString(),
    root_folder: ROOT_FOLDER_NAME,
    folders: {},
  };

  // Organize by path
  for (const [key, value] of Object.entries(folderIds)) {
    if (typeof value === 'object' && value.path) {
      referenceData.folders[value.path] = {
        id: key,
        webViewLink: value.webViewLink,
      };
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(referenceData, null, 2));
  console.log(`\nFolder IDs saved to: ${outputPath}`);
}

/**
 * Main function
 */
async function main() {
  console.log('==========================================');
  console.log('Egen Meeting Notes - Drive Folder Setup');
  console.log('==========================================');
  console.log('');

  try {
    // Initialize Drive client
    console.log('Initializing Google Drive API...');
    const drive = await initializeDriveClient();
    console.log('Connected to Google Drive.');
    console.log('');

    // Create folder structure
    console.log('Creating folder structure:');
    console.log('');
    await createFolderStructure(drive, FOLDER_STRUCTURE);

    // Save folder IDs
    console.log('');
    const outputPath = path.join(__dirname, 'folder-ids.json');
    saveFolderIds(outputPath);

    // Print summary
    console.log('');
    console.log('==========================================');
    console.log('Folder Setup Complete!');
    console.log('==========================================');
    console.log('');
    console.log('Root folder:', folderIds[ROOT_FOLDER_NAME]?.webViewLink || 'N/A');
    console.log('');
    console.log('Next steps:');
    console.log('1. Update Firestore seed data with folder IDs from folder-ids.json');
    console.log('2. Verify folder permissions in Google Drive');
    console.log('3. Test folder access with different users');

  } catch (error) {
    console.error('Error setting up folders:', error.message);

    if (error.message.includes('invalid_grant')) {
      console.log('');
      console.log('Authentication error. Please ensure:');
      console.log('1. Service account has Drive API enabled');
      console.log('2. Service account has been granted domain-wide delegation (if using Workspace)');
      console.log('3. GOOGLE_APPLICATION_CREDENTIALS is set correctly');
    }

    process.exit(1);
  }
}

// Run
main();
