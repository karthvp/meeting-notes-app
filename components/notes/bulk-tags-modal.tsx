'use client';

import { useState } from 'react';
import { Note, bulkAddTags } from '@/lib/firestore';
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

interface BulkTagsModalProps {
  notes: Note[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const SUGGESTED_TAGS = [
  'important',
  'follow-up',
  'action-items',
  'decision',
  'review',
];

export function BulkTagsModal({
  notes,
  open,
  onOpenChange,
  onSuccess,
}: BulkTagsModalProps) {
  const { user } = useAuth();
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);

  const handleAddTag = () => {
    if (!newTag.trim()) return;

    const tag = newTag.trim().toLowerCase().replace(/\s+/g, '-');

    if (tags.includes(tag)) return;

    setTags([...tags, tag]);
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleAddSuggested = (tag: string) => {
    if (!tags.includes(tag)) {
      setTags([...tags, tag]);
    }
  };

  const handleSave = async () => {
    if (!user?.email) return;
    if (tags.length === 0) return;

    setSaving(true);
    setProgress(0);
    setResults(null);

    try {
      const noteIds = notes.map((n) => n.id);

      const result = await bulkAddTags(noteIds, tags, user.email);

      // Simulate progress
      for (let i = 0; i <= 100; i += 20) {
        setProgress(i);
        await new Promise((r) => setTimeout(r, 100));
      }

      setResults({
        success: result.success.length,
        failed: result.failed.length,
      });

      if (result.failed.length === 0) {
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
          resetState();
        }, 1500);
      }
    } catch (error) {
      console.error('Bulk add tags failed:', error);
      setResults({ success: 0, failed: notes.length });
    } finally {
      setSaving(false);
    }
  };

  const resetState = () => {
    setTags([]);
    setNewTag('');
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
          <DialogTitle>Add Tags to Notes</DialogTitle>
          <DialogDescription>
            Add tags to {notes.length} selected notes.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="py-6 space-y-4">
            <div className="flex flex-col items-center justify-center">
              {results.failed === 0 ? (
                <>
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
                  <p className="text-lg font-medium">Tags added!</p>
                  <p className="text-sm text-muted-foreground">
                    Added {tags.length} tag(s) to {results.success} notes.
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
                  <p className="text-lg font-medium">Operation failed</p>
                  <p className="text-sm text-muted-foreground">
                    Could not add tags to the selected notes.
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
              {/* Tag input */}
              <div className="space-y-2">
                <Label>Add tags</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter tag name..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={handleAddTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Suggested tags */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Suggested tags</Label>
                <div className="flex flex-wrap gap-1">
                  {SUGGESTED_TAGS.map((tag) => (
                    <Badge
                      key={tag}
                      variant={tags.includes(tag) ? 'secondary' : 'outline'}
                      className="cursor-pointer hover:bg-primary/10"
                      onClick={() => handleAddSuggested(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Current tags */}
              {tags.length > 0 && (
                <div className="space-y-2">
                  <Label>Tags to add ({tags.length})</Label>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="default"
                        className="cursor-pointer hover:bg-destructive"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        {tag}
                        <X className="ml-1 h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes preview */}
              <div className="p-3 rounded-md bg-muted/50 border">
                <p className="text-sm text-muted-foreground">
                  This will add tags to {notes.length} note(s):
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
                    Adding tags... {progress}%
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || tags.length === 0}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Tags to {notes.length} Notes
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
