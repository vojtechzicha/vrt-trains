'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Station, Variant, RouteCorridor, Platform } from '@/types';
import { StationSelector } from './StationSelector';

// Exported so other components can use this interface
export interface RouteStop {
  stationId: string;
  minutesFromPrevious: number;  // Travel time from previous station
  dwellTime: number;            // Time spent at this station
  platform: string;
}

// Map of stationA:stationB -> shortest duration in minutes
export type DurationLookup = Map<string, number>;

// Build a duration lookup from existing variants (deprecated - use buildDurationLookupFromRoutes)
// Now uses dwellTime since offsets are no longer stored
export function buildDurationLookup(variants: Variant[]): DurationLookup {
  // This function is deprecated - return empty lookup
  // Routes should be used as the source of truth for travel times
  return new Map<string, number>();
}

// Build a duration lookup from route corridors
// Uses the VRT time (or fallback) for each segment
export function buildDurationLookupFromRoutes(routes: RouteCorridor[]): DurationLookup {
  const lookup = new Map<string, number>();

  for (const route of routes) {
    for (const path of route.paths) {
      for (let i = 1; i < path.stops.length; i++) {
        const prev = path.stops[i - 1];
        const curr = path.stops[i];

        // Use VRT time, falling back to fast then slow
        const duration = curr.vrtTime ?? curr.fastTime ?? curr.slowTime ?? 0;

        if (duration > 0) {
          const key = `${prev.stationId}:${curr.stationId}`;
          const existing = lookup.get(key);
          // Keep the shorter duration
          if (existing === undefined || duration < existing) {
            lookup.set(key, duration);
          }
        }
      }
    }
  }

  return lookup;
}

const countryFlags: Record<string, string> = {
  Czech: '',
  Germany: '',
  Austria: '',
  Poland: '',
  Slovakia: '',
  Hungary: '',
};

function getCountryFlag(country?: string): string {
  return countryFlags[country || 'Czech'] || '';
}

interface RouteBuilderProps {
  stations: Station[];
  value: RouteStop[];
  onChange: (stops: RouteStop[]) => void;
  durationLookup?: DurationLookup;
  allowAddStations?: boolean;  // If false, only editing existing stops is allowed
  readOnlyTravelTime?: boolean;  // If true, travel time cannot be edited (comes from route)
}

export function RouteBuilder({
  stations,
  value,
  onChange,
  durationLookup,
  allowAddStations = true,
  readOnlyTravelTime = false,
}: RouteBuilderProps) {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const minutesRefs = useRef<(HTMLInputElement | null)[]>([]);
  const dwellRefs = useRef<(HTMLInputElement | null)[]>([]);
  const platformRefs = useRef<(HTMLInputElement | null)[]>([]);

  const stationMap = new Map(stations.map((s) => [s.id, s]));

  const usedStationIds = value.map((s) => s.stationId);

  function handleAddStation(stationId: string) {
    // Try to find duration from previous station using lookup
    let defaultMinutes = 5;
    if (value.length > 0 && durationLookup) {
      const prevStationId = value[value.length - 1].stationId;
      // Try both directions (A:B and B:A)
      const keyForward = `${prevStationId}:${stationId}`;
      const keyBackward = `${stationId}:${prevStationId}`;
      const duration = durationLookup.get(keyForward) ?? durationLookup.get(keyBackward);
      if (duration !== undefined) {
        defaultMinutes = duration;
      }
    }

    const newStop: RouteStop = {
      stationId,
      minutesFromPrevious: value.length === 0 ? 0 : defaultMinutes,
      dwellTime: 1,  // Default dwell time
      platform: '1',
    };
    onChange([...value, newStop]);
    setIsAddingNew(false);

    // Focus the minutes input for the new station
    setTimeout(() => {
      const newIndex = value.length;
      if (minutesRefs.current[newIndex]) {
        minutesRefs.current[newIndex]?.focus();
        minutesRefs.current[newIndex]?.select();
      }
    }, 50);
  }

  function handleUpdateStop(index: number, updates: Partial<RouteStop>) {
    const newStops = [...value];
    newStops[index] = { ...newStops[index], ...updates };
    onChange(newStops);
  }

  // Remove station and combine travel times
  function handleRemoveStation(index: number) {
    const isFirst = index === 0;
    const removedStop = value[index];
    const newStops = value.filter((_, i) => i !== index);

    if (isFirst && newStops.length > 0) {
      // If we removed the first station, reset the new first's travel time to 0
      newStops[0] = { ...newStops[0], minutesFromPrevious: 0 };
    } else if (!isFirst && index < value.length && newStops.length > index) {
      // Middle station: add removed station's travel time to the next station
      newStops[index] = {
        ...newStops[index],
        minutesFromPrevious: newStops[index].minutesFromPrevious + removedStop.minutesFromPrevious,
      };
    }

    onChange(newStops);
  }

  function handleKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    index: number,
    field: 'minutes' | 'dwell' | 'platform'
  ) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (field === 'minutes' && !e.shiftKey) {
        e.preventDefault();
        dwellRefs.current[index]?.focus();
        dwellRefs.current[index]?.select();
      } else if (field === 'dwell' && !e.shiftKey) {
        e.preventDefault();
        platformRefs.current[index]?.focus();
        platformRefs.current[index]?.select();
      } else if (field === 'platform' && !e.shiftKey) {
        e.preventDefault();
        // Move to next row or show add station
        if (index === value.length - 1) {
          if (allowAddStations) {
            setIsAddingNew(true);
          }
        } else {
          minutesRefs.current[index + 1]?.focus();
          minutesRefs.current[index + 1]?.select();
        }
      }
    }
  }

  // Calculate cumulative times (arrival and departure)
  // First station: departs at 0 (train starts here, no dwell wait)
  // Subsequent stations: arrival = prev departure + travel time, departure = arrival + dwell
  let lastDeparture = 0;
  const times = value.map((stop, index) => {
    if (index === 0) {
      // First station: train starts here, departs immediately at 0
      lastDeparture = 0;
      return { arrival: 0, departure: 0 };
    }

    // Arrival = previous station's departure + travel time
    const arrival = lastDeparture + stop.minutesFromPrevious;
    // Departure = arrival + dwell time at this station
    const departure = arrival + stop.dwellTime;
    lastDeparture = departure;
    return { arrival, departure };
  });

  // Format time as H:MM
  function formatTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
  }

  return (
    <div className="space-y-1">
      {/* Header row */}
      <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
        <span className="w-6"></span>
        <span className="flex-1">Station</span>
        <span className="w-16 text-center">Travel</span>
        <span className="w-14 text-center">Dwell</span>
        <span className="w-12 text-center">Arr</span>
        <span className="w-12 text-center">Dep</span>
        <span className="w-20 text-center">Plt</span>
        <span className="w-8"></span>
      </div>

      {value.map((stop, index) => {
        const station = stationMap.get(stop.stationId);
        const isFirst = index === 0;
        const isLast = index === value.length - 1;
        const { arrival, departure } = times[index];

        return (
          <div
            key={`${stop.stationId}-${index}`}
            className="flex items-center gap-2 p-2 rounded-lg group bg-gray-50 dark:bg-gray-950"
          >
            {/* Sequence number */}
            <span className="w-6 text-center text-sm text-gray-400 dark:text-gray-500 font-mono">
              {index + 1}.
            </span>

            {/* Station name */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate flex items-center gap-1">
                {getCountryFlag(station?.country) && (
                  <span>{getCountryFlag(station?.country)}</span>
                )}
                {station?.name || 'Unknown'}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                {station?.code}
              </div>
            </div>

            {/* Travel time from previous */}
            <div className="w-16">
              <div className="flex items-center justify-center gap-0.5">
                {readOnlyTravelTime ? (
                  <span className="w-10 px-1 py-1 text-sm text-center text-gray-500 dark:text-gray-400">
                    {isFirst ? '-' : stop.minutesFromPrevious}
                  </span>
                ) : (
                  <input
                    ref={(el) => { minutesRefs.current[index] = el; }}
                    type="number"
                    value={stop.minutesFromPrevious}
                    onChange={(e) =>
                      handleUpdateStop(index, { minutesFromPrevious: parseInt(e.target.value) || 0 })
                    }
                    onKeyDown={(e) => handleKeyDown(e, index, 'minutes')}
                    disabled={isFirst}
                    min={0}
                    className="w-10 px-1 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">m</span>
              </div>
            </div>

            {/* Dwell time */}
            <div className="w-14">
              <div className="flex items-center justify-center gap-0.5">
                <input
                  ref={(el) => { dwellRefs.current[index] = el; }}
                  type="number"
                  value={stop.dwellTime}
                  onChange={(e) =>
                    handleUpdateStop(index, { dwellTime: parseInt(e.target.value) || 0 })
                  }
                  onKeyDown={(e) => handleKeyDown(e, index, 'dwell')}
                  disabled={isLast}
                  min={0}
                  className="w-10 px-1 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400 dark:text-gray-500">m</span>
              </div>
            </div>

            {/* Arrival time */}
            <div className="w-12 text-center text-sm text-gray-500 dark:text-gray-400">
              {isFirst ? '--' : formatTime(arrival)}
            </div>

            {/* Departure time */}
            <div className="w-12 text-center text-sm font-medium">
              {isLast ? '--' : formatTime(departure)}
            </div>

            {/* Platform */}
            <div className="w-20">
              {station?.platforms && station.platforms.length > 0 ? (
                <select
                  value={stop.platform}
                  onChange={(e) => handleUpdateStop(index, { platform: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab' && !e.shiftKey) {
                      handleKeyDown(e as unknown as KeyboardEvent<HTMLInputElement>, index, 'platform');
                    }
                  }}
                  className="w-full px-1 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-</option>
                  {station.platforms.map((p: Platform) => (
                    <option key={p.code} value={p.code}>
                      {p.name ? `${p.code} - ${p.name}` : p.code}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  ref={(el) => { platformRefs.current[index] = el; }}
                  type="text"
                  value={stop.platform}
                  onChange={(e) => handleUpdateStop(index, { platform: e.target.value })}
                  onKeyDown={(e) => handleKeyDown(e, index, 'platform')}
                  placeholder="Plt"
                  className="w-full px-1 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              )}
            </div>

            {/* Remove action */}
            <div className="w-8 flex justify-center">
              <button
                type="button"
                onClick={() => handleRemoveStation(index)}
                className="p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove station"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}

      {/* Add station row */}
      {allowAddStations && (
        isAddingNew ? (
          <div className="p-2 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50">
            <StationSelector
              stations={stations}
              value={null}
              onChange={handleAddStation}
              excludeIds={usedStationIds}
              placeholder="Search for station..."
              autoFocus
            />
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="mt-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingNew(true)}
            className="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors text-sm"
          >
            + Add Station
          </button>
        )
      )}
    </div>
  );
}
