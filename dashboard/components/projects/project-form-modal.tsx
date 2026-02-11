'use client';

import { useState, useEffect } from 'react';
import {
  Client,
  Project,
  TeamMember,
  createProject,
  updateProject,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Plus, X, User } from 'lucide-react';

interface ProjectFormModalProps {
  project: Project | null;
  clients: Client[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const TEAM_ROLES = [
  { value: 'Engineering', label: 'Engineering' },
  { value: 'PM', label: 'PM' },
  { value: 'Design', label: 'Design' },
  { value: 'Sales', label: 'Sales' },
  { value: 'Leadership', label: 'Leadership' },
];

export function ProjectFormModal({
  project,
  clients,
  open,
  onOpenChange,
  onSuccess,
}: ProjectFormModalProps) {
  const isEditing = !!project;

  // Form state
  const [projectName, setProjectName] = useState('');
  const [clientId, setClientId] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [driveFolderId, setDriveFolderId] = useState('');
  const [status, setStatus] = useState<'active' | 'completed' | 'on_hold'>('active');

  // New team member form
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('Engineering');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract folder ID from URL if pasted
  const extractFolderIdFromInput = (input: string): string => {
    // Check if it's a Drive URL
    const urlMatch = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }
    // Otherwise assume it's a folder ID
    return input.trim();
  };

  // Initialize form when project changes
  useEffect(() => {
    if (project && open) {
      setProjectName(project.project_name || '');
      setClientId(project.client_id || '');
      setKeywords(project.keywords || []);
      setTeam(project.team || []);
      setDriveFolderId(project.drive_folder_id || '');
      setStatus(project.status || 'active');
    } else if (!project && open) {
      // Reset form for new project
      setProjectName('');
      setClientId('');
      setKeywords([]);
      setTeam([]);
      setDriveFolderId('');
      setStatus('active');
    }
    setError(null);
    setNewKeyword('');
    setNewMemberEmail('');
    setNewMemberName('');
    setNewMemberRole('Engineering');
  }, [project, open]);

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    const keyword = newKeyword.trim().toLowerCase();
    if (keywords.includes(keyword)) {
      setError('This keyword is already added');
      return;
    }
    setKeywords([...keywords, keyword]);
    setNewKeyword('');
    setError(null);
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  const handleAddTeamMember = () => {
    if (!newMemberEmail.trim()) {
      setError('Email is required');
      return;
    }
    if (!newMemberEmail.endsWith('@egen.ai')) {
      setError('Only @egen.ai email addresses are allowed');
      return;
    }
    if (!newMemberName.trim()) {
      setError('Name is required');
      return;
    }
    if (team.some((m) => m.email === newMemberEmail.trim().toLowerCase())) {
      setError('This team member is already added');
      return;
    }

    const newMember: TeamMember = {
      email: newMemberEmail.trim().toLowerCase(),
      name: newMemberName.trim(),
      role: newMemberRole,
    };

    setTeam([...team, newMember]);
    setNewMemberEmail('');
    setNewMemberName('');
    setNewMemberRole('Engineering');
    setError(null);
  };

  const handleRemoveTeamMember = (email: string) => {
    setTeam(team.filter((m) => m.email !== email));
  };

  const handleSave = async () => {
    if (!projectName.trim()) {
      setError('Project name is required');
      return;
    }
    if (!clientId) {
      setError('Please select a client');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const selectedClient = clients.find((c) => c.id === clientId);
      // Build projectData without undefined values (Firestore doesn't accept undefined)
      const projectData: Record<string, any> = {
        project_name: projectName.trim(),
        client_id: clientId,
        client_name: selectedClient?.name,
        status,
      };
      // Only add optional fields if they have values
      if (keywords.length > 0) projectData.keywords = keywords;
      if (team.length > 0) projectData.team = team;
      if (driveFolderId.trim()) projectData.drive_folder_id = driveFolderId.trim();

      if (isEditing && project) {
        await updateProject(project.id, projectData);
      } else {
        await createProject(projectData as Omit<Project, 'id'>);
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to save project:', err);
      setError('Failed to save project. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Project' : 'Add New Project'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the project information below.'
              : 'Create a new project to organize meeting notes.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="projectName">Project Name *</Label>
            <Input
              id="projectName"
              placeholder="e.g., Data Platform Migration"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientId">Client *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger id="clientId">
                <SelectValue placeholder="Select a client..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Keywords</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., data-migration"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddKeyword();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={handleAddKeyword}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {keywords.map((keyword) => (
                  <Badge
                    key={keyword}
                    variant="outline"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => handleRemoveKeyword(keyword)}
                  >
                    {keyword}
                    <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Keywords help identify project-related meetings
            </p>
          </div>

          <div className="space-y-2">
            <Label>Team Members</Label>
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="email@egen.ai"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                />
                <Input
                  placeholder="Name"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                />
                <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={handleAddTeamMember}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Team Member
              </Button>
            </div>
            {team.length > 0 && (
              <div className="grid gap-2 mt-3">
                {team.map((member) => (
                  <Card key={member.email} className="bg-background">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-full bg-primary/10 p-2">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{member.role}</Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveTeamMember(member.email)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="driveFolderId">Google Drive Folder ID or URL</Label>
            <Input
              id="driveFolderId"
              placeholder="Paste folder URL or ID (e.g., 1abc...xyz)"
              value={driveFolderId}
              onChange={(e) => setDriveFolderId(extractFolderIdFromInput(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Paste the Google Drive folder URL or ID where project notes should be moved
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={status}
              onValueChange={(v: 'active' | 'completed' | 'on_hold') => setStatus(v)}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive p-2 rounded bg-destructive/10">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Add Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
