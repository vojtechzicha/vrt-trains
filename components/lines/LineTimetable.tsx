import { Timetable, Variant, Station } from '@/types';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui';
import { formatTime, compareTime } from '@/lib/utils';

const countryFlags: Record<string, string> = {
  Czech: '🇨🇿',
  Germany: '🇩🇪',
  Austria: '🇦🇹',
  Poland: '🇵🇱',
  Slovakia: '🇸🇰',
  Hungary: '🇭🇺',
};

function getCountryFlag(country?: string): string {
  return countryFlags[country || 'Czech'] || '🏳️';
}

interface LineTimetableProps {
  variants: Variant[];
  timetables: Timetable[];
  stations: Station[];
}

interface TimetableEntry {
  trainNumber: string;
  variantCode: string;
  times: Map<string, { arrival: string | null; departure: string | null }>;
  firstDeparture: string;
  firstStationIdx: number;
  lastStationIdx: number;
}

export function LineTimetable({ variants, timetables, stations }: LineTimetableProps) {
  // Only use outbound variants for canonical order (inbound are just reversed)
  const outboundVariants = variants.filter((v) => v.direction === 'outbound');
  const baseVariants = outboundVariants.length > 0 ? outboundVariants : variants;

  // Build ordering constraints from ALL variants
  // If variant says A -> B -> C, then A must come before B, A must come before C, B must come before C
  const mustComeBefore = new Map<string, Set<string>>(); // stationId -> set of stations that must come AFTER it

  baseVariants.forEach((variant) => {
    const sortedStations = [...variant.stations].sort((a, b) => a.sequence - b.sequence);
    for (let i = 0; i < sortedStations.length; i++) {
      const stationId = sortedStations[i].stationId;
      if (!mustComeBefore.has(stationId)) {
        mustComeBefore.set(stationId, new Set());
      }
      // All subsequent stations in this variant must come after this one
      for (let j = i + 1; j < sortedStations.length; j++) {
        mustComeBefore.get(stationId)!.add(sortedStations[j].stationId);
      }
    }
  });

  // Find the longest outbound variant - use it as the canonical order
  const longestVariant = baseVariants.reduce((longest, current) =>
    current.stations.length > longest.stations.length ? current : longest
  , baseVariants[0]);

  // Build ordered station list from the longest variant (using sequence, not offset)
  const orderedStationIds: string[] = [];
  longestVariant?.stations
    .sort((a, b) => a.sequence - b.sequence)
    .forEach((stop) => {
      orderedStationIds.push(stop.stationId);
    });

  // Function to check if inserting a station at a position would violate constraints
  function canInsertAt(stationId: string, position: number): boolean {
    // Check: stations before 'position' must not be required to come AFTER stationId
    for (let i = 0; i < position; i++) {
      const existingStation = orderedStationIds[i];
      const stationMustComeBefore = mustComeBefore.get(stationId);
      if (stationMustComeBefore && stationMustComeBefore.has(existingStation)) {
        // stationId must come before existingStation, but we're placing it after
        return false;
      }
    }

    // Check: stations at/after 'position' must not require stationId to come AFTER them
    for (let i = position; i < orderedStationIds.length; i++) {
      const existingStation = orderedStationIds[i];
      const existingMustComeBefore = mustComeBefore.get(existingStation);
      if (existingMustComeBefore && existingMustComeBefore.has(stationId)) {
        // existingStation must come before stationId, but we're placing stationId before it
        return false;
      }
    }

    return true;
  }

  // Add stations from other outbound variants that aren't in the longest
  // Only insert if it doesn't violate any ordering constraints (i.e., compatible branch)
  baseVariants.forEach((variant) => {
    if (variant.id === longestVariant?.id) return;

    const variantStations = [...variant.stations].sort((a, b) => a.sequence - b.sequence);

    variantStations.forEach((stop, idx) => {
      if (orderedStationIds.includes(stop.stationId)) return;

      // Find the best position to insert this station
      // Look for the previous station in this variant that's already in our list
      let insertIndex = -1;

      for (let i = idx - 1; i >= 0; i--) {
        const prevStationId = variantStations[i].stationId;
        const prevIndex = orderedStationIds.indexOf(prevStationId);
        if (prevIndex !== -1) {
          insertIndex = prevIndex + 1;
          break;
        }
      }

      // If no previous station found, try looking for next stations
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

      // If still no position, append at end
      if (insertIndex === -1) {
        insertIndex = orderedStationIds.length;
      }

      // Only insert if it doesn't violate constraints (skip incompatible branch stations)
      if (canInsertAt(stop.stationId, insertIndex)) {
        orderedStationIds.splice(insertIndex, 0, stop.stationId);
      }
    });
  });

  const sortedStationIds = orderedStationIds;

  // Create station lookup
  const stationMap = new Map(stations.map((s) => [s.id, s]));

  // Create variant lookup
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  // Build timetable entries (first pass - collect times)
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
      firstDeparture: '99:99', // Will be set below
      firstStationIdx: -1, // Will be set below
      lastStationIdx: -1, // Will be set below
    };
  });

  // Calculate first and last station indices for each entry
  entries.forEach((entry) => {
    let first = -1;
    let last = -1;
    sortedStationIds.forEach((stationId, idx) => {
      if (entry.times.has(stationId)) {
        if (first === -1) first = idx;
        last = idx;
      }
    });
    entry.firstStationIdx = first;
    entry.lastStationIdx = last;
  });

  // Find a reference station that ALL trains pass through (for consistent sorting)
  let referenceStationId: string | null = null;
  for (const stationId of sortedStationIds) {
    const allTrainsHaveThis = entries.every((entry) => entry.times.has(stationId));
    if (allTrainsHaveThis) {
      referenceStationId = stationId;
      break;
    }
  }

  // Set sort time for each entry
  entries.forEach((entry) => {
    if (referenceStationId) {
      // Sort by time at the common reference station
      const refTime = entry.times.get(referenceStationId);
      entry.firstDeparture = refTime?.departure || refTime?.arrival || '99:99';
    } else {
      // Fallback: sort by first appearance in the table
      for (const stationId of sortedStationIds) {
        const stationTime = entry.times.get(stationId);
        if (stationTime) {
          entry.firstDeparture = stationTime.departure || stationTime.arrival || '99:99';
          break;
        }
      }
    }
  });

  // Sort entries by time at reference station (or first appearance)
  entries.sort((a, b) => compareTime(a.firstDeparture, b.firstDeparture));

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No timetable data available
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="sticky left-0 bg-gray-50 z-10">Station</TableHead>
          {entries.map((entry) => (
            <TableHead key={entry.trainNumber} className="text-center min-w-[80px]">
              <div className="text-xs text-gray-400">{entry.variantCode}</div>
              <div>{entry.trainNumber}</div>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedStationIds.map((stationId, idx) => {
          const station = stationMap.get(stationId);
          if (!station) return null;

          // Check if this is a country crossing (country differs from previous station)
          const prevStationId = idx > 0 ? sortedStationIds[idx - 1] : null;
          const prevStation = prevStationId ? stationMap.get(prevStationId) : null;
          const currentCountry = station.country || 'Czech';
          const prevCountry = prevStation?.country || 'Czech';
          const isCountryCrossing = idx > 0 && currentCountry !== prevCountry;

          return (
            <TableRow key={stationId} className={isCountryCrossing ? 'border-t-2 border-t-amber-400' : ''}>
              <TableCell className="sticky left-0 bg-white z-10 font-medium">
                <span className="flex items-center gap-1.5">
                  {(isCountryCrossing || currentCountry !== 'Czech') && (
                    <span title={currentCountry}>{getCountryFlag(currentCountry)}</span>
                  )}
                  {station.name}
                </span>
              </TableCell>
              {entries.map((entry) => {
                const timeData = entry.times.get(stationId);
                if (!timeData) {
                  // Check if this station is between the train's first and last stop
                  const isPassingThrough = idx >= entry.firstStationIdx && idx <= entry.lastStationIdx;
                  return (
                    <TableCell key={entry.trainNumber} className="text-center text-gray-300">
                      {isPassingThrough ? '|' : '-'}
                    </TableCell>
                  );
                }

                return (
                  <TableCell key={entry.trainNumber} className="text-center">
                    {timeData.arrival && timeData.departure ? (
                      <div>
                        <div className="text-xs text-gray-400">{formatTime(timeData.arrival)}</div>
                        <div className="font-medium">{formatTime(timeData.departure)}</div>
                      </div>
                    ) : (
                      <div className="font-medium">
                        {formatTime(timeData.departure || timeData.arrival)}
                      </div>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
