'use client';

import { useState } from 'react';
import { Variant, Station } from '@/types';
import { Button } from '@/components/ui';

interface ForkSelectorProps {
  variants: Variant[];
  stations: Station[];
  onFork: (sourceVariant: Variant, options?: { truncateAtStationId?: string; reverse?: boolean }) => void;
  onClose: () => void;
}

export function ForkSelector({ variants, stations, onFork, onClose }: ForkSelectorProps) {
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [truncateAt, setTruncateAt] = useState<string | null>(null);
  const [reverse, setReverse] = useState(false);

  const stationMap = new Map(stations.map((s) => [s.id, s]));

  function handleSelectVariant(variant: Variant) {
    setSelectedVariant(variant);
    setTruncateAt(null);
    setReverse(false);
  }

  function handleFork() {
    if (!selectedVariant) return;
    onFork(selectedVariant, {
      truncateAtStationId: truncateAt || undefined,
      reverse,
    });
  }

  function getStationName(stationId: string): string {
    return stationMap.get(stationId)?.name || 'Unknown';
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Fork from Existing Variant</h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 text-xl"
          >
            &times;
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(80vh-8rem)]">
          {!selectedVariant ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Select a variant to fork from:
              </p>
              {variants.map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => handleSelectVariant(variant)}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{variant.code}</span>
                    <span className="text-gray-500 dark:text-gray-400">{variant.name}</span>
                  </div>
                  <div className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    {getStationName(variant.stations[0]?.stationId)} →{' '}
                    {getStationName(variant.stations[variant.stations.length - 1]?.stationId)}{' '}
                    ({variant.stations.length} stops)
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono font-semibold">{selectedVariant.code}</span>
                  <span className="text-gray-500 dark:text-gray-400 ml-2">{selectedVariant.name}</span>
                </div>
                <button
                  onClick={() => setSelectedVariant(null)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Change
                </button>
              </div>

              <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-950 rounded-lg">
                <input
                  type="checkbox"
                  id="reverse"
                  checked={reverse}
                  onChange={(e) => setReverse(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="reverse" className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Reverse route</span>
                  <span className="text-gray-500 dark:text-gray-400 ml-1">
                    (create {selectedVariant.direction === 'outbound' ? 'inbound' : 'outbound'} variant)
                  </span>
                </label>
              </div>

              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Select where to truncate (optional):
                </p>
                <div className="space-y-1">
                  <button
                    onClick={() => setTruncateAt(null)}
                    className={`w-full text-left px-3 py-2 rounded text-sm ${
                      truncateAt === null
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    Full route (no truncation)
                  </button>
                  {selectedVariant.stations.slice(1).map((stop, index) => (
                    <button
                      key={stop.stationId}
                      onClick={() => setTruncateAt(stop.stationId)}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${
                        truncateAt === stop.stationId
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="text-gray-400 dark:text-gray-500 mr-2">{index + 2}.</span>
                      Truncate at {getStationName(stop.stationId)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleFork} disabled={!selectedVariant}>
            Fork Variant
          </Button>
        </div>
      </div>
    </div>
  );
}
