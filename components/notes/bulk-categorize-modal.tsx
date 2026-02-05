'use client';

import { useState } from 'react';
import {
  Note,
  Client,
  Project,
  bulkUpdateNoteClassifications,
} from '@/lib/firestore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';

interface BulkCategorizeModalProps {
  notes: Note[];
  clients: Client[];
  projects: Project[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const NOTE_TYPES = [
  { value: 'client', label: 'Client Meeting' },
  { value: 'internal', label: 'Internal' },
  { value: 'external', label: 'External' },
  { value: 'personal', label: 'Personal' },
];

export function BulkCategorizeModal({
  notes,
  clients,
  projects,
  open,
  onOpenChange,
  onSuccess,
}: BulkCategorizeModalProps) {
  const { user } = useAuth();
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('client');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);

  const filteredProjects = selectedClient
    ? projects.filter((p) => p.client_id === selectedClient)
    : [];

  const handleSave = async () => {
    if (!user?.email) return;

    setSaving(true);
    setProgress(0);
    setResults(null);

    try {
      const selectedClientObj = clients.find((c) => c.id === selectedClient);
      const selectedProjectObj = projects.find((p) => p.id === selectedProject);

      const classification = {
        type: selectedType as any,
        client_id: selectedClient || null,
        client_name: selectedClientObj?.name || null,
        project_id: selectedProject || null,
        project_name: selectedProjectObj?.project_name || null,
        confidence: 1.0, // User confirmed
      };

      const noteIds = notes.map((n) => n.id);
      const result = await bulkUpdateNoteClassifications(
        noteIds,
        classification,
        user.email
      );

      // Simulate progress (since bulk update doesn't provide real-time progress)
      for (let i = 0; i <= 100; i += 20) {
        setProgress(i);
        await new Promise((r) => setTimeout(r, 100));
      }

      setResults({
        success: result.success.length,
        failed: result.failed.length,
      });

      if (result.failed.length === 0) {
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
          setResults(null);
          setProgress(0);
        }, 1500);
      }
    } catch (error) {
      console.error('Bulk categorize failed:', error);
      setResults({ success: 0, failed: notes.length });
    } finally {
      setSaving(false);
    }
  };

  const handleClientChange = (value: string) => {
    setSelectedClient(value);
    setSelectedProject('');
  };

  const handleClose = () => {
    if (!saving) {
      onOpenChange(false);
      setResults(null);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Bulk Categorize Notes</DialogTitle>
          <DialogDescription>
            Apply the same classification to {notes.length} selected notes.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="py-6 space-y-4">
            <div className="flex flex-col items-center justify-center">
              {results.failed === 0 ? (
                <>
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
                  <p className="text-lg font-medium">Successfully categorized!</p>
                  <p className="text-sm text-muted-foreground">
                    {results.success} notes have been updated.
                  </p>
                </>
              ) : results.success > 0 ? (
                <>
                  <AlertCircle className="h-12 w-12 text-yellow-500 mb-3" />
                  <p className="text-lg font-medium">Partially completed</p>
                  <p className="text-sm text-muted-foreground">
                    {results.success} succeeded, {results.failed} failed.
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="h-12 w-12 text-red-500 mb-3" />
                  <p className="text-lg font-medium">Operation failed</p>
                  <p className="text-sm text-muted-foreground">
                    Could not update the selected notes.
                  </p>
                </>
              )}
            </div>
            {results.failed > 0 && (
              <Button variant="outline" className="w-full" onClick={handleClose}>
                Close
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              {/* Classification Type */}
              <div className="space-y-2">
                <Label htmlFor="type">Classification Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Client Selection */}
              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <Select value={selectedClient} onValueChange={handleClientChange}>
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No client</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Project Selection */}
              <div className="space-y-2">
                <Label htmlFor="project">Project</Label>
                <Select
                  value={selectedProject}
                  onValueChange={setSelectedProject}
                  disabled={!selectedClient}
                >
                  <SelectTrigger id="project">
                    <SelectValue
                      placeholder={
                        selectedClient ? 'Select a project' : 'Select a client first'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No project</SelectItem>
                    {filteredProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.project_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes preview */}
              <div className="p-3 rounded-md bg-muted/50 border">
                <p className="text-sm text-muted-foreground">
                  This will update {notes.length} note(s):
                </p>
                <ul className="mt-2 text-sm max-h-24 overflow-y-auto space-y-1">
                  {notes.slice(0, 5).map((note) => (
                    <li key={note.id} className="truncate">
                      &bull; {note.meeting?.title || note.title || 'Untitled'}
                    </li>
                  ))}
                  {notes.length > 5 && (
                    <li className="text-muted-foreground">
                      ...and {notes.length - 5} more
                    </li>
                  )}
                </ul>
              </div>

              {/* Progress bar */}
              {saving && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-xs text-center text-muted-foreground">
                    Processing... {progress}%
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Categorize {notes.length} Notes
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
