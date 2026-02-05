'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Note } from '@/lib/firestore';
import { getSlackChannels, shareToSlack, SlackChannel } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, MessageSquare, Hash, Lock, AlertCircle, Check } from 'lucide-react';

interface SlackShareModalProps {
  note: Note | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  userEmail: string;
}

export function SlackShareModal({
  note,
  open,
  onOpenChange,
  onSuccess,
  userEmail,
}: SlackShareModalProps) {
  const [selectedChannel, setSelectedChannel] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [shareSuccess, setShareSuccess] = useState(false);

  const {
    data: channelsData,
    isLoading: loadingChannels,
    error: channelsError,
  } = useQuery({
    queryKey: ['slack-channels', userEmail],
    queryFn: () => getSlackChannels(userEmail),
    enabled: open && !!userEmail,
  });

  const shareMutation = useMutation({
    mutationFn: shareToSlack,
    onSuccess: () => {
      setShareSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
        setShareSuccess(false);
        setSelectedChannel('');
        setCustomMessage('');
        onSuccess?.();
      }, 1500);
    },
  });

  const handleShare = () => {
    if (!note || !selectedChannel) return;

    shareMutation.mutate({
      noteId: note.id,
      channelId: selectedChannel,
      userEmail,
      customMessage: customMessage.trim() || undefined,
    });
  };

  const needsAuth = (channelsError as any)?.needsAuth;
  const noteTitle = note?.meeting?.title || note?.title || 'Untitled Note';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Share to Slack
          </DialogTitle>
          <DialogDescription>
            Share &quot;{noteTitle}&quot; to a Slack channel
          </DialogDescription>
        </DialogHeader>

        {shareSuccess ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-green-100 p-3 mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-lg font-medium">Shared to Slack</p>
            <p className="text-sm text-muted-foreground">
              Your note has been posted successfully
            </p>
          </div>
        ) : needsAuth ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Slack is not connected. Please connect your Slack workspace in Settings to share notes.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4 py-4">
            {/* Channel Selection */}
            <div className="space-y-2">
              <Label>Channel</Label>
              {loadingChannels ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading channels...
                </div>
              ) : channelsError && !needsAuth ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Failed to load Slack channels</AlertDescription>
                </Alert>
              ) : (
                <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {channelsData?.channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        <div className="flex items-center gap-2">
                          {channel.isPrivate ? (
                            <Lock className="h-3 w-3" />
                          ) : (
                            <Hash className="h-3 w-3" />
                          )}
                          {channel.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Custom Message */}
            <div className="space-y-2">
              <Label>Add a message (optional)</Label>
              <Textarea
                placeholder="Add context or notes for your team..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={3}
              />
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">What will be shared:</Label>
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Meeting title and date</li>
                  <li>• Client/project info (if available)</li>
                  <li>• AI summary</li>
                  <li>• Action items with assignees</li>
                  <li>• Key decisions</li>
                  <li>• Link to full notes in Drive</li>
                </ul>
              </div>
            </div>

            {shareMutation.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {(shareMutation.error as Error).message || 'Failed to share to Slack'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {!shareSuccess && !needsAuth && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleShare}
              disabled={!selectedChannel || shareMutation.isPending}
            >
              {shareMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Share to Slack
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
