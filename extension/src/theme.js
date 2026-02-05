// Theme utility for Egen Notes Chrome Extension

const THEME_KEY = 'theme';
const VALID_THEMES = ['light', 'dark', 'system'];

/**
 * Get the stored theme preference
 * @returns {Promise<string>} - 'light', 'dark', or 'system'
 */
async function getStoredTheme() {
  try {
    const result = await chrome.storage.local.get(THEME_KEY);
    return VALID_THEMES.includes(result[THEME_KEY]) ? result[THEME_KEY] : 'system';
  } catch (error) {
    console.error('Error getting theme:', error);
    return 'system';
  }
}

/**
 * Save theme preference to storage
 * @param {string} theme - 'light', 'dark', or 'system'
 */
async function saveTheme(theme) {
  if (!VALID_THEMES.includes(theme)) {
    console.error('Invalid theme:', theme);
    return;
  }

  try {
    await chrome.storage.local.set({ [THEME_KEY]: theme });
  } catch (error) {
    console.error('Error saving theme:', error);
  }
}

/**
 * Detect system color scheme preference
 * @returns {string} - 'light' or 'dark'
 */
function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Apply theme to the document
 * @param {string} theme - 'light', 'dark', or 'system'
 */
function applyTheme(theme) {
  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.setAttribute('data-theme', effectiveTheme);

  // Store the effective theme for reference
  document.documentElement.setAttribute('data-effective-theme', effectiveTheme);
}

/**
 * Initialize theme on page load
 * Also sets up a listener for system theme changes when using 'system' mode
 */
async function initializeTheme() {
  const theme = await getStoredTheme();
  applyTheme(theme);

  // Listen for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', async () => {
    const currentTheme = await getStoredTheme();
    if (currentTheme === 'system') {
      applyTheme('system');
    }
  });

  return theme;
}

/**
 * Set theme and apply it immediately
 * @param {string} theme - 'light', 'dark', or 'system'
 */
async function setTheme(theme) {
  await saveTheme(theme);
  applyTheme(theme);
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.ThemeUtils = {
    getStoredTheme,
    saveTheme,
    getSystemTheme,
    applyTheme,
    initializeTheme,
    setTheme,
    VALID_THEMES
  };
}
