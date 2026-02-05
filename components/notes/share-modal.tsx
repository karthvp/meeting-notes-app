'use client';

import { useState, useEffect } from 'react';
import { Note, updateNote } from '@/lib/firestore';
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
import { Loader2, X, Plus } from 'lucide-react';

interface ShareModalProps {
  note: Note | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// Common team members - in production this would come from a directory service
const SUGGESTED_MEMBERS = [
  'john.doe@egen.ai',
  'jane.smith@egen.ai',
  'mike.wilson@egen.ai',
  'sarah.jones@egen.ai',
];

export function ShareModal({
  note,
  open,
  onOpenChange,
  onSuccess,
}: ShareModalProps) {
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (note) {
      setSharedWith(note.sharedWith || []);
    }
  }, [note]);

  const handleAddEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;

    // Basic email validation
    if (!email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address');
      return;
    }

    // Restrict to egen.com domain
    if (!email.endsWith('@egen.ai')) {
      setError('Only @egen.ai email addresses are allowed');
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

  const handleSave = async () => {
    if (!note) return;

    setSaving(true);
    try {
      await updateNote(note.id, {
        sharedWith,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update note:', error);
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  };

  const handleSuggestedClick = (email: string) => {
    if (!sharedWith.includes(email)) {
      setSharedWith([...sharedWith, email]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share Note</DialogTitle>
          <DialogDescription>
            Share this note with team members. They will receive access to view and
            collaborate.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Note Title</Label>
            <p className="text-sm text-muted-foreground truncate">{note?.title}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Add Team Member</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                placeholder="email@egen.ai"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  setError(null);
                }}
                onKeyPress={handleKeyPress}
              />
              <Button type="button" onClick={handleAddEmail} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          {/* Suggested members */}
          <div className="space-y-2">
            <Label>Suggested Team Members</Label>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_MEMBERS.filter((m) => !sharedWith.includes(m)).map(
                (email) => (
                  <Badge
                    key={email}
                    variant="outline"
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => handleSuggestedClick(email)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {email.split('@')[0]}
                  </Badge>
                )
              )}
            </div>
          </div>

          {/* Current shares */}
          <div className="space-y-2">
            <Label>Shared With ({sharedWith.length})</Label>
            {sharedWith.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Not shared with anyone yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sharedWith.map((email) => (
                  <Badge key={email} variant="secondary" className="pr-1">
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveEmail(email)}
                      className="ml-2 rounded-full hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
