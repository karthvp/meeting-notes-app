'use client';

import { KeyDecision } from '@/lib/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gavel, User } from 'lucide-react';

interface DecisionsListProps {
  decisions: KeyDecision[];
}

export function DecisionsList({ decisions }: DecisionsListProps) {
  if (!decisions || decisions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gavel className="h-5 w-5" />
            Key Decisions
          </CardTitle>
          <CardDescription>No key decisions identified in this meeting</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gavel className="h-5 w-5" />
          Key Decisions
          <Badge variant="outline" className="ml-2">
            {decisions.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Important decisions made during this meeting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {decisions.map((decision, index) => (
          <div
            key={decision.id}
            className="rounded-lg border-l-4 border-l-primary bg-muted/30 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {index + 1}
              </div>
              <div className="flex-1 space-y-2">
                <p className="font-medium">{decision.decision}</p>
                {decision.context && (
                  <p className="text-sm text-muted-foreground">{decision.context}</p>
                )}
                {decision.decided_by && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    Decided by: {decision.decided_by}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
