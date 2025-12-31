'use client';

import { useState, useMemo } from 'react';
import {
  Station,
  RouteCorridor,
  RoutePath,
  RoutePathStop,
  ReverseTimeAdjustment,
  VariantRouteRef,
  VariantStop,
  Direction,
  SpeedCategory,
} from '@/types';
import { getSegmentTime } from '@/lib/routeTimes';
import { Button } from '@/components/ui';
import { RouteStop } from './RouteBuilder';

// Export the interface so it can be used by other components
export interface RouteSegment {
  routeId: string;
  pathId: string;
  reversed: boolean;  // true = use path in reverse direction
  speedCategory: SpeedCategory;  // Which speed times to use for this segment
  startStationId?: string;
  endStationId?: string;
}

interface RouteSequenceBuilderProps {
  routes: RouteCorridor[];
  stations: Station[];
  value: RouteSegment[];
  onChange: (segments: RouteSegment[]) => void;
  direction: Direction;  // Base direction for the variant
}

export function RouteSequenceBuilder({
  routes,
  stations,
  value,
  onChange,
  direction,
}: RouteSequenceBuilderProps) {
  const [addingSegment, setAddingSegment] = useState<Partial<RouteSegment> | null>(null);

  const stationMap = useMemo(
    () => new Map(stations.map((s) => [s.id, s])),
    [stations]
  );

  const routeMap = useMemo(
    () => new Map(routes.map((r) => [r.id, r])),
    [routes]
  );

  // Get all stops for a segment (considering reversed and start/end subset)
  function getSegmentStops(segment: RouteSegment): RoutePathStop[] {
    const route = routeMap.get(segment.routeId);
    if (!route) return [];

    const path = route.paths.find((p) => p.id === segment.pathId);
    if (!path) return [];

    let stops = [...path.stops].sort((a, b) => a.sequence - b.sequence);

    // Apply start/end subset BEFORE reversing
    // (startStationId/endStationId are defined in forward path order)
    if (segment.startStationId) {
      const startIndex = stops.findIndex((s) => s.stationId === segment.startStationId);
      if (startIndex > 0) {
        stops = stops.slice(startIndex);
      }
    }

    if (segment.endStationId) {
      const endIndex = stops.findIndex((s) => s.stationId === segment.endStationId);
      if (endIndex >= 0 && endIndex < stops.length - 1) {
        stops = stops.slice(0, endIndex + 1);
      }
    }

    // Now apply segment's reversed flag
    if (segment.reversed) {
      stops = [...stops].reverse();
    }

    return stops;
  }

  // Get full station list for preview
  const previewStops = useMemo(() => {
    const allStops: { stationId: string; fromSegment: number }[] = [];

    for (let i = 0; i < value.length; i++) {
      const segmentStops = getSegmentStops(value[i]);
      for (const stop of segmentStops) {
        // Skip if this station is already the last one (for junction)
        if (
          allStops.length > 0 &&
          allStops[allStops.length - 1].stationId === stop.stationId
        ) {
          continue;
        }
        allStops.push({ stationId: stop.stationId, fromSegment: i });
      }
    }

    return allStops;
  }, [value, routes]);

  // Validate junction between segments
  function validateJunction(segmentIndex: number): string | null {
    if (segmentIndex === 0) return null;

    const prevSegment = value[segmentIndex - 1];
    const currSegment = value[segmentIndex];

    const prevStops = getSegmentStops(prevSegment);
    const currStops = getSegmentStops(currSegment);

    if (prevStops.length === 0 || currStops.length === 0) {
      return 'Invalid segment configuration';
    }

    const prevLastStation = prevStops[prevStops.length - 1].stationId;
    const currFirstStation = currStops[0].stationId;

    if (prevLastStation !== currFirstStation) {
      const prevStationName = stationMap.get(prevLastStation)?.name || prevLastStation;
      const currStationName = stationMap.get(currFirstStation)?.name || currFirstStation;
      return `Junction mismatch: previous segment ends at ${prevStationName}, but this segment starts at ${currStationName}`;
    }

    return null;
  }

  function handleAddSegment() {
    setAddingSegment({});
  }

  function handleConfirmSegment() {
    if (!addingSegment?.routeId || !addingSegment?.pathId) return;

    const newSegment: RouteSegment = {
      routeId: addingSegment.routeId,
      pathId: addingSegment.pathId,
      reversed: addingSegment.reversed || false,
      speedCategory: addingSegment.speedCategory || 'vrt',
      startStationId: addingSegment.startStationId,
      endStationId: addingSegment.endStationId,
    };

    onChange([...value, newSegment]);
    setAddingSegment(null);
  }

  function handleRemoveSegment(index: number) {
    const newSegments = value.filter((_, i) => i !== index);
    onChange(newSegments);
  }

  function handleUpdateSegment(index: number, updates: Partial<RouteSegment>) {
    const newSegments = [...value];
    newSegments[index] = { ...newSegments[index], ...updates };
    onChange(newSegments);
  }

  // Parse composite pathId:direction value
  function parsePathValue(compositeValue: string): { pathId: string; reversed: boolean } {
    const [pathId, dir] = compositeValue.split(':');
    return { pathId, reversed: dir === 'rev' };
  }

  // Create composite value for dropdown
  function createPathValue(pathId: string, reversed: boolean): string {
    return `${pathId}:${reversed ? 'rev' : 'fwd'}`;
  }

  function getPathStopsForDropdown(segment: RouteSegment): RoutePathStop[] {
    const route = routeMap.get(segment.routeId);
    if (!route) return [];

    const path = route.paths.find((p) => p.id === segment.pathId);
    if (!path) return [];

    let stops = [...path.stops].sort((a, b) => a.sequence - b.sequence);
    if (segment.reversed) {
      stops = [...stops].reverse();
    }
    return stops;
  }

  // Get endpoint names for a path (for display)
  function getPathEndpoints(route: RouteCorridor, path: RoutePath, reversed: boolean): string {
    const stops = [...path.stops].sort((a, b) => a.sequence - b.sequence);
    if (stops.length < 2) return path.name;

    const first = stationMap.get(reversed ? stops[stops.length - 1].stationId : stops[0].stationId);
    const last = stationMap.get(reversed ? stops[0].stationId : stops[stops.length - 1].stationId);

    if (first && last) {
      return `${first.name} → ${last.name}`;
    }
    return path.name;
  }

  return (
    <div className="space-y-4">
      {/* Existing segments */}
      {value.map((segment, index) => {
        const route = routeMap.get(segment.routeId);
        const path = route?.paths.find((p) => p.id === segment.pathId);
        const pathStops = getPathStopsForDropdown(segment);
        const junctionError = validateJunction(index);

        return (
          <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Segment {index + 1}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveSegment(index)}
                className="text-sm text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>

            {junctionError && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {junctionError}
              </div>
            )}

            <div className="space-y-3">
              {/* Route and Path row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Route selection */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Route
                  </label>
                  <select
                    value={segment.routeId}
                    onChange={(e) => {
                      const newRouteId = e.target.value;
                      const newRoute = routes.find((r) => r.id === newRouteId);
                      const firstPath = newRoute?.paths[0];
                      handleUpdateSegment(index, {
                        routeId: newRouteId,
                        pathId: firstPath?.id || '',
                        reversed: false,
                        speedCategory: 'vrt',
                        startStationId: undefined,
                        endStationId: undefined,
                      });
                    }}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select route...</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Path selection with speed buttons */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Path
                  </label>
                  <div className="flex gap-1">
                    <select
                      value={segment.pathId ? createPathValue(segment.pathId, segment.reversed) : ''}
                      onChange={(e) => {
                        const { pathId, reversed } = parsePathValue(e.target.value);
                        handleUpdateSegment(index, {
                          pathId,
                          reversed,
                          startStationId: undefined,
                          endStationId: undefined,
                        });
                      }}
                      disabled={!segment.routeId}
                      className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                      <option value="">Select path...</option>
                      {route?.paths.map((p) => (
                        <optgroup key={p.id} label={p.name}>
                          <option value={createPathValue(p.id, false)}>
                            {getPathEndpoints(route, p, false)}
                          </option>
                          <option value={createPathValue(p.id, true)}>
                            {getPathEndpoints(route, p, true)} (rev)
                          </option>
                        </optgroup>
                      ))}
                    </select>
                    {/* Speed category buttons */}
                    <div className="flex border border-gray-300 rounded overflow-hidden">
                      {(['vrt', 'fast', 'slow'] as SpeedCategory[]).map((speed) => (
                        <button
                          key={speed}
                          type="button"
                          onClick={() => handleUpdateSegment(index, { speedCategory: speed })}
                          disabled={!segment.pathId}
                          className={`px-2 py-1.5 text-xs font-medium transition-colors ${
                            segment.speedCategory === speed
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-600 hover:bg-gray-100'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={speed === 'vrt' ? 'VRT (High-speed)' : speed === 'fast' ? 'Fast' : 'Slow (Regional)'}
                        >
                          {speed[0].toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Start and End stations row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Start station (optional subset) */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Start Station (optional)
                  </label>
                  <select
                    value={segment.reversed ? segment.endStationId || '' : segment.startStationId || ''}
                    onChange={(e) => handleUpdateSegment(index, segment.reversed
                      ? { endStationId: e.target.value || undefined }
                      : { startStationId: e.target.value || undefined }
                    )}
                    disabled={!segment.pathId}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">(From beginning)</option>
                    {pathStops.map((stop) => {
                      const station = stationMap.get(stop.stationId);
                      return (
                        <option key={stop.stationId} value={stop.stationId}>
                          {station?.name || stop.stationId}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* End station (optional subset) */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    End Station (optional)
                  </label>
                  <select
                    value={segment.reversed ? segment.startStationId || '' : segment.endStationId || ''}
                    onChange={(e) => handleUpdateSegment(index, segment.reversed
                      ? { startStationId: e.target.value || undefined }
                      : { endStationId: e.target.value || undefined }
                    )}
                    disabled={!segment.pathId}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">(To end)</option>
                    {pathStops.map((stop) => {
                      const station = stationMap.get(stop.stationId);
                      return (
                        <option key={stop.stationId} value={stop.stationId}>
                          {station?.name || stop.stationId}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            {/* Segment summary */}
            {path && (
              <div className="text-xs text-gray-500">
                {route?.name} / {path.name}
                {segment.reversed && <span className="text-orange-600 ml-1">(reverse)</span>}
                <span className="text-blue-600 ml-1">
                  [{segment.speedCategory?.toUpperCase() || 'VRT'}]
                </span>
                : {getSegmentStops(segment).length} stops
              </div>
            )}
          </div>
        );
      })}

      {/* Adding new segment */}
      {addingSegment && (
        <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 bg-blue-50 space-y-3">
          <div className="text-sm font-medium text-blue-700">Add Route Segment</div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Route
              </label>
              <select
                value={addingSegment.routeId || ''}
                onChange={(e) => {
                  const newRouteId = e.target.value;
                  const newRoute = routes.find((r) => r.id === newRouteId);
                  const firstPath = newRoute?.paths[0];
                  setAddingSegment({
                    ...addingSegment,
                    routeId: newRouteId,
                    pathId: firstPath?.id,
                    reversed: false,
                    speedCategory: 'vrt',
                  });
                }}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select route...</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Path
              </label>
              <div className="flex gap-1">
                <select
                  value={addingSegment.pathId ? createPathValue(addingSegment.pathId, addingSegment.reversed || false) : ''}
                  onChange={(e) => {
                    const { pathId, reversed } = parsePathValue(e.target.value);
                    setAddingSegment({
                      ...addingSegment,
                      pathId,
                      reversed,
                    });
                  }}
                  disabled={!addingSegment.routeId}
                  className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Select path...</option>
                  {addingSegment.routeId &&
                    routeMap.get(addingSegment.routeId)?.paths.map((p) => {
                      const route = routeMap.get(addingSegment.routeId!);
                      return (
                        <optgroup key={p.id} label={p.name}>
                          <option value={createPathValue(p.id, false)}>
                            {route ? getPathEndpoints(route, p, false) : p.name}
                          </option>
                          <option value={createPathValue(p.id, true)}>
                            {route ? getPathEndpoints(route, p, true) : p.name} (rev)
                          </option>
                        </optgroup>
                      );
                    })}
                </select>
                {/* Speed category buttons */}
                <div className="flex border border-gray-300 rounded overflow-hidden">
                  {(['vrt', 'fast', 'slow'] as SpeedCategory[]).map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => setAddingSegment({ ...addingSegment, speedCategory: speed })}
                      disabled={!addingSegment.pathId}
                      className={`px-2 py-1.5 text-xs font-medium transition-colors ${
                        (addingSegment.speedCategory || 'vrt') === speed
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-100'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={speed === 'vrt' ? 'VRT (High-speed)' : speed === 'fast' ? 'Fast' : 'Slow (Regional)'}
                    >
                      {speed[0].toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAddingSegment(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmSegment}
              disabled={!addingSegment.routeId || !addingSegment.pathId}
            >
              Add Segment
            </Button>
          </div>
        </div>
      )}

      {/* Add segment button */}
      {!addingSegment && (
        <button
          type="button"
          onClick={handleAddSegment}
          className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors text-sm"
        >
          + Add Route Segment
        </button>
      )}

      {/* Preview */}
      {previewStops.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-xs font-medium text-gray-500 mb-2">
            Station Preview ({previewStops.length} stops)
          </div>
          <div className="flex flex-wrap gap-1">
            {previewStops.map((stop, index) => {
              const station = stationMap.get(stop.stationId);
              const isFirst = index === 0;
              const isLast = index === previewStops.length - 1;
              return (
                <span
                  key={`${stop.stationId}-${index}`}
                  className={`text-xs px-2 py-1 rounded ${
                    isFirst || isLast
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {station?.name || stop.stationId}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {value.length === 0 && (
        <div className="text-center py-4 text-sm text-gray-500">
          Add at least one route segment to define the variant&apos;s path.
        </div>
      )}
    </div>
  );
}

// Helper to convert route segments to VariantRouteRefs
// The direction is computed from segment.reversed and the base direction
export function segmentsToRouteRefs(
  segments: RouteSegment[],
  baseDirection: Direction
): VariantRouteRef[] {
  return segments.map((seg) => ({
    routeId: seg.routeId,
    pathId: seg.pathId,
    // Direction indicates how the path is traversed (outbound=forward, inbound=reversed)
    // Must be symmetric with segment reconstruction: reversed = (ref.direction !== variant.direction)
    direction: seg.reversed
      ? (baseDirection === 'outbound' ? 'inbound' : 'outbound')
      : baseDirection,
    speedCategory: seg.speedCategory || 'vrt',
    startStationId: seg.startStationId,
    endStationId: seg.endStationId,
  }));
}

// Helper to convert route segments to VariantStops (prefilled from route)
// Note: Variants no longer store arrival/departure offsets - times are calculated on-the-fly
export function segmentsToVariantStops(
  segments: RouteSegment[],
  routes: RouteCorridor[]
): VariantStop[] {
  const routeMap = new Map(routes.map((r) => [r.id, r]));
  const allStops: VariantStop[] = [];
  let sequence = 1;

  for (const segment of segments) {
    const route = routeMap.get(segment.routeId);
    if (!route) continue;

    const path = route.paths.find((p) => p.id === segment.pathId);
    if (!path) continue;

    let stops = [...path.stops].sort((a, b) => a.sequence - b.sequence);

    // Apply start/end subset BEFORE reversing
    // (startStationId/endStationId are defined in forward path order)
    if (segment.startStationId) {
      const startIndex = stops.findIndex((s) => s.stationId === segment.startStationId);
      if (startIndex > 0) {
        stops = stops.slice(startIndex);
      }
    }

    if (segment.endStationId) {
      const endIndex = stops.findIndex((s) => s.stationId === segment.endStationId);
      if (endIndex >= 0 && endIndex < stops.length - 1) {
        stops = stops.slice(0, endIndex + 1);
      }
    }

    // Now apply segment's reversed flag
    if (segment.reversed) {
      stops = [...stops].reverse();
    }

    for (const stop of stops) {
      // Skip if this is a junction (same as last station)
      if (allStops.length > 0 && allStops[allStops.length - 1].stationId === stop.stationId) {
        continue;
      }

      allStops.push({
        stationId: stop.stationId,
        sequence: sequence++,
        dwellTime: stop.defaultDwellTime ?? 1,
        platform: '1', // Default, needs to be selected
        stopType: 'regular',
      });
    }
  }

  return allStops;
}

// Helper to convert route segments to RouteStop[] for the RouteBuilder component
// Includes dwellTime from route's defaultDwellTime
// Uses getSegmentTime to lookup time based on segment's speedCategory
export function segmentsToRouteStops(
  segments: RouteSegment[],
  routes: RouteCorridor[]
): RouteStop[] {
  const routeMap = new Map(routes.map((r) => [r.id, r]));
  const allStops: RouteStop[] = [];

  for (const segment of segments) {
    const route = routeMap.get(segment.routeId);
    if (!route) continue;

    const path = route.paths.find((p) => p.id === segment.pathId);
    if (!path) continue;

    let stops = [...path.stops].sort((a, b) => a.sequence - b.sequence);

    // Apply start/end subset BEFORE reversing
    // (startStationId/endStationId are defined in forward path order)
    if (segment.startStationId) {
      const startIndex = stops.findIndex((s) => s.stationId === segment.startStationId);
      if (startIndex > 0) {
        stops = stops.slice(startIndex);
      }
    }

    if (segment.endStationId) {
      const endIndex = stops.findIndex((s) => s.stationId === segment.endStationId);
      if (endIndex >= 0 && endIndex < stops.length - 1) {
        stops = stops.slice(0, endIndex + 1);
      }
    }

    // Now apply segment's reversed flag
    if (segment.reversed) {
      stops = [...stops].reverse();
    }

    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];

      // Skip if this is a junction (same as last station)
      if (allStops.length > 0 && allStops[allStops.length - 1].stationId === stop.stationId) {
        continue;
      }

      const isFirst = allStops.length === 0;

      // Get time using speed category priority, with reverse adjustment if applicable
      const reverseAdj = segment.reversed
        ? path.reverseTimeAdjustments?.find((adj) => adj.stationId === stop.stationId)
        : undefined;

      let timeFromPrevious: number;
      if (isFirst || i === 0) {
        // First station overall OR first station of this segment (not a junction)
        // If it were a junction, it would have been skipped above
        timeFromPrevious = 0;
      } else if (reverseAdj) {
        // Use reverse adjustment if available (overrides calculated time)
        timeFromPrevious = getSegmentTime(stop, segment.speedCategory || 'vrt', reverseAdj);
      } else {
        // For reversed paths, the travel time to stops[i] is stored on stops[i-1]
        // (because times are stored as "time from previous station in FORWARD direction")
        const timeSource = segment.reversed ? stops[i - 1] : stop;
        timeFromPrevious = getSegmentTime(timeSource, segment.speedCategory || 'vrt');
      }

      allStops.push({
        stationId: stop.stationId,
        minutesFromPrevious: timeFromPrevious,
        dwellTime: stop.defaultDwellTime ?? 1,
        platform: '1', // Default, needs to be selected
      });
    }
  }

  return allStops;
}

// Helper to create reversed RouteStops from forward stops
// Uses getSegmentTime with reverse adjustments and speed category
export function reverseRouteStops(
  forwardStops: RouteStop[],
  segments: RouteSegment[],
  routes: RouteCorridor[]
): RouteStop[] {
  if (forwardStops.length === 0) return [];

  const routeMap = new Map(routes.map((r) => [r.id, r]));

  // Create reversed stops array
  const reversed = [...forwardStops].reverse();

  // Build a station-to-segment map for looking up times
  const stationToPathInfo = new Map<string, {
    path: RoutePath;
    stop: RoutePathStop;
    segment: RouteSegment;
  }>();

  for (const segment of segments) {
    const route = routeMap.get(segment.routeId);
    const path = route?.paths.find((p) => p.id === segment.pathId);
    if (!path) continue;

    for (const stop of path.stops) {
      stationToPathInfo.set(stop.stationId, { path, stop, segment });
    }
  }

  // Recalculate times for reversed order
  return reversed.map((stop, index) => {
    if (index === 0) {
      // First stop has no travel time from previous
      return { ...stop, minutesFromPrevious: 0 };
    }

    // For subsequent stops, use the travel time from the original order
    // The time from A->B in forward becomes time from B->A in reverse
    const prevStopInReverse = reversed[index - 1];

    // Find the forward time: in forward order, what was the time to get from
    // the current reversed stop to the previous reversed stop?
    const forwardIndex = forwardStops.findIndex(s => s.stationId === stop.stationId);
    const nextForwardIndex = forwardStops.findIndex(s => s.stationId === prevStopInReverse.stationId);

    let timeFromPrevious = 5; // Default fallback

    if (forwardIndex !== -1 && nextForwardIndex !== -1 && nextForwardIndex > forwardIndex) {
      // The next station in forward order has the travel time we need
      timeFromPrevious = forwardStops[nextForwardIndex].minutesFromPrevious;
    } else if (forwardIndex !== -1 && forwardIndex > 0) {
      // Use this station's forward travel time as approximation
      timeFromPrevious = forwardStops[forwardIndex].minutesFromPrevious;
    }

    // Apply reverse time adjustment if available using getSegmentTime
    const pathInfo = stationToPathInfo.get(stop.stationId);
    if (pathInfo) {
      const reverseAdj = pathInfo.path.reverseTimeAdjustments?.find(
        (adj) => adj.stationId === stop.stationId
      );
      if (reverseAdj) {
        timeFromPrevious = getSegmentTime(
          pathInfo.stop,
          pathInfo.segment.speedCategory || 'vrt',
          reverseAdj
        );
      }
    }

    return { ...stop, minutesFromPrevious: timeFromPrevious };
  });
}

// Helper to validate that all segment junctions connect properly
// Returns error message if invalid, null if valid
export function validateSegmentJunctions(
  segments: RouteSegment[],
  routes: RouteCorridor[],
  stations: Station[]
): string | null {
  if (segments.length < 2) return null;

  const routeMap = new Map(routes.map((r) => [r.id, r]));
  const stationMap = new Map(stations.map((s) => [s.id, s]));

  function getSegmentStops(segment: RouteSegment): string[] {
    const route = routeMap.get(segment.routeId);
    if (!route) return [];

    const path = route.paths.find((p) => p.id === segment.pathId);
    if (!path) return [];

    let stops = [...path.stops].sort((a, b) => a.sequence - b.sequence);

    // Apply start/end subset BEFORE reversing
    // (startStationId/endStationId are defined in forward path order)
    let stationIds = stops.map((s) => s.stationId);

    if (segment.startStationId) {
      const startIndex = stationIds.indexOf(segment.startStationId);
      if (startIndex > 0) {
        stationIds = stationIds.slice(startIndex);
      }
    }

    if (segment.endStationId) {
      const endIndex = stationIds.indexOf(segment.endStationId);
      if (endIndex >= 0 && endIndex < stationIds.length - 1) {
        stationIds = stationIds.slice(0, endIndex + 1);
      }
    }

    // Now apply reversed flag
    if (segment.reversed) {
      stationIds = [...stationIds].reverse();
    }

    return stationIds;
  }

  for (let i = 1; i < segments.length; i++) {
    const prevStops = getSegmentStops(segments[i - 1]);
    const currStops = getSegmentStops(segments[i]);

    if (prevStops.length === 0 || currStops.length === 0) {
      return `Segment ${i} or ${i + 1} has no valid stops`;
    }

    const prevLastStation = prevStops[prevStops.length - 1];
    const currFirstStation = currStops[0];

    if (prevLastStation !== currFirstStation) {
      const prevName = stationMap.get(prevLastStation)?.name || prevLastStation;
      const currName = stationMap.get(currFirstStation)?.name || currFirstStation;
      return `Segments don't connect: Segment ${i} ends at "${prevName}" but Segment ${i + 1} starts at "${currName}"`;
    }
  }

  return null;
}
