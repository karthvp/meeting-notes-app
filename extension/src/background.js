/**
 * Egen Meeting Notes - Chrome Extension Background Service Worker
 *
 * Handles:
 * - Meeting detection via Calendar API polling
 * - Notifications when meetings end
 * - Badge updates for pending notes
 * - OAuth token management
 */

// Configuration
const CONFIG = {
  CALENDAR_POLL_INTERVAL_MINUTES: 5,
  API_BASE_URL: 'https://us-central1-karthik-patil-sandbox.cloudfunctions.net',
  MEETING_END_BUFFER_MINUTES: 2, // Wait this many minutes after meeting ends
};

// State
let currentMeeting = null;
let authToken = null;

// Settings cache to reduce storage reads
let settingsCache = null;

/**
 * Initialize the extension
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Egen Meeting Notes extension installed', details);

  // Set up alarm for calendar polling
  await chrome.alarms.create('checkCalendar', {
    periodInMinutes: CONFIG.CALENDAR_POLL_INTERVAL_MINUTES,
  });

  // Initialize storage
  const stored = await chrome.storage.local.get(['settings', 'pendingNotes']);
  if (!stored.settings) {
    const defaultSettings = {
      autoDetect: true,
      notifications: true,
      defaultFolder: null,
      rememberChoices: true,
    };
    await chrome.storage.local.set({ settings: defaultSettings });
    settingsCache = defaultSettings;
  } else {
    settingsCache = stored.settings;
  }
  if (!stored.pendingNotes) {
    await chrome.storage.local.set({ pendingNotes: [] });
  }
});

// Invalidate settings cache when storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.settings) {
    settingsCache = changes.settings.newValue || null;
  }
});

/**
 * Get settings with caching to reduce storage reads
 */
async function getSettings() {
  if (settingsCache) return settingsCache;
  const stored = await chrome.storage.local.get(['settings']);
  settingsCache = stored.settings || {};
  return settingsCache;
}

/**
 * Handle alarms
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkCalendar') {
    await checkForMeetings();
  } else if (alarm.name === 'meetingEnded') {
    await handleMeetingEnded();
  }
});

/**
 * Get OAuth token from storage (set by popup or options page)
 */
async function getAuthToken(interactive = false) {
  // Check for cached token in storage
  const stored = await chrome.storage.local.get(['authToken', 'tokenExpiry']);

  if (stored.authToken && stored.tokenExpiry && Date.now() < stored.tokenExpiry) {
    authToken = stored.authToken;
    return stored.authToken;
  }

  // Token expired or missing - user needs to sign in via popup
  authToken = null;
  return null;
}

/**
 * Check for current/recent meetings
 */
async function checkForMeetings() {
  try {
    const token = await getAuthToken(false);
    if (!token) {
      console.log('No auth token, skipping calendar check');
      return;
    }

    // Use cached settings for better performance
    const settings = await getSettings();
    if (!settings?.autoDetect) {
      return;
    }

    // Get events from last 2 hours to next 30 minutes
    const now = new Date();
    const timeMin = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&` +
      `timeMax=${encodeURIComponent(timeMax)}&` +
      `singleEvents=true&` +
      `orderBy=startTime`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, clear it
        chrome.identity.removeCachedAuthToken({ token });
        authToken = null;
      }
      throw new Error(`Calendar API error: ${response.status}`);
    }

    const data = await response.json();
    const meetings = (data.items || []).filter(event => {
      // Filter for meetings with Google Meet links
      return event.conferenceData?.conferenceSolution?.name === 'Google Meet' ||
             event.hangoutLink;
    });

    // Check if any meeting just ended
    for (const meeting of meetings) {
      const endTime = new Date(meeting.end.dateTime || meeting.end.date);
      const minutesSinceEnd = (now - endTime) / (1000 * 60);

      // Meeting ended within the last 30 minutes
      if (minutesSinceEnd >= 0 && minutesSinceEnd <= 30) {
        // Check if we already processed this meeting
        const processed = await isMeetingProcessed(meeting.id);
        if (!processed) {
          await handleRecentMeeting(meeting);
        }
      }

      // Track currently ongoing meeting
      const startTime = new Date(meeting.start.dateTime || meeting.start.date);
      if (now >= startTime && now <= endTime) {
        currentMeeting = meeting;
        // Set alarm for when meeting ends
        const msUntilEnd = endTime - now + (CONFIG.MEETING_END_BUFFER_MINUTES * 60 * 1000);
        chrome.alarms.create('meetingEnded', {
          when: Date.now() + msUntilEnd,
        });
      }
    }

    // Update badge with pending notes count
    await updateBadge();

  } catch (error) {
    console.error('Error checking calendar:', error);
  }
}

/**
 * Check if meeting was already processed
 */
async function isMeetingProcessed(meetingId) {
  const stored = await chrome.storage.local.get(['processedMeetings']);
  const processed = stored.processedMeetings || [];
  return processed.includes(meetingId);
}

/**
 * Mark meeting as processed
 */
async function markMeetingProcessed(meetingId) {
  const stored = await chrome.storage.local.get(['processedMeetings']);
  const processed = stored.processedMeetings || [];
  processed.push(meetingId);
  // Keep only last 100 meetings
  if (processed.length > 100) {
    processed.shift();
  }
  await chrome.storage.local.set({ processedMeetings: processed });
}

/**
 * Handle a meeting that recently ended
 */
async function handleRecentMeeting(meeting) {
  console.log('Recent meeting detected:', meeting.summary);

  // Add to pending notes
  const stored = await chrome.storage.local.get(['pendingNotes']);
  const pendingNotes = stored.pendingNotes || [];

  const meetingData = {
    id: meeting.id,
    title: meeting.summary || 'Untitled Meeting',
    description: meeting.description || '',
    start: meeting.start.dateTime || meeting.start.date,
    end: meeting.end.dateTime || meeting.end.date,
    attendees: (meeting.attendees || []).map(a => ({
      email: a.email,
      displayName: a.displayName,
      organizer: a.organizer || false,
    })),
    organizer: meeting.organizer?.email,
    meetLink: meeting.hangoutLink || meeting.conferenceData?.entryPoints?.[0]?.uri,
    detectedAt: new Date().toISOString(),
  };

  // Check if already in pending
  const exists = pendingNotes.some(n => n.id === meeting.id);
  if (!exists) {
    pendingNotes.unshift(meetingData);
    await chrome.storage.local.set({ pendingNotes });
  }

  // Show notification - use cached settings
  const settings = await getSettings();
  if (settings?.notifications) {
    await showMeetingNotification(meetingData);
  }

  // Update badge
  await updateBadge();

  // Mark as processed
  await markMeetingProcessed(meeting.id);
}

/**
 * Handle when a tracked meeting ends
 */
async function handleMeetingEnded() {
  if (currentMeeting) {
    await handleRecentMeeting(currentMeeting);
    currentMeeting = null;
  }
}

/**
 * Show notification for meeting ended
 */
async function showMeetingNotification(meeting) {
  const notificationId = `meeting-${meeting.id}`;

  await chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: '../icons/icon128.png',
    title: 'Meeting Ended',
    message: `"${meeting.title}" has ended. Click to organize notes.`,
    buttons: [
      { title: 'Organize Notes' },
      { title: 'Dismiss' },
    ],
    requireInteraction: true,
  });
}

/**
 * Handle notification clicks
 */
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith('meeting-')) {
    // Open popup
    chrome.action.openPopup();
    chrome.notifications.clear(notificationId);
  }
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId.startsWith('meeting-')) {
    if (buttonIndex === 0) {
      // Organize Notes
      chrome.action.openPopup();
    }
    chrome.notifications.clear(notificationId);
  }
});

/**
 * Update badge with pending notes count
 */
async function updateBadge() {
  const stored = await chrome.storage.local.get(['pendingNotes']);
  const count = (stored.pendingNotes || []).length;

  if (count > 0) {
    await chrome.action.setBadgeText({ text: count.toString() });
    await chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
  } else {
    await chrome.action.setBadgeText({ text: '' });
  }
}

/**
 * Message handling from popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch(error => {
    sendResponse({ error: error.message });
  });
  return true; // Indicates async response
});

async function handleMessage(message) {
  switch (message.type) {
    case 'GET_AUTH_TOKEN':
      return { token: await getAuthToken(message.interactive) };

    case 'GET_PENDING_NOTES':
      const stored = await chrome.storage.local.get(['pendingNotes']);
      return { notes: stored.pendingNotes || [] };

    case 'REMOVE_PENDING_NOTE':
      await removePendingNote(message.meetingId);
      return { success: true };

    case 'GET_SETTINGS':
      const cachedSettings = await getSettings();
      return { settings: cachedSettings };

    case 'UPDATE_SETTINGS':
      await chrome.storage.local.set({ settings: message.settings });
      settingsCache = message.settings; // Update cache immediately
      return { success: true };

    case 'CHECK_MEETINGS':
      await checkForMeetings();
      return { success: true };

    case 'CLEAR_AUTH':
      await chrome.storage.local.remove(['authToken', 'tokenExpiry']);
      authToken = null;
      return { success: true };

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

/**
 * Remove a note from pending
 */
async function removePendingNote(meetingId) {
  const stored = await chrome.storage.local.get(['pendingNotes']);
  const pendingNotes = (stored.pendingNotes || []).filter(n => n.id !== meetingId);
  await chrome.storage.local.set({ pendingNotes });
  await updateBadge();
}

/**
 * Initial check on startup
 */
chrome.runtime.onStartup.addListener(async () => {
  await checkForMeetings();
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    checkForMeetings,
    handleRecentMeeting,
    getAuthToken,
  };
}
