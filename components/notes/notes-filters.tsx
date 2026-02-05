'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Client, Note } from '@/lib/firestore';
import {
  Search,
  Calendar as CalendarIcon,
  User,
  X,
  Filter,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subDays, startOfWeek, startOfMonth } from 'date-fns';

export interface FilterState {
  searchTerm: string;
  filterType: string;
  filterClient: string;
  attendeeEmail: string;
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
}

interface NotesFiltersProps {
  notes: Note[];
  clients: Client[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onExport?: () => void;
  noteTypes: string[];
}

const DATE_PRESETS = [
  { label: 'Today', getValue: () => ({ from: new Date(), to: new Date() }) },
  { label: 'Last 7 days', getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: 'Last 30 days', getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: 'This week', getValue: () => ({ from: startOfWeek(new Date()), to: new Date() }) },
  { label: 'This month', getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
];

export function NotesFilters({
  notes,
  clients,
  filters,
  onFiltersChange,
  onExport,
  noteTypes,
}: NotesFiltersProps) {
  const [dateOpen, setDateOpen] = useState(false);

  // Extract unique attendees from all notes
  const uniqueAttendees = useMemo(() => {
    const attendeeSet = new Map<string, string>();
    notes.forEach((note) => {
      note.meeting?.attendees?.forEach((attendee) => {
        if (attendee.email && !attendeeSet.has(attendee.email)) {
          attendeeSet.set(attendee.email, attendee.name || attendee.email);
        }
      });
    });
    return Array.from(attendeeSet.entries())
      .map(([email, name]) => ({ email, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [notes]);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      searchTerm: '',
      filterType: 'all',
      filterClient: 'all',
      attendeeEmail: '',
      dateRange: { from: undefined, to: undefined },
    });
  };

  const activeFilterCount = [
    filters.searchTerm,
    filters.filterType !== 'all' ? filters.filterType : '',
    filters.filterClient !== 'all' ? filters.filterClient : '',
    filters.attendeeEmail,
    filters.dateRange.from || filters.dateRange.to,
  ].filter(Boolean).length;

  const formatDateRange = () => {
    if (filters.dateRange.from && filters.dateRange.to) {
      if (filters.dateRange.from.toDateString() === filters.dateRange.to.toDateString()) {
        return format(filters.dateRange.from, 'MMM d, yyyy');
      }
      return `${format(filters.dateRange.from, 'MMM d')} - ${format(filters.dateRange.to, 'MMM d, yyyy')}`;
    }
    if (filters.dateRange.from) {
      return `From ${format(filters.dateRange.from, 'MMM d, yyyy')}`;
    }
    if (filters.dateRange.to) {
      return `Until ${format(filters.dateRange.to, 'MMM d, yyyy')}`;
    }
    return 'Select dates';
  };

  return (
    <div className="space-y-4">
      {/* Main filter row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={filters.searchTerm}
            onChange={(e) => updateFilter('searchTerm', e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Type filter */}
        <Select value={filters.filterType} onValueChange={(v) => updateFilter('filterType', v)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {noteTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Client filter */}
        <Select value={filters.filterClient} onValueChange={(v) => updateFilter('filterClient', v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range filter */}
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-[220px] justify-start text-left font-normal',
                (filters.dateRange.from || filters.dateRange.to) && 'text-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formatDateRange()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex">
              {/* Quick presets */}
              <div className="border-r p-2 space-y-1">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">Quick select</p>
                {DATE_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => {
                      const range = preset.getValue();
                      updateFilter('dateRange', range);
                      setDateOpen(false);
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs text-muted-foreground"
                  onClick={() => {
                    updateFilter('dateRange', { from: undefined, to: undefined });
                    setDateOpen(false);
                  }}
                >
                  Clear dates
                </Button>
              </div>
              {/* Calendar */}
              <Calendar
                mode="range"
                selected={{
                  from: filters.dateRange.from,
                  to: filters.dateRange.to,
                }}
                onSelect={(range) => {
                  updateFilter('dateRange', {
                    from: range?.from,
                    to: range?.to,
                  });
                }}
                numberOfMonths={2}
              />
            </div>
          </PopoverContent>
        </Popover>

        {/* Attendee filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-[180px] justify-start text-left font-normal',
                filters.attendeeEmail && 'text-foreground'
              )}
            >
              <User className="mr-2 h-4 w-4" />
              {filters.attendeeEmail
                ? uniqueAttendees.find((a) => a.email === filters.attendeeEmail)?.name || filters.attendeeEmail
                : 'Attendee'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <div className="p-2 border-b">
              <Input
                placeholder="Search attendees..."
                className="h-8"
                onChange={(e) => {
                  // Filter attendees list
                }}
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm"
                onClick={() => updateFilter('attendeeEmail', '')}
              >
                All Attendees
              </Button>
              {uniqueAttendees.map((attendee) => (
                <Button
                  key={attendee.email}
                  variant={filters.attendeeEmail === attendee.email ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start text-sm"
                  onClick={() => updateFilter('attendeeEmail', attendee.email)}
                >
                  <div className="flex flex-col items-start">
                    <span>{attendee.name}</span>
                    {attendee.name !== attendee.email && (
                      <span className="text-xs text-muted-foreground">{attendee.email}</span>
                    )}
                  </div>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Export button */}
        {onExport && (
          <Button variant="outline" onClick={onExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        )}
      </div>

      {/* Active filters */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Active filters:</span>
          <div className="flex flex-wrap items-center gap-2">
            {filters.searchTerm && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Search: {filters.searchTerm}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => updateFilter('searchTerm', '')}
                />
              </Badge>
            )}
            {filters.filterType !== 'all' && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Type: {filters.filterType}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => updateFilter('filterType', 'all')}
                />
              </Badge>
            )}
            {filters.filterClient !== 'all' && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Client: {clients.find((c) => c.id === filters.filterClient)?.name}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => updateFilter('filterClient', 'all')}
                />
              </Badge>
            )}
            {filters.attendeeEmail && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Attendee: {uniqueAttendees.find((a) => a.email === filters.attendeeEmail)?.name || filters.attendeeEmail}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => updateFilter('attendeeEmail', '')}
                />
              </Badge>
            )}
            {(filters.dateRange.from || filters.dateRange.to) && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Date: {formatDateRange()}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => updateFilter('dateRange', { from: undefined, to: undefined })}
                />
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={clearAllFilters}
            >
              Clear all
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export const defaultFilters: FilterState = {
  searchTerm: '',
  filterType: 'all',
  filterClient: 'all',
  attendeeEmail: '',
  dateRange: { from: undefined, to: undefined },
};
