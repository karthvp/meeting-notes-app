'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getRule,
  getNotes,
  getClients,
  getProjects,
  deleteRule,
  toggleRuleStatus,
  ClassificationRule,
} from '@/lib/firestore';
import { RuleFormModal } from '@/components/rules/rule-form-modal';
import { RuleTestPanel } from '@/components/rules/rule-test-panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Loader2,
  ArrowLeft,
  Edit,
  Trash2,
  Play,
  Pause,
  FlaskConical,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Clock,
  Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function RuleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const ruleId = params.id as string;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: rule, isLoading: loadingRule, refetch: refetchRule } = useQuery({
    queryKey: ['rule', ruleId],
    queryFn: () => getRule(ruleId),
    enabled: !!ruleId,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['notes'],
    queryFn: () => getNotes({ limit: 50 }),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => getClients(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects(),
  });

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteRule(ruleId);
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      router.push('/rules');
    } catch (error) {
      console.error('Failed to delete rule:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (status: 'active' | 'disabled' | 'testing') => {
    try {
      await toggleRuleStatus(ruleId, status);
      refetchRule();
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    } catch (error) {
      console.error('Failed to toggle status:', error);
    }
  };

  const handleFormSuccess = () => {
    refetchRule();
    queryClient.invalidateQueries({ queryKey: ['rules'] });
  };

  if (loadingRule) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!rule) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Cpu className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Rule not found</h3>
        <p className="text-muted-foreground mb-4">
          The rule you&apos;re looking for doesn&apos;t exist or has been deleted.
        </p>
        <Button variant="outline" onClick={() => router.push('/rules')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Rules
        </Button>
      </div>
    );
  }

  const formatDate = (timestamp?: any) => {
    if (!timestamp) return 'Never';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status?: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      active: { color: 'bg-green-500', label: 'Active' },
      disabled: { color: 'bg-gray-400', label: 'Disabled' },
      testing: { color: 'bg-yellow-500', label: 'Testing' },
    };
    const config = statusConfig[status || 'disabled'] || statusConfig.disabled;
    return (
      <Badge className={cn(config.color, 'hover:opacity-80')}>
        {config.label}
      </Badge>
    );
  };

  const timesApplied = rule.stats?.times_applied || 0;
  const timesCorrected = rule.stats?.times_corrected || 0;
  const accuracy = timesApplied > 0 ? ((timesApplied - timesCorrected) / timesApplied) * 100 : 0;

  const getClientName = (clientId?: string) => {
    if (!clientId) return null;
    return clients.find((c) => c.id === clientId)?.name || null;
  };

  const getProjectName = (projectId?: string) => {
    if (!projectId) return null;
    return projects.find((p) => p.id === projectId)?.project_name || null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/rules')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">{rule.name}</h1>
            {getStatusBadge(rule.status)}
          </div>
          {rule.description && (
            <p className="text-muted-foreground ml-12">{rule.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {rule.status !== 'active' && (
            <Button variant="outline" onClick={() => handleToggleStatus('active')}>
              <Play className="mr-2 h-4 w-4" />
              Activate
            </Button>
          )}
          {rule.status !== 'disabled' && (
            <Button variant="outline" onClick={() => handleToggleStatus('disabled')}>
              <Pause className="mr-2 h-4 w-4" />
              Disable
            </Button>
          )}
          {rule.status !== 'testing' && (
            <Button variant="outline" onClick={() => handleToggleStatus('testing')}>
              <FlaskConical className="mr-2 h-4 w-4" />
              Test Mode
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsFormOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => setDeleteConfirm(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Times Applied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timesApplied}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Times Corrected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{timesCorrected}</span>
              {timesCorrected > 0 && (
                <XCircle className="h-5 w-5 text-orange-500" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Accuracy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {timesApplied > 0 ? `${accuracy.toFixed(0)}%` : 'N/A'}
              </span>
              {timesApplied > 0 && accuracy >= 90 && (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
              {timesApplied > 0 && accuracy < 90 && accuracy >= 70 && (
                <TrendingUp className="h-5 w-5 text-yellow-500" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last Applied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {rule.stats?.last_applied ? formatDate(rule.stats.last_applied) : 'Never'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conditions */}
        <Card>
          <CardHeader>
            <CardTitle>Conditions</CardTitle>
            <CardDescription>
              This rule triggers when{' '}
              <strong>{rule.conditions?.operator === 'OR' ? 'ANY' : 'ALL'}</strong>{' '}
              of these conditions are met
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rule.conditions?.rules && rule.conditions.rules.length > 0 ? (
              <div className="space-y-2">
                {rule.conditions.rules.map((condition, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 rounded bg-muted/50"
                  >
                    <Badge variant="outline" className="text-xs">
                      {condition.field}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {condition.operator}
                    </span>
                    <span className="text-sm font-medium">
                      {Array.isArray(condition.value)
                        ? condition.value.join(', ')
                        : condition.value}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No conditions defined</p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>
              When this rule matches, these actions will be applied
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rule.actions?.classify_as && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Classification:</span>
                  <Badge>{rule.actions.classify_as}</Badge>
                </div>
              )}

              {rule.actions?.client_id && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Client:</span>
                  <span className="text-sm font-medium">
                    {getClientName(rule.actions.client_id) || rule.actions.client_id}
                  </span>
                </div>
              )}

              {rule.actions?.project_id && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Project:</span>
                  <span className="text-sm font-medium">
                    {getProjectName(rule.actions.project_id) || rule.actions.project_id}
                  </span>
                </div>
              )}

              {rule.actions?.team && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Team:</span>
                  <span className="text-sm font-medium">{rule.actions.team}</span>
                </div>
              )}

              {rule.actions?.share_with && rule.actions.share_with.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground block mb-1">
                    Share with:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {rule.actions.share_with.map((email) => (
                      <Badge key={email} variant="secondary" className="text-xs">
                        {email}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {rule.actions?.add_tags && rule.actions.add_tags.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground block mb-1">
                    Add tags:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {rule.actions.add_tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {rule.actions?.folder_path && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Folder path:</span>
                  <span className="text-sm font-medium font-mono">
                    {rule.actions.folder_path}
                  </span>
                </div>
              )}

              {!rule.actions?.classify_as &&
                !rule.actions?.client_id &&
                !rule.actions?.share_with?.length && (
                  <p className="text-muted-foreground">No actions defined</p>
                )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test Panel */}
      <RuleTestPanel rule={rule} notes={notes} />

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Rule Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block">Priority</span>
              <span className="font-medium">{rule.priority}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Confidence Boost</span>
              <span className="font-medium">+{Math.round((rule.confidence_boost || 0) * 100)}%</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Created</span>
              <span className="font-medium">{formatDate(rule.created_at)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Last Modified</span>
              <span className="font-medium">{formatDate(rule.updated_at)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <RuleFormModal
        rule={rule}
        clients={clients}
        projects={projects}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSuccess={handleFormSuccess}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the rule &quot;{rule.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
