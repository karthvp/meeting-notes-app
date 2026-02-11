'use client';

import { useState, useEffect } from 'react';
import {
  ClassificationRule,
  Client,
  Project,
  createRule,
  updateRule,
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
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, X } from 'lucide-react';
import { ConditionBuilder, ConditionGroup } from './condition-builder';
import { useAuth } from '@/components/auth/auth-provider';

interface RuleFormModalProps {
  rule: ClassificationRule | null;
  clients: Client[];
  projects: Project[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CLASSIFICATION_TYPES = [
  { value: 'client', label: 'Client Meeting' },
  { value: 'internal', label: 'Internal' },
  { value: 'external', label: 'External' },
  { value: 'personal', label: 'Personal' },
];

const INTERNAL_TEAMS = [
  { value: 'Engineering', label: 'Engineering' },
  { value: 'Sales', label: 'Sales' },
  { value: 'All Hands', label: 'All Hands' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'HR', label: 'HR' },
];

export function RuleFormModal({
  rule,
  clients,
  projects,
  open,
  onOpenChange,
  onSuccess,
}: RuleFormModalProps) {
  const { user } = useAuth();
  const isEditing = !!rule;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(50);
  const [status, setStatus] = useState<'active' | 'disabled' | 'testing'>('disabled');
  const [confidenceBoost, setConfidenceBoost] = useState(0.1);
  const [conditions, setConditions] = useState<ConditionGroup>({
    operator: 'AND',
    rules: [],
  });

  // Actions state
  const [classifyAs, setClassifyAs] = useState('');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [team, setTeam] = useState('');
  const [shareWith, setShareWith] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [addTags, setAddTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [folderPath, setFolderPath] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when rule changes
  useEffect(() => {
    if (rule && open) {
      setName(rule.name || '');
      setDescription(rule.description || '');
      setPriority(rule.priority || 50);
      setStatus(rule.status || 'disabled');
      setConfidenceBoost(rule.confidence_boost || 0.1);
      setConditions(rule.conditions || { operator: 'AND', rules: [] });
      setClassifyAs(rule.actions?.classify_as || '');
      setClientId(rule.actions?.client_id || '');
      setProjectId(rule.actions?.project_id || '');
      setTeam(rule.actions?.team || '');
      setShareWith(rule.actions?.share_with || []);
      setAddTags(rule.actions?.add_tags || []);
      setFolderPath(rule.actions?.folder_path || '');
    } else if (!rule && open) {
      // Reset form for new rule
      setName('');
      setDescription('');
      setPriority(50);
      setStatus('disabled');
      setConfidenceBoost(0.1);
      setConditions({ operator: 'AND', rules: [] });
      setClassifyAs('');
      setClientId('');
      setProjectId('');
      setTeam('');
      setShareWith([]);
      setAddTags([]);
      setFolderPath('');
    }
    setError(null);
  }, [rule, open]);

  // Filter projects by client
  const filteredProjects = clientId
    ? projects.filter((p) => p.client_id === clientId)
    : [];

  const handleAddEmail = () => {
    if (!newEmail.trim()) return;
    if (!newEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (shareWith.includes(newEmail.trim().toLowerCase())) {
      setError('This email is already added');
      return;
    }
    setShareWith([...shareWith, newEmail.trim().toLowerCase()]);
    setNewEmail('');
    setError(null);
  };

  const handleRemoveEmail = (email: string) => {
    setShareWith(shareWith.filter((e) => e !== email));
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    if (addTags.includes(newTag.trim().toLowerCase())) return;
    setAddTags([...addTags, newTag.trim().toLowerCase()]);
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    setAddTags(addTags.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Rule name is required');
      return;
    }

    if (conditions.rules.length === 0) {
      setError('At least one condition is required');
      return;
    }

    // Validate conditions have values
    for (const condition of conditions.rules) {
      if (Array.isArray(condition.value)) {
        if (condition.value.length === 0) {
          setError('All conditions must have a value');
          return;
        }
      } else if (!condition.value?.trim()) {
        setError('All conditions must have a value');
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const ruleData = {
        name: name.trim(),
        description: description.trim() || undefined,
        priority,
        status,
        confidence_boost: confidenceBoost,
        conditions,
        actions: {
          classify_as: classifyAs || undefined,
          client_id: clientId || undefined,
          project_id: projectId || undefined,
          team: team || undefined,
          share_with: shareWith.length > 0 ? shareWith : undefined,
          add_tags: addTags.length > 0 ? addTags : undefined,
          folder_path: folderPath || undefined,
        },
        created_by: user?.email || undefined,
      };

      if (isEditing && rule) {
        await updateRule(rule.id, ruleData);
      } else {
        await createRule(ruleData as Omit<ClassificationRule, 'id'>);
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to save rule:', err);
      setError('Failed to save rule. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Rule' : 'Create New Rule'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modify the rule conditions and actions below.'
              : 'Define conditions that will automatically classify and organize meeting notes.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basics" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basics">Basics</TabsTrigger>
            <TabsTrigger value="conditions">Conditions</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          {/* Basics Tab */}
          <TabsContent value="basics" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Rule Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Acme Corp Meetings"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this rule does..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority (0-100)</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[priority]}
                    onValueChange={([value]) => setPriority(value)}
                    max={100}
                    step={1}
                    className="flex-1"
                  />
                  <span className="w-12 text-sm text-muted-foreground">{priority}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Higher priority rules are evaluated first
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                    <SelectItem value="testing">Testing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Confidence Boost</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[confidenceBoost * 100]}
                  onValueChange={([value]) => setConfidenceBoost(value / 100)}
                  max={50}
                  step={5}
                  className="flex-1"
                />
                <span className="w-16 text-sm text-muted-foreground">
                  +{Math.round(confidenceBoost * 100)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Bonus confidence when this rule matches
              </p>
            </div>
          </TabsContent>

          {/* Conditions Tab */}
          <TabsContent value="conditions" className="mt-4">
            <ConditionBuilder value={conditions} onChange={setConditions} />
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="classifyAs">Classification Type</Label>
                <Select value={classifyAs || 'none'} onValueChange={(v) => setClassifyAs(v === 'none' ? '' : v)}>
                  <SelectTrigger id="classifyAs">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No change</SelectItem>
                    {CLASSIFICATION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="team">Internal Team</Label>
                <Select value={team || 'none'} onValueChange={(v) => setTeam(v === 'none' ? '' : v)}>
                  <SelectTrigger id="team">
                    <SelectValue placeholder="Select team..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No team</SelectItem>
                    {INTERNAL_TEAMS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Client</Label>
                <Select
                  value={clientId || 'none'}
                  onValueChange={(v) => {
                    setClientId(v === 'none' ? '' : v);
                    setProjectId(''); // Reset project when client changes
                  }}
                >
                  <SelectTrigger id="clientId">
                    <SelectValue placeholder="Select client..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Auto-detect</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="projectId">Project</Label>
                <Select
                  value={projectId || 'none'}
                  onValueChange={(v) => setProjectId(v === 'none' ? '' : v)}
                  disabled={!clientId}
                >
                  <SelectTrigger id="projectId">
                    <SelectValue
                      placeholder={clientId ? 'Select project...' : 'Select client first'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Auto-detect</SelectItem>
                    {filteredProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.project_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Auto-Share With</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="email@egen.ai"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddEmail();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddEmail}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {shareWith.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {shareWith.map((email) => (
                    <Badge
                      key={email}
                      variant="secondary"
                      className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleRemoveEmail(email)}
                    >
                      {email}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Add Tags</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="tag name"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {addTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {addTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      {tag}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="folderPath">Folder Path</Label>
              <Input
                id="folderPath"
                placeholder="e.g., Meeting Notes/Clients/Acme"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use default folder path based on classification
              </p>
            </div>
          </TabsContent>
        </Tabs>

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
            {isEditing ? 'Save Changes' : 'Create Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
