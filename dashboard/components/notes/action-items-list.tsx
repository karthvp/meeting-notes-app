'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ActionItem, updateActionItemStatus, linkGoogleTaskToActionItem } from '@/lib/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CheckCircle2,
  Circle,
  Clock,
  User,
  Calendar,
  ExternalLink,
  Loader2,
  ListTodo,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionItemsListProps {
  noteId: string;
  actionItems: ActionItem[];
  onCreateGoogleTask?: (item: ActionItem) => Promise<void>;
  isCreatingTask?: boolean;
}

export function ActionItemsList({
  noteId,
  actionItems,
  onCreateGoogleTask,
  isCreatingTask,
}: ActionItemsListProps) {
  const queryClient = useQueryClient();
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      itemId,
      status,
    }: {
      itemId: string;
      status: 'pending' | 'completed' | 'cancelled';
    }) => {
      setUpdatingItemId(itemId);
      await updateActionItemStatus(noteId, itemId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note', noteId] });
    },
    onSettled: () => {
      setUpdatingItemId(null);
    },
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500">Medium</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return null;
    }
  };

  const formatDueDate = (dueDate?: string | null) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    const today = new Date();
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Overdue by ${Math.abs(diffDays)} days`, isOverdue: true };
    } else if (diffDays === 0) {
      return { text: 'Due today', isOverdue: false };
    } else if (diffDays === 1) {
      return { text: 'Due tomorrow', isOverdue: false };
    } else {
      return { text: date.toLocaleDateString(), isOverdue: false };
    }
  };

  if (!actionItems || actionItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListTodo className="h-5 w-5" />
            Action Items
          </CardTitle>
          <CardDescription>No action items found in this meeting</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const pendingItems = actionItems.filter((item) => item.status === 'pending');
  const completedItems = actionItems.filter((item) => item.status === 'completed');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ListTodo className="h-5 w-5" />
          Action Items
          <Badge variant="outline" className="ml-2">
            {pendingItems.length} pending
          </Badge>
        </CardTitle>
        <CardDescription>
          Tasks and follow-ups extracted from this meeting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {actionItems.map((item) => {
          const dueInfo = formatDueDate(item.due_date);
          const isUpdating = updatingItemId === item.id;
          const isCompleted = item.status === 'completed';

          return (
            <div
              key={item.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                isCompleted && 'bg-muted/50'
              )}
            >
              <div className="pt-0.5">
                {isUpdating ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Checkbox
                    checked={isCompleted}
                    onCheckedChange={(checked) => {
                      updateStatusMutation.mutate({
                        itemId: item.id,
                        status: checked ? 'completed' : 'pending',
                      });
                    }}
                  />
                )}
              </div>

              <div className="flex-1 space-y-1">
                <p
                  className={cn(
                    'text-sm font-medium',
                    isCompleted && 'text-muted-foreground line-through'
                  )}
                >
                  {item.task}
                </p>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {item.assignee_name || item.assignee ? (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {item.assignee_name || item.assignee}
                    </span>
                  ) : null}

                  {dueInfo && (
                    <span
                      className={cn(
                        'flex items-center gap-1',
                        dueInfo.isOverdue && 'text-destructive'
                      )}
                    >
                      {dueInfo.isOverdue ? (
                        <AlertCircle className="h-3 w-3" />
                      ) : (
                        <Calendar className="h-3 w-3" />
                      )}
                      {dueInfo.text}
                    </span>
                  )}

                  {getPriorityBadge(item.priority)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {item.google_task_id ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-8 px-2"
                  >
                    <a
                      href={`https://tasks.google.com/`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                ) : onCreateGoogleTask && !isCompleted ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCreateGoogleTask(item)}
                    disabled={isCreatingTask}
                    className="h-8 text-xs"
                  >
                    {isCreatingTask ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Clock className="mr-1 h-3 w-3" />
                    )}
                    Add to Tasks
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}

        {completedItems.length > 0 && pendingItems.length > 0 && (
          <div className="pt-2 text-xs text-muted-foreground">
            {completedItems.length} of {actionItems.length} completed
          </div>
        )}
      </CardContent>
    </Card>
  );
}
