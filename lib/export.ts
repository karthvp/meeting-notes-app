'use client';

import { Note } from './firestore';

export type ExportFormat = 'csv' | 'json' | 'markdown';

export interface ExportOptions {
  format: ExportFormat;
  includeFields: {
    title: boolean;
    date: boolean;
    client: boolean;
    project: boolean;
    type: boolean;
    summary: boolean;
    actionItems: boolean;
    decisions: boolean;
    attendees: boolean;
  };
  filename?: string;
}

const defaultOptions: ExportOptions = {
  format: 'csv',
  includeFields: {
    title: true,
    date: true,
    client: true,
    project: true,
    type: true,
    summary: true,
    actionItems: true,
    decisions: false,
    attendees: false,
  },
};

/**
 * Format date for export
 */
function formatDate(timestamp?: any): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toISOString().split('T')[0];
}

/**
 * Get note title safely
 */
function getTitle(note: Note): string {
  return note.meeting?.title || note.title || 'Untitled Note';
}

/**
 * Escape CSV value
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export notes to CSV format
 */
function exportToCSV(notes: Note[], options: ExportOptions): string {
  const headers: string[] = [];
  const { includeFields } = options;

  if (includeFields.title) headers.push('Title');
  if (includeFields.date) headers.push('Date');
  if (includeFields.client) headers.push('Client');
  if (includeFields.project) headers.push('Project');
  if (includeFields.type) headers.push('Type');
  if (includeFields.summary) headers.push('Summary');
  if (includeFields.actionItems) headers.push('Action Items');
  if (includeFields.decisions) headers.push('Key Decisions');
  if (includeFields.attendees) headers.push('Attendees');

  const rows = notes.map((note) => {
    const row: string[] = [];

    if (includeFields.title) {
      row.push(escapeCSV(getTitle(note)));
    }
    if (includeFields.date) {
      row.push(formatDate(note.meeting?.start_time || note.created_at));
    }
    if (includeFields.client) {
      row.push(escapeCSV(note.classification?.client_name || ''));
    }
    if (includeFields.project) {
      row.push(escapeCSV(note.classification?.project_name || ''));
    }
    if (includeFields.type) {
      row.push(note.classification?.type || 'uncategorized');
    }
    if (includeFields.summary) {
      row.push(escapeCSV(note.summary || note.enhanced_analysis?.summary || ''));
    }
    if (includeFields.actionItems) {
      const items = note.action_items || note.enhanced_analysis?.action_items || [];
      row.push(escapeCSV(items.map((i) => i.task).join('; ')));
    }
    if (includeFields.decisions) {
      const decisions = note.key_decisions || note.enhanced_analysis?.key_decisions || [];
      row.push(escapeCSV(decisions.map((d) => d.decision).join('; ')));
    }
    if (includeFields.attendees) {
      const attendees = note.meeting?.attendees || [];
      row.push(escapeCSV(attendees.map((a) => a.email).join('; ')));
    }

    return row.join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Export notes to JSON format
 */
function exportToJSON(notes: Note[], options: ExportOptions): string {
  const { includeFields } = options;

  const data = notes.map((note) => {
    const obj: Record<string, any> = {};

    if (includeFields.title) obj.title = getTitle(note);
    if (includeFields.date) obj.date = formatDate(note.meeting?.start_time || note.created_at);
    if (includeFields.client) obj.client = note.classification?.client_name || null;
    if (includeFields.project) obj.project = note.classification?.project_name || null;
    if (includeFields.type) obj.type = note.classification?.type || 'uncategorized';
    if (includeFields.summary) obj.summary = note.summary || note.enhanced_analysis?.summary || null;
    if (includeFields.actionItems) {
      obj.actionItems = (note.action_items || note.enhanced_analysis?.action_items || []).map((i) => ({
        task: i.task,
        assignee: i.assignee_name || i.assignee,
        dueDate: i.due_date,
        status: i.status,
      }));
    }
    if (includeFields.decisions) {
      obj.keyDecisions = (note.key_decisions || note.enhanced_analysis?.key_decisions || []).map((d) => ({
        decision: d.decision,
        context: d.context,
      }));
    }
    if (includeFields.attendees) {
      obj.attendees = (note.meeting?.attendees || []).map((a) => ({
        email: a.email,
        name: a.name,
      }));
    }

    return obj;
  });

  return JSON.stringify(data, null, 2);
}

/**
 * Export notes to Markdown format
 */
function exportToMarkdown(notes: Note[], options: ExportOptions): string {
  const { includeFields } = options;

  const lines: string[] = [
    '# Meeting Notes Export',
    '',
    `*Generated on ${new Date().toLocaleDateString()}*`,
    '',
    '---',
    '',
  ];

  notes.forEach((note, index) => {
    const title = getTitle(note);
    lines.push(`## ${index + 1}. ${title}`);
    lines.push('');

    if (includeFields.date) {
      lines.push(`**Date:** ${formatDate(note.meeting?.start_time || note.created_at)}`);
    }
    if (includeFields.client && note.classification?.client_name) {
      lines.push(`**Client:** ${note.classification.client_name}`);
    }
    if (includeFields.project && note.classification?.project_name) {
      lines.push(`**Project:** ${note.classification.project_name}`);
    }
    if (includeFields.type) {
      lines.push(`**Type:** ${note.classification?.type || 'Uncategorized'}`);
    }

    if (includeFields.attendees) {
      const attendees = note.meeting?.attendees || [];
      if (attendees.length > 0) {
        lines.push('');
        lines.push('**Attendees:**');
        attendees.forEach((a) => {
          lines.push(`- ${a.name || a.email} (${a.email})`);
        });
      }
    }

    lines.push('');

    if (includeFields.summary) {
      const summary = note.summary || note.enhanced_analysis?.summary;
      if (summary) {
        lines.push('### Summary');
        lines.push('');
        lines.push(summary);
        lines.push('');
      }
    }

    if (includeFields.actionItems) {
      const items = note.action_items || note.enhanced_analysis?.action_items || [];
      if (items.length > 0) {
        lines.push('### Action Items');
        lines.push('');
        items.forEach((item) => {
          const status = item.status === 'completed' ? '[x]' : '[ ]';
          const assignee = item.assignee_name || item.assignee ? ` (@${item.assignee_name || item.assignee})` : '';
          const due = item.due_date ? ` - Due: ${item.due_date}` : '';
          lines.push(`- ${status} ${item.task}${assignee}${due}`);
        });
        lines.push('');
      }
    }

    if (includeFields.decisions) {
      const decisions = note.key_decisions || note.enhanced_analysis?.key_decisions || [];
      if (decisions.length > 0) {
        lines.push('### Key Decisions');
        lines.push('');
        decisions.forEach((decision, i) => {
          lines.push(`${i + 1}. **${decision.decision}**`);
          if (decision.context) {
            lines.push(`   > ${decision.context}`);
          }
        });
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Export notes to specified format
 */
export function exportNotes(notes: Note[], options: Partial<ExportOptions> = {}): string {
  const mergedOptions: ExportOptions = { ...defaultOptions, ...options };
  if (options.includeFields) {
    mergedOptions.includeFields = { ...defaultOptions.includeFields, ...options.includeFields };
  }

  switch (mergedOptions.format) {
    case 'csv':
      return exportToCSV(notes, mergedOptions);
    case 'json':
      return exportToJSON(notes, mergedOptions);
    case 'markdown':
      return exportToMarkdown(notes, mergedOptions);
    default:
      throw new Error(`Unsupported export format: ${mergedOptions.format}`);
  }
}

/**
 * Download exported notes as a file
 */
export function downloadExport(notes: Note[], options: Partial<ExportOptions> = {}): void {
  const mergedOptions: ExportOptions = { ...defaultOptions, ...options };
  const content = exportNotes(notes, mergedOptions);

  const mimeTypes: Record<ExportFormat, string> = {
    csv: 'text/csv',
    json: 'application/json',
    markdown: 'text/markdown',
  };

  const extensions: Record<ExportFormat, string> = {
    csv: 'csv',
    json: 'json',
    markdown: 'md',
  };

  const filename =
    mergedOptions.filename ||
    `meeting-notes-${new Date().toISOString().split('T')[0]}.${extensions[mergedOptions.format]}`;

  const blob = new Blob([content], { type: mimeTypes[mergedOptions.format] });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
