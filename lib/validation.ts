/**
 * Email validation utilities for Egen Meeting Notes
 */

/**
 * Check if an email is a valid Egen domain email
 * @param email - Email address to validate
 * @returns true if email ends with @egen.ai or @egen.com
 */
export function isEgenEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false;
  const lower = email.toLowerCase().trim();
  return lower.endsWith('@egen.ai') || lower.endsWith('@egen.com');
}

/**
 * Validate email format using regex
 * @param email - Email address to validate
 * @returns true if email has valid format
 */
export function isValidEmailFormat(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate that an email is both valid format and from Egen domain
 * @param email - Email address to validate
 * @returns Object with validation result and error message
 */
export function validateEgenEmail(email: string | null | undefined): {
  valid: boolean;
  error?: string;
} {
  if (!email || typeof email !== 'string' || !email.trim()) {
    return { valid: false, error: 'Email address is required' };
  }

  const trimmed = email.trim();

  if (!isValidEmailFormat(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  if (!isEgenEmail(trimmed)) {
    return { valid: false, error: 'Only @egen.ai email addresses are allowed' };
  }

  return { valid: true };
}

/**
 * Extract domain from email address
 * @param email - Email address
 * @returns Domain part of email or null
 */
export function getEmailDomain(email: string | null | undefined): string | null {
  if (!email || typeof email !== 'string') return null;
  const parts = email.trim().split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : null;
}

/**
 * Extract username from email address
 * @param email - Email address
 * @returns Username part of email or null
 */
export function getEmailUsername(email: string | null | undefined): string | null {
  if (!email || typeof email !== 'string') return null;
  const parts = email.trim().split('@');
  return parts.length >= 1 ? parts[0] : null;
}

/**
 * Format display name from email if name not provided
 * @param email - Email address
 * @param name - Optional display name
 * @returns Display name or formatted email username
 */
export function formatDisplayName(
  email: string | null | undefined,
  name?: string | null
): string {
  if (name && name.trim()) return name.trim();
  const username = getEmailUsername(email);
  if (!username) return email || 'Unknown';
  // Convert john.doe to John Doe
  return username
    .split(/[._-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
