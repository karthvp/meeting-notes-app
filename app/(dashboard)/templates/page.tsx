'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  NoteTemplate,
  TemplateSection,
} from '@/lib/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Edit,
  Trash2,
  FileText,
  Loader2,
  GripVertical,
  X,
  Copy,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULT_SECTIONS: TemplateSection[] = [
  { id: '1', title: 'Attendees', placeholder: 'List of attendees...', type: 'list', order: 1 },
  { id: '2', title: 'Agenda', placeholder: 'Meeting agenda items...', type: 'list', order: 2 },
  { id: '3', title: 'Discussion Notes', placeholder: 'Key discussion points...', type: 'text', order: 3 },
  { id: '4', title: 'Action Items', placeholder: 'Tasks and follow-ups...', type: 'checkbox-list', order: 4, required: true },
  { id: '5', title: 'Decisions', placeholder: 'Key decisions made...', type: 'list', order: 5 },
];

const CATEGORY_COLORS: Record<string, string> = {
  client: 'bg-blue-500',
  internal: 'bg-gray-500',
  external: 'bg-purple-500',
  general: 'bg-green-500',
};

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NoteTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: getTemplates,
  });

  const createMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setShowEditor(false);
      setEditingTemplate(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<NoteTemplate> }) =>
      updateTemplate(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setShowEditor(false);
      setEditingTemplate(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setDeleteConfirm(null);
    },
  });

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setShowEditor(true);
  };

  const handleEdit = (template: NoteTemplate) => {
    setEditingTemplate(template);
    setShowEditor(true);
  };

  const handleDuplicate = (template: NoteTemplate) => {
    setEditingTemplate({
      ...template,
      id: '',
      name: `${template.name} (Copy)`,
      is_default: false,
    });
    setShowEditor(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Note Templates</h1>
          <p className="text-muted-foreground">
            Create and manage templates for consistent meeting notes.
          </p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="mb-2">No templates yet</CardTitle>
            <CardDescription className="mb-4">
              Create your first template to standardize your meeting notes.
            </CardDescription>
            <Button onClick={handleCreateNew}>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="relative">
              {template.is_default && (
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    Default
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Badge className={cn(CATEGORY_COLORS[template.category], 'capitalize')}>
                    {template.category}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{template.name}</CardTitle>
                {template.description && (
                  <CardDescription>{template.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {template.sections?.length || 0} sections
                  </p>
                  {template.auto_apply_rules?.keywords && (
                    <div className="flex flex-wrap gap-1">
                      {template.auto_apply_rules.keywords.slice(0, 3).map((kw) => (
                        <Badge key={kw} variant="outline" className="text-xs">
                          {kw}
                        </Badge>
                      ))}
                      {(template.auto_apply_rules.keywords.length || 0) > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{template.auto_apply_rules.keywords.length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(template)}>
                    <Edit className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDuplicate(template)}>
                    <Copy className="mr-1 h-3 w-3" />
                    Duplicate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteConfirm(template.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Template Editor Dialog */}
      <TemplateEditor
        open={showEditor}
        onOpenChange={setShowEditor}
        template={editingTemplate}
        onSave={(data) => {
          if (editingTemplate?.id) {
            updateMutation.mutate({ id: editingTemplate.id, updates: data });
          } else {
            createMutation.mutate(data as Omit<NoteTemplate, 'id'>);
          }
        }}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Template Editor Component
interface TemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: NoteTemplate | null;
  onSave: (data: Partial<NoteTemplate>) => void;
  isSaving: boolean;
}

function TemplateEditor({ open, onOpenChange, template, onSave, isSaving }: TemplateEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<NoteTemplate['category']>('general');
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [keywords, setKeywords] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Reset form when template changes
  useState(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setCategory(template.category);
      setSections(template.sections || DEFAULT_SECTIONS);
      setKeywords(template.auto_apply_rules?.keywords?.join(', ') || '');
      setIsDefault(template.is_default || false);
    } else {
      setName('');
      setDescription('');
      setCategory('general');
      setSections(DEFAULT_SECTIONS);
      setKeywords('');
      setIsDefault(false);
    }
  });

  const addSection = () => {
    const newSection: TemplateSection = {
      id: Date.now().toString(),
      title: 'New Section',
      placeholder: '',
      type: 'text',
      order: sections.length + 1,
    };
    setSections([...sections, newSection]);
  };

  const updateSection = (id: string, updates: Partial<TemplateSection>) => {
    setSections(sections.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const removeSection = (id: string) => {
    setSections(sections.filter((s) => s.id !== id));
  };

  const handleSave = () => {
    onSave({
      name,
      description,
      category,
      sections,
      auto_apply_rules: keywords
        ? { keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean) }
        : undefined,
      is_default: isDefault,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template?.id ? 'Edit Template' : 'Create Template'}</DialogTitle>
          <DialogDescription>
            Define the structure for your meeting notes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Client Meeting"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this template for?"
              rows={2}
            />
          </div>

          {/* Sections */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Sections</Label>
              <Button variant="outline" size="sm" onClick={addSection}>
                <Plus className="mr-1 h-3 w-3" />
                Add Section
              </Button>
            </div>
            <div className="space-y-2">
              {sections.map((section) => (
                <div
                  key={section.id}
                  className="flex items-center gap-2 rounded-lg border p-3"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                  <Input
                    value={section.title}
                    onChange={(e) => updateSection(section.id, { title: e.target.value })}
                    className="flex-1"
                    placeholder="Section title"
                  />
                  <Select
                    value={section.type}
                    onValueChange={(v) => updateSection(section.id, { type: v as any })}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="list">List</SelectItem>
                      <SelectItem value="checkbox-list">Checklist</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSection(section.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Auto-apply rules */}
          <div className="space-y-2">
            <Label>Auto-apply Keywords (optional)</Label>
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="standup, sprint, kickoff (comma-separated)"
            />
            <p className="text-xs text-muted-foreground">
              Template will be suggested when meeting title contains these keywords
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Template'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
