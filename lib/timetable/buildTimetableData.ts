import { Timetable, Variant } from '@/types';
import { compareTime } from '@/lib/utils';

export interface TimetableEntry {
  trainNumber: string;
  variantCode: string;
  times: Map<string, { arrival: string | null; departure: string | null }>;
  sortTime: string;
  firstStationIdx: number;
  lastStationIdx: number;
  operatingDays: string[];
}

export interface BuildTimetableResult {
  stationOrder: string[];
  entries: TimetableEntry[];
}

/**
 * Build ordering constraints from variants.
 * If a variant has stations A -> B -> C, then A must come before B and C, B must come before C.
 */
export function buildOrderingConstraints(variants: Variant[]): Map<string, Set<string>> {
  const mustComeBefore = new Map<string, Set<string>>();

  variants.forEach((variant) => {
    const sortedStations = [...variant.stations].sort((a, b) => a.sequence - b.sequence);
    for (let i = 0; i < sortedStations.length; i++) {
      const stationId = sortedStations[i].stationId;
      if (!mustComeBefore.has(stationId)) {
        mustComeBefore.set(stationId, new Set());
      }
      for (let j = i + 1; j < sortedStations.length; j++) {
        mustComeBefore.get(stationId)!.add(sortedStations[j].stationId);
      }
    }
  });

  return mustComeBefore;
}

/**
 * Check if inserting a station at a position would violate ordering constraints.
 */
export function canInsertAt(
  stationId: string,
  position: number,
  orderedStationIds: string[],
  mustComeBefore: Map<string, Set<string>>
): boolean {
  // Check: stations before 'position' must not be required to come AFTER stationId
  for (let i = 0; i < position; i++) {
    const existingStation = orderedStationIds[i];
    const stationMustComeBefore = mustComeBefore.get(stationId);
    if (stationMustComeBefore && stationMustComeBefore.has(existingStation)) {
      return false;
    }
  }

  // Check: stations at/after 'position' must not require stationId to come AFTER them
  for (let i = position; i < orderedStationIds.length; i++) {
    const existingStation = orderedStationIds[i];
    const existingMustComeBefore = mustComeBefore.get(existingStation);
    if (existingMustComeBefore && existingMustComeBefore.has(stationId)) {
      return false;
    }
  }

  return true;
}

/**
 * Build ordered station list from variants.
 * Uses the longest variant as base, then inserts compatible stations from other variants.
 */
export function buildStationOrder(variants: Variant[]): string[] {
  if (variants.length === 0) return [];

  // Use outbound variants for canonical order, or all if none are outbound
  const outboundVariants = variants.filter((v) => v.direction === 'outbound');
  const baseVariants = outboundVariants.length > 0 ? outboundVariants : variants;

  const mustComeBefore = buildOrderingConstraints(baseVariants);

  // Find the longest variant
  const longestVariant = baseVariants.reduce(
    (longest, current) => (current.stations.length > longest.stations.length ? current : longest),
    baseVariants[0]
  );

  // Build ordered list from longest variant
  const orderedStationIds: string[] = [];
  longestVariant.stations
    .sort((a, b) => a.sequence - b.sequence)
    .forEach((stop) => {
      orderedStationIds.push(stop.stationId);
    });

  // Add stations from other variants
  baseVariants.forEach((variant) => {
    if (variant.id === longestVariant.id) return;

    const variantStations = [...variant.stations].sort((a, b) => a.sequence - b.sequence);

    variantStations.forEach((stop, idx) => {
      if (orderedStationIds.includes(stop.stationId)) return;

      // Find insertion position based on previous stations
      let insertIndex = -1;

      for (let i = idx - 1; i >= 0; i--) {
        const prevStationId = variantStations[i].stationId;
        const prevIndex = orderedStationIds.indexOf(prevStationId);
        if (prevIndex !== -1) {
          insertIndex = prevIndex + 1;
          break;
        }
      }

      // If no previous found, try next stations
      if (insertIndex === -1) {
        for (let i = idx + 1; i < variantStations.length; i++) {
          const nextStationId = variantStations[i].stationId;
          const nextIndex = orderedStationIds.indexOf(nextStationId);
          if (nextIndex !== -1) {
            insertIndex = nextIndex;
            break;
          }
        }
      }

      if (insertIndex === -1) {
        insertIndex = orderedStationIds.length;
      }

      if (canInsertAt(stop.stationId, insertIndex, orderedStationIds, mustComeBefore)) {
        orderedStationIds.splice(insertIndex, 0, stop.stationId);
      }
    });
  });

  return orderedStationIds;
}

/**
 * Get the first departure time from a timetable's departures.
 */
export function getFirstDepartureTime(timetable: Timetable): string {
  const firstDep = timetable.departures[0];
  if (!firstDep) return '99:99';
  return firstDep.departure || firstDep.arrival || '99:99';
}

/**
 * Parse a time string (HH:MM) into minutes since midnight.
 */
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Check if a train is an overnight train (crosses midnight).
 * An overnight train has some times before midnight (e.g., 21:00-23:59)
 * and some times after midnight (e.g., 00:00-05:00).
 */
export function isOvernightTrain(timetable: Timetable): boolean {
  const times: number[] = [];

  timetable.departures.forEach((dep) => {
    if (dep.departure) times.push(parseTimeToMinutes(dep.departure));
    if (dep.arrival) times.push(parseTimeToMinutes(dep.arrival));
  });

  if (times.length < 2) return false;

  // Check if we have times in the late evening (after 20:00 = 1200 min)
  // and times in the early morning (before 06:00 = 360 min)
  const hasLateEvening = times.some((t) => t >= 1200); // 20:00 or later
  const hasEarlyMorning = times.some((t) => t < 360); // before 06:00

  return hasLateEvening && hasEarlyMorning;
}

/**
 * Apply overnight penalty to a time string.
 * For overnight trains, times after midnight (00:00-05:59) get 24 hours added
 * so they sort after late evening times.
 */
export function applyOvernightPenalty(time: string, isOvernight: boolean): string {
  if (!isOvernight || time === '99:99') return time;

  const minutes = parseTimeToMinutes(time);

  // If time is in early morning (before 06:00), add 24 hours
  if (minutes < 360) {
    const hours = Math.floor(minutes / 60) + 24;
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  return time;
}

/**
 * Find the station with the most trains passing through from a given set of entries.
 */
export function findBestStation(
  entries: TimetableEntry[],
  stationOrder: string[]
): { stationId: string | null; count: number } {
  let bestStation: string | null = null;
  let bestCount = 0;

  for (const stationId of stationOrder) {
    const count = entries.filter((entry) => entry.times.has(stationId)).length;
    if (count > bestCount) {
      bestCount = count;
      bestStation = stationId;
    }
  }

  return { stationId: bestStation, count: bestCount };
}

/**
 * Find a common station between an entry and a list of already-sorted entries.
 * Returns the station and the sort time for the entry at that station.
 */
export function findCommonStationWithSorted(
  entry: TimetableEntry,
  sortedEntries: TimetableEntry[],
  stationOrder: string[]
): { stationId: string | null; sortTime: string } {
  // Find a station that both the entry and at least one sorted entry share
  for (const stationId of stationOrder) {
    if (entry.times.has(stationId)) {
      // Check if any sorted entry also has this station
      const hasCommon = sortedEntries.some((sorted) => sorted.times.has(stationId));
      if (hasCommon) {
        const timeData = entry.times.get(stationId)!;
        return {
          stationId,
          sortTime: timeData.departure || timeData.arrival || '99:99',
        };
      }
    }
  }
  return { stationId: null, sortTime: '99:99' };
}

/**
 * Find the BEST common station (most trains have it) between entry and sorted entries.
 * Unlike findCommonStationWithSorted which returns the first match, this finds
 * the station shared by the most sorted entries for better sorting accuracy.
 */
export function findBestCommonStationWithSorted(
  entry: TimetableEntry,
  sortedEntries: TimetableEntry[],
  stationOrder: string[]
): { stationId: string | null; sortTime: string } {
  let bestStation: string | null = null;
  let bestCount = 0;
  let bestSortTime = '99:99';

  for (const stationId of stationOrder) {
    if (entry.times.has(stationId)) {
      const count = sortedEntries.filter((sorted) => sorted.times.has(stationId)).length;
      if (count > bestCount) {
        bestCount = count;
        bestStation = stationId;
        const timeData = entry.times.get(stationId)!;
        bestSortTime = timeData.departure || timeData.arrival || '99:99';
      }
    }
  }

  return { stationId: bestStation, sortTime: bestSortTime };
}

/**
 * Get the first departure/arrival time for an entry within the given station order.
 * If firstStationIdx is not set, calculates it on-the-fly.
 */
function getFirstStationTime(entry: TimetableEntry, stationOrder: string[]): string {
  let firstIdx = entry.firstStationIdx;

  // If firstStationIdx is not set, calculate it
  if (firstIdx < 0) {
    for (let i = 0; i < stationOrder.length; i++) {
      if (entry.times.has(stationOrder[i])) {
        firstIdx = i;
        break;
      }
    }
  }

  if (firstIdx < 0 || firstIdx >= stationOrder.length) {
    return '99:99';
  }
  const firstStation = stationOrder[firstIdx];
  const time = entry.times.get(firstStation);
  return time?.departure || time?.arrival || '99:99';
}

/**
 * Get the sort time for an entry at a specific station.
 */
export function getTimeAtStation(entry: TimetableEntry, stationId: string): string {
  const timeData = entry.times.get(stationId);
  if (timeData) {
    return timeData.departure || timeData.arrival || '99:99';
  }
  return '99:99';
}

/**
 * Find the first common station between two entries, following station order.
 */
function findPairwiseCommonStation(
  entry1: TimetableEntry,
  entry2: TimetableEntry,
  stationOrder: string[]
): string | null {
  for (const stationId of stationOrder) {
    if (entry1.times.has(stationId) && entry2.times.has(stationId)) {
      return stationId;
    }
  }
  return null;
}

/**
 * Find the correct position to insert an entry into the sorted list.
 * Uses pairwise common station comparison when available, falls back to first station time.
 */
function findInsertPosition(
  entry: TimetableEntry,
  sorted: TimetableEntry[],
  stationOrder: string[],
  overnightMap: Map<string, boolean>
): number {
  if (sorted.length === 0) return 0;

  const entryIsOvernight = overnightMap.get(entry.trainNumber) || false;
  const entryFirstTime = getFirstStationTime(entry, stationOrder);
  const entryFirstTimePenalized = applyOvernightPenalty(entryFirstTime, entryIsOvernight);

  for (let j = 0; j < sorted.length; j++) {
    const sortedEntry = sorted[j];
    const sortedIsOvernight = overnightMap.get(sortedEntry.trainNumber) || false;

    // Find a station that BOTH this entry and the sorted entry have
    const pairCommonStation = findPairwiseCommonStation(entry, sortedEntry, stationOrder);

    if (pairCommonStation) {
      // Both have a common station - compare at that station
      const entryTime = getTimeAtStation(entry, pairCommonStation);
      const entryTimePenalized = applyOvernightPenalty(entryTime, entryIsOvernight);
      const sortedTime = getTimeAtStation(sortedEntry, pairCommonStation);
      const sortedTimePenalized = applyOvernightPenalty(sortedTime, sortedIsOvernight);

      if (compareTime(entryTimePenalized, sortedTimePenalized) <= 0) {
        return j;
      }
    } else {
      // No common station - compare first station times
      const sortedFirstTime = getFirstStationTime(sortedEntry, stationOrder);
      const sortedFirstTimePenalized = applyOvernightPenalty(sortedFirstTime, sortedIsOvernight);
      if (compareTime(entryFirstTimePenalized, sortedFirstTimePenalized) <= 0) {
        return j;
      }
    }
  }

  return sorted.length;
}

/**
 * Sort entries using a multi-pass holistic approach:
 * 1. Find station with most trains among unsorted, sort those by time at that station
 * 2. Merge sorted group into the result list at correct positions
 * 3. Repeat for remaining unsorted entries until no station has 2+ trains
 * 4. For remaining single entries, sort by first appearance time
 */
export function sortEntriesHolistically(
  entries: TimetableEntry[],
  timetables: Timetable[],
  stationOrder: string[]
): TimetableEntry[] {
  if (entries.length === 0) return [];
  if (entries.length === 1) return [...entries];

  // Create lookup maps
  const timetableMap = new Map(timetables.map((tt) => [tt.trainNumber, tt]));
  const overnightMap = new Map(timetables.map((tt) => [tt.trainNumber, isOvernightTrain(tt)]));

  const getSortTimeWithPenalty = (entry: TimetableEntry, stationId: string): string => {
    const time = getTimeAtStation(entry, stationId);
    return applyOvernightPenalty(time, overnightMap.get(entry.trainNumber) || false);
  };

  const sorted: TimetableEntry[] = [];
  let unsorted = [...entries];

  // PHASE 1: Multi-pass sorting by common stations
  // Keep finding "best station" among unsorted trains until none has 2+ trains
  while (unsorted.length > 0) {
    const { stationId, count } = findBestStation(unsorted, stationOrder);

    if (stationId && count > 1) {
      // Sort trains at this station
      const atStation = unsorted.filter((e) => e.times.has(stationId));
      const notAtStation = unsorted.filter((e) => !e.times.has(stationId));

      atStation.forEach((e) => {
        e.sortTime = getSortTimeWithPenalty(e, stationId);
      });
      atStation.sort((a, b) => compareTime(a.sortTime, b.sortTime));

      // Merge into sorted list at correct positions
      for (const entry of atStation) {
        const insertIdx = findInsertPosition(entry, sorted, stationOrder, overnightMap);
        sorted.splice(insertIdx, 0, entry);
      }

      unsorted = notAtStation;
    } else {
      // No station has 2+ trains - break to fallback phase
      break;
    }
  }

  // PHASE 2: Fallback - sort remaining by first appearance time
  if (unsorted.length > 0) {
    unsorted.forEach((e) => {
      const isOvernight = overnightMap.get(e.trainNumber) || false;
      const firstTime = getFirstStationTime(e, stationOrder);
      e.sortTime = applyOvernightPenalty(firstTime, isOvernight);
    });
    unsorted.sort((a, b) => compareTime(a.sortTime, b.sortTime));

    // Insert each into sorted list
    for (const entry of unsorted) {
      const insertIdx = findInsertPosition(entry, sorted, stationOrder, overnightMap);
      sorted.splice(insertIdx, 0, entry);
    }
  }

  // Reset sortTime to first departure for consistency
  sorted.forEach((entry) => {
    const tt = timetableMap.get(entry.trainNumber);
    entry.sortTime = tt ? getFirstDepartureTime(tt) : '99:99';
  });

  return sorted;
}

/**
 * Build timetable entries from timetables and variants.
 * Entries are sorted using a holistic approach that handles overlapping train groups.
 */
export function buildTimetableEntries(
  timetables: Timetable[],
  variants: Variant[],
  stationOrder: string[]
): TimetableEntry[] {
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  // Build entries with times (first pass)
  const entries: TimetableEntry[] = timetables.map((tt) => {
    const variant = variantMap.get(tt.variantId);
    const times = new Map<string, { arrival: string | null; departure: string | null }>();

    tt.departures.forEach((dep) => {
      times.set(dep.stationId, { arrival: dep.arrival, departure: dep.departure });
    });

    return {
      trainNumber: tt.trainNumber,
      variantCode: variant?.code || '',
      times,
      sortTime: '99:99', // Will be set during sorting
      firstStationIdx: -1,
      lastStationIdx: -1,
      operatingDays: tt.operatingDays,
    };
  });

  // Calculate first and last station indices
  entries.forEach((entry) => {
    let first = -1;
    let last = -1;
    stationOrder.forEach((stationId, idx) => {
      if (entry.times.has(stationId)) {
        if (first === -1) first = idx;
        last = idx;
      }
    });
    entry.firstStationIdx = first;
    entry.lastStationIdx = last;
  });

  // Sort using holistic approach
  return sortEntriesHolistically(entries, timetables, stationOrder);
}

/**
 * Main function: build complete timetable data from variants and timetables.
 */
export function buildTimetableData(
  variants: Variant[],
  timetables: Timetable[]
): BuildTimetableResult {
  const stationOrder = buildStationOrder(variants);
  const entries = buildTimetableEntries(timetables, variants, stationOrder);

  return {
    stationOrder,
    entries,
  };
}
