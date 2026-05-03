'use client';

import { useState, useMemo } from 'react';
import { DepartureBoard } from './DepartureBoard';
import { DepartureInfo, Platform } from '@/types';

interface DepartureBoardWithTabsProps {
  stationName: string;
  departures: DepartureInfo[];
  platforms: Platform[];
  isVirtual: boolean;
}

export function DepartureBoardWithTabs({
  stationName,
  departures,
  platforms,
  isVirtual,
}: DepartureBoardWithTabsProps) {
  // Create platform name lookup
  const platformNameMap = useMemo(() => {
    const map = new Map<string, string>();
    platforms.forEach((p) => {
      if (p.name) map.set(p.code, p.name);
    });
    return map;
  }, [platforms]);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  // Get platforms that have departures, preserving station-defined order
  const platformsWithDepartures = useMemo(() => {
    // Collect platforms that have departures
    const platformsInUse = new Set<string>();
    departures.forEach((d) => {
      if (d.platform) {
        platformsInUse.add(d.platform);
      }
    });

    // Return station platforms in their defined order, filtered to those with departures
    return platforms
      .map((p) => p.code)
      .filter((code) => platformsInUse.has(code));
  }, [departures, platforms]);

  // Determine if we should show tabs
  const showTabs = !isVirtual && platformsWithDepartures.length > 1;

  // Filter departures based on selected platform
  const filteredDepartures = useMemo(() => {
    if (!selectedPlatform) {
      return departures;
    }
    return departures.filter((d) => d.platform === selectedPlatform);
  }, [departures, selectedPlatform]);

  // Build display name for header
  const displayName = selectedPlatform
    ? platformNameMap.get(selectedPlatform)
      ? `${stationName} - Platform ${selectedPlatform} (${platformNameMap.get(selectedPlatform)})`
      : `${stationName} - Platform ${selectedPlatform}`
    : stationName;

  return (
    <div>
      {/* Platform tabs */}
      {showTabs && (
        <div className="mb-4 flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedPlatform(null)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              selectedPlatform === null
                ? 'bg-amber-500 text-gray-900 dark:text-gray-100'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            All Platforms
          </button>
          {platformsWithDepartures.map((platform) => {
            const platformName = platformNameMap.get(platform);
            return (
              <button
                key={platform}
                onClick={() => setSelectedPlatform(platform)}
                title={platformName || undefined}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  selectedPlatform === platform
                    ? 'bg-amber-500 text-gray-900 dark:text-gray-100'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Platform {platform}
              </button>
            );
          })}
        </div>
      )}

      <DepartureBoard stationName={displayName} departures={filteredDepartures} />
    </div>
  );
}
