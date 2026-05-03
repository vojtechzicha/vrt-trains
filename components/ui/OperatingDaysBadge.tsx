'use client';

interface OperatingDaysBadgeProps {
  days: string[];
  className?: string;
  /** Use dark variant for departure boards (light text on dark bg) */
  variant?: 'light' | 'dark';
}

// Day name to number mapping (Mon=1, Sun=7)
// Supports both short (Mon, Tue) and full (monday, tuesday) formats
const dayToNumber: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

// Unicode circled numbers
const circledNumbers = ['①', '②', '③', '④', '⑤', '⑥', '⑦'];

// Normalize day to short format (Mon, Tue, etc.)
function normalizeDay(day: string): string {
  const mapping: Record<string, string> = {
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
    sunday: 'Sun',
  };
  return mapping[day.toLowerCase()] || day;
}

// Expand keywords like 'weekdays' and 'weekends' to individual days
function expandDays(days: string[]): string[] {
  const expanded = new Set<string>();

  for (const day of days) {
    if (day === 'weekdays') {
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(d => expanded.add(d));
    } else if (day === 'weekends') {
      ['Sat', 'Sun'].forEach(d => expanded.add(d));
    } else if (dayToNumber[day]) {
      expanded.add(normalizeDay(day));
    }
  }

  return Array.from(expanded);
}

// Check if array contains exactly these days
function hasExactDays(days: string[], expected: string[]): boolean {
  if (days.length !== expected.length) return false;
  const daySet = new Set(days);
  return expected.every(d => daySet.has(d));
}

export function OperatingDaysBadge({ days, className = '', variant = 'light' }: OperatingDaysBadgeProps) {
  // Expand any keywords
  const expandedDays = expandDays(days);

  // Sort by day number for consistent comparison
  const sortedDays = [...expandedDays].sort((a, b) => dayToNumber[a] - dayToNumber[b]);

  // Check for daily (all 7 days) - show nothing
  if (sortedDays.length === 7) {
    return null;
  }

  // Check for weekdays (Mon-Fri)
  const isWeekdays = hasExactDays(sortedDays, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);

  // Check for weekends (Sat-Sun)
  const isWeekends = hasExactDays(sortedDays, ['Sat', 'Sun']);

  const badgeClasses = variant === 'dark'
    ? 'text-xs text-gray-400 dark:text-gray-500'
    : 'text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded';

  if (isWeekdays) {
    // Crossed hammers - traditional Czech symbol for working days
    return (
      <span className={`${badgeClasses} ${className}`} title="Monday to Friday">
        ⚒
      </span>
    );
  }

  if (isWeekends) {
    return (
      <span className={`${badgeClasses} ${className}`} title="Saturday and Sunday">
        ☀
      </span>
    );
  }

  // Custom days - show circled numbers
  const dayNumbers = sortedDays.map(d => dayToNumber[d]);
  const circles = dayNumbers.map(n => circledNumbers[n - 1]).join('');

  // Build tooltip
  const dayNames = sortedDays.join(', ');

  return (
    <span
      className={`${variant === 'dark' ? 'text-xs text-gray-400 dark:text-gray-500' : 'text-xs text-gray-500 dark:text-gray-400'} ${className}`}
      title={dayNames}
    >
      {circles}
    </span>
  );
}
