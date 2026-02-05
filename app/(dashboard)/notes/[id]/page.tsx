'use client';

import { useQuery } from '@tanstack/react-query';
import { getNote, getClient, getProject, getClients, getProjects, Note, ActionItem } from '@/lib/firestore';
import { CategorizeModal } from '@/components/notes/categorize-modal';
import { ShareModal } from '@/components/notes/share-modal';
import { SummaryCard } from '@/components/notes/summary-card';
import { ActionItemsList } from '@/components/notes/action-items-list';
import { DecisionsList } from '@/components/notes/decisions-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Edit,
  Share2,
  Calendar,
  User,
  FolderKanban,
  Users,
  FileText,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { createGoogleTask } from '@/lib/api';

export default function NoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const noteId = params.id as string;

  const [showCategorize, setShowCategorize] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  const handleCreateGoogleTask = async (item: ActionItem) => {
    try {
      setIsCreatingTask(true);
      await createGoogleTask({
        noteId,
        actionItemId: item.id,
        title: item.task,
        notes: `From meeting: ${note?.meeting?.title || note?.title || 'Unknown'}`,
        due: item.due_date || undefined,
      });
      refetchNote();
    } catch (error) {
      console.error('Failed to create Google Task:', error);
    } finally {
      setIsCreatingTask(false);
    }
  };

  const { data: note, isLoading: loadingNote, refetch: refetchNote } = useQuery({
    queryKey: ['note', noteId],
    queryFn: () => getNote(noteId),
    enabled: !!noteId,
  });

  const { data: client } = useQuery({
    queryKey: ['client', note?.clientId],
    queryFn: () => getClient(note!.clientId!),
    enabled: !!note?.clientId,
  });

  const { data: project } = useQuery({
    queryKey: ['project', note?.projectId],
    queryFn: () => getProject(note!.projectId!),
    enabled: !!note?.projectId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => getClients(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects(),
  });

  if (loadingNote) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="flex h-32 items-center justify-center">
            <p className="text-muted-foreground">Note not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (timestamp?: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getConfidenceBadge = (confidence?: number) => {
    if (confidence === undefined || confidence === null) {
      return <Badge variant="outline">N/A</Badge>;
    }
    if (confidence >= 0.8) {
      return <Badge className="bg-green-500">High ({Math.round(confidence * 100)}%)</Badge>;
    }
    if (confidence >= 0.5) {
      return <Badge className="bg-yellow-500">Medium ({Math.round(confidence * 100)}%)</Badge>;
    }
    return <Badge className="bg-red-500">Low ({Math.round(confidence * 100)}%)</Badge>;
  };

  const getTypeBadge = (noteType?: string) => {
    const typeColors: Record<string, string> = {
      meeting: 'bg-blue-500',
      kickoff: 'bg-purple-500',
      status: 'bg-green-500',
      planning: 'bg-orange-500',
      review: 'bg-pink-500',
      internal: 'bg-gray-500',
    };
    const color = typeColors[noteType?.toLowerCase() || ''] || 'bg-gray-400';
    return (
      <Badge className={cn(color, 'hover:opacity-80')}>
        {noteType || 'Unknown'}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCategorize(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Categorize
          </Button>
          <Button variant="outline" onClick={() => setShowShare(true)}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
          {note.driveFileId && (
            <Button asChild>
              <a
                href={`https://drive.google.com/file/d/${note.driveFileId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in Drive
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Note Details */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl">{note.title}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Created {formatDate(note.createdAt)}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {getTypeBadge(note.noteType)}
              {getConfidenceBadge(note.confidence)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Metadata */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                Client
              </div>
              {client ? (
                <Link
                  href={`/clients/${client.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {client.name}
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">Uncategorized</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FolderKanban className="h-4 w-4" />
                Project
              </div>
              {project ? (
                <Link
                  href={`/projects/${project.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {project.project_name}
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">Not assigned</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                Created By
              </div>
              <p className="text-sm">{note.createdBy || 'Unknown'}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Last Updated
              </div>
              <p className="text-sm">{formatDate(note.updatedAt)}</p>
            </div>
          </div>

          <Separator />

          {/* Shared With */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Share2 className="h-4 w-4" />
              Shared With
            </div>
            {note.sharedWith && note.sharedWith.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {note.sharedWith.map((email) => (
                  <Badge key={email} variant="secondary">
                    {email}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not shared with anyone</p>
            )}
          </div>

          {/* Content Preview */}
          {note.content && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Content Preview
                </div>
                <div className="rounded-md bg-muted p-4">
                  <p className="whitespace-pre-wrap text-sm">{note.content}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* AI Summary */}
      {(note.summary || note.enhanced_analysis?.summary) && (
        <SummaryCard summary={note.summary || note.enhanced_analysis?.summary} />
      )}

      {/* Action Items & Decisions Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Action Items */}
        <ActionItemsList
          noteId={noteId}
          actionItems={note.action_items || note.enhanced_analysis?.action_items || []}
          onCreateGoogleTask={handleCreateGoogleTask}
          isCreatingTask={isCreatingTask}
        />

        {/* Key Decisions */}
        <DecisionsList
          decisions={note.key_decisions || note.enhanced_analysis?.key_decisions || []}
        />
      </div>

      {/* Modals */}
      <CategorizeModal
        note={note}
        clients={clients}
        projects={projects}
        open={showCategorize}
        onOpenChange={setShowCategorize}
        onSuccess={() => refetchNote()}
      />

      <ShareModal
        note={note}
        open={showShare}
        onOpenChange={setShowShare}
        onSuccess={() => refetchNote()}
      />
    </div>
  );
}
