import { describe, it, expect } from 'vitest';
import {
  generateDefaultPlatforms,
  getPlatformCount,
  findPlatformByCode,
  sortPlatforms,
  validatePlatformCodes,
  normalizePlatforms,
  getPlatformCodes,
} from './helpers';
import { Platform } from '@/types';

describe('generateDefaultPlatforms', () => {
  it('generates correct number of platforms', () => {
    const platforms = generateDefaultPlatforms(5);
    expect(platforms).toHaveLength(5);
  });

  it('generates platforms with sequential codes', () => {
    const platforms = generateDefaultPlatforms(3);
    expect(platforms[0].code).toBe('1');
    expect(platforms[1].code).toBe('2');
    expect(platforms[2].code).toBe('3');
  });

  it('generates platforms with empty names and isBay false', () => {
    const platforms = generateDefaultPlatforms(2);
    expect(platforms[0]).toEqual({ code: '1', name: '', isBay: false });
    expect(platforms[1]).toEqual({ code: '2', name: '', isBay: false });
  });

  it('returns empty array for count 0', () => {
    const platforms = generateDefaultPlatforms(0);
    expect(platforms).toEqual([]);
  });
});

describe('getPlatformCount', () => {
  it('returns correct count', () => {
    const platforms: Platform[] = [
      { code: '1', name: '', isBay: false },
      { code: '2', name: '', isBay: false },
    ];
    expect(getPlatformCount(platforms)).toBe(2);
  });

  it('returns 0 for empty array', () => {
    expect(getPlatformCount([])).toBe(0);
  });
});

describe('findPlatformByCode', () => {
  const platforms: Platform[] = [
    { code: '1', name: 'to Prague', isBay: false },
    { code: '2', name: 'to Brno', isBay: true },
    { code: '1A', name: 'Bay', isBay: true },
  ];

  it('finds platform by exact code', () => {
    expect(findPlatformByCode(platforms, '2')).toEqual({
      code: '2',
      name: 'to Brno',
      isBay: true,
    });
  });

  it('finds alphanumeric platform code', () => {
    expect(findPlatformByCode(platforms, '1A')).toEqual({
      code: '1A',
      name: 'Bay',
      isBay: true,
    });
  });

  it('returns undefined for non-existent code', () => {
    expect(findPlatformByCode(platforms, '3')).toBeUndefined();
  });
});

describe('sortPlatforms', () => {
  it('sorts numeric codes numerically', () => {
    const platforms: Platform[] = [
      { code: '10', name: '', isBay: false },
      { code: '2', name: '', isBay: false },
      { code: '1', name: '', isBay: false },
    ];
    const sorted = sortPlatforms(platforms);
    expect(sorted.map((p) => p.code)).toEqual(['1', '2', '10']);
  });

  it('sorts alphanumeric codes lexicographically', () => {
    const platforms: Platform[] = [
      { code: 'B', name: '', isBay: false },
      { code: '1A', name: '', isBay: false },
      { code: 'A', name: '', isBay: false },
    ];
    const sorted = sortPlatforms(platforms);
    expect(sorted.map((p) => p.code)).toEqual(['1A', 'A', 'B']);
  });

  it('does not mutate original array', () => {
    const platforms: Platform[] = [
      { code: '2', name: '', isBay: false },
      { code: '1', name: '', isBay: false },
    ];
    const sorted = sortPlatforms(platforms);
    expect(platforms[0].code).toBe('2'); // Original unchanged
    expect(sorted[0].code).toBe('1'); // Sorted result
  });
});

describe('validatePlatformCodes', () => {
  it('returns null for valid unique codes', () => {
    const platforms: Platform[] = [
      { code: '1', name: '', isBay: false },
      { code: '2', name: '', isBay: false },
      { code: '1A', name: '', isBay: false },
    ];
    expect(validatePlatformCodes(platforms)).toBeNull();
  });

  it('returns error for duplicate codes', () => {
    const platforms: Platform[] = [
      { code: '1', name: '', isBay: false },
      { code: '1', name: '', isBay: true },
    ];
    expect(validatePlatformCodes(platforms)).toBe('Duplicate platform code: 1');
  });

  it('returns error for empty code', () => {
    const platforms: Platform[] = [
      { code: '', name: '', isBay: false },
      { code: '1', name: '', isBay: false },
    ];
    expect(validatePlatformCodes(platforms)).toBe('Platform 1 has an empty code');
  });

  it('returns error for whitespace-only code', () => {
    const platforms: Platform[] = [
      { code: '   ', name: '', isBay: false },
    ];
    expect(validatePlatformCodes(platforms)).toBe('Platform 1 has an empty code');
  });

  it('returns null for empty array', () => {
    expect(validatePlatformCodes([])).toBeNull();
  });
});

describe('normalizePlatforms', () => {
  it('returns Platform[] unchanged', () => {
    const platforms: Platform[] = [
      { code: '1', name: 'Test', isBay: true },
    ];
    expect(normalizePlatforms(platforms)).toBe(platforms);
  });

  it('converts number to Platform[]', () => {
    const result = normalizePlatforms(3 as unknown as Platform[]);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ code: '1', name: '', isBay: false });
  });

  it('returns empty array for undefined', () => {
    expect(normalizePlatforms(undefined)).toEqual([]);
  });

  it('returns empty array for 0', () => {
    expect(normalizePlatforms(0 as unknown as Platform[])).toEqual([]);
  });
});

describe('getPlatformCodes', () => {
  it('returns array of codes', () => {
    const platforms: Platform[] = [
      { code: '1', name: '', isBay: false },
      { code: '2', name: '', isBay: true },
      { code: '1A', name: '', isBay: false },
    ];
    expect(getPlatformCodes(platforms)).toEqual(['1', '2', '1A']);
  });

  it('returns empty array for empty platforms', () => {
    expect(getPlatformCodes([])).toEqual([]);
  });
});
