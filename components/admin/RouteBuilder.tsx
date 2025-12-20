'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Station, StopType, Variant } from '@/types';
import { StationSelector } from './StationSelector';
import { Button } from '@/components/ui';

interface RouteStop {
  stationId: string;
  minutesFromPrevious: number;
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

interface RouteBuilderProps {
  stations: Station[];
  value: RouteStop[];
  onChange: (stops: RouteStop[]) => void;
  durationLookup?: DurationLookup;
}

export function RouteBuilder({ stations, value, onChange, durationLookup }: RouteBuilderProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const minutesRefs = useRef<(HTMLInputElement | null)[]>([]);
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

  function handleRemoveStop(index: number) {
    const newStops = value.filter((_, i) => i !== index);
    onChange(newStops);
  }

  function handleMoveUp(index: number) {
    if (index === 0) return;
    const newStops = [...value];
    [newStops[index - 1], newStops[index]] = [newStops[index], newStops[index - 1]];
    onChange(newStops);
  }

  function handleMoveDown(index: number) {
    if (index === value.length - 1) return;
    const newStops = [...value];
    [newStops[index], newStops[index + 1]] = [newStops[index + 1], newStops[index]];
    onChange(newStops);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number, field: 'minutes' | 'platform') {
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (field === 'minutes' && !e.shiftKey) {
        e.preventDefault();
        platformRefs.current[index]?.focus();
        platformRefs.current[index]?.select();
      } else if (field === 'platform' && !e.shiftKey) {
        e.preventDefault();
        // Move to next row or show add station
        if (index === value.length - 1) {
          setIsAddingNew(true);
        } else {
          minutesRefs.current[index + 1]?.focus();
          minutesRefs.current[index + 1]?.select();
        }
      }
    }
  }

  // Calculate cumulative times
  let cumulative = 0;
  const cumulativeTimes = value.map((stop, index) => {
    if (index === 0) {
      cumulative = 0;
    } else {
      cumulative += stop.minutesFromPrevious;
    }
    return cumulative;
  });

  return (
    <div className="space-y-2">
      {value.map((stop, index) => {
        const station = stationMap.get(stop.stationId);
        const isFirst = index === 0;
        const isLast = index === value.length - 1;

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
                <span>{getCountryFlag(station?.country)}</span>
                {station?.name || 'Unknown'}
              </div>
              <div className="text-xs text-gray-400 font-mono">
                {station?.code}
              </div>
            </div>

            {/* Minutes */}
            <div className="w-20">
              <div className="flex items-center gap-1">
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
                  className="w-12 px-1 py-1 text-sm text-center border border-gray-300 rounded disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">min</span>
              </div>
              <div className="text-xs text-gray-400 text-center mt-0.5">
                Σ {cumulativeTimes[index]}
              </div>
            </div>

            {/* Platform */}
            <div className="w-16">
              <input
                ref={(el) => { platformRefs.current[index] = el; }}
                type="text"
                value={stop.platform}
                onChange={(e) => handleUpdateStop(index, { platform: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, index, 'platform')}
                placeholder="Plt"
                className="w-full px-2 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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

            {/* Actions */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => handleMoveUp(index)}
                disabled={isFirst}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => handleMoveDown(index)}
                disabled={isLast}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => handleRemoveStop(index)}
                className="p-1 text-red-400 hover:text-red-600"
                title="Remove"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}

      {/* Add station row */}
      {isAddingNew ? (
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
      )}
    </div>
  );
}
