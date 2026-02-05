'use client';

import { useState } from 'react';
import { Note } from '@/lib/firestore';
import { downloadExport, ExportFormat, ExportOptions } from '@/lib/export';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, FileJson, FileText, FileSpreadsheet } from 'lucide-react';

interface ExportModalProps {
  notes: Note[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportModal({ notes, open, onOpenChange }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [includeFields, setIncludeFields] = useState({
    title: true,
    date: true,
    client: true,
    project: true,
    type: true,
    summary: true,
    actionItems: true,
    decisions: false,
    attendees: false,
  });

  const toggleField = (field: keyof typeof includeFields) => {
    setIncludeFields((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleExport = () => {
    downloadExport(notes, { format, includeFields });
    onOpenChange(false);
  };

  const formatIcons: Record<ExportFormat, React.ReactNode> = {
    csv: <FileSpreadsheet className="h-4 w-4" />,
    json: <FileJson className="h-4 w-4" />,
    markdown: <FileText className="h-4 w-4" />,
  };

  const formatDescriptions: Record<ExportFormat, string> = {
    csv: 'Best for spreadsheets (Excel, Google Sheets)',
    json: 'Best for data processing and APIs',
    markdown: 'Best for documentation and reports',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Notes
          </DialogTitle>
          <DialogDescription>
            Export {notes.length} note{notes.length !== 1 ? 's' : ''} to your preferred format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    {formatIcons.csv}
                    <span>CSV (Spreadsheet)</span>
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center gap-2">
                    {formatIcons.json}
                    <span>JSON (Data)</span>
                  </div>
                </SelectItem>
                <SelectItem value="markdown">
                  <div className="flex items-center gap-2">
                    {formatIcons.markdown}
                    <span>Markdown (Document)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{formatDescriptions[format]}</p>
          </div>

          {/* Field Selection */}
          <div className="space-y-3">
            <Label>Include Fields</Label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries({
                title: 'Title',
                date: 'Date',
                client: 'Client',
                project: 'Project',
                type: 'Type',
                summary: 'Summary',
                actionItems: 'Action Items',
                decisions: 'Key Decisions',
                attendees: 'Attendees',
              }).map(([key, label]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={includeFields[key as keyof typeof includeFields]}
                    onCheckedChange={() => toggleField(key as keyof typeof includeFields)}
                  />
                  <Label
                    htmlFor={key}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
