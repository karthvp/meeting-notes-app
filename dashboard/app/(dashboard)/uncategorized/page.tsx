'use client';

import { useQuery } from '@tanstack/react-query';
import { getNotes, getClients, getProjects, Note } from '@/lib/firestore';
import { NotesTable } from '@/components/notes/notes-table';
import { CategorizeModal } from '@/components/notes/categorize-modal';
import { ShareModal } from '@/components/notes/share-modal';
import { BulkCategorizeModal } from '@/components/notes/bulk-categorize-modal';
import { BulkShareModal } from '@/components/notes/bulk-share-modal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function UncategorizedPage() {
  const [categorizeNote, setCategorizeNote] = useState<Note | null>(null);
  const [shareNote, setShareNote] = useState<Note | null>(null);
  const [bulkCategorizeNotes, setBulkCategorizeNotes] = useState<Note[]>([]);
  const [bulkShareNotes, setBulkShareNotes] = useState<Note[]>([]);

  const { data: notes = [], isLoading: loadingNotes, refetch: refetchNotes } = useQuery({
    queryKey: ['notes'],
    queryFn: () => getNotes(),
  });

  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => getClients(),
  });

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects(),
  });

  const isLoading = loadingNotes || loadingClients || loadingProjects;

  // Filter for uncategorized notes - check both new classification.type and legacy clientId
  const uncategorizedNotes = notes.filter((note) =>
    note.classification?.type === 'uncategorized' ||
    (!note.classification?.client_id && !note.clientId)
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Uncategorized Notes</h1>
        <p className="text-muted-foreground">
          Notes that need to be assigned to a client and project.
        </p>
      </div>

      {uncategorizedNotes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-green-100 p-3 mb-4">
              <AlertCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="mb-2">All caught up!</CardTitle>
            <CardDescription>
              There are no uncategorized notes at the moment.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <NotesTable
          notes={uncategorizedNotes}
          clients={clients}
          projects={projects}
          onCategorize={setCategorizeNote}
          onShare={setShareNote}
          onBulkCategorize={(notes) => setBulkCategorizeNotes(notes)}
          onBulkShare={(notes) => setBulkShareNotes(notes)}
        />
      )}

      <CategorizeModal
        note={categorizeNote}
        clients={clients}
        projects={projects}
        open={!!categorizeNote}
        onOpenChange={(open) => !open && setCategorizeNote(null)}
        onSuccess={() => refetchNotes()}
      />

      <ShareModal
        note={shareNote}
        open={!!shareNote}
        onOpenChange={(open) => !open && setShareNote(null)}
        onSuccess={() => refetchNotes()}
      />

      <BulkCategorizeModal
        notes={bulkCategorizeNotes}
        clients={clients}
        projects={projects}
        open={bulkCategorizeNotes.length > 0}
        onOpenChange={(open) => !open && setBulkCategorizeNotes([])}
        onSuccess={() => refetchNotes()}
      />

      <BulkShareModal
        notes={bulkShareNotes}
        open={bulkShareNotes.length > 0}
        onOpenChange={(open) => !open && setBulkShareNotes([])}
        onSuccess={() => refetchNotes()}
      />
    </div>
  );
}
