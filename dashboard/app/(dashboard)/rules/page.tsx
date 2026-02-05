'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  getAllRules,
  getClients,
  getProjects,
  ClassificationRule,
  deleteRule,
  duplicateRule,
  toggleRuleStatus,
} from '@/lib/firestore';
import { RulesTable } from '@/components/rules/rules-table';
import { RuleFormModal } from '@/components/rules/rule-form-modal';
import { Button } from '@/components/ui/button';
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
import { Loader2, Plus, Cpu } from 'lucide-react';

export default function RulesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editingRule, setEditingRule] = useState<ClassificationRule | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ClassificationRule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: rules = [], isLoading: loadingRules, refetch: refetchRules } = useQuery({
    queryKey: ['rules'],
    queryFn: () => getAllRules(),
  });

  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => getClients(),
  });

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects(),
  });

  const isLoading = loadingRules || loadingClients || loadingProjects;

  const handleCreateRule = () => {
    setEditingRule(null);
    setIsFormOpen(true);
  };

  const handleEditRule = (rule: ClassificationRule) => {
    setEditingRule(rule);
    setIsFormOpen(true);
  };

  const handleDuplicateRule = async (rule: ClassificationRule) => {
    try {
      await duplicateRule(rule.id);
      refetchRules();
    } catch (error) {
      console.error('Failed to duplicate rule:', error);
    }
  };

  const handleDeleteRule = async () => {
    if (!deleteConfirm) return;

    setIsDeleting(true);
    try {
      await deleteRule(deleteConfirm.id);
      refetchRules();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete rule:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (
    rule: ClassificationRule,
    status: 'active' | 'disabled' | 'testing'
  ) => {
    try {
      await toggleRuleStatus(rule.id, status);
      refetchRules();
    } catch (error) {
      console.error('Failed to toggle rule status:', error);
    }
  };

  const handleViewDetails = (rule: ClassificationRule) => {
    router.push(`/rules/${rule.id}`);
  };

  const handleFormSuccess = () => {
    refetchRules();
    queryClient.invalidateQueries({ queryKey: ['rules'] });
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
          <h1 className="text-3xl font-bold tracking-tight">Classification Rules</h1>
          <p className="text-muted-foreground">
            Manage rules that automatically classify and organize meeting notes.
          </p>
        </div>
        <Button onClick={handleCreateRule}>
          <Plus className="mr-2 h-4 w-4" />
          Create Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/20">
          <Cpu className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No rules yet</h3>
          <p className="text-muted-foreground text-center max-w-sm mb-4">
            Create classification rules to automatically categorize and share meeting notes based on attendees, keywords, and more.
          </p>
          <Button onClick={handleCreateRule}>
            <Plus className="mr-2 h-4 w-4" />
            Create Your First Rule
          </Button>
        </div>
      ) : (
        <RulesTable
          rules={rules}
          clients={clients}
          projects={projects}
          onEdit={handleEditRule}
          onDuplicate={handleDuplicateRule}
          onDelete={(rule) => setDeleteConfirm(rule)}
          onToggleStatus={handleToggleStatus}
          onViewDetails={handleViewDetails}
        />
      )}

      {/* Rule Form Modal */}
      <RuleFormModal
        rule={editingRule}
        clients={clients}
        projects={projects}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSuccess={handleFormSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the rule &quot;{deleteConfirm?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRule}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
