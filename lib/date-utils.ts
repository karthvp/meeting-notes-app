/**
 * Date and timestamp utilities for Egen Meeting Notes
 * Handles Firestore timestamps and JavaScript dates uniformly
 */

import { Timestamp } from 'firebase/firestore';

type TimestampLike = Date | Timestamp | { toDate: () => Date } | string | number | null | undefined;

/**
 * Convert any timestamp-like value to a JavaScript Date
 * Handles Firestore Timestamps, Date objects, ISO strings, and Unix timestamps
 */
export function toDate(timestamp: TimestampLike): Date | null {
  if (!timestamp) return null;

  // Already a Date
  if (timestamp instanceof Date) return timestamp;

  // Firestore Timestamp or object with toDate method
  if (typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }

  // ISO string or Unix timestamp
  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/**
 * Format a timestamp as a human-readable date string
 * @param timestamp - Any timestamp-like value
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string or '-' if invalid
 */
export function formatDate(
  timestamp: TimestampLike,
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }
): string {
  const date = toDate(timestamp);
  if (!date) return '-';
  return date.toLocaleDateString('en-US', options);
}

/**
 * Format a timestamp as a date with time
 */
export function formatDateTime(timestamp: TimestampLike): string {
  const date = toDate(timestamp);
  if (!date) return '-';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format a timestamp as time only
 */
export function formatTime(timestamp: TimestampLike): string {
  const date = toDate(timestamp);
  if (!date) return '-';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format a timestamp as a relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: TimestampLike): string {
  const date = toDate(timestamp);
  if (!date) return '-';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffSeconds < 60) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;

  return formatDate(date);
}

/**
 * Check if a timestamp is today
 */
export function isToday(timestamp: TimestampLike): boolean {
  const date = toDate(timestamp);
  if (!date) return false;

  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if a timestamp is within the last N days
 */
export function isWithinDays(timestamp: TimestampLike, days: number): boolean {
  const date = toDate(timestamp);
  if (!date) return false;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return date >= cutoff;
}

/**
 * Get start of day for a timestamp
 */
export function startOfDay(timestamp: TimestampLike): Date | null {
  const date = toDate(timestamp);
  if (!date) return null;

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Get end of day for a timestamp
 */
export function endOfDay(timestamp: TimestampLike): Date | null {
  const date = toDate(timestamp);
  if (!date) return null;

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Calculate duration between two timestamps in minutes
 */
export function getDurationMinutes(start: TimestampLike, end: TimestampLike): number | null {
  const startDate = toDate(start);
  const endDate = toDate(end);

  if (!startDate || !endDate) return null;

  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.round(diffMs / (1000 * 60));
}

/**
 * Format a duration in minutes as a human-readable string
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || minutes < 0) return '-';

  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
}
