'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Note,
  Client,
  Project,
  updateNoteClassification,
  getNoteTitle,
} from '@/lib/firestore';
import {
  classifyNote,
  submitFeedback,
  ClassifyResponse,
  getConfidenceLabel,
  getConfidenceColor,
  formatConfidence,
} from '@/lib/api';
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
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, AlertCircle, CheckCircle2, Brain, Cpu } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';

interface CategorizeModalProps {
  note: Note | null;
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

export function CategorizeModal({
  note,
  clients,
  projects,
  open,
  onOpenChange,
  onSuccess,
}: CategorizeModalProps) {
  const { user } = useAuth();
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('client');
  const [saving, setSaving] = useState(false);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);

  // AI suggestion state
  const [aiSuggestion, setAiSuggestion] = useState<ClassifyResponse | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [usedSuggestion, setUsedSuggestion] = useState(false);

  // Fetch AI suggestion when modal opens
  const fetchSuggestion = useCallback(async () => {
    if (!note) return;

    setLoadingSuggestion(true);
    setSuggestionError(null);

    try {
      const meetingData = {
        title: getNoteTitle(note),
        description: note.meeting?.description,
        organizer: note.meeting?.organizer,
        attendees: note.meeting?.attendees,
        start_time: note.meeting?.start_time?.toDate?.()?.toISOString(),
        end_time: note.meeting?.end_time?.toDate?.()?.toISOString(),
      };

      const result = await classifyNote(meetingData, note.drive_file_id);
      setAiSuggestion(result);
    } catch (error) {
      console.error('Failed to get AI suggestion:', error);
      setSuggestionError('Could not load AI suggestions');
    } finally {
      setLoadingSuggestion(false);
    }
  }, [note]);

  // Initialize values when note changes
  useEffect(() => {
    if (note && open) {
      // Set existing values or defaults
      const existingClientId =
        note.classification?.client_id || note.clientId || '';
      const existingProjectId =
        note.classification?.project_id || note.projectId || '';
      const existingType =
        note.classification?.type || note.noteType || 'client';

      setSelectedClient(existingClientId);
      setSelectedProject(existingProjectId);
      setSelectedType(existingType);
      setUsedSuggestion(false);

      // Fetch AI suggestion
      fetchSuggestion();
    }
  }, [note, open, fetchSuggestion]);

  // Filter projects when client changes
  useEffect(() => {
    if (selectedClient) {
      setFilteredProjects(
        projects.filter((p) => p.client_id === selectedClient)
      );
    } else {
      setFilteredProjects([]);
    }
  }, [selectedClient, projects]);

  // Apply AI suggestion
  const applySuggestion = () => {
    if (!aiSuggestion) return;

    if (aiSuggestion.classification.client?.id) {
      setSelectedClient(aiSuggestion.classification.client.id);
    }
    if (aiSuggestion.classification.project?.id) {
      setSelectedProject(aiSuggestion.classification.project.id);
    }
    if (aiSuggestion.classification.type) {
      setSelectedType(aiSuggestion.classification.type);
    }
    setUsedSuggestion(true);
  };

  const handleSave = async () => {
    if (!note || !user?.email) return;

    setSaving(true);
    try {
      // Get client and project names for the update
      const selectedClientObj = clients.find((c) => c.id === selectedClient);
      const selectedProjectObj = projects.find((p) => p.id === selectedProject);

      await updateNoteClassification(
        note.id,
        {
          type: selectedType as any,
          client_id: selectedClient || null,
          client_name: selectedClientObj?.name || null,
          project_id: selectedProject || null,
          project_name: selectedProjectObj?.project_name || null,
          confidence: usedSuggestion
            ? aiSuggestion?.classification.confidence || 0.8
            : 1.0,
        },
        user.email
      );

      // Record feedback if AI suggestion was modified
      if (aiSuggestion && !usedSuggestion) {
        const originalClassification = note.classification || {
          type: 'uncategorized' as const,
          confidence: 0,
        };

        // Only record feedback if classification changed
        const suggestionClientId = aiSuggestion.classification.client?.id;
        const suggestionProjectId = aiSuggestion.classification.project?.id;

        if (
          suggestionClientId !== selectedClient ||
          suggestionProjectId !== selectedProject
        ) {
          try {
            await submitFeedback({
              noteId: note.id,
              originalClassification: {
                type: aiSuggestion.classification.type,
                clientId: suggestionClientId,
                clientName: aiSuggestion.classification.client?.name,
                projectId: suggestionProjectId,
                projectName: aiSuggestion.classification.project?.name,
                confidence: aiSuggestion.classification.confidence,
                ruleId: aiSuggestion.classification.matched_rule_id,
              },
              correctedClassification: {
                type: selectedType,
                clientId: selectedClient || null,
                clientName: selectedClientObj?.name || null,
                projectId: selectedProject || null,
                projectName: selectedProjectObj?.project_name || null,
              },
              meeting: {
                title: getNoteTitle(note),
                attendees: note.meeting?.attendees?.map((a) => a.email),
              },
              userEmail: user.email,
            });
          } catch (feedbackError) {
            console.error('Failed to record feedback:', feedbackError);
            // Don't block the save operation
          }
        }
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update note:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleClientChange = (value: string) => {
    setSelectedClient(value);
    setSelectedProject(''); // Reset project when client changes
    setUsedSuggestion(false);
  };

  const noteTitle = note ? getNoteTitle(note) : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Categorize Note</DialogTitle>
          <DialogDescription>
            Assign this note to a client, project, and type.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Note Title */}
          <div className="space-y-2">
            <Label>Note Title</Label>
            <p className="text-sm text-muted-foreground truncate">{noteTitle}</p>
          </div>

          {/* AI Suggestion Banner */}
          {loadingSuggestion && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm">Loading AI suggestions...</span>
            </div>
          )}

          {suggestionError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{suggestionError}</span>
            </div>
          )}

          {aiSuggestion && !loadingSuggestion && (
            <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {aiSuggestion.classification_method === 'gemini_ai' ? (
                    <Brain className="h-4 w-4 text-primary" />
                  ) : (
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">
                    {aiSuggestion.classification_method === 'gemini_ai'
                      ? 'AI Suggestion'
                      : 'Rule-Based Suggestion'}
                  </span>
                  {aiSuggestion.classification_method === 'gemini_ai' && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      Gemini
                    </Badge>
                  )}
                </div>
                <Badge
                  className={getConfidenceColor(
                    aiSuggestion.classification.confidence
                  )}
                >
                  {formatConfidence(aiSuggestion.classification.confidence)}{' '}
                  {getConfidenceLabel(aiSuggestion.classification.confidence)}
                </Badge>
              </div>

              <div className="text-sm space-y-1">
                {aiSuggestion.classification.client && (
                  <p>
                    <span className="text-muted-foreground">Client:</span>{' '}
                    <span className="font-medium">
                      {aiSuggestion.classification.client.name}
                    </span>
                  </p>
                )}
                {aiSuggestion.classification.project && (
                  <p>
                    <span className="text-muted-foreground">Project:</span>{' '}
                    <span className="font-medium">
                      {aiSuggestion.classification.project.name}
                    </span>
                  </p>
                )}
                {aiSuggestion.classification.internal_team && (
                  <p>
                    <span className="text-muted-foreground">Team:</span>{' '}
                    <span className="font-medium">
                      {aiSuggestion.classification.internal_team}
                    </span>
                  </p>
                )}
                <p>
                  <span className="text-muted-foreground">Type:</span>{' '}
                  <span className="font-medium capitalize">
                    {aiSuggestion.classification.type}
                  </span>
                </p>
              </div>

              {/* AI Reasoning Section */}
              {aiSuggestion.classification.ai_reasoning && (
                <div className="mt-2 p-2 rounded bg-muted/50 border-l-2 border-primary/30">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">
                    AI Reasoning
                  </p>
                  <p className="text-sm text-foreground/80">
                    {aiSuggestion.classification.ai_reasoning}
                  </p>
                </div>
              )}

              {!usedSuggestion ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={applySuggestion}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Apply Suggestion
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Suggestion applied
                </div>
              )}
            </div>
          )}

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
              onValueChange={(value) => {
                setSelectedProject(value);
                setUsedSuggestion(false);
              }}
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

          {/* Suggested Tags (if available) */}
          {aiSuggestion?.suggested_actions.tags &&
            aiSuggestion.suggested_actions.tags.length > 0 && (
              <div className="space-y-2">
                <Label>Suggested Tags</Label>
                <div className="flex flex-wrap gap-1">
                  {aiSuggestion.suggested_actions.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
