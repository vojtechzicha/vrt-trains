'use client';

import { useState, useEffect } from 'react';
import { DepartureRow } from './DepartureRow';
import { LiveClock } from './LiveClock';
import { DepartureInfo } from '@/types';

interface DepartureBoardProps {
  stationName: string;
  departures: DepartureInfo[];
}

function getCurrentTimeString(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

function isWithinMinutes(departureTime: string, currentTime: string, minutes: number): boolean {
  const [depH, depM] = departureTime.split(':').map(Number);
  const [curH, curM] = currentTime.split(':').map(Number);
  const depMinutes = depH * 60 + depM;
  const curMinutes = curH * 60 + curM;
  const diff = depMinutes - curMinutes;
  return diff >= 0 && diff <= minutes;
}

export function DepartureBoard({ stationName, departures }: DepartureBoardProps) {
  const [currentTime, setCurrentTime] = useState(() => getCurrentTimeString());
  const [showPast, setShowPast] = useState(false);
  const [headerMode, setHeaderMode] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cycle header: Line → Variant → Train
  useEffect(() => {
    const interval = setInterval(() => {
      setHeaderMode((m) => ((m + 1) % 3) as 0 | 1 | 2);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const headerLabels = ['Line', 'Line', 'Train'];

  const pastDepartures = departures.filter((d) => d.time < currentTime);
  const upcomingDepartures = departures.filter((d) => d.time >= currentTime);

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm text-gray-400">Departures from</div>
            <h2 className="text-2xl font-bold text-white">{stationName}</h2>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Current time</div>
            <LiveClock className="text-2xl text-amber-400" />
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="bg-gray-800 px-6 py-2 border-b border-gray-700 flex gap-4 text-xs text-gray-400 uppercase tracking-wider">
        <div className="w-20">Time</div>
        <div className="w-24 text-center">{headerLabels[headerMode]}</div>
        <div className="flex-1">Destination</div>
        <div className="w-64">Calling at</div>
        <div className="w-52">Via</div>
        <div className="text-right w-28">Platform</div>
      </div>

      {/* Past departures toggle */}
      {pastDepartures.length > 0 && (
        <button
          onClick={() => setShowPast(!showPast)}
          className="w-full px-6 py-2 text-sm text-gray-400 hover:text-gray-300 bg-gray-800/50 hover:bg-gray-800 border-b border-gray-700 transition-colors flex items-center justify-center gap-2"
        >
          <span className={`transform transition-transform ${showPast ? 'rotate-180' : ''}`}>
            ^
          </span>
          {showPast ? 'Hide earlier departures' : `Show ${pastDepartures.length} earlier departure${pastDepartures.length > 1 ? 's' : ''}`}
        </button>
      )}

      {/* Past departures (collapsed by default) */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          showPast ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {pastDepartures.map((dep, idx) => (
          <DepartureRow
            key={`past-${dep.trainNumber}-${idx}`}
            time={dep.time}
            lineIdentifier={dep.lineIdentifier}
            lineColor={dep.lineColor}
            lineTextColor={dep.lineTextColor}
            destination={dep.destination}
            platform={dep.platform}
            viaStations={dep.viaStations}
            allStations={dep.allStations}
            variantCode={dep.variantCode}
            variantName={dep.variantName}
            trainNumber={dep.trainNumber}
            isPast={true}
            isNext={false}
            isDepartingSoon={false}
            fromStationName={dep.fromStationName}
          />
        ))}
      </div>

      {/* Upcoming departures */}
      <div>
        {upcomingDepartures.length === 0 && pastDepartures.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            No scheduled departures
          </div>
        ) : upcomingDepartures.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            No more departures today
          </div>
        ) : (
          upcomingDepartures.map((dep, idx) => (
            <DepartureRow
              key={`${dep.trainNumber}-${idx}`}
              time={dep.time}
              lineIdentifier={dep.lineIdentifier}
              lineColor={dep.lineColor}
              lineTextColor={dep.lineTextColor}
              destination={dep.destination}
              platform={dep.platform}
              viaStations={dep.viaStations}
              allStations={dep.allStations}
              variantCode={dep.variantCode}
              variantName={dep.variantName}
              trainNumber={dep.trainNumber}
              isPast={false}
              isNext={idx === 0}
              isDepartingSoon={isWithinMinutes(dep.time, currentTime, 5)}
              fromStationName={dep.fromStationName}
            />
          ))
        )}
      </div>
    </div>
  );
}
