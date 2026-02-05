'use client';

import { useState } from 'react';
import { Note, bulkUpdateNoteSharing } from '@/lib/firestore';
import { bulkShare } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, AlertCircle, Plus, X } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';

interface BulkShareModalProps {
  notes: Note[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const SUGGESTED_TEAM = [
  'team@egen.com',
  'engineering@egen.com',
  'sales@egen.com',
];

export function BulkShareModal({
  notes,
  open,
  onOpenChange,
  onSuccess,
}: BulkShareModalProps) {
  const { user } = useAuth();
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);

  const handleAddEmail = () => {
    if (!newEmail.trim()) return;

    const email = newEmail.trim().toLowerCase();

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (sharedWith.includes(email)) {
      setError('This email is already added');
      return;
    }

    setSharedWith([...sharedWith, email]);
    setNewEmail('');
    setError(null);
  };

  const handleRemoveEmail = (email: string) => {
    setSharedWith(sharedWith.filter((e) => e !== email));
  };

  const handleAddSuggested = (email: string) => {
    if (!sharedWith.includes(email)) {
      setSharedWith([...sharedWith, email]);
    }
  };

  const handleSave = async () => {
    if (!user?.email) return;
    if (sharedWith.length === 0) {
      setError('Please add at least one email to share with');
      return;
    }

    setSaving(true);
    setProgress(0);
    setResults(null);
    setError(null);

    try {
      const noteIds = notes.map((n) => n.id);

      // Use API for Drive sharing
      const shareResult = await bulkShare({
        noteIds,
        shareWith: sharedWith.map((email) => ({ email, permission: 'reader' })),
        userEmail: user.email,
        sendNotifications: false,
      });

      // Also update Firestore metadata
      const firestoreResult = await bulkUpdateNoteSharing(
        noteIds,
        sharedWith,
        user.email,
        'viewer'
      );

      // Simulate progress
      for (let i = 0; i <= 100; i += 20) {
        setProgress(i);
        await new Promise((r) => setTimeout(r, 100));
      }

      const totalSuccess = firestoreResult.success.length;
      const totalFailed = firestoreResult.failed.length;

      setResults({
        success: totalSuccess,
        failed: totalFailed,
      });

      if (totalFailed === 0) {
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
          resetState();
        }, 1500);
      }
    } catch (err) {
      console.error('Bulk share failed:', err);
      setResults({ success: 0, failed: notes.length });
    } finally {
      setSaving(false);
    }
  };

  const resetState = () => {
    setSharedWith([]);
    setNewEmail('');
    setError(null);
    setResults(null);
    setProgress(0);
  };

  const handleClose = () => {
    if (!saving) {
      onOpenChange(false);
      resetState();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Bulk Share Notes</DialogTitle>
          <DialogDescription>
            Share {notes.length} selected notes with team members.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="py-6 space-y-4">
            <div className="flex flex-col items-center justify-center">
              {results.failed === 0 ? (
                <>
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
                  <p className="text-lg font-medium">Successfully shared!</p>
                  <p className="text-sm text-muted-foreground">
                    {results.success} notes shared with {sharedWith.length} people.
                  </p>
                </>
              ) : results.success > 0 ? (
                <>
                  <AlertCircle className="h-12 w-12 text-yellow-500 mb-3" />
                  <p className="text-lg font-medium">Partially completed</p>
                  <p className="text-sm text-muted-foreground">
                    {results.success} succeeded, {results.failed} failed.
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="h-12 w-12 text-red-500 mb-3" />
                  <p className="text-lg font-medium">Sharing failed</p>
                  <p className="text-sm text-muted-foreground">
                    Could not share the selected notes.
                  </p>
                </>
              )}
            </div>
            {results.failed > 0 && (
              <Button variant="outline" className="w-full" onClick={handleClose}>
                Close
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              {/* Email input */}
              <div className="space-y-2">
                <Label>Share with</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="email@egen.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEmail();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={handleAddEmail}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Suggested team members */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Quick add</Label>
                <div className="flex flex-wrap gap-1">
                  {SUGGESTED_TEAM.map((email) => (
                    <Badge
                      key={email}
                      variant={sharedWith.includes(email) ? 'secondary' : 'outline'}
                      className="cursor-pointer hover:bg-primary/10"
                      onClick={() => handleAddSuggested(email)}
                    >
                      {email}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Current list */}
              {sharedWith.length > 0 && (
                <div className="space-y-2">
                  <Label>Will share with ({sharedWith.length})</Label>
                  <div className="flex flex-wrap gap-1">
                    {sharedWith.map((email) => (
                      <Badge
                        key={email}
                        variant="secondary"
                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleRemoveEmail(email)}
                      >
                        {email}
                        <X className="ml-1 h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              {/* Notes preview */}
              <div className="p-3 rounded-md bg-muted/50 border">
                <p className="text-sm text-muted-foreground">
                  This will share {notes.length} note(s):
                </p>
                <ul className="mt-2 text-sm max-h-24 overflow-y-auto space-y-1">
                  {notes.slice(0, 5).map((note) => (
                    <li key={note.id} className="truncate">
                      &bull; {note.meeting?.title || note.title || 'Untitled'}
                    </li>
                  ))}
                  {notes.length > 5 && (
                    <li className="text-muted-foreground">
                      ...and {notes.length - 5} more
                    </li>
                  )}
                </ul>
              </div>

              {/* Progress bar */}
              {saving && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-xs text-center text-muted-foreground">
                    Sharing... {progress}%
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || sharedWith.length === 0}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Share {notes.length} Notes
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
