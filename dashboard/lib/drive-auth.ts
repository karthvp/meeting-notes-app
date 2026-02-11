/**
 * Drive Authentication Helper
 *
 * Manages Google Drive access tokens with backend refresh.
 * - Checks for stored refresh token in backend
 * - Gets fresh access tokens without user interaction
 * - Falls back to OAuth popup only when necessary
 */

import { getFirebaseAuth } from './firebase';

const DRIVE_TOKEN_API = process.env.NEXT_PUBLIC_DRIVE_TOKEN_API_URL ||
  'https://us-central1-karthik-patil-sandbox.cloudfunctions.net/driveToken';

const GOOGLE_CLIENT_ID = '309681502162-gv7a1djnlkfg0vtd7mgnbrlt973vo51a.apps.googleusercontent.com';

// In-memory cache for access token
let cachedToken: { token: string; expiresAt: number } | null = null;

// Flag to track if GIS script is loaded
let gisLoaded = false;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('AUTH_REQUIRED');
  }
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Load Google Identity Services script
 */
function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (gisLoaded || (window as any).google?.accounts?.oauth2) {
      gisLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gisLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

/**
 * Request authorization code using Google Identity Services
 * This gives us a code we can exchange for tokens (including refresh token)
 */
async function requestAuthorizationCode(userEmail: string): Promise<string> {
  await loadGisScript();

  return new Promise((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initCodeClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive',
      ux_mode: 'popup',
      login_hint: userEmail,
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else if (response.code) {
          resolve(response.code);
        } else {
          reject(new Error('No authorization code received'));
        }
      },
    });

    client.requestCode();
  });
}

/**
 * Exchange authorization code for tokens via backend
 */
async function exchangeCodeForTokens(
  code: string,
  userEmail: string
): Promise<{ access_token: string; expires_at: number } | null> {
  try {
    const authHeaders = await getAuthHeaders();
    // GIS popup mode uses 'postmessage' as redirect URI
    const response = await fetch(`${DRIVE_TOKEN_API}?action=exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        code,
        userEmail,
        redirectUri: 'postmessage',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Token exchange failed:', error);
      return null;
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      expires_at: data.expires_at || Date.now() + 3500 * 1000,
    };
  } catch (error) {
    console.error('Failed to exchange code for tokens:', error);
    return null;
  }
}

/**
 * Check if user has a stored refresh token in backend
 */
export async function hasStoredDriveToken(userEmail: string): Promise<boolean> {
  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${DRIVE_TOKEN_API}?action=check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ userEmail }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data.hasToken === true;
  } catch (error) {
    console.error('Failed to check stored token:', error);
    return false;
  }
}

/**
 * Get fresh access token from backend using stored refresh token
 */
async function refreshAccessToken(userEmail: string): Promise<string | null> {
  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${DRIVE_TOKEN_API}?action=refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ userEmail }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('Token refresh failed:', error);
      return null;
    }

    const data = await response.json();

    if (data.access_token) {
      // Cache the token
      cachedToken = {
        token: data.access_token,
        expiresAt: data.expires_at || Date.now() + 3500 * 1000, // Default ~1 hour
      };
      return data.access_token;
    }

    return null;
  } catch (error) {
    console.error('Failed to refresh access token:', error);
    return null;
  }
}

/**
 * Store refresh token in backend after OAuth consent
 */
async function storeRefreshToken(userEmail: string, refreshToken: string): Promise<boolean> {
  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${DRIVE_TOKEN_API}?action=store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ userEmail, refreshToken }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to store refresh token:', error);
    return false;
  }
}

/**
 * Get Drive access token - tries cached/backend first, falls back to GIS OAuth
 *
 * Flow:
 * 1. Check in-memory cache
 * 2. Try backend refresh (if we have stored refresh token)
 * 3. Fall back to Google Identity Services popup (stores refresh token for future)
 *
 * @param userEmail - User's email address
 * @param forcePopup - Force showing the OAuth popup (for initial setup)
 * @returns Access token or null if user cancelled
 */
export async function getDriveAccessToken(
  userEmail: string,
  forcePopup = false
): Promise<{ token: string | null; error?: string }> {
  // Check cached token first (with 5 min buffer before expiry)
  if (!forcePopup && cachedToken && cachedToken.expiresAt > Date.now() + 300000) {
    return { token: cachedToken.token };
  }

  // Try to refresh from backend (uses stored refresh token)
  if (!forcePopup) {
    const refreshedToken = await refreshAccessToken(userEmail);
    if (refreshedToken) {
      return { token: refreshedToken };
    }
  }

  // Fall back to Google Identity Services OAuth flow
  // This gets us an authorization code that we can exchange for tokens
  // including a refresh token for future use
  console.log('No stored token, initiating OAuth flow...');

  try {
    // Request authorization code via GIS popup
    const code = await requestAuthorizationCode(userEmail);

    // Exchange code for tokens via backend
    const tokens = await exchangeCodeForTokens(code, userEmail);

    if (!tokens) {
      return { token: null, error: 'Failed to exchange authorization code' };
    }

    // Cache the token
    cachedToken = {
      token: tokens.access_token,
      expiresAt: tokens.expires_at,
    };

    return { token: tokens.access_token };
  } catch (error: any) {
    console.error('OAuth flow failed:', error);

    if (error.message?.includes('popup_closed') || error.message?.includes('access_denied')) {
      return { token: null, error: 'popup_closed' };
    }

    return { token: null, error: error.message };
  }
}

/**
 * Clear cached token (for logout or token revocation)
 */
export function clearCachedToken(): void {
  cachedToken = null;
}

/**
 * Revoke stored Drive access
 */
export async function revokeDriveAccess(userEmail: string): Promise<boolean> {
  clearCachedToken();

  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${DRIVE_TOKEN_API}?action=revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ userEmail }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to revoke drive access:', error);
    return false;
  }
}
