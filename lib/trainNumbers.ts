import { Direction } from '@/types';

export interface TrainNumberParts {
  prefix: string;
  coreNumber: number;
}

/**
 * Parse a train number like "Ex201" into its parts
 * Returns null if the format is invalid
 */
export function parseTrainNumber(trainNumber: string): TrainNumberParts | null {
  // Match letters at the start (prefix) followed by digits (core number)
  const match = trainNumber.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return null;

  return {
    prefix: match[1],
    coreNumber: parseInt(match[2], 10),
  };
}

/**
 * Calculate the core number from a base number and direction
 * Outbound trains get odd numbers, inbound trains get even numbers
 *
 * Base 100: outbound → 101 (first odd >= 100), inbound → 100 (first even >= 100)
 * Base 101: outbound → 101, inbound → 102
 */
export function calculateCoreNumber(baseNumber: number, direction: Direction): number {
  const isOdd = baseNumber % 2 === 1;
  if (direction === 'outbound') {
    // Outbound = odd numbers - if even, add 1
    return isOdd ? baseNumber : baseNumber + 1;
  } else {
    // Inbound = even numbers - if odd, add 1
    return isOdd ? baseNumber + 1 : baseNumber;
  }
}

/**
 * Extract the base number from a core number (for editing)
 * Returns the core number itself since it's already valid
 */
export function extractBaseNumber(coreNumber: number, _direction: Direction): number {
  return coreNumber;
}

/**
 * Format a train number from prefix and core number
 * Example: formatTrainNumber("Ex", 201) → "Ex201"
 */
export function formatTrainNumber(prefix: string, coreNumber: number): string {
  return `${prefix}${coreNumber}`;
}

/**
 * Check if a train number follows the valid format (prefix + digits)
 */
export function isValidTrainNumberFormat(trainNumber: string): boolean {
  return /^[A-Za-z]+\d+$/.test(trainNumber);
}

/**
 * Check if a core number matches the expected parity for a direction
 */
export function isCorrectParity(coreNumber: number, direction: Direction): boolean {
  const isOdd = coreNumber % 2 === 1;
  return direction === 'outbound' ? isOdd : !isOdd;
}
