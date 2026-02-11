'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNotes, getClients, getProjects, getUserSettings, Note } from '@/lib/firestore';
import { useAuth } from '@/components/auth/auth-provider';
import { NotesTable } from '@/components/notes/notes-table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Download } from 'lucide-react';

// Direct imports for modals (removed dynamic imports to eliminate caching issues)
import { CategorizeModal } from '@/components/notes/categorize-modal';
import { ShareModal } from '@/components/notes/share-modal';
import { BulkCategorizeModal } from '@/components/notes/bulk-categorize-modal';
import { BulkShareModal } from '@/components/notes/bulk-share-modal';
import { BulkTagsModal } from '@/components/notes/bulk-tags-modal';
import { ExportModal } from '@/components/notes/export-modal';
import { ImportNotesModal } from '@/components/notes/import-notes-modal';

export default function NotesPage() {
  const { user } = useAuth();
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

  // Notes folder configuration check
  const [hasNotesFolder, setHasNotesFolder] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkNotesFolder() {
      if (!user?.email) {
        setHasNotesFolder(null);
        return;
      }

      try {
        const settings = await getUserSettings(user.email);
        setHasNotesFolder(!!settings?.gemini_notes_folder_id);
      } catch (error) {
        console.error('Failed to check Gemini Notes folder settings:', error);
        // Don't block import UI if settings check fails; import modal validates again.
        setHasNotesFolder(null);
      }
    }
    checkNotesFolder();
  }, [user?.email]);

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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  onClick={() => setImportModalOpen(true)}
                  disabled={hasNotesFolder === false}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Import from Drive
                </Button>
              </span>
            </TooltipTrigger>
            {hasNotesFolder === false && (
              <TooltipContent>
                <p>Configure your Gemini Notes Folder in Settings first</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
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
