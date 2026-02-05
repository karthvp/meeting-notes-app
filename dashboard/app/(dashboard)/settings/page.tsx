'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { signInWithPopup, OAuthCredential, GoogleAuthProvider } from 'firebase/auth';
import { getFirebaseAuth, getGoogleProviderWithDriveScope } from '@/lib/firebase';
import {
  getDriveWebhookConfig,
  registerDriveWebhook,
  unregisterDriveWebhook,
  DriveWebhookConfig,
} from '@/lib/api';
import { getUserSettings, saveUserSettings } from '@/lib/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  Loader2,
  RefreshCw,
  Unlink,
  Link as LinkIcon,
  FileText,
  Save,
  Palette,
  Chrome,
  Download,
} from 'lucide-react';
import { ThemeSelector } from '@/components/ui/theme-toggle';

export default function SettingsPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<DriveWebhookConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [folderId, setFolderId] = useState('');
  const [folderName, setFolderName] = useState('Meeting Notes');

  // Gemini folder settings state
  const [geminiFolderId, setGeminiFolderId] = useState('');
  const [geminiFolderName, setGeminiFolderName] = useState('');
  const [geminiFolderVerified, setGeminiFolderVerified] = useState(false);
  const [savingGeminiSettings, setSavingGeminiSettings] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [geminiSuccess, setGeminiSuccess] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!user?.email) return;

    setLoading(true);
    try {
      const result = await getDriveWebhookConfig(user.email);
      setConfig(result);
      if (result.folderId) {
        setFolderId(result.folderId);
      }
      if (result.folderName) {
        setFolderName(result.folderName);
      }

      // Fetch user settings for Gemini folder
      const userSettings = await getUserSettings(user.email);
      if (userSettings?.gemini_notes_folder_id) {
        setGeminiFolderId(userSettings.gemini_notes_folder_id);
        setGeminiFolderVerified(true);
        if (userSettings.gemini_notes_folder_name) {
          setGeminiFolderName(userSettings.gemini_notes_folder_name);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch config:', err);
      setError('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Extract folder ID from URL if pasted
  const extractFolderIdFromInput = (input: string): string => {
    // Check if it's a Drive URL
    const urlMatch = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }
    // Otherwise assume it's a folder ID
    return input.trim();
  };

  const handleGeminiFolderInputChange = (value: string) => {
    const folderId = extractFolderIdFromInput(value);
    setGeminiFolderId(folderId);
    setGeminiFolderVerified(false);
    setGeminiError(null);
    setGeminiSuccess(null);
  };

  const handleSaveGeminiSettings = async () => {
    if (!user?.email || !geminiFolderId) {
      setGeminiError('Please enter a folder ID or URL');
      return;
    }

    setSavingGeminiSettings(true);
    setGeminiError(null);
    setGeminiSuccess(null);

    try {
      // Verify folder access by re-authenticating with Drive scope
      const auth = getFirebaseAuth();
      const provider = getGoogleProviderWithDriveScope();
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      if (!credential?.accessToken) {
        throw new Error('Failed to get access token');
      }

      // Verify the folder exists and is accessible
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${geminiFolderId}?fields=id,name,mimeType`,
        {
          headers: {
            Authorization: `Bearer ${credential.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Folder not found. Please check the folder ID.');
        }
        throw new Error('Unable to access folder. Please check permissions.');
      }

      const folderData = await response.json();

      if (folderData.mimeType !== 'application/vnd.google-apps.folder') {
        throw new Error('The ID provided is not a folder.');
      }

      // Save to Firestore
      await saveUserSettings(user.email, {
        gemini_notes_folder_id: geminiFolderId,
        gemini_notes_folder_url: `https://drive.google.com/drive/folders/${geminiFolderId}`,
        gemini_notes_folder_name: folderData.name,
      });

      setGeminiFolderName(folderData.name);
      setGeminiFolderVerified(true);
      setGeminiSuccess('Gemini notes folder saved successfully!');
    } catch (err: any) {
      console.error('Failed to save Gemini folder settings:', err);
      setGeminiError(err.message || 'Failed to save settings');
      setGeminiFolderVerified(false);
    } finally {
      setSavingGeminiSettings(false);
    }
  };

  const handleConnect = async () => {
    if (!user?.email || !folderId) {
      setError('Please enter a folder ID');
      return;
    }

    setConnecting(true);
    setError(null);
    setSuccess(null);

    try {
      // Re-authenticate with Drive scopes to get access token
      const auth = getFirebaseAuth();
      const provider = getGoogleProviderWithDriveScope();

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      if (!credential?.accessToken) {
        throw new Error('Failed to get access token');
      }

      // Register the webhook
      const response = await registerDriveWebhook({
        folderId,
        folderName,
        accessToken: credential.accessToken,
        userEmail: user.email,
      });

      if (response.success) {
        setSuccess('Drive folder connected successfully!');
        await fetchConfig();
      } else {
        throw new Error(response.error || 'Failed to register webhook');
      }
    } catch (err: any) {
      console.error('Connection error:', err);
      setError(err.message || 'Failed to connect Drive folder');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user?.email) return;

    setDisconnecting(true);
    setError(null);
    setSuccess(null);

    try {
      // Re-authenticate to get access token
      const auth = getFirebaseAuth();
      const provider = getGoogleProviderWithDriveScope();

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      if (!credential?.accessToken) {
        throw new Error('Failed to get access token');
      }

      const response = await unregisterDriveWebhook(
        credential.accessToken,
        user.email
      );

      if (response.success) {
        setSuccess('Drive folder disconnected');
        await fetchConfig();
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (err: any) {
      console.error('Disconnect error:', err);
      setError(err.message || 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const getStatusBadge = () => {
    if (!config?.configured) {
      return <Badge variant="outline">Not Connected</Badge>;
    }

    switch (config.status) {
      case 'active':
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-orange-500 hover:bg-orange-600">
            <AlertCircle className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return <Badge variant="outline">Disconnected</Badge>;
    }
  };

  const isExpiringSoon = () => {
    if (!config?.webhookExpiration) return false;
    const expiration = new Date(config.webhookExpiration);
    const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    return expiration < twoDaysFromNow;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your Meeting Notes preferences
        </p>
      </div>

      {/* Appearance Card */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Choose how the app looks to you
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Theme</Label>
            <ThemeSelector />
          </div>
        </CardContent>
      </Card>

      {/* Gemini Notes Folder Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Gemini Notes Folder
              </CardTitle>
              <CardDescription>
                Specify the Google Drive folder where Gemini saves your meeting notes
              </CardDescription>
            </div>
            {geminiFolderVerified && (
              <Badge className="bg-green-500 hover:bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error/Success Messages */}
          {geminiError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{geminiError}</span>
            </div>
          )}

          {geminiSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">{geminiSuccess}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="geminiFolderId">Folder ID or URL</Label>
            <Input
              id="geminiFolderId"
              placeholder="Paste folder URL or ID (e.g., 1BXGIela04Je9lkmteILZ_pEugFdeQ8fw)"
              value={geminiFolderId}
              onChange={(e) => handleGeminiFolderInputChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Find this in your Google Drive URL: drive.google.com/drive/folders/<strong>FOLDER_ID</strong>
            </p>
          </div>

          {geminiFolderVerified && geminiFolderName && (
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Folder Name:</span>
                <span className="font-medium">{geminiFolderName}</span>
              </div>
            </div>
          )}

          <Button
            onClick={handleSaveGeminiSettings}
            disabled={savingGeminiSettings || !geminiFolderId}
          >
            {savingGeminiSettings ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {geminiFolderVerified ? 'Update Settings' : 'Save Settings'}
          </Button>

          <p className="text-xs text-muted-foreground">
            The Chrome extension will search this folder to find Gemini-generated notes
            for your meetings.
          </p>
        </CardContent>
      </Card>

      {/* Drive Connection Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Google Drive Connection
              </CardTitle>
              <CardDescription>
                Connect your Meeting Notes folder for automatic note detection
              </CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error/Success Messages */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">{success}</span>
            </div>
          )}

          {config?.configured && config.status === 'active' ? (
            // Connected state
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Folder Name:</span>
                    <span className="font-medium">{config.folderName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Folder ID:</span>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {config.folderId}
                    </code>
                  </div>
                  {config.webhookExpiration && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Webhook Expires:</span>
                      <span className={isExpiringSoon() ? 'text-orange-600 font-medium' : ''}>
                        {new Date(config.webhookExpiration).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {isExpiringSoon() && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">
                    Webhook expiring soon. Click Refresh to renew.
                  </span>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleConnect}
                  disabled={connecting}
                >
                  {connecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh Webhook
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Unlink className="h-4 w-4 mr-2" />
                  )}
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            // Not connected state
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="folderId">Meeting Notes Folder ID or URL</Label>
                <Input
                  id="folderId"
                  placeholder="Paste folder URL or ID (e.g., 1BXGIela04Je9lkmteILZ_pEugFdeQ8fw)"
                  value={folderId}
                  onChange={(e) => setFolderId(extractFolderIdFromInput(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Find this in your Google Drive URL: drive.google.com/drive/folders/
                  <strong>FOLDER_ID</strong>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="folderName">Folder Name (optional)</Label>
                <Input
                  id="folderName"
                  placeholder="Meeting Notes"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                />
              </div>

              <Button onClick={handleConnect} disabled={connecting || !folderId}>
                {connecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <LinkIcon className="h-4 w-4 mr-2" />
                )}
                Connect Google Drive
              </Button>

              <p className="text-xs text-muted-foreground">
                You&apos;ll be asked to grant Drive access permissions. This allows
                the app to monitor your Meeting Notes folder for new Gemini-generated
                notes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chrome Extension Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Chrome className="h-5 w-5" />
            Chrome Extension
          </CardTitle>
          <CardDescription>
            Install the Chrome extension to organize meeting notes directly from your browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Chrome className="h-12 w-12 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-2">
                The extension detects when meetings end and helps you organize notes instantly.
              </p>
              <Button asChild>
                <a href="/extension/egen-notes-extension.zip" download>
                  <Download className="mr-2 h-4 w-4" />
                  Download Extension (.zip)
                </a>
              </Button>
            </div>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            <p className="font-medium">Installation:</p>
            <ol className="list-decimal ml-4 mt-1 space-y-1">
              <li>Download and unzip the file</li>
              <li>Open Chrome and go to chrome://extensions</li>
              <li>Enable &quot;Developer mode&quot;</li>
              <li>Click &quot;Load unpacked&quot; and select the unzipped folder</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* How it Works Card */}
      <Card>
        <CardHeader>
          <CardTitle>How Auto-Detection Works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Connect your Google Drive &quot;Meeting Notes&quot; folder above</li>
            <li>When Gemini creates a new meeting note, our system detects it automatically</li>
            <li>The note is analyzed by AI to identify the client and project</li>
            <li>If confidence is 90%+, it&apos;s auto-filed to the correct folder</li>
            <li>Otherwise, it appears in your &quot;Uncategorized&quot; queue for review</li>
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            Note: Webhooks expire after 7 days. Return here to refresh if needed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
