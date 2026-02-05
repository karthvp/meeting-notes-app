'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getNotes, getClients, getProjects, Note } from '@/lib/firestore';
import { NotesTable } from '@/components/notes/notes-table';
import { CategorizeModal } from '@/components/notes/categorize-modal';
import { ShareModal } from '@/components/notes/share-modal';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Search, Loader2 } from 'lucide-react';
import { useState, useMemo } from 'react';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [categorizeNote, setCategorizeNote] = useState<Note | null>(null);
  const [shareNote, setShareNote] = useState<Note | null>(null);

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

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();

    return notes.filter((note) => {
      // Search in title
      if (note.title?.toLowerCase().includes(lowerQuery)) return true;

      // Search in content
      if (note.content?.toLowerCase().includes(lowerQuery)) return true;

      // Search in note type
      if (note.noteType?.toLowerCase().includes(lowerQuery)) return true;

      // Search in client name
      const client = clients.find((c) => c.id === note.clientId || c.id === note.classification?.client_id);
      if (client?.name.toLowerCase().includes(lowerQuery)) return true;

      // Search in project name
      const project = projects.find((p) => p.id === note.projectId || p.id === note.classification?.project_id);
      if (project?.project_name.toLowerCase().includes(lowerQuery)) return true;

      return false;
    });
  }, [query, notes, clients, projects]);

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
        <h1 className="text-3xl font-bold tracking-tight">Search Results</h1>
        <p className="text-muted-foreground">
          {query ? (
            <>
              Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &quot;{query}&quot;
            </>
          ) : (
            'Enter a search term to find notes'
          )}
        </p>
      </div>

      {!query ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-3 mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="mb-2">Search for notes</CardTitle>
            <CardDescription>
              Use the search bar to find notes by title, content, client, or project.
            </CardDescription>
          </CardContent>
        </Card>
      ) : searchResults.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-3 mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="mb-2">No results found</CardTitle>
            <CardDescription>
              Try searching with different keywords.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <NotesTable
          notes={searchResults}
          clients={clients}
          projects={projects}
          onCategorize={setCategorizeNote}
          onShare={setShareNote}
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
    </div>
  );
}
