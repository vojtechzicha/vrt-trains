import {
  LineSchedule,
  OperatingPattern,
  Variant,
  Timetable,
  TimetableDeparture,
  ServicePeriod,
  Direction,
  RouteCorridor,
  CalculatedVariantStop,
} from '@/types';
import { generateId, addMinutesToTime } from '@/lib/data/helpers';
import { calculateCoreNumber, formatTrainNumber } from '@/lib/trainNumbers';
import { calculateVariantTimes } from '@/lib/routeTimes';

interface GenerationContext {
  schedule: LineSchedule;
  pattern: OperatingPattern;
  outboundVariant: Variant;
  inboundVariant: Variant;
  routes: RouteCorridor[];  // Routes for calculating times
  shortTurnVariants?: {
    outboundMorning?: Variant;
    inboundMorning?: Variant;
    outboundEvening?: Variant;
    inboundEvening?: Variant;
  };
}

interface DepartureSlot {
  anchorTime: number; // Minutes from midnight at anchor station
  periodIndex: number;
  isOffPeak: boolean;
  skipDueToReduction: boolean;
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
 * Check if a time is within an off-peak reduction window
 */
function isInOffPeakWindow(
  minutes: number,
  period: ServicePeriod
): boolean {
  if (!period.offPeakReduction) return false;

  const reductionStart = timeToMinutes(period.offPeakReduction.startTime);
  const reductionEnd = timeToMinutes(period.offPeakReduction.endTime);

  return minutes >= reductionStart && minutes < reductionEnd;
}

/**
 * Calculate all departure slots for a pattern at a given anchor minute
 */
function calculateDepartureSlots(
  pattern: OperatingPattern,
  anchorMinute: number
): DepartureSlot[] {
  const slots: DepartureSlot[] = [];
  let offPeakCounter = 0; // For skipping alternate trains

  for (let periodIndex = 0; periodIndex < pattern.periods.length; periodIndex++) {
    const period = pattern.periods[periodIndex];
    const periodStart = timeToMinutes(period.startTime);
    const periodEnd = timeToMinutes(period.endTime);
    const interval = period.intervalMinutes;

    // Start from the first hour of the period
    const startHour = Math.floor(periodStart / 60);
    let currentAnchorTime = startHour * 60 + anchorMinute;

    // Adjust if anchor time is before period start
    while (currentAnchorTime < periodStart) {
      currentAnchorTime += interval;
    }

    // Generate slots until we reach the period end
    while (currentAnchorTime < periodEnd) {
      const isOffPeak = isInOffPeakWindow(currentAnchorTime, period);

      // Skip alternate trains during off-peak if reduction is active
      let skipDueToReduction = false;
      if (isOffPeak) {
        if (offPeakCounter % 2 === 1) {
          skipDueToReduction = true;
        }
        offPeakCounter++;
      } else {
        offPeakCounter = 0; // Reset counter when leaving off-peak
      }

      slots.push({
        anchorTime: currentAnchorTime,
        periodIndex,
        isOffPeak,
        skipDueToReduction,
      });

      currentAnchorTime += interval;
    }
  }

  return slots;
}

/**
 * Get the journey time from origin to anchor station for a variant
 * Uses calculated stops with offsets
 */
function getJourneyTimeToAnchor(
  calculatedStops: CalculatedVariantStop[],
  anchorStationId: string
): number {
  const anchorStop = calculatedStops.find((s) => s.stationId === anchorStationId);
  if (!anchorStop) return 0;
  return anchorStop.departureOffset ?? anchorStop.arrivalOffset ?? 0;
}

/**
 * Check if a departure time is reasonable (not before 3:00 AM)
 */
function isReasonableDepartureTime(minutes: number): boolean {
  return minutes >= 180; // 03:00
}

/**
 * Determine which variant to use for a given departure slot
 * Uses calculated stops for the primary variant
 */
function selectVariantForSlot(
  slot: DepartureSlot,
  direction: Direction,
  ctx: GenerationContext,
  anchorMinute: number,
  primaryCalculatedStops: CalculatedVariantStop[]
): { variant: Variant; calculatedStops: CalculatedVariantStop[]; isShortTurn: boolean } {
  const { outboundVariant, inboundVariant, shortTurnVariants, schedule, routes } = ctx;
  const primaryVariant = direction === 'outbound' ? outboundVariant : inboundVariant;

  // Calculate origin departure time for full variant
  const journeyToAnchor = getJourneyTimeToAnchor(primaryCalculatedStops, schedule.anchorStationId);
  const originDeparture = slot.anchorTime - journeyToAnchor;

  // Check if we need a morning short-turn
  if (!isReasonableDepartureTime(originDeparture)) {
    const shortTurn = direction === 'outbound'
      ? shortTurnVariants?.outboundMorning
      : shortTurnVariants?.inboundMorning;

    if (shortTurn) {
      const shortCalculatedStops = calculateVariantTimes(shortTurn.stations, shortTurn.routeRefs || [], routes);
      return { variant: shortTurn, calculatedStops: shortCalculatedStops, isShortTurn: true };
    }
  }

  // Check if we need an evening short-turn (arrival after midnight)
  const terminusStop = primaryCalculatedStops[primaryCalculatedStops.length - 1];
  const terminusArrival = slot.anchorTime + (terminusStop?.arrivalOffset ?? 0) - journeyToAnchor;

  if (terminusArrival >= 1440) { // After midnight
    const shortTurn = direction === 'outbound'
      ? shortTurnVariants?.outboundEvening
      : shortTurnVariants?.inboundEvening;

    if (shortTurn) {
      const shortCalculatedStops = calculateVariantTimes(shortTurn.stations, shortTurn.routeRefs || [], routes);
      return { variant: shortTurn, calculatedStops: shortCalculatedStops, isShortTurn: true };
    }
  }

  return { variant: primaryVariant, calculatedStops: primaryCalculatedStops, isShortTurn: false };
}

/**
 * Generate timetable departures using calculated stops given a first departure time
 * Pass-through stations (stopType: 'pass') are excluded from departures
 */
function generateDepartures(
  calculatedStops: CalculatedVariantStop[],
  firstDepartureTime: string
): TimetableDeparture[] {
  return calculatedStops
    .filter((stop) => stop.stopType !== 'pass')
    .map((stop) => {
      const arrival = stop.arrivalOffset !== null
        ? addMinutesToTime(firstDepartureTime, stop.arrivalOffset)
        : null;
      const departure = stop.departureOffset !== null
        ? addMinutesToTime(firstDepartureTime, stop.departureOffset)
        : null;

      return {
        stationId: stop.stationId,
        arrival,
        departure,
      };
    });
}

/**
 * Generate all timetables for a line schedule
 */
export function generateTimetables(
  ctx: GenerationContext,
  existingTrainNumbers: Set<string>
): {
  outboundTimetables: Timetable[];
  inboundTimetables: Timetable[];
} {
  const { schedule, pattern, outboundVariant, inboundVariant, routes } = ctx;
  const { outboundAnchorMinute, inboundAnchorMinute, trainNumberPrefix, startBaseNumber } = schedule;

  const outboundTimetables: Timetable[] = [];
  const inboundTimetables: Timetable[] = [];

  // Pre-calculate variant times for primary variants
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

  // Calculate all departure slots for both directions
  const outboundSlots = calculateDepartureSlots(pattern, outboundAnchorMinute);
  const inboundSlots = calculateDepartureSlots(pattern, inboundAnchorMinute);

  // Combine and sort all slots by anchor time
  const allSlots: { slot: DepartureSlot; direction: Direction }[] = [
    ...outboundSlots.map((slot) => ({ slot, direction: 'outbound' as Direction })),
    ...inboundSlots.map((slot) => ({ slot, direction: 'inbound' as Direction })),
  ].sort((a, b) => a.slot.anchorTime - b.slot.anchorTime);

  let baseNumber = startBaseNumber;
  const usedNumbers = new Set(existingTrainNumbers);

  for (const { slot, direction } of allSlots) {
    // Skip if this slot should be skipped due to off-peak reduction
    if (slot.skipDueToReduction) continue;

    // Select the appropriate variant and its calculated stops
    const anchorMinute = direction === 'outbound' ? outboundAnchorMinute : inboundAnchorMinute;
    const primaryCalculatedStops = direction === 'outbound' ? outboundCalculatedStops : inboundCalculatedStops;
    const { variant, calculatedStops } = selectVariantForSlot(
      slot,
      direction,
      ctx,
      anchorMinute,
      primaryCalculatedStops
    );

    // Calculate origin departure time
    const journeyToAnchor = getJourneyTimeToAnchor(calculatedStops, schedule.anchorStationId);
    const originDeparture = slot.anchorTime - journeyToAnchor;

    // Skip if origin departure is unreasonable and we don't have a short-turn variant
    if (!isReasonableDepartureTime(originDeparture)) continue;

    // Calculate train number
    const coreNumber = calculateCoreNumber(baseNumber, direction);
    const trainNumber = formatTrainNumber(trainNumberPrefix, coreNumber);

    // Skip if duplicate
    if (usedNumbers.has(trainNumber)) {
      baseNumber++;
      continue;
    }
    usedNumbers.add(trainNumber);

    // Generate departures using calculated stops
    const firstDepartureTime = minutesToTime(originDeparture);
    const departures = generateDepartures(calculatedStops, firstDepartureTime);

    const timetable: Timetable = {
      id: generateId(),
      variantId: variant.id,
      trainNumber,
      operatingDays: pattern.operatingDays,
      departures,
    };

    if (direction === 'outbound') {
      outboundTimetables.push(timetable);
    } else {
      inboundTimetables.push(timetable);
    }

    baseNumber += 2; // Maintain odd/even parity
  }

  return { outboundTimetables, inboundTimetables };
}

/**
 * Calculate total train count for a pattern (for preview)
 */
export function calculateTrainCount(
  pattern: OperatingPattern
): { total: number; perDirection: number } {
  let total = 0;

  for (const period of pattern.periods) {
    const periodStart = timeToMinutes(period.startTime);
    const periodEnd = timeToMinutes(period.endTime);
    const interval = period.intervalMinutes;

    let trainsInPeriod = 0;
    let currentTime = Math.ceil(periodStart / interval) * interval;

    while (currentTime < periodEnd) {
      const isOffPeak = isInOffPeakWindow(currentTime, period);
      // For off-peak, count half (due to skip-alternate)
      if (!isOffPeak) {
        trainsInPeriod++;
      } else {
        trainsInPeriod += 0.5;
      }
      currentTime += interval;
    }

    total += Math.floor(trainsInPeriod);
  }

  // Total is per direction, double for both directions
  return {
    total: total * 2,
    perDirection: total,
  };
}

/**
 * Generate departure times preview for a pattern
 */
export function generateDeparturePreview(
  pattern: OperatingPattern,
  anchorMinute: number,
  limit: number = 10
): string[] {
  const slots = calculateDepartureSlots(pattern, anchorMinute);
  return slots
    .filter((slot) => !slot.skipDueToReduction)
    .slice(0, limit)
    .map((slot) => minutesToTime(slot.anchorTime));
}
