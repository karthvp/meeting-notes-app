'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getNotes,
  getClients,
  getProjects,
  getDashboardStats,
  getUncategorizedNotes,
  getNoteTitle,
  getNoteClientName,
  getNoteProjectName,
  timestampToDate,
  Note,
  Client,
  Project,
} from '@/lib/firestore';
import { NotesTable } from '@/components/notes/notes-table';
import { CategorizeModal } from '@/components/notes/categorize-modal';
import { ShareModal } from '@/components/notes/share-modal';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Users,
  FolderKanban,
  AlertCircle,
  Loader2,
  Share2,
  TrendingUp,
  Calendar,
  Bot,
} from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const [categorizeNote, setCategorizeNote] = useState<Note | null>(null);
  const [shareNote, setShareNote] = useState<Note | null>(null);

  const {
    data: notes = [],
    isLoading: loadingNotes,
    refetch: refetchNotes,
  } = useQuery({
    queryKey: ['notes'],
    queryFn: () => getNotes({ limit: 50 }),
  });

  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => getClients(),
  });

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects(),
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => getDashboardStats(),
    staleTime: 60000, // Cache for 1 minute
  });

  const { data: uncategorizedNotes = [] } = useQuery({
    queryKey: ['uncategorizedNotes'],
    queryFn: () => getUncategorizedNotes(10),
  });

  const isLoading = loadingNotes || loadingClients || loadingProjects || loadingStats;

  // Use stats if available, otherwise calculate from notes
  const uncategorizedCount =
    stats?.uncategorizedCount ?? uncategorizedNotes.length;
  const notesThisWeek = stats?.totalNotesThisWeek ?? 0;
  const recentlySharedCount = stats?.recentlySharedCount ?? 0;

  // Calculate auto-filed count from notes
  const autoFiledCount = notes.filter(
    (note) => note.classification?.auto_filed || note.classification?.auto_classified
  ).length;

  // Get recent notes sorted by meeting time or created time
  const recentNotes = [...notes]
    .sort((a, b) => {
      const aDate =
        a.meeting?.start_time?.toDate?.() ||
        a.created_at?.toDate?.() ||
        a.createdAt?.toDate?.() ||
        new Date(0);
      const bDate =
        b.meeting?.start_time?.toDate?.() ||
        b.created_at?.toDate?.() ||
        b.createdAt?.toDate?.() ||
        new Date(0);
      return bDate.getTime() - aDate.getTime();
    })
    .slice(0, 5);

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
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your meeting notes and projects.
        </p>
      </div>

      {/* Stats Cards - Top Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notesThisWeek}</div>
            <p className="text-xs text-muted-foreground">
              Notes created this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.length}</div>
            <p className="text-xs text-muted-foreground">Active clients</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto-Filed</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{autoFiledCount}</div>
            <p className="text-xs text-muted-foreground">
              Notes filed by AI
            </p>
          </CardContent>
        </Card>

        <Link href="/uncategorized">
          <Card className="cursor-pointer transition-colors hover:bg-accent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Uncategorized</CardTitle>
              <AlertCircle
                className={`h-4 w-4 ${
                  uncategorizedCount > 0 ? 'text-orange-500' : 'text-green-500'
                }`}
              />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uncategorizedCount}</div>
              <p className="text-xs text-muted-foreground">
                {uncategorizedCount > 0
                  ? 'Notes need categorization'
                  : 'All notes categorized'}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Notes by Client - Only show if there are client notes */}
      {stats?.notesByClient && stats.notesByClient.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Notes by Client
            </CardTitle>
            <CardDescription>
              Top clients by meeting note count
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.notesByClient.map((item) => (
                <div
                  key={item.clientId}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <Link
                        href={`/clients/${item.clientId}`}
                        className="font-medium hover:underline"
                      >
                        {item.clientName}
                      </Link>
                    </div>
                  </div>
                  <Badge variant="secondary">{item.count} notes</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Notes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notes.length}</div>
            <p className="text-xs text-muted-foreground">
              All meeting notes tracked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects.length}</div>
            <p className="text-xs text-muted-foreground">Active projects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Classification Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {notes.length > 0
                ? `${Math.round(((notes.length - uncategorizedCount) / notes.length) * 100)}%`
                : '100%'}
            </div>
            <p className="text-xs text-muted-foreground">Notes categorized</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Notes</CardTitle>
          <CardDescription>
            Your most recent meeting notes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentNotes.length > 0 ? (
            <NotesTable
              notes={recentNotes}
              clients={clients}
              projects={projects}
              onCategorize={setCategorizeNote}
              onShare={setShareNote}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No notes yet</h3>
              <p className="text-sm text-muted-foreground">
                Meeting notes will appear here once created.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
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
