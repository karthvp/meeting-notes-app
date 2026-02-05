/**
 * Egen Meeting Notes - Options Page Script
 */

// Theme buttons
const themeButtons = document.querySelectorAll('.theme-option');

// Elements
const accountInfo = document.getElementById('accountInfo');
const signInPrompt = document.getElementById('signInPrompt');
const accountAvatar = document.getElementById('accountAvatar');
const accountName = document.getElementById('accountName');
const accountEmail = document.getElementById('accountEmail');
const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');

const clearPendingBtn = document.getElementById('clearPendingBtn');
const resetSettingsBtn = document.getElementById('resetSettingsBtn');

const statusMessage = document.getElementById('statusMessage');
const statusText = document.getElementById('statusText');

// API Configuration
const API_BASE_URL = 'https://us-central1-karthik-patil-sandbox.cloudfunctions.net';

// State
let currentSettings = null;
let currentUserEmail = null;

/**
 * Initialize the options page
 */
async function init() {
  // Initialize theme first (before other content loads)
  await initTheme();

  await loadSettings();
  await checkAuthStatus();
  attachEventListeners();
}

/**
 * Initialize theme settings
 */
async function initTheme() {
  // Use ThemeUtils from theme.js
  if (window.ThemeUtils) {
    const currentTheme = await window.ThemeUtils.initializeTheme();
    updateThemeButtons(currentTheme);
  }
}

/**
 * Update theme button states
 */
function updateThemeButtons(activeTheme) {
  themeButtons.forEach((btn) => {
    if (btn.dataset.theme === activeTheme) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Handle theme selection
 */
async function handleThemeChange(theme) {
  if (window.ThemeUtils) {
    await window.ThemeUtils.setTheme(theme);
    updateThemeButtons(theme);
    showStatus(`Theme set to ${theme}`, 'success');
  }
}

/**
 * Load settings from storage
 */
async function loadSettings() {
  const result = await chrome.storage.local.get(['settings']);
  currentSettings = result.settings || {};
}

/**
 * Check authentication status
 */
async function checkAuthStatus() {
  try {
    // Check for cached token in storage
    const stored = await chrome.storage.local.get(['authToken', 'tokenExpiry']);
    if (stored.authToken && stored.tokenExpiry && Date.now() < stored.tokenExpiry) {
      await loadUserInfo(stored.authToken);
    } else {
      showSignedOut();
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    showSignedOut();
  }
}

/**
 * Load user info from Google
 */
async function loadUserInfo(token) {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    const user = await response.json();
    showSignedIn(user);
  } catch (error) {
    console.error('Failed to load user info:', error);
    showSignedOut();
  }
}

/**
 * Show signed in state
 */
function showSignedIn(user) {
  signInPrompt.classList.add('hidden');
  accountInfo.classList.remove('hidden');

  accountName.textContent = user.name || 'Egen User';
  accountEmail.textContent = user.email || '';
  accountAvatar.textContent = (user.name || user.email || '?')[0].toUpperCase();
  currentUserEmail = user.email;
}

/**
 * Show signed out state
 */
function showSignedOut() {
  accountInfo.classList.add('hidden');
  signInPrompt.classList.remove('hidden');
}

// OAuth configuration
const OAUTH_CLIENT_ID = '309681502162-gv7a1djnlkfg0vtd7mgnbrlt973vo51a.apps.googleusercontent.com';
const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
].join(' ');

/**
 * Sign in using launchWebAuthFlow
 */
async function signIn() {
  try {
    const redirectUri = chrome.identity.getRedirectURL();
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');

    authUrl.searchParams.set('client_id', OAUTH_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('scope', OAUTH_SCOPES);
    authUrl.searchParams.set('prompt', 'select_account');

    const responseUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl.toString(), interactive: true },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });

    if (!responseUrl) {
      throw new Error('No response URL');
    }

    // Extract token from URL fragment
    const url = new URL(responseUrl);
    const hash = url.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    const expiresIn = params.get('expires_in');

    if (token) {
      // Cache the token
      const tokenExpiry = Date.now() + (parseInt(expiresIn, 10) * 1000) - 60000;
      await chrome.storage.local.set({ authToken: token, tokenExpiry });
      await loadUserInfo(token);
      showStatus('Signed in successfully', 'success');
    } else {
      throw new Error('No access token in response');
    }
  } catch (error) {
    console.error('Sign in failed:', error);
    showStatus('Sign in failed: ' + error.message, 'error');
  }
}

/**
 * Sign out
 */
async function signOut() {
  try {
    await chrome.storage.local.remove(['authToken', 'tokenExpiry']);
    showSignedOut();
    showStatus('Signed out', 'success');
  } catch (error) {
    console.error('Sign out failed:', error);
    showStatus('Sign out failed', 'error');
  }
}

/**
 * Clear pending notes
 */
async function clearPendingNotes() {
  if (!confirm('Are you sure you want to clear all pending notes?')) {
    return;
  }

  await chrome.storage.local.set({ pendingNotes: [] });
  // Update badge
  await chrome.action.setBadgeText({ text: '' });
  showStatus('Pending notes cleared', 'success');
}

/**
 * Reset all settings
 */
async function resetSettings() {
  if (!confirm('Are you sure you want to reset all settings to defaults?')) {
    return;
  }

  await chrome.storage.local.set({
    settings: {
      autoDetect: true,
      notifications: true,
      defaultFolder: null,
      rememberChoices: true,
    },
  });

  await loadSettings();
  showStatus('Settings reset to defaults', 'success');
}

/**
 * Show status message
 */
function showStatus(message, type) {
  statusMessage.classList.remove('hidden', 'success', 'error');
  statusMessage.classList.add(type);
  statusText.textContent = message;

  // Auto-hide after 3 seconds
  setTimeout(() => {
    statusMessage.classList.add('hidden');
  }, 3000);
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
  // Theme
  themeButtons.forEach((btn) => {
    btn.addEventListener('click', () => handleThemeChange(btn.dataset.theme));
  });

  // Auth
  signInBtn.addEventListener('click', signIn);
  signOutBtn.addEventListener('click', signOut);

  // Data actions
  clearPendingBtn.addEventListener('click', clearPendingNotes);
  resetSettingsBtn.addEventListener('click', resetSettings);
}

// Initialize
init();
