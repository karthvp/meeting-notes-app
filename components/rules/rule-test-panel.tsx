'use client';

import { useState } from 'react';
import { ClassificationRule, Note, getNoteTitle } from '@/lib/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RuleTestPanelProps {
  rule: ClassificationRule;
  notes: Note[];
}

interface TestResult {
  noteId: string;
  noteTitle: string;
  matches: boolean;
  matchedConditions: string[];
  failedConditions: string[];
}

/**
 * Simple client-side rule evaluation for testing
 * (Full evaluation happens server-side in the classify function)
 */
function evaluateRuleAgainstNote(
  rule: ClassificationRule,
  note: Note
): { matches: boolean; matchedConditions: string[]; failedConditions: string[] } {
  const conditions = rule.conditions;
  if (!conditions || !conditions.rules || conditions.rules.length === 0) {
    return { matches: false, matchedConditions: [], failedConditions: ['No conditions defined'] };
  }

  const matchedConditions: string[] = [];
  const failedConditions: string[] = [];

  // Extract note data
  const title = getNoteTitle(note).toLowerCase();
  const description = (note.meeting?.description || '').toLowerCase();
  const organizer = note.meeting?.organizer?.toLowerCase() || '';
  const attendeeDomains = (note.meeting?.attendees || [])
    .map((a) => a.email?.split('@')[1]?.toLowerCase())
    .filter(Boolean);

  for (const condition of conditions.rules) {
    const { field, operator, value } = condition;
    let matched = false;
    let conditionDesc = '';

    switch (field) {
      case 'title':
        conditionDesc = `Title ${operator} "${value}"`;
        if (operator === 'contains' && typeof value === 'string') {
          matched = title.includes(value.toLowerCase());
        } else if (operator === 'equals' && typeof value === 'string') {
          matched = title === value.toLowerCase();
        } else if (operator === 'starts_with' && typeof value === 'string') {
          matched = title.startsWith(value.toLowerCase());
        } else if (operator === 'contains_any' && Array.isArray(value)) {
          matched = value.some((v) => title.includes(v.toLowerCase()));
        }
        break;

      case 'description':
        conditionDesc = `Description ${operator} "${value}"`;
        if (operator === 'contains' && typeof value === 'string') {
          matched = description.includes(value.toLowerCase());
        } else if (operator === 'equals' && typeof value === 'string') {
          matched = description === value.toLowerCase();
        } else if (operator === 'starts_with' && typeof value === 'string') {
          matched = description.startsWith(value.toLowerCase());
        }
        break;

      case 'attendee_domains':
        conditionDesc = `Attendee domains ${operator} [${Array.isArray(value) ? value.join(', ') : value}]`;
        if (operator === 'contains' || operator === 'intersects') {
          const domainsToMatch = Array.isArray(value) ? value : [value];
          matched = attendeeDomains.some((d) => domainsToMatch.includes(d));
        }
        break;

      case 'organizer':
        conditionDesc = `Organizer ${operator} "${value}"`;
        if (operator === 'equals' && typeof value === 'string') {
          matched = organizer === value.toLowerCase();
        } else if (operator === 'ends_with' && typeof value === 'string') {
          matched = organizer.endsWith(value.toLowerCase());
        }
        break;

      case 'all_attendees_domain':
        conditionDesc = `All attendees from "${value}"`;
        if (operator === 'equals' && typeof value === 'string') {
          matched =
            attendeeDomains.length > 0 &&
            attendeeDomains.every((d) => d === value.toLowerCase());
        }
        break;

      default:
        conditionDesc = `Unknown field: ${field}`;
        break;
    }

    if (matched) {
      matchedConditions.push(conditionDesc);
    } else {
      failedConditions.push(conditionDesc);
    }
  }

  // Apply AND/OR logic
  let matches = false;
  if (conditions.operator === 'AND') {
    matches = failedConditions.length === 0;
  } else {
    matches = matchedConditions.length > 0;
  }

  return { matches, matchedConditions, failedConditions };
}

export function RuleTestPanel({ rule, notes }: RuleTestPanelProps) {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [hasRun, setHasRun] = useState(false);

  const handleTest = () => {
    setTesting(true);

    // Simulate a short delay for UX
    setTimeout(() => {
      const testResults = notes.slice(0, 20).map((note) => {
        const evaluation = evaluateRuleAgainstNote(rule, note);
        return {
          noteId: note.id,
          noteTitle: getNoteTitle(note),
          matches: evaluation.matches,
          matchedConditions: evaluation.matchedConditions,
          failedConditions: evaluation.failedConditions,
        };
      });

      setResults(testResults);
      setTesting(false);
      setHasRun(true);
    }, 500);
  };

  const matchCount = results.filter((r) => r.matches).length;
  const noMatchCount = results.filter((r) => !r.matches).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Test Rule
        </CardTitle>
        <CardDescription>
          Test this rule against recent notes to see which ones would match.
          This is a dry-run - no changes will be made.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleTest} disabled={testing}>
          {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {testing ? 'Testing...' : hasRun ? 'Run Test Again' : 'Run Test'}
        </Button>

        {hasRun && (
          <>
            {/* Summary */}
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{matchCount} would match</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <XCircle className="h-4 w-4 text-gray-400" />
                <span>{noMatchCount} would not match</span>
              </div>
            </div>

            {/* Results List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.map((result) => (
                <div
                  key={result.noteId}
                  className={cn(
                    'p-3 rounded-lg border',
                    result.matches ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' : 'bg-gray-50 border-gray-200 dark:bg-gray-950/20 dark:border-gray-800'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {result.matches ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-400 shrink-0" />
                        )}
                        <span className="font-medium truncate">{result.noteTitle}</span>
                      </div>

                      {result.matchedConditions.length > 0 && (
                        <div className="mt-2 ml-6">
                          <span className="text-xs text-green-600 font-medium">Matched:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {result.matchedConditions.map((c, i) => (
                              <Badge key={i} variant="outline" className="text-xs bg-green-100 border-green-300 text-green-700">
                                {c}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {!result.matches && result.failedConditions.length > 0 && (
                        <div className="mt-2 ml-6">
                          <span className="text-xs text-gray-500 font-medium">Failed:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {result.failedConditions.map((c, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {c}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <Badge variant={result.matches ? 'default' : 'secondary'} className="shrink-0 ml-2">
                      {result.matches ? 'Match' : 'No Match'}
                    </Badge>
                  </div>
                </div>
              ))}

              {results.length === 0 && (
                <div className="text-center text-muted-foreground py-4">
                  No notes available for testing
                </div>
              )}
            </div>

            {notes.length > 20 && (
              <p className="text-xs text-muted-foreground">
                Showing results for 20 most recent notes
              </p>
            )}
          </>
        )}

        {!hasRun && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>Click &quot;Run Test&quot; to evaluate this rule against recent notes</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
