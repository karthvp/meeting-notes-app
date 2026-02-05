/**
 * Egen Meeting Notes - /setup-drive-folders Cloud Function
 *
 * Creates the folder structure in Google Drive based on clients/projects in Firestore.
 * Also creates Internal folders for team meetings.
 */

const functions = require('@google-cloud/functions-framework');
const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { google } = require('googleapis');

// Initialize Firestore
const db = new Firestore();

// Collections
const CLIENTS_COLLECTION = 'clients';
const PROJECTS_COLLECTION = 'projects';
const FOLDER_CONFIG_COLLECTION = 'folder_config';

/**
 * Get authenticated Drive client
 */
async function getDriveClient(accessToken = null) {
  if (accessToken) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

/**
 * Find or create a folder
 */
async function findOrCreateFolder(drive, name, parentId = null) {
  // Search for existing folder
  let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const searchResponse = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (searchResponse.data.files && searchResponse.data.files.length > 0) {
    return searchResponse.data.files[0];
  }

  // Create new folder
  const folderMetadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    folderMetadata.parents = [parentId];
  }

  const createResponse = await drive.files.create({
    requestBody: folderMetadata,
    fields: 'id, name, webViewLink',
  });

  return createResponse.data;
}

/**
 * Setup the complete folder structure
 */
async function setupFolderStructure(drive, userEmail) {
  const results = {
    rootFolder: null,
    clientsFolder: null,
    internalFolder: null,
    clients: [],
    internalTeams: [],
  };

  // 1. Create root "Egen Meeting Notes" folder
  const rootFolder = await findOrCreateFolder(drive, 'Egen Meeting Notes');
  results.rootFolder = { id: rootFolder.id, name: rootFolder.name };

  // 2. Create "Clients" folder
  const clientsFolder = await findOrCreateFolder(drive, 'Clients', rootFolder.id);
  results.clientsFolder = { id: clientsFolder.id, name: clientsFolder.name };

  // 3. Create "Internal" folder
  const internalFolder = await findOrCreateFolder(drive, 'Internal', rootFolder.id);
  results.internalFolder = { id: internalFolder.id, name: internalFolder.name };

  // 4. Create internal team folders
  const internalTeams = ['Engineering', 'Sales', 'Marketing', 'All Hands', 'Leadership'];
  for (const team of internalTeams) {
    const teamFolder = await findOrCreateFolder(drive, team, internalFolder.id);
    results.internalTeams.push({
      name: team,
      folderId: teamFolder.id,
    });

    // Save to Firestore
    await db.collection(FOLDER_CONFIG_COLLECTION).doc(`internal_${team.toLowerCase().replace(/\s+/g, '_')}`).set({
      type: 'internal',
      team_name: team,
      folder_id: teamFolder.id,
      folder_path: `Egen Meeting Notes/Internal/${team}`,
      created_by: userEmail,
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  // 5. Get clients from Firestore and create folders
  const clientsSnapshot = await db.collection(CLIENTS_COLLECTION).get();

  for (const clientDoc of clientsSnapshot.docs) {
    const client = { id: clientDoc.id, ...clientDoc.data() };

    // Create client folder
    const clientFolder = await findOrCreateFolder(drive, client.name, clientsFolder.id);

    const clientResult = {
      id: client.id,
      name: client.name,
      folderId: clientFolder.id,
      projects: [],
    };

    // Update client document with folder ID
    await db.collection(CLIENTS_COLLECTION).doc(client.id).update({
      folder_id: clientFolder.id,
      folder_path: `Egen Meeting Notes/Clients/${client.name}`,
      updated_at: FieldValue.serverTimestamp(),
    });

    // Get projects for this client
    const projectsSnapshot = await db.collection(PROJECTS_COLLECTION)
      .where('client_id', '==', client.id)
      .get();

    for (const projectDoc of projectsSnapshot.docs) {
      const project = { id: projectDoc.id, ...projectDoc.data() };

      // Create project folder
      const projectFolder = await findOrCreateFolder(drive, project.project_name || project.name, clientFolder.id);

      clientResult.projects.push({
        id: project.id,
        name: project.project_name || project.name,
        folderId: projectFolder.id,
      });

      // Update project document with folder ID
      await db.collection(PROJECTS_COLLECTION).doc(project.id).update({
        folder_id: projectFolder.id,
        folder_path: `Egen Meeting Notes/Clients/${client.name}/${project.project_name || project.name}`,
        updated_at: FieldValue.serverTimestamp(),
      });
    }

    results.clients.push(clientResult);
  }

  // 6. Save root folder config
  await db.collection(FOLDER_CONFIG_COLLECTION).doc('root').set({
    root_folder_id: rootFolder.id,
    clients_folder_id: clientsFolder.id,
    internal_folder_id: internalFolder.id,
    created_by: userEmail,
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });

  return results;
}

/**
 * HTTP Cloud Function entry point
 */
functions.http('setupDriveFolders', async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { userEmail, accessToken } = req.body;

    if (!userEmail) {
      res.status(400).json({ error: 'Missing required field: userEmail' });
      return;
    }

    // Get Drive client (use access token if provided for user's Drive)
    const drive = await getDriveClient(accessToken);

    // Setup folder structure
    const results = await setupFolderStructure(drive, userEmail);

    res.status(200).json({
      success: true,
      message: 'Folder structure created successfully',
      folders: results,
    });

  } catch (error) {
    console.error('Setup drive folders error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// Export for testing
module.exports = { setupFolderStructure };
