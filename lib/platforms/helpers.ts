import { Platform } from '@/types';

/**
 * Generate default platforms from a count.
 * Each platform gets a sequential code ("1", "2", etc.), empty name, and isBay: false.
 */
export function generateDefaultPlatforms(count: number): Platform[] {
  return Array.from({ length: count }, (_, i) => ({
    code: String(i + 1),
    name: '',
    isBay: false,
  }));
}

/**
 * Get platform count from Platform[] (for backward compatibility).
 */
export function getPlatformCount(platforms: Platform[]): number {
  return platforms.length;
}

/**
 * Find a platform by its code.
 */
export function findPlatformByCode(
  platforms: Platform[],
  code: string
): Platform | undefined {
  return platforms.find((p) => p.code === code);
}

/**
 * Sort platforms by code (numeric-aware).
 * Numeric codes are sorted numerically, alphanumeric codes are sorted lexicographically.
 */
export function sortPlatforms(platforms: Platform[]): Platform[] {
  return [...platforms].sort((a, b) => {
    const numA = parseInt(a.code, 10);
    const numB = parseInt(b.code, 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.code.localeCompare(b.code);
  });
}

/**
 * Validate that all platform codes are unique and non-empty.
 * Returns an error message if validation fails, or null if valid.
 */
export function validatePlatformCodes(platforms: Platform[]): string | null {
  // Check for empty codes
  const emptyCodeIndex = platforms.findIndex((p) => !p.code || p.code.trim() === '');
  if (emptyCodeIndex !== -1) {
    return `Platform ${emptyCodeIndex + 1} has an empty code`;
  }

  // Check for duplicate codes
  const codes = platforms.map((p) => p.code);
  const uniqueCodes = new Set(codes);
  if (uniqueCodes.size !== codes.length) {
    const duplicates = codes.filter((code, i) => codes.indexOf(code) !== i);
    return `Duplicate platform code: ${duplicates[0]}`;
  }

  return null;
}

/**
 * Normalize platforms - converts legacy number format to Platform[].
 * This is a runtime helper for handling mixed data during migration.
 */
export function normalizePlatforms(
  platforms: Platform[] | number | undefined
): Platform[] {
  if (!platforms) return [];

  if (typeof platforms === 'number') {
    return generateDefaultPlatforms(platforms);
  }

  return platforms;
}

/**
 * Get all platform codes from a Platform[].
 */
export function getPlatformCodes(platforms: Platform[]): string[] {
  return platforms.map((p) => p.code);
}
