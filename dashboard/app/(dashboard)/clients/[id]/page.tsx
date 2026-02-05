'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getClient,
  getProjects,
  getNotes,
  getClients,
  Note,
} from '@/lib/firestore';
import { NotesTable } from '@/components/notes/notes-table';
import { CategorizeModal } from '@/components/notes/categorize-modal';
import { ShareModal } from '@/components/notes/share-modal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Users,
  FolderKanban,
  FileText,
  ChevronRight,
  Building,
  Mail,
  Loader2,
  Pencil,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ClientFormModal } from '@/components/clients/client-form-modal';
import { useQueryClient } from '@tanstack/react-query';

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const clientId = params.id as string;

  const [categorizeNote, setCategorizeNote] = useState<Note | null>(null);
  const [shareNote, setShareNote] = useState<Note | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const { data: client, isLoading: loadingClient } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => getClient(clientId),
    enabled: !!clientId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => getClients(),
  });

  const { data: allProjects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects(),
  });

  const { data: allNotes = [], isLoading: loadingNotes, refetch: refetchNotes } = useQuery({
    queryKey: ['notes'],
    queryFn: () => getNotes(),
  });

  const isLoading = loadingClient || loadingProjects || loadingNotes;

  const clientProjects = allProjects.filter((p) => p.client_id === clientId);
  const clientNotes = allNotes.filter((n) => n.clientId === clientId || n.classification?.client_id === clientId);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="flex h-32 items-center justify-center">
            <p className="text-muted-foreground">Client not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/clients" className="hover:text-foreground">
          Clients
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{client.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-primary/10 p-3">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
            {client.status && (
              <p className="text-muted-foreground capitalize">{client.status}</p>
            )}
          </div>
        </div>
        <Button variant="outline" onClick={() => setEditModalOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit Client
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientProjects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientNotes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Primary Contact</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm truncate">
              {client.account_manager || 'Not set'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="projects" className="space-y-4">
        <TabsList>
          <TabsTrigger value="projects">
            Projects ({clientProjects.length})
          </TabsTrigger>
          <TabsTrigger value="notes">Notes ({clientNotes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-4">
          {clientProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderKanban className="h-8 w-8 text-muted-foreground mb-4" />
                <CardDescription>No projects for this client yet.</CardDescription>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {clientProjects.map((project) => {
                const projectNotes = allNotes.filter(
                  (n) => n.projectId === project.id
                );
                return (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <Card className="cursor-pointer transition-colors hover:bg-accent">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <FolderKanban className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg">{project.project_name}</CardTitle>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                        {project.status && (
                          <Badge variant="secondary">{project.status}</Badge>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4" />
                          <span>{projectNotes.length} notes</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes">
          {clientNotes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-8 w-8 text-muted-foreground mb-4" />
                <CardDescription>No notes for this client yet.</CardDescription>
              </CardContent>
            </Card>
          ) : (
            <NotesTable
              notes={clientNotes}
              clients={clients}
              projects={allProjects}
              onCategorize={setCategorizeNote}
              onShare={setShareNote}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <CategorizeModal
        note={categorizeNote}
        clients={clients}
        projects={allProjects}
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

      <ClientFormModal
        client={client}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['client', clientId] });
          queryClient.invalidateQueries({ queryKey: ['clients'] });
        }}
      />
    </div>
  );
}
