'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Station, StopType, Variant } from '@/types';
import { StationSelector } from './StationSelector';

// Exported so other components can use this interface
export interface RouteStop {
  stationId: string;
  minutesFromPrevious: number;  // Travel time from previous station
  dwellTime: number;            // Time spent at this station
  platform: string;
  stopType: StopType;
}

// Map of stationA:stationB -> shortest duration in minutes
export type DurationLookup = Map<string, number>;

// Build a duration lookup from existing variants
// Uses the shortest duration when multiple variants have the same station pair
export function buildDurationLookup(variants: Variant[]): DurationLookup {
  const lookup = new Map<string, number>();

  for (const variant of variants) {
    for (let i = 1; i < variant.stations.length; i++) {
      const prev = variant.stations[i - 1];
      const curr = variant.stations[i];

      // Calculate duration between consecutive stops
      const prevDeparture = prev.departureOffset ?? prev.arrivalOffset ?? 0;
      const currArrival = curr.arrivalOffset ?? curr.departureOffset ?? 0;
      const duration = currArrival - prevDeparture;

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
}

export function RouteBuilder({
  stations,
  value,
  onChange,
  durationLookup,
  allowAddStations = true,
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
      stopType: 'regular',
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

  // Skip/remove a station - recalculate times when removing middle stations
  function handleSkipStation(index: number) {
    const isFirst = index === 0;
    const isLast = index === value.length - 1;

    // When removing a middle station, add its travel time to the next station
    if (!isFirst && !isLast) {
      const removedStop = value[index];
      const nextStop = value[index + 1];

      // Sum the travel times: A->B + B->C = A->C
      const combinedTime = removedStop.minutesFromPrevious + nextStop.minutesFromPrevious;

      const newStops = value.filter((_, i) => i !== index);
      // Update the next station (which is now at index) with combined time
      newStops[index] = { ...newStops[index], minutesFromPrevious: combinedTime };
      onChange(newStops);
    } else {
      // First or last station - just remove without time recalculation
      const newStops = value.filter((_, i) => i !== index);
      // If we removed the first station, reset the new first's travel time to 0
      if (isFirst && newStops.length > 0) {
        newStops[0] = { ...newStops[0], minutesFromPrevious: 0 };
      }
      onChange(newStops);
    }
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
      <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500 font-medium">
        <span className="w-6"></span>
        <span className="flex-1">Station</span>
        <span className="w-16 text-center">Travel</span>
        <span className="w-14 text-center">Dwell</span>
        <span className="w-12 text-center">Arr</span>
        <span className="w-12 text-center">Dep</span>
        <span className="w-14 text-center">Plt</span>
        <span className="w-20 text-center">Type</span>
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
            className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg group"
          >
            {/* Sequence number */}
            <span className="w-6 text-center text-sm text-gray-400 font-mono">
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
              <div className="text-xs text-gray-400 font-mono">
                {station?.code}
              </div>
            </div>

            {/* Travel time from previous */}
            <div className="w-16">
              <div className="flex items-center justify-center gap-0.5">
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
                  className="w-10 px-1 py-1 text-sm text-center border border-gray-300 rounded disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">m</span>
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
                  className="w-10 px-1 py-1 text-sm text-center border border-gray-300 rounded disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">m</span>
              </div>
            </div>

            {/* Arrival time */}
            <div className="w-12 text-center text-sm text-gray-500">
              {isFirst ? '--' : formatTime(arrival)}
            </div>

            {/* Departure time */}
            <div className="w-12 text-center text-sm font-medium">
              {isLast ? '--' : formatTime(departure)}
            </div>

            {/* Platform */}
            <div className="w-14">
              <input
                ref={(el) => { platformRefs.current[index] = el; }}
                type="text"
                value={stop.platform}
                onChange={(e) => handleUpdateStop(index, { platform: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, index, 'platform')}
                placeholder="Plt"
                className="w-full px-1 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Stop type */}
            <select
              value={stop.stopType}
              onChange={(e) => handleUpdateStop(index, { stopType: e.target.value as StopType })}
              className="w-20 px-1 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="regular">Regular</option>
              <option value="request">Request</option>
              <option value="pass">Pass</option>
            </select>

            {/* Skip/Remove action */}
            <div className="w-8 flex justify-center">
              <button
                type="button"
                onClick={() => handleSkipStation(index)}
                className="p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                title={isFirst || isLast ? "Remove" : "Skip (time added to next)"}
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
              className="mt-2 text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingNew(true)}
            className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors text-sm"
          >
            + Add Station
          </button>
        )
      )}
    </div>
  );
}
