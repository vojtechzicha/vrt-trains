'use client';

import { useState } from 'react';
import { Station, RouteCorridor, RoutePath, RoutePathStop } from '@/types';
import { RoutePathEditor, RoutePathLookup } from './RoutePathEditor';
import { Button } from '@/components/ui';

interface RouteCorridorEditorProps {
  stations: Station[];
  value: Omit<RouteCorridor, 'id' | 'createdAt' | 'updatedAt'>;
  onChange: (route: Omit<RouteCorridor, 'id' | 'createdAt' | 'updatedAt'>) => void;
  lockedPathIds?: string[]; // Paths that are used by variants
  routePathLookup?: RoutePathLookup; // Lookup for prefilling distance/time/dwell
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
}

export function RouteCorridorEditor({
  stations,
  value,
  onChange,
  lockedPathIds = [],
  routePathLookup,
  onSave,
  onCancel,
  saving = false,
}: RouteCorridorEditorProps) {
  const [expandedPathIndex, setExpandedPathIndex] = useState<number | null>(
    value.paths.length > 0 ? 0 : null
  );

  function handleNameChange(name: string) {
    onChange({ ...value, name });
  }

  function handleDescriptionChange(description: string) {
    onChange({ ...value, description: description || undefined });
  }

  function handlePathChange(index: number, path: RoutePath) {
    const newPaths = [...value.paths];
    newPaths[index] = path;
    onChange({ ...value, paths: newPaths });
  }

  function handleAddPath() {
    // Create a new path with default stops from the first path (if exists)
    let defaultStops: RoutePathStop[] = [];

    if (value.paths.length > 0 && value.paths[0].stops.length >= 2) {
      // Copy first and last station from existing path
      const existingPath = value.paths[0];
      defaultStops = [
        { ...existingPath.stops[0] },
        { ...existingPath.stops[existingPath.stops.length - 1], sequence: 2 },
      ];
    }

    const newPath: RoutePath = {
      id: '', // Will be assigned by backend
      name: `Path ${value.paths.length + 1}`,
      stops: defaultStops,
    };

    const newPaths = [...value.paths, newPath];
    onChange({ ...value, paths: newPaths });
    setExpandedPathIndex(newPaths.length - 1);
  }

  function handleRemovePath(index: number) {
    const pathToRemove = value.paths[index];
    if (pathToRemove.id && lockedPathIds.includes(pathToRemove.id)) {
      return; // Can't remove locked paths
    }

    const newPaths = value.paths.filter((_, i) => i !== index);
    onChange({ ...value, paths: newPaths });

    if (expandedPathIndex === index) {
      setExpandedPathIndex(newPaths.length > 0 ? 0 : null);
    } else if (expandedPathIndex !== null && expandedPathIndex > index) {
      setExpandedPathIndex(expandedPathIndex - 1);
    }
  }

  function handleDuplicatePath(index: number) {
    const sourcePath = value.paths[index];
    const newPath: RoutePath = {
      id: '', // New path, will get ID from backend
      name: `${sourcePath.name} (copy)`,
      stops: sourcePath.stops.map((stop) => ({ ...stop })),
      reverseTimeAdjustments: sourcePath.reverseTimeAdjustments?.map((adj) => ({
        ...adj,
      })),
    };

    const newPaths = [...value.paths, newPath];
    onChange({ ...value, paths: newPaths });
    setExpandedPathIndex(newPaths.length - 1);
  }

  const isValid =
    value.name.trim() !== '' &&
    value.paths.length > 0 &&
    value.paths.every(
      (path) => path.name.trim() !== '' && path.stops.length >= 2
    );

  return (
    <div className="space-y-6">
      {/* Route info */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Route Corridor Name *
          </label>
          <input
            type="text"
            value={value.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g., Praha - Brno Corridor"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <textarea
            value={value.description || ''}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="Additional notes about this route corridor..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Paths section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            Paths ({value.paths.length})
          </h3>
          <Button onClick={handleAddPath} variant="secondary" size="sm">
            + Add Path
          </Button>
        </div>

        {value.paths.length === 0 ? (
          <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500">
            <p>No paths defined yet.</p>
            <p className="text-sm mt-1">
              Add at least one path to define the route.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {value.paths.map((path, index) => {
              const isExpanded = expandedPathIndex === index;
              const isLocked = path.id ? lockedPathIds.includes(path.id) : false;
              const stationMap = new Map(stations.map((s) => [s.id, s]));
              const firstStation = stationMap.get(path.stops[0]?.stationId);
              const lastStation = stationMap.get(
                path.stops[path.stops.length - 1]?.stationId
              );

              return (
                <div
                  key={path.id || `path-${index}`}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  {/* Path header */}
                  <div
                    className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                      isExpanded ? 'bg-blue-50' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() =>
                      setExpandedPathIndex(isExpanded ? null : index)
                    }
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                      <div>
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {path.name || 'Unnamed Path'}
                          {isLocked && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                              In Use
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {path.stops.length} stops
                          {firstStation && lastStation && (
                            <>
                              {' '}
                              | {firstStation.name} → {lastStation.name}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => handleDuplicatePath(index)}
                        className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
                        title="Duplicate path"
                      >
                        Duplicate
                      </button>
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => handleRemovePath(index)}
                          className="px-2 py-1 text-xs text-red-600 hover:text-red-900 hover:bg-red-100 rounded"
                          title="Remove path"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Path editor (expanded) */}
                  {isExpanded && (
                    <div className="p-4 border-t border-gray-200 bg-white">
                      <RoutePathEditor
                        stations={stations}
                        value={path}
                        onChange={(updatedPath) =>
                          handlePathChange(index, updatedPath)
                        }
                        isLocked={isLocked}
                        routePathLookup={routePathLookup}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button onClick={onCancel} variant="secondary" disabled={saving}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={saving || !isValid}>
          {saving ? 'Saving...' : 'Save Route'}
        </Button>
      </div>
    </div>
  );
}
