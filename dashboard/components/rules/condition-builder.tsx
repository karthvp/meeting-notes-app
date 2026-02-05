'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, X, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Condition {
  field: string;
  operator: string;
  value: string | string[];
}

export interface ConditionGroup {
  operator: 'AND' | 'OR';
  rules: Condition[];
}

interface ConditionBuilderProps {
  value: ConditionGroup;
  onChange: (value: ConditionGroup) => void;
}

const FIELD_OPTIONS = [
  { value: 'title', label: 'Meeting Title' },
  { value: 'description', label: 'Description' },
  { value: 'attendee_domains', label: 'Attendee Domains' },
  { value: 'organizer', label: 'Organizer Email' },
  { value: 'all_attendees_domain', label: 'All Attendees Domain' },
];

const OPERATOR_OPTIONS: Record<string, { value: string; label: string }[]> = {
  title: [
    { value: 'contains', label: 'Contains' },
    { value: 'equals', label: 'Equals' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'contains_any', label: 'Contains any of' },
  ],
  description: [
    { value: 'contains', label: 'Contains' },
    { value: 'equals', label: 'Equals' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'contains_any', label: 'Contains any of' },
  ],
  attendee_domains: [
    { value: 'contains', label: 'Contains' },
    { value: 'intersects', label: 'Intersects with' },
  ],
  organizer: [
    { value: 'equals', label: 'Equals' },
    { value: 'ends_with', label: 'Ends with' },
  ],
  all_attendees_domain: [
    { value: 'equals', label: 'Equals' },
  ],
};

function getDefaultOperator(field: string): string {
  return OPERATOR_OPTIONS[field]?.[0]?.value || 'contains';
}

export function ConditionBuilder({ value, onChange }: ConditionBuilderProps) {
  const [newDomain, setNewDomain] = useState('');

  const updateOperator = (op: 'AND' | 'OR') => {
    onChange({ ...value, operator: op });
  };

  const addCondition = () => {
    const newCondition: Condition = {
      field: 'title',
      operator: 'contains',
      value: '',
    };
    onChange({
      ...value,
      rules: [...value.rules, newCondition],
    });
  };

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    const newRules = [...value.rules];
    newRules[index] = { ...newRules[index], ...updates };

    // If field changed, reset operator to default for that field
    if (updates.field && updates.field !== value.rules[index].field) {
      newRules[index].operator = getDefaultOperator(updates.field);
      // Reset value for domain fields
      if (updates.field === 'attendee_domains') {
        newRules[index].value = [];
      } else if (value.rules[index].field === 'attendee_domains') {
        newRules[index].value = '';
      }
    }

    onChange({ ...value, rules: newRules });
  };

  const removeCondition = (index: number) => {
    const newRules = value.rules.filter((_, i) => i !== index);
    onChange({ ...value, rules: newRules });
  };

  const addDomainToCondition = (index: number, domain: string) => {
    if (!domain.trim()) return;
    const currentValue = value.rules[index].value;
    const domains = Array.isArray(currentValue) ? currentValue : [];
    if (!domains.includes(domain.trim().toLowerCase())) {
      updateCondition(index, { value: [...domains, domain.trim().toLowerCase()] });
    }
    setNewDomain('');
  };

  const removeDomainFromCondition = (index: number, domain: string) => {
    const currentValue = value.rules[index].value;
    const domains = Array.isArray(currentValue) ? currentValue : [];
    updateCondition(index, { value: domains.filter((d) => d !== domain) });
  };

  const renderConditionPreview = () => {
    if (value.rules.length === 0) {
      return <span className="text-muted-foreground italic">No conditions defined</span>;
    }

    return value.rules.map((condition, index) => {
      const fieldLabel = FIELD_OPTIONS.find((f) => f.value === condition.field)?.label || condition.field;
      const operatorLabel = OPERATOR_OPTIONS[condition.field]?.find((o) => o.value === condition.operator)?.label || condition.operator;
      const valueStr = Array.isArray(condition.value) ? condition.value.join(', ') : condition.value;

      return (
        <span key={index}>
          {index > 0 && (
            <Badge variant="outline" className="mx-1 text-xs">
              {value.operator}
            </Badge>
          )}
          <span className="text-sm">
            <span className="font-medium">{fieldLabel}</span>
            {' '}
            <span className="text-muted-foreground">{operatorLabel.toLowerCase()}</span>
            {' '}
            <span className="text-primary">&quot;{valueStr}&quot;</span>
          </span>
        </span>
      );
    });
  };

  return (
    <div className="space-y-4">
      {/* Logic Operator Toggle */}
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">Match:</Label>
        <div className="flex rounded-md border overflow-hidden">
          <button
            type="button"
            onClick={() => updateOperator('AND')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium transition-colors',
              value.operator === 'AND'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background hover:bg-muted'
            )}
          >
            ALL conditions (AND)
          </button>
          <button
            type="button"
            onClick={() => updateOperator('OR')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium transition-colors border-l',
              value.operator === 'OR'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background hover:bg-muted'
            )}
          >
            ANY condition (OR)
          </button>
        </div>
      </div>

      {/* Condition Rows */}
      <div className="space-y-3">
        {value.rules.map((condition, index) => (
          <Card key={index} className="bg-muted/30">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="flex items-center pt-2 text-muted-foreground">
                  <GripVertical className="h-4 w-4" />
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Field Selection */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Field</Label>
                    <Select
                      value={condition.field}
                      onValueChange={(field) => updateCondition(index, { field })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_OPTIONS.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Operator Selection */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Operator</Label>
                    <Select
                      value={condition.operator}
                      onValueChange={(operator) => updateCondition(index, { operator })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(OPERATOR_OPTIONS[condition.field] || []).map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Value Input */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Value</Label>
                    {condition.field === 'attendee_domains' ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="e.g., acme.com"
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addDomainToCondition(index, newDomain);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => addDomainToCondition(index, newDomain)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(condition.value) ? condition.value : []).map((domain) => (
                            <Badge
                              key={domain}
                              variant="secondary"
                              className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => removeDomainFromCondition(index, domain)}
                            >
                              {domain}
                              <X className="ml-1 h-3 w-3" />
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <Input
                        placeholder={
                          condition.field === 'organizer'
                            ? 'user@domain.com'
                            : condition.field === 'all_attendees_domain'
                            ? 'egen.com'
                            : 'Enter text to match...'
                        }
                        value={typeof condition.value === 'string' ? condition.value : ''}
                        onChange={(e) => updateCondition(index, { value: e.target.value })}
                      />
                    )}
                  </div>
                </div>

                {/* Remove Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeCondition(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Condition Button */}
      <Button
        type="button"
        variant="outline"
        onClick={addCondition}
        className="w-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Condition
      </Button>

      {/* Preview */}
      {value.rules.length > 0 && (
        <div className="p-3 rounded-md bg-muted/50 border">
          <Label className="text-xs text-muted-foreground block mb-2">Rule Preview</Label>
          <div className="text-sm">{renderConditionPreview()}</div>
        </div>
      )}
    </div>
  );
}
