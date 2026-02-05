/**
 * Egen Meeting Notes - Chrome Extension Popup
 * Handles the popup UI logic for meeting note organization
 */

// API Configuration
const API_BASE_URL = 'https://us-central1-karthik-patil-sandbox.cloudfunctions.net';

// API Response Cache
const apiCache = {
  folders: { data: null, timestamp: 0 },
  settings: { data: null, timestamp: 0 }
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const cached = apiCache[key];
  if (cached.data && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCache(key, data) {
  apiCache[key] = { data, timestamp: Date.now() };
}

function clearCache(key) {
  if (key) {
    apiCache[key] = { data: null, timestamp: 0 };
  } else {
    Object.keys(apiCache).forEach(k => {
      apiCache[k] = { data: null, timestamp: 0 };
    });
  }
}

// State
let currentUser = null;
let currentMeeting = null;
let classification = null;
let clients = [];
let projects = [];
let userSettings = null;

// DOM Elements
const views = {
  login: document.getElementById('loginView'),
  loading: document.getElementById('loadingView'),
  noMeeting: document.getElementById('noMeetingView'),
  main: document.getElementById('mainView'),
  success: document.getElementById('successView'),
};

const elements = {
  loginBtn: document.getElementById('loginBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  checkMeetingsBtn: document.getElementById('checkMeetingsBtn'),
  saveShareBtn: document.getElementById('saveShareBtn'),
  reviewLaterBtn: document.getElementById('reviewLaterBtn'),
  undoBtn: document.getElementById('undoBtn'),
  loadingText: document.getElementById('loadingText'),
  meetingTitle: document.getElementById('meetingTitle'),
  meetingTime: document.getElementById('meetingTime'),
  meetingDuration: document.getElementById('meetingDuration'),
  meetingAttendees: document.getElementById('meetingAttendees'),
  notesPreview: document.getElementById('notesPreview'),
  notesContent: document.getElementById('notesContent'),
  viewFullNotes: document.getElementById('viewFullNotes'),
  folderSelect: document.getElementById('folderSelect'),
  aiSuggestion: document.getElementById('aiSuggestion'),
  aiConfidence: document.getElementById('aiConfidence'),
  shareList: document.getElementById('shareList'),
  tagsList: document.getElementById('tagsList'),
  rememberSetting: document.getElementById('rememberSetting'),
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toastMessage'),
  toastAction: document.getElementById('toastAction'),
  successMessage: document.getElementById('successMessage'),
  savedFolder: document.getElementById('savedFolder'),
  sharedWith: document.getElementById('sharedWith'),
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Initialize theme first
  if (window.ThemeUtils) {
    await window.ThemeUtils.initializeTheme();
  }

  setupEventListeners();
  await checkAuthState();
}

function setupEventListeners() {
  elements.loginBtn.addEventListener('click', handleLogin);
  elements.settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
  elements.checkMeetingsBtn.addEventListener('click', checkForMeetings);
  elements.saveShareBtn.addEventListener('click', handleSaveShare);
  elements.reviewLaterBtn.addEventListener('click', handleReviewLater);
  elements.undoBtn.addEventListener('click', handleUndo);
}

// View Management
function showView(viewName) {
  Object.values(views).forEach(view => view.classList.add('hidden'));
  if (views[viewName]) {
    views[viewName].classList.remove('hidden');
  }
}

function setLoading(text = 'Loading...') {
  elements.loadingText.textContent = text;
  showView('loading');
}

// Authentication
async function checkAuthState() {
  setLoading('Checking authentication...');

  try {
    // Check if we have a cached token
    const token = await getAuthToken(false);
    if (token) {
      // Verify token and get user info
      const userInfo = await fetchUserInfo(token);
      if (userInfo) {
        currentUser = userInfo;
        await loadInitialData();
        return;
      }
    }
    showView('login');
  } catch (error) {
    console.error('Auth check failed:', error);
    showView('login');
  }
}

async function handleLogin() {
  setLoading('Signing in...');

  try {
    const token = await getAuthToken(true);
    if (token) {
      const userInfo = await fetchUserInfo(token);
      if (userInfo) {
        // Verify domain
        if (!userInfo.email.endsWith('@egen.ai') && !userInfo.email.endsWith('@egen.com')) {
          showToast('Access restricted to Egen accounts only', 'error');
          await chrome.storage.local.remove(['authToken', 'tokenExpiry']);
          showView('login');
          return;
        }

        currentUser = userInfo;
        await loadInitialData();
      }
    }
  } catch (error) {
    console.error('Login failed:', error);
    showToast('Login failed. Please try again.', 'error');
    showView('login');
  }
}

// OAuth configuration
const OAUTH_CLIENT_ID = '309681502162-gv7a1djnlkfg0vtd7mgnbrlt973vo51a.apps.googleusercontent.com';
const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
].join(' ');

async function getAuthToken(interactive = false) {
  // First try to get cached token from storage
  const stored = await chrome.storage.local.get(['authToken', 'tokenExpiry']);

  if (stored.authToken && stored.tokenExpiry && Date.now() < stored.tokenExpiry) {
    return stored.authToken;
  }

  if (!interactive) {
    return null;
  }

  // Use launchWebAuthFlow for OAuth
  return new Promise((resolve, reject) => {
    const redirectUri = chrome.identity.getRedirectURL();
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');

    authUrl.searchParams.set('client_id', OAUTH_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('scope', OAUTH_SCOPES);
    authUrl.searchParams.set('prompt', 'select_account');

    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl.toString(),
        interactive: true
      },
      async (responseUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!responseUrl) {
          reject(new Error('No response URL'));
          return;
        }

        // Extract token from URL fragment
        const url = new URL(responseUrl);
        const hash = url.hash.substring(1);
        const params = new URLSearchParams(hash);
        const token = params.get('access_token');
        const expiresIn = params.get('expires_in');

        if (token) {
          // Cache the token
          const tokenExpiry = Date.now() + (parseInt(expiresIn, 10) * 1000) - 60000; // 1 min buffer
          await chrome.storage.local.set({ authToken: token, tokenExpiry });
          resolve(token);
        } else {
          reject(new Error('No access token in response'));
        }
      }
    );
  });
}

async function fetchUserInfo(token) {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to fetch user info:', error);
  }
  return null;
}

// Folder data from API
let folderData = null;

// Data Loading
async function loadInitialData() {
  setLoading('Loading data...');

  try {
    // Load user settings and folders in parallel instead of sequential
    const [settingsResult, foldersResult] = await Promise.all([
      loadUserSettings(),
      loadFolders()
    ]);

    // Populate folder dropdown
    populateFolderDropdown();

    // Check for recent meetings
    await checkForMeetings();
  } catch (error) {
    console.error('Failed to load initial data:', error);
    showView('noMeeting');
  }
}

async function loadUserSettings() {
  if (!currentUser?.email) return null;

  // Check cache first
  const cached = getCached('settings');
  if (cached) {
    console.log('Using cached user settings');
    userSettings = cached;
    return cached;
  }

  try {
    console.log('Loading user settings for:', currentUser.email);
    const response = await fetch(
      `${API_BASE_URL}/getUserSettings?userEmail=${encodeURIComponent(currentUser.email)}`
    );

    if (response.ok) {
      const data = await response.json();
      console.log('User settings:', data);
      if (data.found && data.settings) {
        userSettings = data.settings;
        setCache('settings', data.settings);
        return data.settings;
      }
    }
  } catch (error) {
    console.error('Failed to load user settings:', error);
    // Continue without settings - will fall back to Firestore search only
  }
  return null;
}

async function loadFolders() {
  // Check cache first
  const cached = getCached('folders');
  if (cached) {
    console.log('Using cached folders data');
    folderData = cached.folders;
    clients = cached.clients;
    projects = cached.projects;
    return cached;
  }

  try {
    console.log('Loading folders from:', `${API_BASE_URL}/getFolders`);
    const response = await fetch(`${API_BASE_URL}/getFolders`);
    console.log('Folders response status:', response.status);
    if (response.ok) {
      const data = await response.json();
      console.log('Folders data:', data);
      folderData = data.folders;

      // Extract clients and projects for backward compatibility
      clients = folderData.clients.map(c => ({
        id: c.id,
        name: c.name,
        folderId: c.folderId,
      }));

      projects = [];
      folderData.clients.forEach(client => {
        client.projects.forEach(project => {
          projects.push({
            id: project.id,
            client_id: client.id,
            name: project.name,
            folderId: project.folderId,
            team: project.team || [],
          });
        });
      });

      // Cache the processed data
      const cacheData = { folders: folderData, clients, projects };
      setCache('folders', cacheData);
      return cacheData;
    }
  } catch (error) {
    console.error('Failed to load folders:', error);
    // Fall back to empty arrays
    folderData = { internal: [], clients: [] };
    clients = [];
    projects = [];
  }
  return null;
}

function populateFolderDropdown() {
  console.log('Populating folder dropdown with:', folderData);
  const select = elements.folderSelect;
  select.innerHTML = '<option value="">Select a folder...</option>';

  // Add internal folders from API data (only if configured)
  if (folderData?.internal?.length > 0) {
    const internalGroup = document.createElement('optgroup');
    internalGroup.label = 'Internal';
    folderData.internal.forEach(folder => {
      const option = document.createElement('option');
      option.value = JSON.stringify({
        type: 'internal',
        team: folder.name,
        folderId: folder.folderId,
        folderPath: folder.folderPath,
      });
      option.textContent = `Internal / ${folder.name}`;
      option.dataset.folderId = folder.folderId;
      internalGroup.appendChild(option);
    });
    select.appendChild(internalGroup);
  }
  // No fallback - only show folders that are actually configured

  // Add client/project folders from API data
  if (folderData?.clients?.length > 0) {
    folderData.clients.forEach(client => {
      if (client.projects?.length > 0) {
        const group = document.createElement('optgroup');
        group.label = client.name;

        client.projects.forEach(project => {
          const option = document.createElement('option');
          option.value = JSON.stringify({
            type: 'client',
            clientId: client.id,
            clientName: client.name,
            projectId: project.id,
            projectName: project.name,
            folderId: project.folderId,
            folderPath: project.folderPath,
            team: project.team || [],
          });
          option.textContent = `${client.name} / ${project.name}`;
          option.dataset.folderId = project.folderId;
          option.dataset.clientId = client.id;
          option.dataset.projectId = project.id;
          group.appendChild(option);
        });

        select.appendChild(group);
      }
    });
  }

  // Add uncategorized option
  const uncatOption = document.createElement('option');
  uncatOption.value = JSON.stringify({ type: 'uncategorized', folderId: null });
  uncatOption.textContent = 'Uncategorized (review later)';
  select.appendChild(uncatOption);

  // Add change listener to update share list when project is selected
  select.addEventListener('change', handleFolderSelectionChange);
}

function handleFolderSelectionChange() {
  const folderValue = elements.folderSelect.value;

  try {
    const folderSelection = JSON.parse(folderValue);

    // If a client project is selected and has team members, show only team members
    if (folderSelection.type === 'client' && folderSelection.team && folderSelection.team.length > 0) {
      populateShareListWithTeam(folderSelection.team);
    } else if (currentMeeting && classification) {
      // Fallback to meeting attendees + AI suggestions
      populateShareList(
        currentMeeting.attendees || [],
        classification.suggested_actions?.share_with || []
      );
    }
  } catch (e) {
    // Invalid JSON or no selection - do nothing
  }
}

function populateShareListWithTeam(team) {
  const shareList = elements.shareList;
  shareList.innerHTML = '';

  const currentUserEmail = currentUser?.email?.toLowerCase();

  // Filter out current user from team
  const filteredTeam = (team || []).filter(member =>
    member.email?.toLowerCase() !== currentUserEmail
  );

  if (filteredTeam.length === 0) {
    shareList.innerHTML = '<span style="color: var(--gray-500); font-size: 13px;">No team members assigned</span>';
    return;
  }

  // Add Select All / Select None buttons
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'share-actions';
  actionsDiv.innerHTML = `
    <button type="button" class="share-action-btn" id="selectAllBtn">Select All</button>
    <button type="button" class="share-action-btn" id="selectNoneBtn">Select None</button>
  `;
  shareList.appendChild(actionsDiv);

  // Create container for share items
  const itemsContainer = document.createElement('div');
  itemsContainer.className = 'share-items';
  itemsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; width: 100%;';

  filteredTeam.forEach(member => {
    const item = document.createElement('div');
    // Pre-select all team members
    item.className = 'share-item selected';
    item.dataset.email = member.email;
    item.innerHTML = `
      <span class="checkmark"></span>
      <span class="name">${member.name || member.email.split('@')[0]}</span>
      <span class="role">(${member.role || 'Team'})</span>
    `;
    item.addEventListener('click', () => {
      item.classList.toggle('selected');
    });
    itemsContainer.appendChild(item);
  });

  shareList.appendChild(itemsContainer);

  // Add event listeners for Select All / Select None
  document.getElementById('selectAllBtn').addEventListener('click', () => {
    itemsContainer.querySelectorAll('.share-item').forEach(item => {
      item.classList.add('selected');
    });
  });

  document.getElementById('selectNoneBtn').addEventListener('click', () => {
    itemsContainer.querySelectorAll('.share-item').forEach(item => {
      item.classList.remove('selected');
    });
  });
}

// Meeting Detection
async function checkForMeetings() {
  setLoading('Checking for recent meetings...');

  try {
    // Get recent meeting from storage (set by background script)
    const storage = await chrome.storage.local.get(['recentMeeting', 'pendingNote']);

    if (storage.recentMeeting) {
      currentMeeting = storage.recentMeeting;
      await loadMeetingData(currentMeeting);
    } else {
      // Try to fetch from Calendar API
      const token = await getAuthToken(false);
      if (token) {
        const recentMeeting = await fetchRecentMeeting(token);
        if (recentMeeting) {
          currentMeeting = recentMeeting;
          await loadMeetingData(currentMeeting);
        } else {
          showView('noMeeting');
        }
      } else {
        showView('noMeeting');
      }
    }
  } catch (error) {
    console.error('Failed to check meetings:', error);
    showView('noMeeting');
  }
}

async function fetchRecentMeeting(token) {
  try {
    // Get meetings from the last 2 hours
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${twoHoursAgo.toISOString()}&` +
      `timeMax=${now.toISOString()}&` +
      `singleEvents=true&orderBy=startTime`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (response.ok) {
      const data = await response.json();
      const events = data.items || [];

      // Find the most recent ended meeting
      const endedMeetings = events.filter(event => {
        if (!event.end?.dateTime) return false;
        const endTime = new Date(event.end.dateTime);
        return endTime <= now && endTime > twoHoursAgo;
      });

      if (endedMeetings.length > 0) {
        const meeting = endedMeetings[endedMeetings.length - 1];
        return {
          id: meeting.id,
          title: meeting.summary || 'Untitled Meeting',
          description: meeting.description,
          start: meeting.start?.dateTime,
          end: meeting.end?.dateTime,
          attendees: (meeting.attendees || []).map(a => ({
            email: a.email,
            name: a.displayName,
            organizer: a.organizer,
          })),
          organizer: meeting.organizer?.email,
        };
      }
    }
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
  }
  return null;
}

async function loadMeetingData(meeting) {
  // Display meeting info
  elements.meetingTitle.textContent = meeting.title;

  if (meeting.end) {
    const endTime = new Date(meeting.end);
    elements.meetingTime.textContent = endTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (meeting.start && meeting.end) {
    const duration = Math.round((new Date(meeting.end) - new Date(meeting.start)) / 60000);
    elements.meetingDuration.querySelector('span').textContent = `${duration} min`;
  }

  const attendeeCount = meeting.attendees?.length || 0;
  elements.meetingAttendees.querySelector('span').textContent =
    `${attendeeCount} attendee${attendeeCount !== 1 ? 's' : ''}`;

  // Find associated note and classify meeting in parallel
  setLoading('Processing meeting...');

  try {
    // Run findNoteForMeeting and classifyMeeting in parallel
    const [noteResult, classificationResult] = await Promise.all([
      findNoteForMeeting(meeting).catch(error => {
        console.error('Failed to find note for meeting:', error);
        return { found: false };
      }),
      classifyMeeting(meeting).catch(error => {
        console.error('Classification failed:', error);
        return null;
      })
    ]);

    // Process note result
    if (noteResult.found) {
      // Store the note info on the meeting object
      currentMeeting.noteId = noteResult.noteId;
      currentMeeting.driveFileId = noteResult.driveFileId;
      currentMeeting.driveFileUrl = noteResult.driveFileUrl;
      currentMeeting.driveFileName = noteResult.driveFileName;
      currentMeeting.matchScore = noteResult.matchScore;

      // Show notes preview if we have a Drive URL
      if (noteResult.driveFileUrl) {
        elements.notesPreview.classList.remove('hidden');
        // Display the document title if available, otherwise show match confidence
        const displayTitle = noteResult.driveFileName || 'Meeting notes found';
        elements.notesContent.textContent = displayTitle;
        elements.viewFullNotes.href = noteResult.driveFileUrl;

        // Display match confidence if available
        if (noteResult.matchScore) {
          const confidenceEl = document.getElementById('matchConfidence');
          const percent = Math.round(noteResult.matchScore * 100);
          confidenceEl.textContent = `${percent}% match`;
          confidenceEl.className = `match-badge ${percent >= 80 ? 'high' : percent >= 60 ? 'medium' : 'low'}`;
        }
      }

      // Use existing classification if available and no new classification
      if (noteResult.classification && !classificationResult) {
        classification = { classification: noteResult.classification };
      }

      console.log('Found matching note:', noteResult);
    } else {
      console.log('No matching note found for meeting');
    }

    // Process classification result
    if (classificationResult) {
      classification = classificationResult;

      // Apply classification results
      if (classification.classification) {
        const { type, client, project, confidence } = classification.classification;

        // Set folder selection
        if (type === 'client' && client && project) {
          elements.folderSelect.value = `${client.id}|${project.id}`;
        } else if (type === 'internal' && classification.classification.internal_team) {
          elements.folderSelect.value = `internal_${classification.classification.internal_team.toLowerCase().replace(' ', '_')}`;
        }

        // Show AI confidence
        elements.aiSuggestion.classList.remove('hidden');
        const confidencePercent = Math.round(confidence * 100);
        elements.aiConfidence.textContent = `${confidencePercent}% confidence`;
        elements.aiConfidence.className = 'ai-confidence';
        if (confidence >= 0.9) {
          elements.aiConfidence.classList.add('high');
        } else if (confidence >= 0.7) {
          elements.aiConfidence.classList.add('medium');
        } else {
          elements.aiConfidence.classList.add('low');
        }

        // Show AI reasoning if available
        if (classification.classification.ai_reasoning) {
          elements.aiConfidence.title = classification.classification.ai_reasoning;
        }
      }

      // Populate share list
      populateShareList(meeting.attendees || [], classification.suggested_actions?.share_with || []);

      // Populate tags
      populateTags(classification.suggested_actions?.tags || []);
    } else {
      // Still show the view but without AI suggestions
      populateShareList(meeting.attendees || [], []);
      populateTags([]);
    }

    showView('main');
  } catch (error) {
    console.error('Failed to load meeting data:', error);
    // Still show the view but without AI suggestions
    populateShareList(meeting.attendees || [], []);
    populateTags([]);
    showView('main');
  }
}

async function findNoteForMeeting(meeting) {
  const requestBody = {
    meeting: {
      title: meeting.title,
      start_time: meeting.start,
      end_time: meeting.end,
      attendees: meeting.attendees,
      organizer: meeting.organizer,
    },
    userEmail: currentUser?.email,
  };

  // Include Gemini folder ID if available from user settings
  if (userSettings?.gemini_notes_folder_id) {
    requestBody.geminiFolderId = userSettings.gemini_notes_folder_id;
  }

  const response = await fetch(`${API_BASE_URL}/getNoteForMeeting`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error('Failed to find note');
  }

  return await response.json();
}

async function classifyMeeting(meeting) {
  const response = await fetch(`${API_BASE_URL}/classify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      meeting: {
        title: meeting.title,
        description: meeting.description,
        organizer: meeting.organizer,
        attendees: meeting.attendees,
        start_time: meeting.start,
        end_time: meeting.end,
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Classification failed');
  }

  return await response.json();
}

function populateShareList(attendees, suggestedShares) {
  const shareList = elements.shareList;
  shareList.innerHTML = '';

  // Combine attendees with suggested shares
  const allPeople = new Map();
  const currentUserEmail = currentUser?.email?.toLowerCase();

  // Add attendees (excluding current user)
  attendees.forEach(a => {
    if (a.email && a.email.toLowerCase() !== currentUserEmail) {
      allPeople.set(a.email, {
        email: a.email,
        name: a.name || a.email.split('@')[0],
        role: a.organizer ? 'Organizer' : 'Attendee',
        suggested: false,
      });
    }
  });

  // Mark suggested shares (excluding current user)
  suggestedShares.forEach(s => {
    if (s.email?.toLowerCase() === currentUserEmail) return;
    if (allPeople.has(s.email)) {
      const person = allPeople.get(s.email);
      person.suggested = true;
      if (s.role) person.role = s.role;
    } else {
      allPeople.set(s.email, {
        email: s.email,
        name: s.name || s.email.split('@')[0],
        role: s.role || 'Team',
        suggested: true,
      });
    }
  });

  // Show all attendees, pre-select Egen users
  const allUsers = Array.from(allPeople.values());

  if (allUsers.length === 0) {
    shareList.innerHTML = '<span style="color: var(--gray-500); font-size: 13px;">No attendees found</span>';
    return;
  }

  // Add Select All / Select None buttons
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'share-actions';
  actionsDiv.innerHTML = `
    <button type="button" class="share-action-btn" id="selectAllBtn">Select All</button>
    <button type="button" class="share-action-btn" id="selectNoneBtn">Select None</button>
  `;
  shareList.appendChild(actionsDiv);

  // Create container for share items
  const itemsContainer = document.createElement('div');
  itemsContainer.className = 'share-items';
  itemsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; width: 100%;';

  allUsers.forEach(person => {
    const isEgen = person.email.endsWith('@egen.ai') || person.email.endsWith('@egen.com');
    const item = document.createElement('div');
    // Pre-select Egen users or suggested shares
    item.className = `share-item${(isEgen || person.suggested) ? ' selected' : ''}`;
    item.dataset.email = person.email;
    item.innerHTML = `
      <span class="checkmark"></span>
      <span class="name">${person.name}</span>
      <span class="role">(${person.role})</span>
    `;
    item.addEventListener('click', () => {
      item.classList.toggle('selected');
    });
    itemsContainer.appendChild(item);
  });

  shareList.appendChild(itemsContainer);

  // Add event listeners for Select All / Select None
  document.getElementById('selectAllBtn').addEventListener('click', () => {
    itemsContainer.querySelectorAll('.share-item').forEach(item => {
      item.classList.add('selected');
    });
  });

  document.getElementById('selectNoneBtn').addEventListener('click', () => {
    itemsContainer.querySelectorAll('.share-item').forEach(item => {
      item.classList.remove('selected');
    });
  });
}

function populateTags(tags) {
  const tagsList = elements.tagsList;
  tagsList.innerHTML = '';

  tags.forEach(tag => {
    const tagEl = document.createElement('span');
    tagEl.className = 'tag suggested';
    tagEl.textContent = tag;
    tagsList.appendChild(tagEl);
  });

  // Add "Add tag" button
  const addBtn = document.createElement('button');
  addBtn.className = 'add-tag';
  addBtn.innerHTML = '+ Add tag';
  addBtn.addEventListener('click', promptAddTag);
  tagsList.appendChild(addBtn);
}

function promptAddTag() {
  const tag = prompt('Enter a tag (e.g., #project-name):');
  if (tag) {
    const tagEl = document.createElement('span');
    tagEl.className = 'tag';
    tagEl.textContent = tag.startsWith('#') ? tag : `#${tag}`;
    elements.tagsList.insertBefore(tagEl, elements.tagsList.lastChild);
  }
}

// Actions
async function handleSaveShare() {
  const saveBtn = elements.saveShareBtn;
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Saving...';

  try {
    const folderValue = elements.folderSelect.value;
    const selectedShares = Array.from(elements.shareList.querySelectorAll('.share-item.selected'))
      .map(el => el.dataset.email);
    const tags = Array.from(elements.tagsList.querySelectorAll('.tag'))
      .map(el => el.textContent);

    // Parse folder selection (JSON format)
    let folderSelection = {};
    let targetFolderId = null;

    try {
      folderSelection = JSON.parse(folderValue);
      targetFolderId = folderSelection.folderId;
    } catch (e) {
      // Handle old format or empty value
      folderSelection = { type: 'uncategorized' };
    }

    const classification = {
      type: folderSelection.type || 'uncategorized',
      clientId: folderSelection.clientId || null,
      clientName: folderSelection.clientName || null,
      projectId: folderSelection.projectId || null,
      projectName: folderSelection.projectName || null,
      internalTeam: folderSelection.team || null,
    };

    // Call save-note API
    const requestBody = {
      noteId: currentMeeting.noteId || null,
      driveFileId: currentMeeting.driveFileId || null,
      targetFolderId: targetFolderId,
      classification,
      sharedWith: selectedShares.map(email => ({ email })),
      tags,
      userEmail: currentUser.email,
      // Include meeting info when no note exists yet
      meeting: (!currentMeeting.noteId && !currentMeeting.driveFileId) ? {
        id: currentMeeting.id,
        title: currentMeeting.title,
        start: currentMeeting.start,
        end: currentMeeting.end,
        organizer: currentMeeting.organizer,
        attendees: currentMeeting.attendees,
      } : null,
    };
    console.log('Saving note with:', requestBody);

    const response = await fetch(`${API_BASE_URL}/saveNote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Save API error:', response.status, errorData);
      throw new Error(errorData.message || errorData.error || 'Failed to save note');
    }

    const result = await response.json();
    console.log('Save result:', result);

    // Show success
    let folderDisplay = 'Uncategorized';
    if (classification.type === 'client' && classification.clientName) {
      folderDisplay = `${classification.clientName} / ${classification.projectName || ''}`;
    } else if (classification.type === 'internal' && classification.internalTeam) {
      folderDisplay = `Internal / ${classification.internalTeam}`;
    }

    elements.savedFolder.innerHTML = `<strong>Saved to:</strong> ${folderDisplay}`;
    elements.sharedWith.innerHTML = `<strong>Shared with:</strong> ${
      selectedShares.length > 0 ? selectedShares.join(', ') : 'No one'
    }`;

    // Clear the pending meeting
    await chrome.storage.local.remove(['recentMeeting', 'pendingNote']);

    // If "remember settings" is checked, save the preference
    if (elements.rememberSetting.checked) {
      await saveRememberedSettings(currentMeeting, classification, selectedShares);
    }

    showView('success');
  } catch (error) {
    console.error('Save failed:', error);
    showToast('Failed to save. Please try again.', 'error');
    saveBtn.disabled = false;
    saveBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Save & Share
    `;
  }
}

async function handleReviewLater() {
  try {
    // Store meeting for later review
    await chrome.storage.local.set({
      pendingNotes: [
        ...(await chrome.storage.local.get('pendingNotes')).pendingNotes || [],
        {
          meeting: currentMeeting,
          addedAt: new Date().toISOString(),
        }
      ]
    });

    // Clear the current meeting
    await chrome.storage.local.remove(['recentMeeting']);

    showToast('Added to review queue', 'success');

    // Close popup after delay
    setTimeout(() => window.close(), 1500);
  } catch (error) {
    console.error('Failed to add to review queue:', error);
    showToast('Failed to add to queue', 'error');
  }
}

async function handleUndo() {
  // In a real implementation, this would undo the last action
  showToast('Undo not yet implemented', 'info');
}

async function saveRememberedSettings(meeting, classification, shares) {
  // Save pattern for similar meetings
  const pattern = {
    attendeeDomains: [...new Set(
      meeting.attendees
        ?.map(a => a.email?.split('@')[1])
        .filter(Boolean)
    )],
    classification,
    shares,
    createdAt: new Date().toISOString(),
  };

  const patterns = (await chrome.storage.local.get('rememberedPatterns')).rememberedPatterns || [];
  patterns.push(pattern);

  await chrome.storage.local.set({ rememberedPatterns: patterns });
}

// Toast Notifications
function showToast(message, type = 'info', action = null) {
  elements.toastMessage.textContent = message;
  elements.toast.classList.remove('hidden');
  elements.toast.classList.add('visible');

  if (action) {
    elements.toastAction.textContent = action.label;
    elements.toastAction.onclick = action.handler;
    elements.toastAction.classList.remove('hidden');
  } else {
    elements.toastAction.classList.add('hidden');
  }

  // Auto-hide after 4 seconds
  setTimeout(() => {
    elements.toast.classList.remove('visible');
    setTimeout(() => elements.toast.classList.add('hidden'), 300);
  }, 4000);
}
