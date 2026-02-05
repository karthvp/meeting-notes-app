'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { getFirebaseAuth, getGoogleProviderWithDriveScope } from '@/lib/firebase';
import { importFromDriveSecure, ImportFromDriveResponse } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Download,
  CheckCircle2,
  AlertCircle,
  FileText,
  SkipForward,
} from 'lucide-react';

interface ImportNotesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type ImportState = 'initial' | 'authenticating' | 'importing' | 'complete' | 'error';

export function ImportNotesModal({
  open,
  onOpenChange,
  onSuccess,
}: ImportNotesModalProps) {
  const { user } = useAuth();
  const [state, setState] = useState<ImportState>('initial');
  const [statusMessage, setStatusMessage] = useState('');
  const [result, setResult] = useState<ImportFromDriveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetModal = () => {
    setState('initial');
    setStatusMessage('');
    setResult(null);
    setError(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetModal();
    }
    onOpenChange(open);
  };

  const handleStartImport = async () => {
    if (!user?.email) {
      setError('You must be signed in to import notes');
      return;
    }

    setError(null);
    setState('authenticating');
    setStatusMessage('Authenticating with Google Drive...');

    try {
      // Re-authenticate with Drive scopes to get access token
      const auth = getFirebaseAuth();
      const provider = getGoogleProviderWithDriveScope();

      const authResult = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(authResult);

      if (!credential?.accessToken) {
        throw new Error('Failed to get access token. Please try again.');
      }

      setState('importing');
      setStatusMessage('Scanning Google Drive for meeting notes...');

      // Call the import API (uses Authorization header for security)
      const importResult = await importFromDriveSecure({
        accessToken: credential.accessToken,
        userEmail: user.email,
      });

      setResult(importResult);
      setState('complete');

      if (importResult.imported.length > 0) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Import error:', err);

      if (err.needsReauth) {
        setError('Your session has expired. Please try again.');
      } else {
        setError(err.message || 'Failed to import notes. Please try again.');
      }

      setState('error');
    }
  };

  const renderContent = () => {
    switch (state) {
      case 'initial':
        return (
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
              <Download className="h-8 w-8 text-primary mt-1" />
              <div>
                <h4 className="font-medium">Import Gemini Meeting Notes</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  This will scan your entire Google Drive for documents named
                  &ldquo;Meeting notes&rdquo; (created by Google Meet&apos;s Gemini) and import
                  them as uncategorized notes.
                </p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>What happens during import:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Searches for all &ldquo;Meeting notes&rdquo; documents in your Drive</li>
                <li>Skips notes that have already been imported</li>
                <li>Creates new uncategorized entries for each new note</li>
                <li>You can then categorize them individually or in bulk</li>
              </ul>
            </div>
          </div>
        );

      case 'authenticating':
      case 'importing':
        return (
          <div className="space-y-4 py-8">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="mt-4 text-center text-muted-foreground">
                {statusMessage}
              </p>
              {state === 'importing' && (
                <p className="text-sm text-muted-foreground mt-2">
                  This may take a moment depending on how many notes you have...
                </p>
              )}
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <h4 className="text-lg font-medium text-center">Import Complete</h4>

            {result && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {result.summary.imported}
                    </div>
                    <div className="text-xs text-muted-foreground">Imported</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-muted-foreground">
                      {result.summary.skipped}
                    </div>
                    <div className="text-xs text-muted-foreground">Skipped</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-destructive">
                      {result.summary.errors}
                    </div>
                    <div className="text-xs text-muted-foreground">Errors</div>
                  </div>
                </div>

                {result.imported.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Recently Imported ({result.imported.length})
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {result.imported.slice(0, 10).map((note) => (
                        <div
                          key={note.id}
                          className="flex items-center gap-2 text-sm p-2 rounded bg-background"
                        >
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate">{note.title}</span>
                          <Badge variant="secondary" className="ml-auto">New</Badge>
                        </div>
                      ))}
                      {result.imported.length > 10 && (
                        <p className="text-xs text-muted-foreground pl-6">
                          ...and {result.imported.length - 10} more
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {result.summary.skipped > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <SkipForward className="h-4 w-4" />
                    <span>{result.summary.skipped} notes were already imported</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'error':
        return (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <h4 className="text-lg font-medium text-center">Import Failed</h4>
            <p className="text-center text-muted-foreground">{error}</p>
          </div>
        );

      default:
        return null;
    }
  };

  const renderFooter = () => {
    switch (state) {
      case 'initial':
        return (
          <>
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartImport}>
              <Download className="mr-2 h-4 w-4" />
              Start Import
            </Button>
          </>
        );

      case 'authenticating':
      case 'importing':
        return (
          <Button variant="outline" disabled>
            Importing...
          </Button>
        );

      case 'complete':
        return (
          <Button onClick={() => handleClose(false)}>
            Done
          </Button>
        );

      case 'error':
        return (
          <>
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartImport}>
              Try Again
            </Button>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import from Google Drive</DialogTitle>
          <DialogDescription>
            Import Gemini meeting notes from your Google Drive.
          </DialogDescription>
        </DialogHeader>

        {renderContent()}

        <DialogFooter>{renderFooter()}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
