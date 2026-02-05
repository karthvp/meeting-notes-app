/**
 * Egen Meeting Notes - Firestore Seed Data Script
 * Day 2: Initialize Firestore with sample data
 *
 * Prerequisites:
 * - Node.js 18+
 * - Firebase Admin SDK
 * - Service account key file
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"
 *   node seed-data.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'karthik-patil-sandbox',
});

const db = admin.firestore();

// Sample Clients Data
const clients = [
  {
    id: 'client_acme',
    name: 'Acme Corp',
    domains: ['acme.com', 'acmecorp.com'],
    keywords: ['acme', 'acme corp', 'acme corporation'],
    account_manager: 'sarah@egen.com',
    drive_folder_id: '', // To be filled after Drive setup
    projects: ['proj_acme_data_platform', 'proj_acme_cloud_migration'],
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    status: 'active',
  },
  {
    id: 'client_beta',
    name: 'Beta Industries',
    domains: ['beta-ind.com', 'betaindustries.com'],
    keywords: ['beta', 'beta industries', 'beta ind'],
    account_manager: 'mike@egen.com',
    drive_folder_id: '',
    projects: ['proj_beta_ml_pipeline'],
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    status: 'active',
  },
  {
    id: 'client_gamma',
    name: 'Gamma Technologies',
    domains: ['gamma.io', 'gammatech.com'],
    keywords: ['gamma', 'gamma tech', 'gamma technologies'],
    account_manager: 'lisa@egen.com',
    drive_folder_id: '',
    projects: ['proj_gamma_analytics'],
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    status: 'active',
  },
];

// Sample Projects Data
const projects = [
  {
    id: 'proj_acme_data_platform',
    client_id: 'client_acme',
    client_name: 'Acme Corp',
    project_name: 'Data Platform',
    keywords: ['data platform', 'lakehouse', 'bigquery', 'analytics', 'data warehouse'],
    team: [
      { email: 'alice@egen.com', role: 'lead', name: 'Alice Johnson' },
      { email: 'bob@egen.com', role: 'engineer', name: 'Bob Smith' },
      { email: 'charlie@egen.com', role: 'engineer', name: 'Charlie Brown' },
    ],
    drive_folder_id: '',
    drive_folder_path: 'Meeting Notes/Clients/Acme Corp/Data Platform',
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    status: 'active',
  },
  {
    id: 'proj_acme_cloud_migration',
    client_id: 'client_acme',
    client_name: 'Acme Corp',
    project_name: 'Cloud Migration',
    keywords: ['cloud migration', 'gcp', 'aws', 'migration', 'lift and shift'],
    team: [
      { email: 'dave@egen.com', role: 'lead', name: 'Dave Wilson' },
      { email: 'alice@egen.com', role: 'architect', name: 'Alice Johnson' },
    ],
    drive_folder_id: '',
    drive_folder_path: 'Meeting Notes/Clients/Acme Corp/Cloud Migration',
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    status: 'active',
  },
  {
    id: 'proj_beta_ml_pipeline',
    client_id: 'client_beta',
    client_name: 'Beta Industries',
    project_name: 'ML Pipeline',
    keywords: ['ml', 'machine learning', 'pipeline', 'mlops', 'model training'],
    team: [
      { email: 'eve@egen.com', role: 'lead', name: 'Eve Martinez' },
      { email: 'frank@egen.com', role: 'ml engineer', name: 'Frank Lee' },
    ],
    drive_folder_id: '',
    drive_folder_path: 'Meeting Notes/Clients/Beta Industries/ML Pipeline',
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    status: 'active',
  },
  {
    id: 'proj_gamma_analytics',
    client_id: 'client_gamma',
    client_name: 'Gamma Technologies',
    project_name: 'Analytics Dashboard',
    keywords: ['analytics', 'dashboard', 'reporting', 'visualization', 'looker'],
    team: [
      { email: 'grace@egen.com', role: 'lead', name: 'Grace Kim' },
      { email: 'henry@egen.com', role: 'analyst', name: 'Henry Chen' },
    ],
    drive_folder_id: '',
    drive_folder_path: 'Meeting Notes/Clients/Gamma Technologies/Analytics Dashboard',
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    status: 'active',
  },
];

// Sample Classification Rules
const rules = [
  {
    id: 'rule_client_domain_match',
    name: 'Client by Domain',
    description: 'Match meetings by attendee email domain to known clients',
    priority: 100, // Higher priority = checked first
    conditions: {
      operator: 'OR',
      rules: [
        {
          field: 'attendee_domains',
          operator: 'intersects',
          value: 'client.domains', // Dynamic reference to client domains
        },
      ],
    },
    actions: {
      classify_as: 'client',
      client_detection: 'from_domain',
      project_detection: 'auto',
      add_tags: ['#client'],
    },
    confidence_boost: 0.25,
    stats: {
      times_applied: 0,
      times_corrected: 0,
      last_applied: null,
    },
    created_by: 'system',
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    status: 'active',
  },
  {
    id: 'rule_internal_egen_only',
    name: 'Internal Meeting - All Egen',
    description: 'Classify as internal when all attendees are @egen.com',
    priority: 90,
    conditions: {
      operator: 'AND',
      rules: [
        {
          field: 'all_attendees_domain',
          operator: 'equals',
          value: 'egen.com',
        },
      ],
    },
    actions: {
      classify_as: 'internal',
      team_detection: 'auto',
      folder_template: 'Internal/{team}',
      add_tags: ['#internal'],
    },
    confidence_boost: 0.30,
    stats: {
      times_applied: 0,
      times_corrected: 0,
      last_applied: null,
    },
    created_by: 'system',
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    status: 'active',
  },
  {
    id: 'rule_engineering_standup',
    name: 'Engineering Standup',
    description: 'Classify engineering standup meetings',
    priority: 80,
    conditions: {
      operator: 'AND',
      rules: [
        {
          field: 'title',
          operator: 'contains_any',
          value: ['standup', 'daily sync', 'daily standup', 'engineering sync'],
        },
        {
          field: 'all_attendees_domain',
          operator: 'equals',
          value: 'egen.com',
        },
      ],
    },
    actions: {
      classify_as: 'internal',
      team: 'Engineering',
      folder_path: 'Internal/Engineering/Standups',
      share_with: ['engineering@egen.com'],
      add_tags: ['#engineering', '#standup'],
    },
    confidence_boost: 0.20,
    stats: {
      times_applied: 0,
      times_corrected: 0,
      last_applied: null,
    },
    created_by: 'system',
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    status: 'active',
  },
];

// Sample User Preferences
const userPreferences = [
  {
    id: 'alice@egen.com',
    display_name: 'Alice Johnson',
    settings: {
      auto_file_threshold: 0.90,
      show_popup_threshold: 0.70,
      default_share_permission: 'commenter',
      notification_preferences: {
        popup_enabled: true,
        email_digest: 'daily',
        slack_notifications: true,
      },
    },
    learned_patterns: [],
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  },
];

// Seed function
async function seedData() {
  console.log('Starting Firestore seed...');
  console.log('');

  const batch = db.batch();

  // Seed clients
  console.log('Seeding clients collection...');
  for (const client of clients) {
    const docRef = db.collection('clients').doc(client.id);
    batch.set(docRef, client);
    console.log(`  - ${client.name}`);
  }

  // Seed projects
  console.log('Seeding projects collection...');
  for (const project of projects) {
    const docRef = db.collection('projects').doc(project.id);
    batch.set(docRef, project);
    console.log(`  - ${project.client_name}: ${project.project_name}`);
  }

  // Seed rules
  console.log('Seeding rules collection...');
  for (const rule of rules) {
    const docRef = db.collection('rules').doc(rule.id);
    batch.set(docRef, rule);
    console.log(`  - ${rule.name}`);
  }

  // Seed user preferences
  console.log('Seeding user_preferences collection...');
  for (const pref of userPreferences) {
    const docRef = db.collection('user_preferences').doc(pref.id);
    batch.set(docRef, pref);
    console.log(`  - ${pref.display_name}`);
  }

  // Create empty notes_metadata collection by adding a placeholder
  // (Firestore creates collections automatically, but we add a system doc)
  console.log('Creating notes_metadata collection...');
  const systemDoc = db.collection('notes_metadata').doc('_system');
  batch.set(systemDoc, {
    description: 'System document - collection placeholder',
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Commit all changes
  console.log('');
  console.log('Committing batch write...');
  await batch.commit();

  console.log('');
  console.log('========================================');
  console.log('Firestore seed completed successfully!');
  console.log('========================================');
  console.log('');
  console.log('Collections created:');
  console.log(`  - clients: ${clients.length} documents`);
  console.log(`  - projects: ${projects.length} documents`);
  console.log(`  - rules: ${rules.length} documents`);
  console.log(`  - user_preferences: ${userPreferences.length} documents`);
  console.log('  - notes_metadata: ready for use');
  console.log('');
  console.log('View in console:');
  console.log('  https://console.cloud.google.com/firestore/data?project=karthik-patil-sandbox');
}

// Run seed
seedData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error seeding data:', error);
    process.exit(1);
  });
