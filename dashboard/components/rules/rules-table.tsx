'use client';

import { useState } from 'react';
import { ClassificationRule, Client, Project } from '@/lib/firestore';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Edit,
  Copy,
  Trash2,
  MoreHorizontal,
  Play,
  Pause,
  FlaskConical,
  ArrowUpDown,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RulesTableProps {
  rules: ClassificationRule[];
  clients: Client[];
  projects: Project[];
  onEdit: (rule: ClassificationRule) => void;
  onDuplicate: (rule: ClassificationRule) => void;
  onDelete: (rule: ClassificationRule) => void;
  onToggleStatus: (rule: ClassificationRule, status: 'active' | 'disabled' | 'testing') => void;
  onViewDetails: (rule: ClassificationRule) => void;
}

type SortField = 'name' | 'priority' | 'status' | 'timesApplied' | 'lastApplied';
type SortDirection = 'asc' | 'desc';

export function RulesTable({
  rules,
  clients,
  projects,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleStatus,
  onViewDetails,
}: RulesTableProps) {
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterStatus, setFilterStatus] = useState<string>('all');

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

  const formatDate = (timestamp?: any) => {
    if (!timestamp) return 'Never';
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

  const getClientName = (clientId?: string) => {
    if (!clientId) return null;
    const client = clients.find((c) => c.id === clientId);
    return client?.name || null;
  };

  const getProjectName = (projectId?: string) => {
    if (!projectId) return null;
    const project = projects.find((p) => p.id === projectId);
    return project?.project_name || null;
  };

  const getActionSummary = (rule: ClassificationRule) => {
    const parts: string[] = [];
    if (rule.actions?.classify_as) {
      parts.push(`Type: ${rule.actions.classify_as}`);
    }
    if (rule.actions?.client_id) {
      const clientName = getClientName(rule.actions.client_id);
      if (clientName) parts.push(`Client: ${clientName}`);
    }
    if (rule.actions?.share_with?.length) {
      parts.push(`Share: ${rule.actions.share_with.length} people`);
    }
    return parts.join(' | ') || 'No actions';
  };

  // Filter and sort rules
  const filteredRules = rules
    .filter((rule) => {
      if (filterStatus !== 'all' && rule.status !== filterStatus) return false;
      return true;
    })
    .sort((a, b) => {
      let aValue: any, bValue: any;
      switch (sortField) {
        case 'name':
          aValue = a.name || '';
          bValue = b.name || '';
          break;
        case 'priority':
          aValue = a.priority || 0;
          bValue = b.priority || 0;
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'timesApplied':
          aValue = a.stats?.times_applied || 0;
          bValue = b.stats?.times_applied || 0;
          break;
        case 'lastApplied':
          aValue = a.stats?.last_applied?.toDate?.() || new Date(0);
          bValue = b.stats?.last_applied?.toDate?.() || new Date(0);
          break;
        default:
          return 0;
      }
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
            <SelectItem value="testing">Testing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('name')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Name
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('priority')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Priority
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('status')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Status
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Actions Summary</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('timesApplied')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Times Applied
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('lastApplied')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Last Applied
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No rules found.
                </TableCell>
              </TableRow>
            ) : (
              filteredRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium max-w-[200px]">
                    <div className="truncate" title={rule.name}>
                      {rule.name}
                    </div>
                    {rule.description && (
                      <div className="text-xs text-muted-foreground truncate" title={rule.description}>
                        {rule.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{rule.priority}</Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(rule.status)}</TableCell>
                  <TableCell className="max-w-[200px]">
                    <div className="text-sm text-muted-foreground truncate" title={getActionSummary(rule)}>
                      {getActionSummary(rule)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{rule.stats?.times_applied || 0}</span>
                      {(rule.stats?.times_corrected || 0) > 0 && (
                        <span className="text-xs text-orange-500">
                          ({rule.stats?.times_corrected} corrected)
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(rule.stats?.last_applied)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewDetails(rule)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(rule)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDuplicate(rule)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {rule.status !== 'active' && (
                          <DropdownMenuItem onClick={() => onToggleStatus(rule, 'active')}>
                            <Play className="mr-2 h-4 w-4" />
                            Activate
                          </DropdownMenuItem>
                        )}
                        {rule.status !== 'disabled' && (
                          <DropdownMenuItem onClick={() => onToggleStatus(rule, 'disabled')}>
                            <Pause className="mr-2 h-4 w-4" />
                            Disable
                          </DropdownMenuItem>
                        )}
                        {rule.status !== 'testing' && (
                          <DropdownMenuItem onClick={() => onToggleStatus(rule, 'testing')}>
                            <FlaskConical className="mr-2 h-4 w-4" />
                            Set to Testing
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(rule)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredRules.length} of {rules.length} rules
      </div>
    </div>
  );
}
