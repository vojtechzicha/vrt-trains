import {
  LineSchedule,
  OperatingPattern,
  Variant,
  ShortTurnSuggestion,
  ServicePeriod,
  RouteCorridor,
  CalculatedVariantStop,
} from '@/types';
import { calculateVariantTimes } from '@/lib/routeTimes';

interface AnalysisContext {
  schedule: LineSchedule;
  pattern: OperatingPattern;
  outboundVariant: Variant;
  inboundVariant: Variant;
  routes: RouteCorridor[];
  outboundCalculatedStops: CalculatedVariantStop[];
  inboundCalculatedStops: CalculatedVariantStop[];
}

/**
 * Parse a time string (HH:MM) to minutes from midnight
 */
function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

/**
 * Format minutes from midnight to HH:MM string
 */
function minutesToTime(minutes: number): string {
  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalizedMinutes / 60);
  const mins = normalizedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Get the journey time from one station to another using calculated stops
 */
function getJourneyTime(
  calculatedStops: CalculatedVariantStop[],
  fromStationId: string,
  toStationId: string
): number | null {
  const fromStop = calculatedStops.find((s) => s.stationId === fromStationId);
  const toStop = calculatedStops.find((s) => s.stationId === toStationId);

  if (!fromStop || !toStop) return null;

  const fromOffset = fromStop.departureOffset ?? fromStop.arrivalOffset ?? 0;
  const toOffset = toStop.departureOffset ?? toStop.arrivalOffset ?? 0;

  return toOffset - fromOffset;
}

/**
 * Get the first station ID of a variant
 */
function getOriginStationId(variant: Variant): string {
  return variant.stations[0]?.stationId;
}

/**
 * Get the last station ID of a variant
 */
function getTerminusStationId(variant: Variant): string {
  return variant.stations[variant.stations.length - 1]?.stationId;
}

/**
 * Get the interval for a period
 */
function getIntervalForPeriod(period: ServicePeriod): number {
  return period.intervalMinutes;
}

/**
 * Get first departure time of a period (at the anchor station)
 */
function getFirstAnchorTime(period: ServicePeriod, anchorMinute: number): number {
  const periodStartMinutes = timeToMinutes(period.startTime);
  // First anchor departure is at the start hour + anchor minute
  const startHour = Math.floor(periodStartMinutes / 60);
  return startHour * 60 + anchorMinute;
}

/**
 * Calculate what time a train needs to depart from origin to reach anchor at the specified time
 */
function calculateOriginDeparture(
  anchorTime: number,
  calculatedStops: CalculatedVariantStop[],
  anchorStationId: string
): number {
  const originId = calculatedStops[0]?.stationId;
  if (!originId) return anchorTime;
  const journeyTime = getJourneyTime(calculatedStops, originId, anchorStationId);
  if (journeyTime === null) return anchorTime; // Fallback
  return anchorTime - journeyTime;
}

/**
 * Check if a departure time is reasonable (e.g., not before 3:00 AM)
 */
function isReasonableDepartureTime(minutes: number): boolean {
  // Consider times before 3:00 AM as too early
  return minutes >= 180; // 03:00
}

/**
 * Analyze short-turn needs for morning service (outbound)
 */
function analyzeMorningOutbound(
  ctx: AnalysisContext
): ShortTurnSuggestion | null {
  const { schedule, pattern, outboundVariant, outboundCalculatedStops } = ctx;
  const { anchorStationId, outboundAnchorMinute, shortTurnConfig } = schedule;

  if (!shortTurnConfig?.startingStations?.length) return null;

  // Get the first period
  const firstPeriod = pattern.periods[0];
  if (!firstPeriod) return null;

  // Calculate first anchor time
  const firstAnchorTime = getFirstAnchorTime(firstPeriod, outboundAnchorMinute);

  // Calculate when full variant needs to depart from origin
  const fullVariantDeparture = calculateOriginDeparture(
    firstAnchorTime,
    outboundCalculatedStops,
    anchorStationId
  );

  // If full variant departure is reasonable, no short-turn needed
  if (isReasonableDepartureTime(fullVariantDeparture)) {
    return null;
  }

  // Find the best starting station that can provide earlier coverage
  let bestStation: string | null = null;
  let bestDeparture = fullVariantDeparture;
  let firstReasonableFullTrainTime = firstAnchorTime;

  for (const startStationId of shortTurnConfig.startingStations) {
    const journeyToAnchor = getJourneyTime(outboundCalculatedStops, startStationId, anchorStationId);
    if (journeyToAnchor === null) continue;

    const requiredDeparture = firstAnchorTime - journeyToAnchor;
    if (isReasonableDepartureTime(requiredDeparture) && requiredDeparture > bestDeparture) {
      bestStation = startStationId;
      bestDeparture = requiredDeparture;
    }
  }

  if (!bestStation) return null;

  // Calculate how many trains are needed before full variant can take over
  const interval = getIntervalForPeriod(firstPeriod);
  let trainsNeeded = 0;
  let currentAnchorTime = firstAnchorTime;

  while (!isReasonableDepartureTime(calculateOriginDeparture(currentAnchorTime, outboundCalculatedStops, anchorStationId))) {
    trainsNeeded++;
    currentAnchorTime += interval;
    if (trainsNeeded > 10) break; // Safety limit
  }

  firstReasonableFullTrainTime = currentAnchorTime;

  const terminusId = getTerminusStationId(outboundVariant);

  return {
    direction: 'outbound',
    startStationId: bestStation,
    endStationId: terminusId,
    purpose: 'morning-starter',
    trainsNeeded,
    timeRange: {
      start: minutesToTime(firstAnchorTime),
      end: minutesToTime(firstReasonableFullTrainTime - interval),
    },
    suggestedCode: `${schedule.trainNumberPrefix}-am`,
    suggestedName: `${schedule.name} Morning`,
  };
}

/**
 * Analyze short-turn needs for morning service (inbound)
 */
function analyzeMorningInbound(
  ctx: AnalysisContext
): ShortTurnSuggestion | null {
  const { schedule, pattern, inboundVariant, inboundCalculatedStops } = ctx;
  const { anchorStationId, inboundAnchorMinute, shortTurnConfig } = schedule;

  if (!shortTurnConfig?.startingStations?.length) return null;

  // For inbound, "starting stations" are stations where inbound trains can start
  // which would be stations towards the "end" of the outbound route
  const firstPeriod = pattern.periods[0];
  if (!firstPeriod) return null;

  const firstAnchorTime = getFirstAnchorTime(firstPeriod, inboundAnchorMinute);
  const fullVariantDeparture = calculateOriginDeparture(
    firstAnchorTime,
    inboundCalculatedStops,
    anchorStationId
  );

  if (isReasonableDepartureTime(fullVariantDeparture)) {
    return null;
  }

  // For inbound, starting stations need to be ones that are on the inbound variant
  let bestStation: string | null = null;
  let bestDeparture = fullVariantDeparture;

  for (const startStationId of shortTurnConfig.startingStations) {
    // Check if this station is on the inbound variant
    const stationOnInbound = inboundVariant.stations.find(s => s.stationId === startStationId);
    if (!stationOnInbound) continue;

    const journeyToAnchor = getJourneyTime(inboundCalculatedStops, startStationId, anchorStationId);
    if (journeyToAnchor === null) continue;

    const requiredDeparture = firstAnchorTime - journeyToAnchor;
    if (isReasonableDepartureTime(requiredDeparture) && requiredDeparture > bestDeparture) {
      bestStation = startStationId;
      bestDeparture = requiredDeparture;
    }
  }

  if (!bestStation) return null;

  const interval = getIntervalForPeriod(firstPeriod);
  let trainsNeeded = 0;
  let currentAnchorTime = firstAnchorTime;

  while (!isReasonableDepartureTime(calculateOriginDeparture(currentAnchorTime, inboundCalculatedStops, anchorStationId))) {
    trainsNeeded++;
    currentAnchorTime += interval;
    if (trainsNeeded > 10) break;
  }

  const terminusId = getTerminusStationId(inboundVariant);

  return {
    direction: 'inbound',
    startStationId: bestStation,
    endStationId: terminusId,
    purpose: 'morning-starter',
    trainsNeeded,
    timeRange: {
      start: minutesToTime(firstAnchorTime),
      end: minutesToTime(currentAnchorTime - interval),
    },
    suggestedCode: `${schedule.trainNumberPrefix}-am-r`,
    suggestedName: `${schedule.name} Morning Rev`,
  };
}

/**
 * Analyze short-turn needs for evening service (outbound)
 */
function analyzeEveningOutbound(
  ctx: AnalysisContext
): ShortTurnSuggestion | null {
  const { schedule, pattern, outboundVariant, outboundCalculatedStops } = ctx;
  const { anchorStationId, outboundAnchorMinute, shortTurnConfig } = schedule;

  if (!shortTurnConfig?.endingStations?.length) return null;

  // Get the last period
  const lastPeriod = pattern.periods[pattern.periods.length - 1];
  if (!lastPeriod) return null;

  // Calculate last anchor time in the period
  const periodEndMinutes = timeToMinutes(lastPeriod.endTime);
  const interval = getIntervalForPeriod(lastPeriod);
  const endHour = Math.floor(periodEndMinutes / 60);
  let lastAnchorTime = endHour * 60 + outboundAnchorMinute;

  // Adjust if past end time
  while (lastAnchorTime >= periodEndMinutes) {
    lastAnchorTime -= interval;
  }

  // Check if terminus arrival is too late
  const terminusId = getTerminusStationId(outboundVariant);
  const journeyToTerminus = getJourneyTime(outboundCalculatedStops, anchorStationId, terminusId);
  if (journeyToTerminus === null) return null;

  const terminusArrival = lastAnchorTime + journeyToTerminus;

  // If arriving before midnight-ish, no short-turn needed
  if (terminusArrival < 1440) { // Before midnight
    return null;
  }

  // Find best ending station
  let bestStation: string | null = null;
  let bestArrival = terminusArrival;

  for (const endStationId of shortTurnConfig.endingStations) {
    const journeyToEnd = getJourneyTime(outboundCalculatedStops, anchorStationId, endStationId);
    if (journeyToEnd === null) continue;

    const endArrival = lastAnchorTime + journeyToEnd;
    if (endArrival < 1440 && endArrival < bestArrival) {
      bestStation = endStationId;
      bestArrival = endArrival;
    }
  }

  if (!bestStation) return null;

  // Count trains that need short-turning
  let trainsNeeded = 0;
  let currentAnchorTime = lastAnchorTime;
  const periodStartMinutes = timeToMinutes(lastPeriod.startTime);
  const startHour = Math.floor(periodStartMinutes / 60);
  const firstAnchorInPeriod = startHour * 60 + outboundAnchorMinute;

  while (currentAnchorTime + journeyToTerminus >= 1440) {
    trainsNeeded++;
    currentAnchorTime -= interval;
    if (currentAnchorTime < firstAnchorInPeriod) break;
    if (trainsNeeded > 10) break;
  }

  const originId = getOriginStationId(outboundVariant);

  return {
    direction: 'outbound',
    startStationId: originId,
    endStationId: bestStation,
    purpose: 'evening-terminator',
    trainsNeeded,
    timeRange: {
      start: minutesToTime(currentAnchorTime + interval),
      end: minutesToTime(lastAnchorTime),
    },
    suggestedCode: `${schedule.trainNumberPrefix}-pm`,
    suggestedName: `${schedule.name} Evening`,
  };
}

/**
 * Analyze short-turn needs for evening service (inbound)
 */
function analyzeEveningInbound(
  ctx: AnalysisContext
): ShortTurnSuggestion | null {
  const { schedule, pattern, inboundVariant, inboundCalculatedStops } = ctx;
  const { anchorStationId, inboundAnchorMinute, shortTurnConfig } = schedule;

  if (!shortTurnConfig?.endingStations?.length) return null;

  const lastPeriod = pattern.periods[pattern.periods.length - 1];
  if (!lastPeriod) return null;

  const periodEndMinutes = timeToMinutes(lastPeriod.endTime);
  const interval = getIntervalForPeriod(lastPeriod);
  const endHour = Math.floor(periodEndMinutes / 60);
  let lastAnchorTime = endHour * 60 + inboundAnchorMinute;

  while (lastAnchorTime >= periodEndMinutes) {
    lastAnchorTime -= interval;
  }

  const terminusId = getTerminusStationId(inboundVariant);
  const journeyToTerminus = getJourneyTime(inboundCalculatedStops, anchorStationId, terminusId);
  if (journeyToTerminus === null) return null;

  const terminusArrival = lastAnchorTime + journeyToTerminus;

  if (terminusArrival < 1440) {
    return null;
  }

  let bestStation: string | null = null;
  let bestArrival = terminusArrival;

  for (const endStationId of shortTurnConfig.endingStations) {
    // Check if this station is on the inbound variant
    const stationOnInbound = inboundVariant.stations.find(s => s.stationId === endStationId);
    if (!stationOnInbound) continue;

    const journeyToEnd = getJourneyTime(inboundCalculatedStops, anchorStationId, endStationId);
    if (journeyToEnd === null) continue;

    const endArrival = lastAnchorTime + journeyToEnd;
    if (endArrival < 1440 && endArrival < bestArrival) {
      bestStation = endStationId;
      bestArrival = endArrival;
    }
  }

  if (!bestStation) return null;

  let trainsNeeded = 0;
  let currentAnchorTime = lastAnchorTime;
  const periodStartMinutes = timeToMinutes(lastPeriod.startTime);
  const startHour = Math.floor(periodStartMinutes / 60);
  const firstAnchorInPeriod = startHour * 60 + inboundAnchorMinute;

  while (currentAnchorTime + journeyToTerminus >= 1440) {
    trainsNeeded++;
    currentAnchorTime -= interval;
    if (currentAnchorTime < firstAnchorInPeriod) break;
    if (trainsNeeded > 10) break;
  }

  const originId = getOriginStationId(inboundVariant);

  return {
    direction: 'inbound',
    startStationId: originId,
    endStationId: bestStation,
    purpose: 'evening-terminator',
    trainsNeeded,
    timeRange: {
      start: minutesToTime(currentAnchorTime + interval),
      end: minutesToTime(lastAnchorTime),
    },
    suggestedCode: `${schedule.trainNumberPrefix}-pm-r`,
    suggestedName: `${schedule.name} Evening Rev`,
  };
}

/**
 * Main function to analyze all short-turn needs for a line schedule
 */
export function analyzeShortTurnNeeds(
  schedule: LineSchedule,
  pattern: OperatingPattern,
  outboundVariant: Variant,
  inboundVariant: Variant,
  routes: RouteCorridor[]
): ShortTurnSuggestion[] {
  // Pre-calculate variant times
  const outboundCalculatedStops = calculateVariantTimes(
    outboundVariant.stations,
    outboundVariant.routeRefs || [],
    routes
  );
  const inboundCalculatedStops = calculateVariantTimes(
    inboundVariant.stations,
    inboundVariant.routeRefs || [],
    routes
  );

  const ctx: AnalysisContext = {
    schedule,
    pattern,
    outboundVariant,
    inboundVariant,
    routes,
    outboundCalculatedStops,
    inboundCalculatedStops,
  };

  const suggestions: ShortTurnSuggestion[] = [];

  // Analyze morning needs
  const morningOutbound = analyzeMorningOutbound(ctx);
  if (morningOutbound) suggestions.push(morningOutbound);

  const morningInbound = analyzeMorningInbound(ctx);
  if (morningInbound) suggestions.push(morningInbound);

  // Analyze evening needs
  const eveningOutbound = analyzeEveningOutbound(ctx);
  if (eveningOutbound) suggestions.push(eveningOutbound);

  const eveningInbound = analyzeEveningInbound(ctx);
  if (eveningInbound) suggestions.push(eveningInbound);

  return suggestions;
}

/**
 * Get coverage information for the full variants
 */
export function getFullVariantCoverage(
  schedule: LineSchedule,
  pattern: OperatingPattern,
  outboundVariant: Variant,
  inboundVariant: Variant,
  routes: RouteCorridor[]
): {
  outbound: { firstAnchorTime: string; lastAnchorTime: string };
  inbound: { firstAnchorTime: string; lastAnchorTime: string };
} {
  const { anchorStationId, outboundAnchorMinute, inboundAnchorMinute } = schedule;

  // Pre-calculate variant times
  const outboundCalculatedStops = calculateVariantTimes(
    outboundVariant.stations,
    outboundVariant.routeRefs || [],
    routes
  );
  const inboundCalculatedStops = calculateVariantTimes(
    inboundVariant.stations,
    inboundVariant.routeRefs || [],
    routes
  );

  const firstPeriod = pattern.periods[0];
  const lastPeriod = pattern.periods[pattern.periods.length - 1];

  // Calculate first reasonable anchor time for outbound
  let firstOutboundAnchor = getFirstAnchorTime(firstPeriod, outboundAnchorMinute);
  const interval = getIntervalForPeriod(firstPeriod);

  while (!isReasonableDepartureTime(calculateOriginDeparture(firstOutboundAnchor, outboundCalculatedStops, anchorStationId))) {
    firstOutboundAnchor += interval;
  }

  // Calculate last anchor time for outbound
  const periodEndMinutes = timeToMinutes(lastPeriod.endTime);
  const endHour = Math.floor(periodEndMinutes / 60);
  let lastOutboundAnchor = endHour * 60 + outboundAnchorMinute;
  while (lastOutboundAnchor >= periodEndMinutes) {
    lastOutboundAnchor -= getIntervalForPeriod(lastPeriod);
  }

  // Same for inbound
  let firstInboundAnchor = getFirstAnchorTime(firstPeriod, inboundAnchorMinute);
  while (!isReasonableDepartureTime(calculateOriginDeparture(firstInboundAnchor, inboundCalculatedStops, anchorStationId))) {
    firstInboundAnchor += interval;
  }

  let lastInboundAnchor = endHour * 60 + inboundAnchorMinute;
  while (lastInboundAnchor >= periodEndMinutes) {
    lastInboundAnchor -= getIntervalForPeriod(lastPeriod);
  }

  return {
    outbound: {
      firstAnchorTime: minutesToTime(firstOutboundAnchor),
      lastAnchorTime: minutesToTime(lastOutboundAnchor),
    },
    inbound: {
      firstAnchorTime: minutesToTime(firstInboundAnchor),
      lastAnchorTime: minutesToTime(lastInboundAnchor),
    },
  };
}
