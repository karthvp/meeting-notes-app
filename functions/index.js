/**
 * Egen Meeting Notes - Cloud Functions Entry Point
 *
 * This file exports all Cloud Functions for deployment.
 * Each function is registered with the functions-framework in its own module.
 */

// Register all functions with the framework
require('./classify/index.js');
require('./update-note/index.js');
require('./save-note/index.js');
require('./share/index.js');
require('./feedback/index.js');
require('./process-new-note/index.js');
require('./register-drive-webhook/index.js');
require('./get-note-for-meeting/index.js');
require('./setup-drive-folders/index.js');
require('./get-folders/index.js');
require('./get-user-settings/index.js');
require('./import-from-drive/index.js');
require('./drive-token/index.js');
