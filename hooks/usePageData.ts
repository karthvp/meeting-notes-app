'use client';

import { useQuery } from '@tanstack/react-query';
import { getNotes, getClients, getProjects, Note, Client, Project } from '@/lib/firestore';

interface PageDataResult {
  clients: Client[];
  projects: Project[];
  notes: Note[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  refetchClients: () => void;
  refetchProjects: () => void;
  refetchNotes: () => void;
}

/**
 * Shared hook for fetching common page data (clients, projects, notes)
 * Reduces code duplication across dashboard pages
 */
export function usePageData(): PageDataResult {
  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
  });

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects(),
  });

  const notesQuery = useQuery({
    queryKey: ['notes'],
    queryFn: () => getNotes(),
  });

  const isLoading =
    clientsQuery.isLoading || projectsQuery.isLoading || notesQuery.isLoading;

  const isError =
    clientsQuery.isError || projectsQuery.isError || notesQuery.isError;

  const refetch = () => {
    clientsQuery.refetch();
    projectsQuery.refetch();
    notesQuery.refetch();
  };

  return {
    clients: clientsQuery.data ?? [],
    projects: projectsQuery.data ?? [],
    notes: notesQuery.data ?? [],
    isLoading,
    isError,
    refetch,
    refetchClients: () => clientsQuery.refetch(),
    refetchProjects: () => projectsQuery.refetch(),
    refetchNotes: () => notesQuery.refetch(),
  };
}

interface ClientPageDataResult {
  clients: Client[];
  projects: Project[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Hook for pages that only need clients and projects (no notes)
 */
export function useClientProjectData(): ClientPageDataResult {
  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
  });

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects(),
  });

  const isLoading = clientsQuery.isLoading || projectsQuery.isLoading;
  const isError = clientsQuery.isError || projectsQuery.isError;

  const refetch = () => {
    clientsQuery.refetch();
    projectsQuery.refetch();
  };

  return {
    clients: clientsQuery.data ?? [],
    projects: projectsQuery.data ?? [],
    isLoading,
    isError,
    refetch,
  };
}
