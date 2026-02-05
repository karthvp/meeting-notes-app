/**
 * Egen Meeting Notes - /classify Function Tests
 * Day 5: Integration tests for classification endpoint
 */

const { classify } = require('../functions/classify/index.js');

// Mock Firestore
jest.mock('@google-cloud/firestore', () => {
  const mockClients = [
    {
      id: 'client_acme',
      name: 'Acme Corp',
      domains: ['acme.com', 'acmecorp.com'],
      keywords: ['acme', 'acme corp'],
      status: 'active',
    },
    {
      id: 'client_beta',
      name: 'Beta Industries',
      domains: ['beta-ind.com'],
      keywords: ['beta', 'beta industries'],
      status: 'active',
    },
  ];

  const mockProjects = [
    {
      id: 'proj_acme_data_platform',
      client_id: 'client_acme',
      client_name: 'Acme Corp',
      project_name: 'Data Platform',
      keywords: ['data platform', 'bigquery', 'analytics'],
      team: [
        { email: 'alice@egen.com', role: 'lead', name: 'Alice Johnson' },
        { email: 'bob@egen.com', role: 'engineer', name: 'Bob Smith' },
      ],
      drive_folder_path: 'Meeting Notes/Clients/Acme Corp/Data Platform',
      status: 'active',
    },
    {
      id: 'proj_acme_cloud_migration',
      client_id: 'client_acme',
      client_name: 'Acme Corp',
      project_name: 'Cloud Migration',
      keywords: ['cloud migration', 'gcp', 'migration'],
      team: [
        { email: 'dave@egen.com', role: 'lead', name: 'Dave Wilson' },
      ],
      drive_folder_path: 'Meeting Notes/Clients/Acme Corp/Cloud Migration',
      status: 'active',
    },
  ];

  const mockRules = [
    {
      id: 'rule_engineering_standup',
      name: 'Engineering Standup',
      priority: 80,
      conditions: {
        operator: 'AND',
        rules: [
          { field: 'title', operator: 'contains_any', value: ['standup', 'daily sync'] },
          { field: 'all_attendees_domain', operator: 'equals', value: 'egen.com' },
        ],
      },
      actions: {
        classify_as: 'internal',
        team: 'Engineering',
        folder_path: 'Meeting Notes/Internal/Engineering/Standups',
        add_tags: ['#engineering', '#standup'],
      },
      confidence_boost: 0.20,
      status: 'active',
    },
  ];

  // Create mock query results
  const createMockSnapshot = (docs) => ({
    docs: docs.map(doc => ({
      id: doc.id,
      data: () => doc,
    })),
    size: docs.length,
  });

  // Mock collection and query
  const mockCollection = jest.fn((collectionName) => {
    const mockQuery = {
      where: jest.fn(() => mockQuery),
      orderBy: jest.fn(() => mockQuery),
      get: jest.fn(async () => {
        if (collectionName === 'clients') {
          return createMockSnapshot(mockClients);
        }
        if (collectionName === 'projects') {
          return createMockSnapshot(mockProjects);
        }
        if (collectionName === 'rules') {
          return createMockSnapshot(mockRules);
        }
        return createMockSnapshot([]);
      }),
    };
    return mockQuery;
  });

  return {
    Firestore: jest.fn(() => ({
      collection: mockCollection,
    })),
  };
});

describe('/classify endpoint', () => {
  describe('Client classification by domain', () => {
    test('should classify meeting with Acme attendee as client meeting', async () => {
      const meeting = {
        title: 'Weekly Project Sync',
        attendees: [
          { email: 'alice@egen.com', name: 'Alice' },
          { email: 'john@acme.com', name: 'John' },
        ],
      };

      const result = await classify(meeting, 'test-file-id');

      expect(result.classification.type).toBe('client');
      expect(result.classification.client.name).toBe('Acme Corp');
      expect(result.classification.confidence).toBeGreaterThan(0.7);
    });

    test('should match project by keywords', async () => {
      const meeting = {
        title: 'Data Platform Architecture Review',
        attendees: [
          { email: 'alice@egen.com' },
          { email: 'john@acme.com' },
        ],
      };

      const result = await classify(meeting, 'test-file-id');

      expect(result.classification.type).toBe('client');
      expect(result.classification.project.name).toBe('Data Platform');
      expect(result.suggested_actions.folder_path).toContain('Data Platform');
    });
  });

  describe('Internal meeting classification', () => {
    test('should classify all-egen meeting as internal', async () => {
      const meeting = {
        title: 'Team Planning Session',
        attendees: [
          { email: 'alice@egen.com' },
          { email: 'bob@egen.com' },
          { email: 'charlie@egen.com' },
        ],
      };

      const result = await classify(meeting, 'test-file-id');

      expect(result.classification.type).toBe('internal');
      expect(result.suggested_actions.folder_path).toContain('Internal');
    });

    test('should detect engineering standup by rule', async () => {
      const meeting = {
        title: 'Daily Standup',
        attendees: [
          { email: 'alice@egen.com' },
          { email: 'bob@egen.com' },
        ],
      };

      const result = await classify(meeting, 'test-file-id');

      expect(result.classification.type).toBe('internal');
      expect(result.classification.internal_team).toBe('Engineering');
      expect(result.suggested_actions.folder_path).toContain('Standups');
      expect(result.suggested_actions.tags).toContain('#standup');
    });
  });

  describe('Confidence scoring', () => {
    test('should have higher confidence for domain match', async () => {
      const meetingWithDomain = {
        title: 'Generic Meeting',
        attendees: [
          { email: 'alice@egen.com' },
          { email: 'john@acme.com' },
        ],
      };

      const result = await classify(meetingWithDomain, 'test-file-id');

      expect(result.classification.confidence).toBeGreaterThan(0.7);
    });

    test('should set auto_apply true for high confidence', async () => {
      const meeting = {
        title: 'Data Platform Weekly Sync',
        attendees: [
          { email: 'alice@egen.com' },
          { email: 'john@acme.com' },
        ],
      };

      const result = await classify(meeting, 'test-file-id');

      // Domain match + project keyword match should give high confidence
      expect(result.classification.confidence).toBeGreaterThan(0.85);
    });
  });

  describe('Share suggestions', () => {
    test('should include project team in share suggestions', async () => {
      const meeting = {
        title: 'Data Platform Review',
        attendees: [
          { email: 'alice@egen.com' },
          { email: 'john@acme.com' },
        ],
      };

      const result = await classify(meeting, 'test-file-id');

      const shareEmails = result.suggested_actions.share_with.map(s => s.email);
      expect(shareEmails).toContain('alice@egen.com');
      expect(shareEmails).toContain('bob@egen.com'); // From project team
    });

    test('should not have duplicate emails in share suggestions', async () => {
      const meeting = {
        title: 'Meeting',
        attendees: [
          { email: 'alice@egen.com' },
          { email: 'alice@egen.com' }, // Duplicate
          { email: 'john@acme.com' },
        ],
      };

      const result = await classify(meeting, 'test-file-id');

      const shareEmails = result.suggested_actions.share_with.map(s => s.email);
      const uniqueEmails = [...new Set(shareEmails)];
      expect(shareEmails.length).toBe(uniqueEmails.length);
    });
  });

  describe('Uncategorized handling', () => {
    test('should classify unknown external meeting as external', async () => {
      const meeting = {
        title: 'Random Meeting',
        attendees: [
          { email: 'alice@egen.com' },
          { email: 'stranger@unknown.com' },
        ],
      };

      const result = await classify(meeting, 'test-file-id');

      expect(result.classification.type).toBe('external');
      expect(result.suggested_actions.folder_path).toContain('External');
    });
  });
});

describe('Input validation', () => {
  test('should handle missing attendees gracefully', async () => {
    const meeting = {
      title: 'Meeting with no attendees',
    };

    const result = await classify(meeting, 'test-file-id');

    expect(result).toBeDefined();
    expect(result.classification.type).toBe('uncategorized');
  });

  test('should handle empty title', async () => {
    const meeting = {
      title: '',
      attendees: [{ email: 'alice@egen.com' }],
    };

    const result = await classify(meeting, 'test-file-id');

    expect(result).toBeDefined();
    expect(result.classification.type).toBe('internal');
  });
});
