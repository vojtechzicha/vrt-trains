import {
  SpeedCategory,
  RoutePathStop,
  ReverseTimeAdjustment,
  RouteCorridor,
  RoutePath,
  VariantRouteRef,
  VariantStop,
  CalculatedVariantStop,
} from '@/types';

/**
 * Priority order for time lookup based on speed category
 */
const SPEED_PRIORITY: Record<SpeedCategory, SpeedCategory[]> = {
  vrt: ['vrt', 'fast', 'slow'],
  fast: ['fast', 'slow', 'vrt'],
  slow: ['slow', 'fast', 'vrt'],
};

/**
 * Get travel time for a route stop based on speed category with fallback priority.
 * Priority order:
 *   VRT: vrt → fast → slow
 *   Fast: fast → slow → vrt
 *   Slow: slow → fast → vrt
 */
export function getSegmentTime(
  stop: RoutePathStop,
  speedCategory: SpeedCategory,
  reverseAdjustment?: ReverseTimeAdjustment
): number {
  const priorities = SPEED_PRIORITY[speedCategory];

  // Use reverse adjustment times if provided, otherwise use stop times
  const source = reverseAdjustment ?? stop;

  // Try each priority in order until we find a valid time
  for (const speed of priorities) {
    const time = getTimeForSpeed(source, speed);
    if (time !== undefined && time !== null && time >= 0) {
      return time;
    }
  }

  // Final fallback: try stop directly if source was a reverse adjustment
  if (reverseAdjustment) {
    for (const speed of priorities) {
      const time = getTimeForSpeed(stop, speed);
      if (time !== undefined && time !== null && time >= 0) {
        return time;
      }
    }
  }

  return 0;
}

/**
 * Helper to get time value for a specific speed category
 */
function getTimeForSpeed(
  source: RoutePathStop | ReverseTimeAdjustment,
  speed: SpeedCategory
): number | undefined {
  if (speed === 'vrt') {
    return (source as RoutePathStop).vrtTime;
  } else if (speed === 'fast') {
    return (source as RoutePathStop).fastTime;
  } else {
    return (source as RoutePathStop).slowTime;
  }
}

/**
 * Build a lookup map for cumulative times from route start
 * Returns: Map<stationId, cumulativeTimeFromRouteStart>
 * This allows calculating travel time between any two stations by subtraction
 */
export function buildCumulativeTimeLookup(
  routeRefs: VariantRouteRef[],
  routes: RouteCorridor[]
): Map<string, number> {
  const routeMap = new Map(routes.map((r) => [r.id, r]));
  const lookup = new Map<string, number>();
  let cumulativeTime = 0;

  for (const ref of routeRefs) {
    const route = routeMap.get(ref.routeId);
    if (!route) continue;

    const path = route.paths.find((p) => p.id === ref.pathId);
    if (!path) continue;

    // Get stops in order
    let stops = [...path.stops].sort((a, b) => a.sequence - b.sequence);
    const reversed = ref.direction === 'inbound';

    if (reversed) {
      stops = [...stops].reverse();
    }

    // Apply start/end subset if specified
    let startIdx = 0;
    let endIdx = stops.length - 1;

    if (ref.startStationId) {
      const idx = stops.findIndex((s) => s.stationId === ref.startStationId);
      if (idx !== -1) startIdx = idx;
    }
    if (ref.endStationId) {
      const idx = stops.findIndex((s) => s.stationId === ref.endStationId);
      if (idx !== -1) endIdx = idx;
    }

    stops = stops.slice(startIdx, endIdx + 1);

    // Build cumulative times for each stop
    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];

      // Skip junction stations (already have cumulative time from previous segment)
      if (lookup.has(stop.stationId)) {
        // Update cumulative time to match the junction's time
        cumulativeTime = lookup.get(stop.stationId)!;
        continue;
      }

      if (i === 0) {
        // First stop of first segment
        lookup.set(stop.stationId, cumulativeTime);
      } else {
        // Get reverse adjustment if applicable
        const reverseAdj = reversed
          ? path.reverseTimeAdjustments?.find((adj) => adj.stationId === stop.stationId)
          : undefined;

        // For reversed paths, the travel time to stops[i] is stored on stops[i-1]
        const timeSource = reversed ? stops[i - 1] : stop;

        let segmentTime: number;
        if (reverseAdj) {
          segmentTime = getSegmentTime(stop, ref.speedCategory, reverseAdj);
        } else {
          segmentTime = getSegmentTime(timeSource, ref.speedCategory);
        }

        cumulativeTime += segmentTime;
        lookup.set(stop.stationId, cumulativeTime);
      }
    }
  }

  return lookup;
}

/**
 * Build a lookup map for segment times from variant route refs
 * Returns: Map<stationId, travelTimeFromPrevious>
 */
export function buildSegmentTimeLookup(
  routeRefs: VariantRouteRef[],
  routes: RouteCorridor[]
): Map<string, number> {
  const routeMap = new Map(routes.map((r) => [r.id, r]));
  const lookup = new Map<string, number>();

  for (const ref of routeRefs) {
    const route = routeMap.get(ref.routeId);
    if (!route) continue;

    const path = route.paths.find((p) => p.id === ref.pathId);
    if (!path) continue;

    // Get stops in order
    let stops = [...path.stops].sort((a, b) => a.sequence - b.sequence);
    const reversed = ref.direction === 'inbound';

    if (reversed) {
      stops = [...stops].reverse();
    }

    // Apply start/end subset if specified
    let startIdx = 0;
    let endIdx = stops.length - 1;

    if (ref.startStationId) {
      const idx = stops.findIndex((s) => s.stationId === ref.startStationId);
      if (idx !== -1) startIdx = idx;
    }
    if (ref.endStationId) {
      const idx = stops.findIndex((s) => s.stationId === ref.endStationId);
      if (idx !== -1) endIdx = idx;
    }

    stops = stops.slice(startIdx, endIdx + 1);

    // Build lookup for each stop
    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];

      if (i === 0) {
        // First stop in segment - only set to 0 if not already in lookup
        // (junction stations already have a travel time from previous segment)
        if (!lookup.has(stop.stationId)) {
          lookup.set(stop.stationId, 0);
        }
      } else {
        // Get reverse adjustment if applicable
        const reverseAdj = reversed
          ? path.reverseTimeAdjustments?.find((adj) => adj.stationId === stop.stationId)
          : undefined;

        // For reversed paths, the travel time to stops[i] is stored on stops[i-1]
        // (because times are stored as "time from previous station in FORWARD direction")
        // Example: Forward A->B->C has B.time=10 (A to B), C.time=5 (B to C)
        // Reversed C->B->A: time to B is C.time=5, time to A is B.time=10
        const timeSource = reversed ? stops[i - 1] : stop;

        let time: number;
        if (reverseAdj) {
          // Use reverse adjustment if available (overrides calculated time)
          time = getSegmentTime(stop, ref.speedCategory, reverseAdj);
        } else {
          time = getSegmentTime(timeSource, ref.speedCategory);
        }
        lookup.set(stop.stationId, time);
      }
    }
  }

  return lookup;
}

/**
 * Calculate arrival and departure times for a variant on-the-fly from route data
 * Supports skipped intermediate stations - travel time is summed automatically
 */
export function calculateVariantTimes(
  variantStops: VariantStop[],
  routeRefs: VariantRouteRef[],
  routes: RouteCorridor[]
): CalculatedVariantStop[] {
  // Build cumulative time lookup from route refs
  // This gives us the total time from route start to each station
  const cumulativeTimes = buildCumulativeTimeLookup(routeRefs, routes);

  let variantCumulativeTime = 0;

  return variantStops.map((stop, index) => {
    const isFirst = index === 0;
    const isLast = index === variantStops.length - 1;

    // Calculate travel time from previous variant stop
    // By using cumulative times, we automatically sum intermediate stations
    let travelTime = 0;
    if (!isFirst) {
      const prevStop = variantStops[index - 1];
      const prevCumulative = cumulativeTimes.get(prevStop.stationId) ?? 0;
      const currCumulative = cumulativeTimes.get(stop.stationId) ?? 0;
      travelTime = currCumulative - prevCumulative;
    }

    if (!isFirst) {
      variantCumulativeTime += travelTime;
    }

    const arrivalOffset = isFirst ? null : variantCumulativeTime;

    // Add dwell time for departure (except last stop)
    const departureOffset = isLast ? null : variantCumulativeTime + stop.dwellTime;

    if (!isLast) {
      variantCumulativeTime += stop.dwellTime;
    }

    return {
      ...stop,
      arrivalOffset,
      departureOffset,
      travelTimeFromPrevious: travelTime,
    };
  });
}

/**
 * Get total journey time for a variant (arrival at last station)
 */
export function getVariantJourneyTime(
  variantStops: VariantStop[],
  routeRefs: VariantRouteRef[],
  routes: RouteCorridor[]
): number {
  const calculatedStops = calculateVariantTimes(variantStops, routeRefs, routes);
  const lastStop = calculatedStops[calculatedStops.length - 1];
  return lastStop?.arrivalOffset ?? 0;
}

/**
 * Extract station order from route refs (used when creating variants)
 */
export function getStationsFromRouteRefs(
  routeRefs: VariantRouteRef[],
  routes: RouteCorridor[]
): { stationId: string; travelTime: number; dwellTime: number }[] {
  const routeMap = new Map(routes.map((r) => [r.id, r]));
  const result: { stationId: string; travelTime: number; dwellTime: number }[] = [];
  const seenStations = new Set<string>();

  for (const ref of routeRefs) {
    const route = routeMap.get(ref.routeId);
    if (!route) continue;

    const path = route.paths.find((p) => p.id === ref.pathId);
    if (!path) continue;

    // Get stops in order
    let stops = [...path.stops].sort((a, b) => a.sequence - b.sequence);
    const reversed = ref.direction === 'inbound';

    if (reversed) {
      stops = [...stops].reverse();
    }

    // Apply start/end subset
    let startIdx = 0;
    let endIdx = stops.length - 1;

    if (ref.startStationId) {
      const idx = stops.findIndex((s) => s.stationId === ref.startStationId);
      if (idx !== -1) startIdx = idx;
    }
    if (ref.endStationId) {
      const idx = stops.findIndex((s) => s.stationId === ref.endStationId);
      if (idx !== -1) endIdx = idx;
    }

    stops = stops.slice(startIdx, endIdx + 1);

    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];

      // Skip junction duplicates (station already in result from previous segment)
      if (seenStations.has(stop.stationId)) {
        continue;
      }
      seenStations.add(stop.stationId);

      // Get travel time with speed category priority
      const reverseAdj = reversed
        ? path.reverseTimeAdjustments?.find((adj) => adj.stationId === stop.stationId)
        : undefined;

      const travelTime = i === 0 && result.length === 0
        ? 0  // First station overall
        : getSegmentTime(stop, ref.speedCategory, reverseAdj);

      result.push({
        stationId: stop.stationId,
        travelTime,
        dwellTime: stop.defaultDwellTime,
      });
    }
  }

  return result;
}

/**
 * Calculate total path time for a route path with a specific speed category
 */
export function calculatePathTime(path: RoutePath, speedCategory: SpeedCategory = 'vrt'): number {
  return path.stops.reduce((sum, stop) => {
    return sum + getSegmentTime(stop, speedCategory);
  }, 0);
}

/**
 * Calculate total path distance
 */
export function calculatePathDistance(path: RoutePath): number {
  const lastStop = path.stops[path.stops.length - 1];
  return lastStop?.distanceKm ?? 0;
}
