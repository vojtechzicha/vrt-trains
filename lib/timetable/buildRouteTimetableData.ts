import { RouteCorridor, RoutePath, RoutePathStop, Variant, Timetable, Station, Line, Direction } from '@/types';
import { compareTime } from '@/lib/utils';
import {
  TimetableEntry,
  canInsertAt,
  getFirstDepartureTime,
  isOvernightTrain,
  applyOvernightPenalty,
  getTimeAtStation,
  findBestStation,
  findBestCommonStationWithSorted,
} from './buildTimetableData';

/**
 * Extended timetable entry with route-specific continuation info.
 */
export interface RouteTimetableEntry extends TimetableEntry {
  lineId: string;
  lineIdentifier: string;
  lineColor: string;
  lineTextColor: string;
  originStationId?: string;
  originStationName?: string;
  destinationStationId?: string;
  destinationStationName?: string;
  entersFromOutside: boolean;
  continuesBeyond: boolean;
  routeDirection: Direction;  // Direction this train travels on this route
}

export interface BuildRouteTimetableResult {
  stationOrder: string[];
  outboundEntries: RouteTimetableEntry[];
  inboundEntries: RouteTimetableEntry[];
}

/**
 * Build ordering constraints from route paths.
 * If a path has stops A -> B -> C, then A must come before B and C, B must come before C.
 */
export function buildPathOrderingConstraints(paths: RoutePath[]): Map<string, Set<string>> {
  const mustComeBefore = new Map<string, Set<string>>();

  for (const path of paths) {
    const sortedStops = [...path.stops].sort((a, b) => a.sequence - b.sequence);
    for (let i = 0; i < sortedStops.length; i++) {
      const stationId = sortedStops[i].stationId;
      if (!mustComeBefore.has(stationId)) {
        mustComeBefore.set(stationId, new Set());
      }
      for (let j = i + 1; j < sortedStops.length; j++) {
        mustComeBefore.get(stationId)!.add(sortedStops[j].stationId);
      }
    }
  }

  return mustComeBefore;
}

/**
 * Find insertion index for a station based on adjacent stations in the path.
 */
function findInsertionIndex(
  stationId: string,
  idx: number,
  pathStops: RoutePathStop[],
  orderedStationIds: string[],
  mustComeBefore: Map<string, Set<string>>
): number {
  // Find insertion position based on previous stations
  let insertIndex = -1;

  for (let i = idx - 1; i >= 0; i--) {
    const prevStationId = pathStops[i].stationId;
    const prevIndex = orderedStationIds.indexOf(prevStationId);
    if (prevIndex !== -1) {
      insertIndex = prevIndex + 1;
      break;
    }
  }

  // If no previous found, try next stations
  if (insertIndex === -1) {
    for (let i = idx + 1; i < pathStops.length; i++) {
      const nextStationId = pathStops[i].stationId;
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

  return insertIndex;
}

/**
 * Build merged station order from all paths within a route corridor.
 * Uses the longest path as base, then inserts compatible stations from other paths.
 */
export function buildRoutePathStationOrder(paths: RoutePath[]): string[] {
  if (paths.length === 0) return [];

  const mustComeBefore = buildPathOrderingConstraints(paths);

  // Find the longest path
  const longestPath = paths.reduce(
    (longest, current) => (current.stops.length > longest.stops.length ? current : longest),
    paths[0]
  );

  // Build ordered list from longest path
  const orderedStationIds: string[] = longestPath.stops
    .sort((a, b) => a.sequence - b.sequence)
    .map((stop) => stop.stationId);

  // Add stations from other paths
  for (const path of paths) {
    if (path.id === longestPath.id) continue;

    const pathStops = [...path.stops].sort((a, b) => a.sequence - b.sequence);

    for (let idx = 0; idx < pathStops.length; idx++) {
      const stop = pathStops[idx];
      if (orderedStationIds.includes(stop.stationId)) continue;

      const insertIndex = findInsertionIndex(
        stop.stationId,
        idx,
        pathStops,
        orderedStationIds,
        mustComeBefore
      );

      if (canInsertAt(stop.stationId, insertIndex, orderedStationIds, mustComeBefore)) {
        orderedStationIds.splice(insertIndex, 0, stop.stationId);
      }
    }
  }

  return orderedStationIds;
}

/**
 * Determine if a train enters from outside this route or continues beyond it.
 */
export function determineTrainContinuation(
  variant: Variant,
  routeStationIds: Set<string>,
  stationMap: Map<string, Station>
): {
  origin?: Station;
  destination?: Station;
  entersFromOutside: boolean;
  continuesBeyond: boolean;
} {
  const variantStops = [...variant.stations].sort((a, b) => a.sequence - b.sequence);

  if (variantStops.length === 0) {
    return { entersFromOutside: false, continuesBeyond: false };
  }

  // Find first and last stops within this route
  let firstRouteStopIdx = -1;
  let lastRouteStopIdx = -1;

  for (let i = 0; i < variantStops.length; i++) {
    if (routeStationIds.has(variantStops[i].stationId)) {
      if (firstRouteStopIdx === -1) firstRouteStopIdx = i;
      lastRouteStopIdx = i;
    }
  }

  // If no stops within route, the train doesn't use this route
  if (firstRouteStopIdx === -1) {
    return { entersFromOutside: false, continuesBeyond: false };
  }

  const entersFromOutside = firstRouteStopIdx > 0;
  const continuesBeyond = lastRouteStopIdx < variantStops.length - 1;

  // Get actual origin (first stop of variant)
  const origin = entersFromOutside
    ? stationMap.get(variantStops[0].stationId)
    : undefined;

  // Get actual destination (last stop of variant)
  const destination = continuesBeyond
    ? stationMap.get(variantStops[variantStops.length - 1].stationId)
    : undefined;

  return { origin, destination, entersFromOutside, continuesBeyond };
}

/**
 * Get the first departure/arrival time for an entry on this route.
 * If firstStationIdx is not set, calculates it on-the-fly.
 */
function getFirstRouteTime(entry: RouteTimetableEntry, stationOrder: string[]): string {
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
 * Find the correct position to insert an entry into the sorted list.
 * Uses best common station comparison when available, falls back to first route time.
 */
/**
 * Find the first common station between two entries, following station order.
 */
function findPairwiseCommonStation(
  entry1: RouteTimetableEntry,
  entry2: RouteTimetableEntry,
  stationOrder: string[]
): string | null {
  for (const stationId of stationOrder) {
    if (entry1.times.has(stationId) && entry2.times.has(stationId)) {
      return stationId;
    }
  }
  return null;
}

function findRouteInsertPosition(
  entry: RouteTimetableEntry,
  sorted: RouteTimetableEntry[],
  stationOrder: string[],
  overnightMap: Map<string, boolean>
): number {
  if (sorted.length === 0) return 0;

  const entryIsOvernight = overnightMap.get(entry.trainNumber) || false;
  const entryFirstTime = getFirstRouteTime(entry, stationOrder);
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
      // No common station - compare first route times
      const sortedFirstTime = getFirstRouteTime(sortedEntry, stationOrder);
      const sortedFirstTimePenalized = applyOvernightPenalty(sortedFirstTime, sortedIsOvernight);
      if (compareTime(entryFirstTimePenalized, sortedFirstTimePenalized) <= 0) {
        return j;
      }
    }
  }

  return sorted.length;
}

/**
 * Sort route timetable entries using a multi-pass holistic approach.
 * 1. Find station with most trains among unsorted, sort those by time at that station
 * 2. Merge sorted group into the result list at correct positions
 * 3. Repeat for remaining unsorted entries until no station has 2+ trains
 * 4. For remaining single entries, sort by first route appearance time
 */
function sortRouteEntriesHolistically(
  entries: RouteTimetableEntry[],
  timetables: Timetable[],
  stationOrder: string[]
): RouteTimetableEntry[] {
  if (entries.length === 0) return [];
  if (entries.length === 1) return [...entries];

  // Create maps for lookups
  const timetableMap = new Map(timetables.map((tt) => [tt.trainNumber, tt]));
  const overnightMap = new Map(timetables.map((tt) => [tt.trainNumber, isOvernightTrain(tt)]));

  const getSortTimeWithPenalty = (entry: RouteTimetableEntry, stationId: string): string => {
    const time = getTimeAtStation(entry, stationId);
    return applyOvernightPenalty(time, overnightMap.get(entry.trainNumber) || false);
  };

  const sorted: RouteTimetableEntry[] = [];
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
        const insertIdx = findRouteInsertPosition(entry, sorted, stationOrder, overnightMap);
        sorted.splice(insertIdx, 0, entry);
      }

      unsorted = notAtStation;
    } else {
      // No station has 2+ trains - break to fallback phase
      break;
    }
  }

  // PHASE 2: Fallback - sort remaining by first route appearance time
  if (unsorted.length > 0) {
    unsorted.forEach((e) => {
      const isOvernight = overnightMap.get(e.trainNumber) || false;
      const firstTime = getFirstRouteTime(e, stationOrder);
      e.sortTime = applyOvernightPenalty(firstTime, isOvernight);
    });
    unsorted.sort((a, b) => compareTime(a.sortTime, b.sortTime));

    // Insert each into sorted list
    for (const entry of unsorted) {
      const insertIdx = findRouteInsertPosition(entry, sorted, stationOrder, overnightMap);
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
 * Build timetable data for a specific route corridor.
 * Shows all trains using any path within the route, with origin/destination indicators
 * for trains that extend beyond this route.
 */
export function buildRouteTimetableData(
  route: RouteCorridor,
  variants: Variant[],
  timetables: Timetable[],
  stations: Station[],
  lines: Line[]
): BuildRouteTimetableResult {
  // Step 1: Build merged station order from all paths
  const stationOrder = buildRoutePathStationOrder(route.paths);
  const routeStationIds = new Set(stationOrder);

  // Create lookup maps
  const variantMap = new Map(variants.map((v) => [v.id, v]));
  const lineMap = new Map(lines.map((l) => [l.id, l]));
  const stationMap = new Map(stations.map((s) => [s.id, s]));

  // Step 2: Build entries with continuation info
  const entries: RouteTimetableEntry[] = timetables.map((tt) => {
    const variant = variantMap.get(tt.variantId);
    const line = variant ? lineMap.get(variant.lineId) : undefined;

    // Filter departures to only those within this route
    const routeDepartures = tt.departures.filter((d) => routeStationIds.has(d.stationId));

    // Build times map for route stations only
    const times = new Map<string, { arrival: string | null; departure: string | null }>();
    routeDepartures.forEach((dep) => {
      times.set(dep.stationId, { arrival: dep.arrival, departure: dep.departure });
    });

    // Determine continuation
    const { origin, destination, entersFromOutside, continuesBeyond } = variant
      ? determineTrainContinuation(variant, routeStationIds, stationMap)
      : { entersFromOutside: false, continuesBeyond: false };

    // Determine direction on this route from routeRefs
    const routeRef = variant?.routeRefs?.find((ref) => ref.routeId === route.id);
    const routeDirection: Direction = routeRef?.direction || 'outbound';

    return {
      trainNumber: tt.trainNumber,
      variantCode: variant?.code || '',
      lineId: line?.id || '',
      lineIdentifier: line?.identifier || '',
      lineColor: line?.color || '#gray',
      lineTextColor: line?.textColor || '#fff',
      times,
      sortTime: '99:99',
      firstStationIdx: -1,
      lastStationIdx: -1,
      operatingDays: tt.operatingDays,
      originStationId: origin?.id,
      originStationName: origin?.name,
      destinationStationId: destination?.id,
      destinationStationName: destination?.name,
      entersFromOutside,
      continuesBeyond,
      routeDirection,
    };
  });

  // Step 3: Calculate first and last station indices
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

  // Step 4: Filter out entries with no times in this route
  const validEntries = entries.filter((e) => e.times.size > 0);

  // Step 5: Split by direction and sort each group
  const outboundEntries = validEntries.filter((e) => e.routeDirection === 'outbound');
  const inboundEntries = validEntries.filter((e) => e.routeDirection === 'inbound');

  const sortedOutbound = sortRouteEntriesHolistically(outboundEntries, timetables, stationOrder);
  const sortedInbound = sortRouteEntriesHolistically(inboundEntries, timetables, stationOrder);

  return { stationOrder, outboundEntries: sortedOutbound, inboundEntries: sortedInbound };
}

/**
 * Calculate total distance for a route path.
 */
export function calculatePathDistance(path: RoutePath): number {
  if (path.stops.length === 0) return 0;
  const sortedStops = [...path.stops].sort((a, b) => a.sequence - b.sequence);
  return sortedStops[sortedStops.length - 1].distanceKm;
}

/**
 * Calculate total travel time for a route path (excluding dwell times).
 * Uses VRT time with fallback to fast/slow.
 */
export function calculatePathTime(path: RoutePath): number {
  return path.stops.reduce((sum, stop) => {
    const time = stop.vrtTime ?? stop.fastTime ?? stop.slowTime ?? 0;
    return sum + time;
  }, 0);
}

/**
 * Get endpoint stations for a route corridor.
 */
export function getRouteEndpoints(
  route: RouteCorridor,
  stationMap: Map<string, Station>
): { from: Station | undefined; to: Station | undefined } {
  if (route.paths.length === 0) {
    return { from: undefined, to: undefined };
  }

  // Use the first path as reference
  const path = route.paths[0];
  const sortedStops = [...path.stops].sort((a, b) => a.sequence - b.sequence);

  if (sortedStops.length === 0) {
    return { from: undefined, to: undefined };
  }

  return {
    from: stationMap.get(sortedStops[0].stationId),
    to: stationMap.get(sortedStops[sortedStops.length - 1].stationId),
  };
}
