'use client';

import { useState, useMemo } from 'react';
import { DepartureBoard } from './DepartureBoard';
import { DepartureInfo } from '@/types';

interface DepartureBoardWithTabsProps {
  stationName: string;
  departures: DepartureInfo[];
  platformCount: number;
  isVirtual: boolean;
}

export function DepartureBoardWithTabs({
  stationName,
  departures,
  platformCount,
  isVirtual,
}: DepartureBoardWithTabsProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  // Get unique platforms that have departures
  const platformsWithDepartures = useMemo(() => {
    const platforms = new Set<string>();
    departures.forEach((d) => {
      if (d.platform) {
        platforms.add(d.platform);
      }
    });
    // Sort numerically
    return [...platforms].sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });
  }, [departures]);

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
    ? `${stationName} - Platform ${selectedPlatform}`
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
                ? 'bg-amber-500 text-gray-900'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            All Platforms
          </button>
          {platformsWithDepartures.map((platform) => (
            <button
              key={platform}
              onClick={() => setSelectedPlatform(platform)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                selectedPlatform === platform
                  ? 'bg-amber-500 text-gray-900'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Platform {platform}
            </button>
          ))}
        </div>
      )}

      <DepartureBoard stationName={displayName} departures={filteredDepartures} />
    </div>
  );
}
