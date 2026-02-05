'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { getNotes, getClients, getProjects, Note } from '@/lib/firestore';
import { NotesTable } from '@/components/notes/notes-table';
import { Button } from '@/components/ui/button';
import { Loader2, Download } from 'lucide-react';

// Dynamic imports for modals to enable code splitting (not needed on initial page load)
const CategorizeModal = dynamic(
  () => import('@/components/notes/categorize-modal').then(m => ({ default: m.CategorizeModal })),
  { ssr: false }
);
const ShareModal = dynamic(
  () => import('@/components/notes/share-modal').then(m => ({ default: m.ShareModal })),
  { ssr: false }
);
const BulkCategorizeModal = dynamic(
  () => import('@/components/notes/bulk-categorize-modal').then(m => ({ default: m.BulkCategorizeModal })),
  { ssr: false }
);
const BulkShareModal = dynamic(
  () => import('@/components/notes/bulk-share-modal').then(m => ({ default: m.BulkShareModal })),
  { ssr: false }
);
const BulkTagsModal = dynamic(
  () => import('@/components/notes/bulk-tags-modal').then(m => ({ default: m.BulkTagsModal })),
  { ssr: false }
);
const ExportModal = dynamic(
  () => import('@/components/notes/export-modal').then(m => ({ default: m.ExportModal })),
  { ssr: false }
);
const ImportNotesModal = dynamic(
  () => import('@/components/notes/import-notes-modal').then(m => ({ default: m.ImportNotesModal })),
  { ssr: false }
);

export default function NotesPage() {
  const [categorizeNote, setCategorizeNote] = useState<Note | null>(null);
  const [shareNote, setShareNote] = useState<Note | null>(null);

  // Bulk action states
  const [bulkCategorizeNotes, setBulkCategorizeNotes] = useState<Note[]>([]);
  const [bulkShareNotes, setBulkShareNotes] = useState<Note[]>([]);
  const [bulkTagNotes, setBulkTagNotes] = useState<Note[]>([]);

  // Export modal state
  const [exportNotes, setExportNotes] = useState<Note[]>([]);

  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);

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

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notes</h1>
          <p className="text-muted-foreground">
            Browse and manage all your meeting notes.
          </p>
        </div>
        <Button onClick={() => setImportModalOpen(true)}>
          <Download className="mr-2 h-4 w-4" />
          Import from Drive
        </Button>
      </div>

      <NotesTable
        notes={notes}
        clients={clients}
        projects={projects}
        onCategorize={setCategorizeNote}
        onShare={setShareNote}
        onBulkCategorize={(notes) => setBulkCategorizeNotes(notes)}
        onBulkShare={(notes) => setBulkShareNotes(notes)}
        onBulkAddTags={(notes) => setBulkTagNotes(notes)}
        onExport={(notes) => setExportNotes(notes)}
      />

      {/* Single note modals */}
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

      {/* Bulk action modals */}
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

      <BulkTagsModal
        notes={bulkTagNotes}
        open={bulkTagNotes.length > 0}
        onOpenChange={(open) => !open && setBulkTagNotes([])}
        onSuccess={() => refetchNotes()}
      />

      {/* Export modal */}
      <ExportModal
        notes={exportNotes}
        open={exportNotes.length > 0}
        onOpenChange={(open) => !open && setExportNotes([])}
      />

      {/* Import modal */}
      <ImportNotesModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onSuccess={() => refetchNotes()}
      />
    </div>
  );
}
