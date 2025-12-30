'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Station, RoutePath, RoutePathStop, ReverseTimeAdjustment } from '@/types';
import { StationSelector } from './StationSelector';

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

interface RoutePathEditorProps {
  stations: Station[];
  value: RoutePath;
  onChange: (path: RoutePath) => void;
  isLocked?: boolean; // True if path is used by variants (structural changes blocked)
}

export function RoutePathEditor({
  stations,
  value,
  onChange,
  isLocked = false,
}: RoutePathEditorProps) {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [showReverseAdjustments, setShowReverseAdjustments] = useState(
    Boolean(value.reverseTimeAdjustments?.length)
  );

  const distanceRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const dwellRefs = useRef<(HTMLInputElement | null)[]>([]);

  const stationMap = new Map(stations.map((s) => [s.id, s]));
  const usedStationIds = value.stops.map((s) => s.stationId);

  // Calculate cumulative distances
  const cumulativeDistances = value.stops.map((_, index) => {
    let cumulative = 0;
    for (let i = 0; i <= index; i++) {
      if (i > 0) {
        cumulative += value.stops[i].distanceFromPrevious;
      }
    }
    return cumulative;
  });

  // Calculate cumulative times (travel time only, no dwell)
  const cumulativeTimes = value.stops.map((_, index) => {
    let cumulative = 0;
    for (let i = 0; i <= index; i++) {
      if (i > 0) {
        cumulative += value.stops[i].baseTimeFromPrevious;
      }
    }
    return cumulative;
  });

  function handleNameChange(name: string) {
    onChange({ ...value, name });
  }

  function handleAddStation(stationId: string) {
    const newStop: RoutePathStop = {
      stationId,
      sequence: value.stops.length + 1,
      distanceFromPrevious: value.stops.length === 0 ? 0 : 10,
      distanceKm: 0, // Will be recalculated
      baseTimeFromPrevious: value.stops.length === 0 ? 0 : 10,
      defaultDwellTime: 1,
    };

    const newStops = [...value.stops, newStop];
    updateStopsWithDistances(newStops);
    setIsAddingNew(false);

    // Focus the distance input for the new station
    setTimeout(() => {
      const newIndex = value.stops.length;
      if (distanceRefs.current[newIndex]) {
        distanceRefs.current[newIndex]?.focus();
        distanceRefs.current[newIndex]?.select();
      }
    }, 50);
  }

  function updateStopsWithDistances(stops: RoutePathStop[]) {
    // Recalculate cumulative distances and sequences
    let cumulative = 0;
    const updatedStops = stops.map((stop, index) => {
      if (index > 0) {
        cumulative += stop.distanceFromPrevious;
      }
      return {
        ...stop,
        sequence: index + 1,
        distanceKm: cumulative,
      };
    });
    onChange({ ...value, stops: updatedStops });
  }

  function handleUpdateStop(index: number, updates: Partial<RoutePathStop>) {
    const newStops = [...value.stops];
    newStops[index] = { ...newStops[index], ...updates };
    updateStopsWithDistances(newStops);
  }

  function handleRemoveStop(index: number) {
    if (isLocked) return;
    const newStops = value.stops.filter((_, i) => i !== index);
    // Also remove any reverse adjustments for this station
    const removedStationId = value.stops[index].stationId;
    const newReverseAdjustments = value.reverseTimeAdjustments?.filter(
      (adj) => adj.stationId !== removedStationId
    );
    onChange({
      ...value,
      stops: newStops.map((s, i) => ({
        ...s,
        sequence: i + 1,
        distanceKm: newStops.slice(0, i + 1).reduce((acc, curr, j) =>
          j === 0 ? 0 : acc + curr.distanceFromPrevious, 0
        ),
      })),
      reverseTimeAdjustments: newReverseAdjustments,
    });
  }

  function handleMoveUp(index: number) {
    if (isLocked || index === 0) return;
    const newStops = [...value.stops];
    [newStops[index - 1], newStops[index]] = [newStops[index], newStops[index - 1]];
    updateStopsWithDistances(newStops);
  }

  function handleMoveDown(index: number) {
    if (isLocked || index === value.stops.length - 1) return;
    const newStops = [...value.stops];
    [newStops[index], newStops[index + 1]] = [newStops[index + 1], newStops[index]];
    updateStopsWithDistances(newStops);
  }

  function handleKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    index: number,
    field: 'distance' | 'time' | 'dwell'
  ) {
    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      if (field === 'distance') {
        timeRefs.current[index]?.focus();
        timeRefs.current[index]?.select();
      } else if (field === 'time') {
        dwellRefs.current[index]?.focus();
        dwellRefs.current[index]?.select();
      } else if (field === 'dwell') {
        // Move to next row or show add station
        if (index === value.stops.length - 1) {
          if (!isLocked) {
            setIsAddingNew(true);
          }
        } else {
          distanceRefs.current[index + 1]?.focus();
          distanceRefs.current[index + 1]?.select();
        }
      }
    }
  }

  function handleReverseAdjustmentChange(stationId: string, baseTimeFromPrevious: number) {
    const existing = value.reverseTimeAdjustments || [];
    const index = existing.findIndex((adj) => adj.stationId === stationId);

    let newAdjustments: ReverseTimeAdjustment[];
    if (index >= 0) {
      newAdjustments = [...existing];
      newAdjustments[index] = { stationId, baseTimeFromPrevious };
    } else {
      newAdjustments = [...existing, { stationId, baseTimeFromPrevious }];
    }

    onChange({ ...value, reverseTimeAdjustments: newAdjustments });
  }

  function getReverseAdjustment(stationId: string): number | undefined {
    return value.reverseTimeAdjustments?.find((adj) => adj.stationId === stationId)
      ?.baseTimeFromPrevious;
  }

  return (
    <div className="space-y-4">
      {/* Path name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Path Name
        </label>
        <input
          type="text"
          value={value.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g., via VRT, via Jihlava"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Locked warning */}
      {isLocked && (
        <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          This path is used by variants. Only times and distances can be edited.
        </div>
      )}

      {/* Stops header */}
      <div className="flex items-center gap-2 px-2 text-xs text-gray-500 font-medium">
        <span className="w-6"></span>
        <span className="flex-1">Station</span>
        <span className="w-20 text-center">Distance</span>
        <span className="w-20 text-center">Time</span>
        <span className="w-16 text-center">Dwell</span>
        {showReverseAdjustments && (
          <span className="w-20 text-center">Rev. Time</span>
        )}
        <span className="w-16"></span>
      </div>

      {/* Stops list */}
      <div className="space-y-2">
        {value.stops.map((stop, index) => {
          const station = stationMap.get(stop.stationId);
          const isFirst = index === 0;
          const isLast = index === value.stops.length - 1;
          const reverseTime = getReverseAdjustment(stop.stationId);

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

              {/* Distance from previous */}
              <div className="w-20">
                <div className="flex items-center gap-1">
                  <input
                    ref={(el) => { distanceRefs.current[index] = el; }}
                    type="number"
                    value={stop.distanceFromPrevious}
                    onChange={(e) =>
                      handleUpdateStop(index, {
                        distanceFromPrevious: parseFloat(e.target.value) || 0,
                      })
                    }
                    onKeyDown={(e) => handleKeyDown(e, index, 'distance')}
                    disabled={isFirst}
                    min={0}
                    step={0.1}
                    className="w-12 px-1 py-1 text-sm text-center border border-gray-300 rounded disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-400">km</span>
                </div>
                <div className="text-xs text-gray-400 text-center mt-0.5">
                  {cumulativeDistances[index].toFixed(1)}
                </div>
              </div>

              {/* Time from previous */}
              <div className="w-20">
                <div className="flex items-center gap-1">
                  <input
                    ref={(el) => { timeRefs.current[index] = el; }}
                    type="number"
                    value={stop.baseTimeFromPrevious}
                    onChange={(e) =>
                      handleUpdateStop(index, {
                        baseTimeFromPrevious: parseInt(e.target.value) || 0,
                      })
                    }
                    onKeyDown={(e) => handleKeyDown(e, index, 'time')}
                    disabled={isFirst}
                    min={0}
                    className="w-12 px-1 py-1 text-sm text-center border border-gray-300 rounded disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-400">min</span>
                </div>
                <div className="text-xs text-gray-400 text-center mt-0.5">
                  {cumulativeTimes[index]}
                </div>
              </div>

              {/* Dwell time */}
              <div className="w-16">
                <div className="flex items-center gap-1">
                  <input
                    ref={(el) => { dwellRefs.current[index] = el; }}
                    type="number"
                    value={stop.defaultDwellTime}
                    onChange={(e) =>
                      handleUpdateStop(index, {
                        defaultDwellTime: parseInt(e.target.value) || 0,
                      })
                    }
                    onKeyDown={(e) => handleKeyDown(e, index, 'dwell')}
                    min={0}
                    className="w-10 px-1 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-400">m</span>
                </div>
              </div>

              {/* Reverse time adjustment */}
              {showReverseAdjustments && (
                <div className="w-20">
                  {!isFirst && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={reverseTime ?? stop.baseTimeFromPrevious}
                        onChange={(e) =>
                          handleReverseAdjustmentChange(
                            stop.stationId,
                            parseInt(e.target.value) || 0
                          )
                        }
                        min={0}
                        className="w-12 px-1 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-400">min</span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="w-16 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!isLocked && (
                  <>
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
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* Add station row */}
        {!isLocked && (
          <>
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
          </>
        )}
      </div>

      {/* Reverse timing toggle */}
      <div className="pt-2 border-t border-gray-200">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showReverseAdjustments}
            onChange={(e) => setShowReverseAdjustments(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-gray-700">Show reverse direction timing adjustments</span>
        </label>
        <p className="text-xs text-gray-500 mt-1 ml-6">
          Enable if travel times differ between directions (e.g., uphill vs downhill)
        </p>
      </div>

      {/* Summary */}
      <div className="pt-2 border-t border-gray-200 text-sm text-gray-600">
        <span className="font-medium">{value.stops.length}</span> stops |{' '}
        <span className="font-medium">
          {cumulativeDistances[cumulativeDistances.length - 1]?.toFixed(1) || 0}
        </span>{' '}
        km |{' '}
        <span className="font-medium">
          {cumulativeTimes[cumulativeTimes.length - 1] || 0}
        </span>{' '}
        min total
      </div>
    </div>
  );
}
