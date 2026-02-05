'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Note, Client, Project } from '@/lib/firestore';
import { NotesFilters, FilterState, defaultFilters } from './notes-filters';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Edit,
  Share2,
  Eye,
  ArrowUpDown,
  Bot,
  Tag,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotesTableProps {
  notes: Note[];
  clients: Client[];
  projects: Project[];
  onCategorize: (note: Note) => void;
  onShare: (note: Note) => void;
  onBulkCategorize?: (notes: Note[]) => void;
  onBulkShare?: (notes: Note[]) => void;
  onBulkAddTags?: (notes: Note[]) => void;
  onExport?: (notes: Note[]) => void;
}

type SortField = 'title' | 'createdAt' | 'confidence' | 'noteType';
type SortDirection = 'asc' | 'desc';

export function NotesTable({
  notes,
  clients,
  projects,
  onCategorize,
  onShare,
  onBulkCategorize,
  onBulkShare,
  onBulkAddTags,
  onExport,
}: NotesTableProps) {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Clear selection when notes change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [notes]);

  const getClientName = (note: Note) => {
    const clientId = note.classification?.client_id || note.clientId;
    const clientName = note.classification?.client_name;
    if (clientName) return clientName;
    if (!clientId) return 'Uncategorized';
    const client = clients.find((c) => c.id === clientId);
    return client?.name || 'Unknown';
  };

  const getProjectName = (note: Note) => {
    const projectId = note.classification?.project_id || note.projectId;
    const projectName = note.classification?.project_name;
    if (projectName) return projectName;
    if (!projectId) return '-';
    const project = projects.find((p) => p.id === projectId);
    return project?.project_name || 'Unknown';
  };

  const getNoteTitle = (note: Note) => {
    return note.meeting?.title || note.title || 'Untitled Note';
  };

  const getNoteType = (note: Note) => {
    return note.classification?.type || note.noteType || 'uncategorized';
  };

  const getNoteConfidence = (note: Note) => {
    return note.classification?.confidence ?? note.confidence;
  };

  const isAutoFiled = (note: Note) => {
    return note.classification?.auto_filed || note.classification?.auto_classified;
  };

  const getConfidenceBadge = (confidence?: number) => {
    if (confidence === undefined || confidence === null) {
      return <Badge variant="outline">N/A</Badge>;
    }
    if (confidence >= 0.8) {
      return <Badge className="bg-green-500 hover:bg-green-600">High ({Math.round(confidence * 100)}%)</Badge>;
    }
    if (confidence >= 0.5) {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Medium ({Math.round(confidence * 100)}%)</Badge>;
    }
    return <Badge className="bg-red-500 hover:bg-red-600">Low ({Math.round(confidence * 100)}%)</Badge>;
  };

  const getTypeBadge = (noteType?: string) => {
    const typeColors: Record<string, string> = {
      client: 'bg-blue-500',
      internal: 'bg-gray-500',
      external: 'bg-purple-500',
      personal: 'bg-green-500',
      uncategorized: 'bg-orange-500',
      meeting: 'bg-blue-500',
      kickoff: 'bg-purple-500',
      status: 'bg-green-500',
      planning: 'bg-orange-500',
      review: 'bg-pink-500',
    };
    const color = typeColors[noteType?.toLowerCase() || ''] || 'bg-gray-400';
    const labels: Record<string, string> = {
      client: 'Client',
      internal: 'Internal',
      external: 'External',
      personal: 'Personal',
      uncategorized: 'Uncategorized',
    };
    const label = labels[noteType?.toLowerCase() || ''] || noteType || 'Unknown';
    return (
      <Badge className={cn(color, 'hover:opacity-80')}>
        {label}
      </Badge>
    );
  };

  const formatDate = (timestamp?: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filter and sort notes
  const filteredNotes = notes
    .filter((note) => {
      const noteType = getNoteType(note);
      const clientId = note.classification?.client_id || note.clientId;
      const title = getNoteTitle(note);

      // Type filter
      if (filters.filterType !== 'all' && noteType !== filters.filterType) return false;

      // Client filter
      if (filters.filterClient !== 'all' && clientId !== filters.filterClient) return false;

      // Search filter (title, summary, content)
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const summary = note.summary || note.enhanced_analysis?.summary || '';
        const content = note.content || '';
        const matchesSearch =
          title.toLowerCase().includes(searchLower) ||
          summary.toLowerCase().includes(searchLower) ||
          content.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Attendee filter
      if (filters.attendeeEmail) {
        const attendees = note.meeting?.attendees || [];
        const hasAttendee = attendees.some(
          (a) => a.email?.toLowerCase() === filters.attendeeEmail.toLowerCase()
        );
        if (!hasAttendee) return false;
      }

      // Date range filter
      if (filters.dateRange.from || filters.dateRange.to) {
        const noteDate = note.meeting?.start_time?.toDate?.() ||
          note.created_at?.toDate?.() ||
          (note.createdAt as any)?.toDate?.();

        if (!noteDate) return false;

        if (filters.dateRange.from && noteDate < filters.dateRange.from) return false;
        if (filters.dateRange.to) {
          // Set to end of day for inclusive range
          const endDate = new Date(filters.dateRange.to);
          endDate.setHours(23, 59, 59, 999);
          if (noteDate > endDate) return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      let aValue: any, bValue: any;
      switch (sortField) {
        case 'title':
          aValue = getNoteTitle(a);
          bValue = getNoteTitle(b);
          break;
        case 'createdAt':
          aValue = a.meeting?.start_time?.toDate?.() || a.created_at?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
          bValue = b.meeting?.start_time?.toDate?.() || b.created_at?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
          break;
        case 'confidence':
          aValue = getNoteConfidence(a) || 0;
          bValue = getNoteConfidence(b) || 0;
          break;
        case 'noteType':
          aValue = getNoteType(a);
          bValue = getNoteType(b);
          break;
        default:
          return 0;
      }
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const noteTypes = [...new Set(notes.map((n) => getNoteType(n)).filter(Boolean))];

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredNotes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNotes.map((n) => n.id)));
    }
  };

  const toggleSelectNote = (noteId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(noteId)) {
      newSelected.delete(noteId);
    } else {
      newSelected.add(noteId);
    }
    setSelectedIds(newSelected);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const getSelectedNotes = () => {
    return filteredNotes.filter((note) => selectedIds.has(note.id));
  };

  const isAllSelected = filteredNotes.length > 0 && selectedIds.size === filteredNotes.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < filteredNotes.length;

  return (
    <div className="space-y-4">
      {/* Bulk Actions Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            {onBulkCategorize && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBulkCategorize(getSelectedNotes())}
              >
                <Edit className="h-4 w-4 mr-2" />
                Categorize Selected
              </Button>
            )}
            {onBulkShare && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBulkShare(getSelectedNotes())}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share Selected
              </Button>
            )}
            {onBulkAddTags && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBulkAddTags(getSelectedNotes())}
              >
                <Tag className="h-4 w-4 mr-2" />
                Add Tags
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <NotesFilters
        notes={notes}
        clients={clients}
        filters={filters}
        onFiltersChange={setFilters}
        onExport={onExport ? () => onExport(filteredNotes) : undefined}
        noteTypes={noteTypes}
      />

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                  className={isSomeSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                />
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('title')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Title
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('createdAt')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Date
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('noteType')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Type
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('confidence')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Confidence
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredNotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  No notes found.
                </TableCell>
              </TableRow>
            ) : (
              filteredNotes.map((note) => (
                <TableRow
                  key={note.id}
                  className={cn(selectedIds.has(note.id) && 'bg-primary/5')}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(note.id)}
                      onCheckedChange={() => toggleSelectNote(note.id)}
                      aria-label={`Select ${getNoteTitle(note)}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium max-w-[300px]">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{getNoteTitle(note)}</span>
                      {isAutoFiled(note) && (
                        <Badge
                          variant="outline"
                          className="shrink-0 text-xs px-1.5 py-0 border-green-500 text-green-600"
                          title="Auto-filed by AI"
                        >
                          <Bot className="h-3 w-3 mr-1" />
                          Auto
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(note.meeting?.start_time || note.created_at || note.createdAt)}</TableCell>
                  <TableCell>{getClientName(note)}</TableCell>
                  <TableCell>{getProjectName(note)}</TableCell>
                  <TableCell>{getTypeBadge(getNoteType(note))}</TableCell>
                  <TableCell>{getConfidenceBadge(getNoteConfidence(note))}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/notes/${note.id}`)}
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onCategorize(note)}
                        title="Categorize"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onShare(note)}
                        title="Share"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredNotes.length} of {notes.length} notes
        {selectedIds.size > 0 && ` (${selectedIds.size} selected)`}
      </div>
    </div>
  );
}
