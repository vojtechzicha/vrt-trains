import { Station, Line, Variant, Timetable, DirectConnection, LineConnection, StationType } from '@/types';
import { parseTimeToMinutes } from '@/lib/timetable';

export interface GetDirectConnectionsParams {
  stationId: string;
  variants: Variant[];
  timetables: Timetable[];
  lines: Line[];
  stations: Station[];
}

// Station type priority for sorting (lower = higher priority)
const STATION_TYPE_PRIORITY: Record<string, number> = {
  virtual: 0,
  airport: 1,
  hub: 2,
  terminal: 3,
  regular: 4,
  request: 5,
};

/**
 * Calculate travel time between two stations using timetable data.
 * Only considers trains going in the correct direction (origin before destination).
 */
function calculateTravelTime(
  originStationId: string,
  destStationId: string,
  timetables: Timetable[],
  variantIds: string[]
): { avgMinutes: number; trainCount: number } {
  const travelTimes: number[] = [];

  for (const tt of timetables) {
    if (!variantIds.includes(tt.variantId)) continue;

    const originIdx = tt.departures.findIndex((d) => d.stationId === originStationId);
    const destIdx = tt.departures.findIndex((d) => d.stationId === destStationId);

    if (originIdx === -1 || destIdx === -1) continue;

    // Only consider trains where origin comes before destination (correct direction)
    if (originIdx >= destIdx) continue;

    const originStop = tt.departures[originIdx];
    const destStop = tt.departures[destIdx];

    // Use departure from origin, arrival at destination
    const originTime = originStop.departure || originStop.arrival;
    const destTime = destStop.arrival || destStop.departure;

    if (!originTime || !destTime) continue;

    let travelMins = parseTimeToMinutes(destTime) - parseTimeToMinutes(originTime);

    // Handle overnight trains (negative means crossing midnight)
    if (travelMins < 0) {
      travelMins += 24 * 60;
    }

    if (travelMins > 0 && travelMins < 24 * 60) {
      travelTimes.push(travelMins);
    }
  }

  if (travelTimes.length === 0) {
    return { avgMinutes: 0, trainCount: 0 };
  }

  const avg = Math.round(travelTimes.reduce((a, b) => a + b, 0) / travelTimes.length);
  return { avgMinutes: avg, trainCount: travelTimes.length };
}

/**
 * Find all stations reachable from the current station via any variant.
 * Only includes stations that come AFTER the current station in the sequence
 * (stations the train will pass after picking up the passenger).
 * Returns a map of destination station ID -> array of { lineId, variantIds }
 */
function findReachableStations(
  currentStationId: string,
  variants: Variant[]
): Map<string, { lineId: string; variantIds: string[] }[]> {
  const connections = new Map<string, Map<string, string[]>>();

  for (const variant of variants) {
    const stationSequence = [...variant.stations].sort((a, b) => a.sequence - b.sequence);
    const currentIdx = stationSequence.findIndex((s) => s.stationId === currentStationId);

    if (currentIdx === -1) continue;

    // Only stations AFTER current station are reachable (train passes them after us)
    for (let i = currentIdx + 1; i < stationSequence.length; i++) {
      const destId = stationSequence[i].stationId;

      if (!connections.has(destId)) {
        connections.set(destId, new Map());
      }

      const lineMap = connections.get(destId)!;
      if (!lineMap.has(variant.lineId)) {
        lineMap.set(variant.lineId, []);
      }
      lineMap.get(variant.lineId)!.push(variant.id);
    }
  }

  // Convert to the output format
  const result = new Map<string, { lineId: string; variantIds: string[] }[]>();
  for (const [destId, lineMap] of connections) {
    const lineConnections: { lineId: string; variantIds: string[] }[] = [];
    for (const [lineId, variantIds] of lineMap) {
      lineConnections.push({ lineId, variantIds });
    }
    result.set(destId, lineConnections);
  }

  return result;
}

/**
 * Get the sort priority for a station.
 */
function getStationPriority(station: Station): number {
  if (station.isVirtual) return STATION_TYPE_PRIORITY.virtual;
  return STATION_TYPE_PRIORITY[station.type] ?? 99;
}

/**
 * Main function: Get all direct connections from a station.
 */
export function getDirectConnections(params: GetDirectConnectionsParams): DirectConnection[] {
  const { stationId, variants, timetables, lines, stations } = params;

  // Create lookup maps
  const stationMap = new Map(stations.map((s) => [s.id, s]));
  const lineMap = new Map(lines.map((l) => [l.id, l]));

  // Build mapping: member station ID -> virtual station
  const memberToVirtual = new Map<string, Station>();

  for (const station of stations) {
    if (station.isVirtual && station.memberStationIds) {
      for (const memberId of station.memberStationIds) {
        memberToVirtual.set(memberId, station);
      }
    }
  }

  // Find all reachable stations
  const reachableStations = findReachableStations(stationId, variants);

  // Group connections by effective destination (virtual station if member, otherwise physical)
  // Map: effective destination ID -> { station, lineConnections Map<lineId, {variantIds, physicalStationIds}> }
  const connectionsByDest = new Map<string, {
    station: Station;
    lineConnections: Map<string, { variantIds: string[]; physicalStationIds: string[] }>;
  }>();

  for (const [destStationId, lineConnections] of reachableStations) {
    const physicalStation = stationMap.get(destStationId);
    if (!physicalStation) continue;

    // Determine effective destination (virtual if member, otherwise physical)
    const virtualStation = memberToVirtual.get(destStationId);
    const effectiveDest = virtualStation || physicalStation;
    const effectiveDestId = effectiveDest.id;

    if (!connectionsByDest.has(effectiveDestId)) {
      connectionsByDest.set(effectiveDestId, {
        station: effectiveDest,
        lineConnections: new Map(),
      });
    }

    const destData = connectionsByDest.get(effectiveDestId)!;

    // Merge line connections
    for (const { lineId, variantIds } of lineConnections) {
      if (!destData.lineConnections.has(lineId)) {
        destData.lineConnections.set(lineId, { variantIds: [], physicalStationIds: [] });
      }
      const lineData = destData.lineConnections.get(lineId)!;
      lineData.variantIds.push(...variantIds);
      lineData.physicalStationIds.push(destStationId);
    }
  }

  // Build connections list
  const connections: DirectConnection[] = [];

  for (const [destId, destData] of connectionsByDest) {
    const { station: destStation, lineConnections: destLineConnections } = destData;

    // Build line connections with travel times
    const lineConnectionsResult: LineConnection[] = [];

    for (const [lineId, { variantIds, physicalStationIds }] of destLineConnections) {
      const line = lineMap.get(lineId);
      if (!line) continue;

      // For virtual stations, find the shortest travel time to any member station
      const uniquePhysicalIds = [...new Set(physicalStationIds)];
      let bestAvgMinutes = Infinity;
      let totalTrainCount = 0;

      for (const physicalId of uniquePhysicalIds) {
        const { avgMinutes, trainCount } = calculateTravelTime(
          stationId,
          physicalId,
          timetables,
          variantIds
        );
        if (trainCount > 0) {
          if (avgMinutes < bestAvgMinutes) {
            bestAvgMinutes = avgMinutes;
          }
          totalTrainCount += trainCount;
        }
      }

      if (totalTrainCount === 0 || bestAvgMinutes === Infinity) continue;

      lineConnectionsResult.push({
        lineId: line.id,
        lineIdentifier: line.identifier,
        lineColor: line.color,
        lineTextColor: line.textColor,
        travelTimeMinutes: bestAvgMinutes,
        trainsPerDay: totalTrainCount,
      });
    }

    if (lineConnectionsResult.length === 0) continue;

    // Sort lines by travel time (fastest first)
    lineConnectionsResult.sort((a, b) => a.travelTimeMinutes - b.travelTimeMinutes);

    connections.push({
      destinationStationId: destStation.id,
      destinationStationName: destStation.name,
      destinationStationCode: destStation.code,
      destinationType: destStation.type as StationType,
      isVirtual: destStation.isVirtual || false,
      lines: lineConnectionsResult,
    });
  }

  // Sort connections by station priority, then alphabetically
  connections.sort((a, b) => {
    const stationA = stationMap.get(a.destinationStationId);
    const stationB = stationMap.get(b.destinationStationId);

    const priorityA = stationA ? getStationPriority(stationA) : 99;
    const priorityB = stationB ? getStationPriority(stationB) : 99;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return a.destinationStationName.localeCompare(b.destinationStationName, 'cs');
  });

  return connections;
}

/**
 * Format travel time for display.
 */
export function formatTravelTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

/**
 * Format frequency for display.
 * Shows "X trains/hour" if >=1 per hour, otherwise "every X min".
 */
export function formatFrequency(trainsPerDay: number): string {
  if (trainsPerDay === 0) return '';

  // Assume ~16 operating hours per day for frequency calculation
  const operatingHours = 16;
  const trainsPerHour = trainsPerDay / operatingHours;

  if (trainsPerHour >= 1) {
    const rounded = Math.round(trainsPerHour);
    return `${rounded} train${rounded !== 1 ? 's' : ''}/hour`;
  } else {
    const intervalMinutes = Math.round((operatingHours * 60) / trainsPerDay);
    return `every ${intervalMinutes} min`;
  }
}
