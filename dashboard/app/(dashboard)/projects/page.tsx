'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getClients, getNotes, getProjects, Project } from '@/lib/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FolderKanban, FileText, ChevronRight, Users, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { ProjectFormModal } from '@/components/projects/project-form-modal';

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

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

  const getProjectStats = (projectId: string) => {
    const projectNotes = notes.filter((n) => n.projectId === projectId || n.classification?.project_id === projectId);
    return {
      noteCount: projectNotes.length,
    };
  };

  const getClientName = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    return client?.name || 'Unknown';
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Group projects by client
  const projectsByClient = projects.reduce(
    (acc, project) => {
      const clientId = project.client_id;
      if (!acc[clientId]) {
        acc[clientId] = [];
      }
      acc[clientId].push(project);
      return acc;
    },
    {} as Record<string, typeof projects>
  );

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    setEditingProject(null);
  };

  const openAddModal = () => {
    setEditingProject(null);
    setFormModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Browse all projects grouped by client.
          </p>
        </div>
        <Button onClick={openAddModal}>
          <Plus className="mr-2 h-4 w-4" />
          Add Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-3 mb-4">
              <FolderKanban className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="mb-2">No projects yet</CardTitle>
            <CardDescription>
              Projects will appear here once they are added.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(projectsByClient).map(([clientId, clientProjects]) => (
            <div key={clientId} className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <Link
                  href={`/clients/${clientId}`}
                  className="text-lg font-semibold hover:underline"
                >
                  {getClientName(clientId)}
                </Link>
                <Badge variant="secondary">{clientProjects.length} projects</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {clientProjects.map((project) => {
                  const stats = getProjectStats(project.id);
                  return (
                    <Link key={project.id} href={`/projects/${project.id}`}>
                      <Card className="cursor-pointer transition-colors hover:bg-accent">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <FolderKanban className="h-5 w-5 text-primary" />
                              <CardTitle className="text-lg">{project.project_name}</CardTitle>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                          {project.status && (
                            <Badge variant="secondary" className="w-fit">
                              {project.status}
                            </Badge>
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <FileText className="h-4 w-4" />
                            <span>{stats.noteCount} notes</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <ProjectFormModal
        project={editingProject}
        clients={clients}
        open={formModalOpen}
        onOpenChange={(open) => {
          setFormModalOpen(open);
          if (!open) setEditingProject(null);
        }}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
