'use client';

import { useState, useEffect } from 'react';
import { LineBadge } from '@/components/lines';
import { ViaStationsCycler } from './ViaStationsCycler';
import { StationMarquee } from './StationMarquee';

interface DepartureRowProps {
  time: string;
  lineIdentifier: string;
  lineColor: string;
  lineTextColor: string;
  destination: string;
  platform: string;
  viaStations: string[];
  allStations: string[];
  variantCode: string;
  variantName: string;
  trainNumber: string;
  isPast?: boolean;
  isNext?: boolean;
  isDepartingSoon?: boolean;
  fromStationName?: string;
}

export function DepartureRow({
  time,
  lineIdentifier,
  lineColor,
  lineTextColor,
  destination,
  platform,
  viaStations,
  allStations,
  variantCode,
  variantName,
  trainNumber,
  isPast = false,
  isNext = false,
  isDepartingSoon = false,
  fromStationName,
}: DepartureRowProps) {
  // Cycle through: 0 = line, 1 = variant, 2 = train number
  const [displayMode, setDisplayMode] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayMode((m) => ((m + 1) % 3) as 0 | 1 | 2);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const rowClasses = [
    'flex items-center gap-4 px-6 py-4 border-b border-gray-700 last:border-b-0 transition-all duration-300',
    isPast ? 'opacity-50' : 'hover:bg-gray-800/50',
    isNext ? 'bg-amber-900/20 border-l-4 border-l-amber-400' : '',
  ].join(' ');

  const timeClasses = [
    'w-20 text-3xl font-mono font-bold',
    isPast ? 'text-gray-500' : 'text-amber-400',
    isDepartingSoon && !isPast ? 'animate-pulse' : '',
  ].join(' ');

  return (
    <div className={rowClasses}>
      <div className={timeClasses}>
        {time}
      </div>
      <div className="w-24 flex justify-center">
        <div className="transition-opacity duration-300">
          {displayMode === 2 ? (
            <div className={`text-lg font-mono ${isPast ? 'text-gray-500' : 'text-gray-300'}`}>
              {trainNumber}
            </div>
          ) : (
            <LineBadge
              identifier={displayMode === 1 && variantCode !== lineIdentifier ? variantCode : lineIdentifier}
              color={lineColor}
              textColor={lineTextColor}
              className={`text-lg ${isPast ? 'opacity-70' : ''}`}
            />
          )}
        </div>
      </div>
      <div className="flex-1">
        <div className={`text-xl font-semibold ${isPast ? 'text-gray-400' : 'text-white'}`}>
          {destination}
        </div>
      </div>
      <div className="w-64">
        <StationMarquee
          stations={allStations}
          className={isPast ? 'opacity-70' : ''}
        />
      </div>
      <div className="w-52">
        <ViaStationsCycler
          stations={viaStations}
          variantName={variantName}
          className={isPast ? 'opacity-70' : ''}
        />
      </div>
      <div className="w-28 text-right">
        {fromStationName ? (
          <>
            <div className="text-xs text-gray-500 truncate" title={fromStationName}>
              {fromStationName}
            </div>
            <div className={`text-2xl font-bold ${isPast ? 'text-gray-400' : 'text-white'}`}>
              Plt {platform}
            </div>
          </>
        ) : (
          <>
            <div className="text-sm text-gray-400">Platform</div>
            <div className={`text-2xl font-bold ${isPast ? 'text-gray-400' : 'text-white'}`}>
              {platform}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
