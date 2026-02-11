/**
 * Egen Meeting Notes - /get-folders Cloud Function
 *
 * Returns all available folders for the extension picker.
 * Includes client/project folders and internal team folders.
 */

const functions = require('@google-cloud/functions-framework');
const { Firestore } = require('@google-cloud/firestore');
const { authenticateRequest } = require('../_shared/auth');

// Initialize Firestore
const db = new Firestore();

// Collections
const CLIENTS_COLLECTION = 'clients';
const PROJECTS_COLLECTION = 'projects';
const FOLDER_CONFIG_COLLECTION = 'folder_config';

/**
 * Get all folders organized for the picker
 */
async function getAllFolders() {
  const folders = {
    internal: [],
    clients: [],
  };

  // 1. Get internal team folders
  const internalSnapshot = await db.collection(FOLDER_CONFIG_COLLECTION)
    .where('type', '==', 'internal')
    .get();

  for (const doc of internalSnapshot.docs) {
    const data = doc.data();
    if (data.folder_id) {
      folders.internal.push({
        id: doc.id,
        name: data.team_name,
        folderId: data.folder_id,
        folderPath: data.folder_path,
      });
    }
  }

  // Sort internal folders
  folders.internal.sort((a, b) => a.name.localeCompare(b.name));

  // 2. Get active clients with their active projects
  const clientsSnapshot = await db.collection(CLIENTS_COLLECTION)
    .where('status', '==', 'active')
    .get();

  for (const clientDoc of clientsSnapshot.docs) {
    const client = { id: clientDoc.id, ...clientDoc.data() };

    const clientData = {
      id: client.id,
      name: client.name,
      folderId: client.folder_id || null,
      folderPath: client.folder_path || null,
      projects: [],
    };

    // Get active projects for this client
    const projectsSnapshot = await db.collection(PROJECTS_COLLECTION)
      .where('client_id', '==', client.id)
      .where('status', '==', 'active')
      .get();

    for (const projectDoc of projectsSnapshot.docs) {
      const project = { id: projectDoc.id, ...projectDoc.data() };
      clientData.projects.push({
        id: project.id,
        name: project.project_name || project.name,
        folderId: project.drive_folder_id || project.folder_id || null,
        folderPath: project.drive_folder_path || project.folder_path || null,
        team: project.team || [],
      });
    }

    // Only include clients that have at least one active project
    if (clientData.projects.length > 0) {
      folders.clients.push(clientData);
    }
  }

  // 3. Get root folder config
  const rootConfig = await db.collection(FOLDER_CONFIG_COLLECTION).doc('root').get();
  if (rootConfig.exists) {
    folders.rootConfig = rootConfig.data();
  }

  return folders;
}

/**
 * HTTP Cloud Function entry point
 */
functions.http('getFolders', async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Allow GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const authContext = await authenticateRequest(req, res);
    if (!authContext) {
      return;
    }

    const folders = await getAllFolders();

    // Add Cache-Control header for GET requests (5 minutes)
    if (req.method === 'GET') {
      res.set('Cache-Control', 'private, max-age=300');
    }

    res.status(200).json({
      success: true,
      folders,
    });

  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// Export for testing
module.exports = { getAllFolders };
