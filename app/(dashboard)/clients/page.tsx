'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getClients, getNotes, getProjects, Client } from '@/lib/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, FolderKanban, FileText, ChevronRight, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { ClientFormModal } from '@/components/clients/client-form-modal';

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => getClients(),
  });

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects(),
  });

  const { data: notes = [], isLoading: loadingNotes } = useQuery({
    queryKey: ['notes'],
    queryFn: () => getNotes(),
  });

  const isLoading = loadingClients || loadingProjects || loadingNotes;

  const getClientStats = (clientId: string) => {
    const clientProjects = projects.filter((p) => p.client_id === clientId);
    const clientNotes = notes.filter((n) => n.clientId === clientId || n.classification?.client_id === clientId);
    return {
      projectCount: clientProjects.length,
      noteCount: clientNotes.length,
    };
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    setEditingClient(null);
  };

  const openAddModal = () => {
    setEditingClient(null);
    setFormModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            Manage your clients and view their associated projects and notes.
          </p>
        </div>
        <Button onClick={openAddModal}>
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </Button>
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-3 mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="mb-2">No clients yet</CardTitle>
            <CardDescription>
              Clients will appear here once they are added.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => {
            const stats = getClientStats(client.id);
            return (
              <Link key={client.id} href={`/clients/${client.id}`}>
                <Card className="cursor-pointer transition-colors hover:bg-accent">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="rounded-full bg-primary/10 p-2">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{client.name}</CardTitle>
                          {client.status && (
                            <CardDescription className="capitalize">{client.status}</CardDescription>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <FolderKanban className="h-4 w-4" />
                        <span>{stats.projectCount} projects</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        <span>{stats.noteCount} notes</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <ClientFormModal
        client={editingClient}
        open={formModalOpen}
        onOpenChange={(open) => {
          setFormModalOpen(open);
          if (!open) setEditingClient(null);
        }}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
