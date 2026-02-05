'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Sparkles } from 'lucide-react';

interface SummaryCardProps {
  summary: string | null | undefined;
}

export function SummaryCard({ summary }: SummaryCardProps) {
  if (!summary) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
      </CardContent>
    </Card>
  );
}
