'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Station } from '@/types';
import { smartMatchStation } from '@/lib/search/smartSearch';
import { StationCard } from './StationCard';
import { Card, CardBody } from '@/components/ui';

type CardVariant = 'station' | 'departure';

interface StationSearchListProps {
  stations: Station[];
  variant?: CardVariant;
  emptyMessage?: string;
}

export function StationSearchList({
  stations,
  variant = 'station',
  emptyMessage = 'No stations found',
}: StationSearchListProps) {
  const [search, setSearch] = useState('');

  const filteredStations = useMemo(
    () => stations.filter((s) => smartMatchStation(search, s)),
    [stations, search]
  );

  const virtualStations = filteredStations.filter((s) => s.isVirtual);
  const physicalStations = filteredStations.filter((s) => !s.isVirtual);

  // Group physical stations by country
  const czechStations = physicalStations.filter((s) => !s.country || s.country === 'Czech');
  const otherStations = physicalStations.filter((s) => s.country && s.country !== 'Czech');

  // Group other stations by country
  const stationsByCountry = otherStations.reduce((acc, station) => {
    const country = station.country!;
    if (!acc[country]) {
      acc[country] = [];
    }
    acc[country].push(station);
    return acc;
  }, {} as Record<string, Station[]>);

  const otherCountries = Object.keys(stationsByCountry).sort();

  const renderCard = (station: Station) => {
    if (variant === 'departure') {
      return <DepartureCard station={station} />;
    }
    return (
      <StationCard
        station={station}
        memberCount={station.memberStationIds?.length}
        showCountry={station.country !== 'Czech'}
      />
    );
  };

  return (
    <div>
      {/* Search Input */}
      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search stations... (try 'p h n' for Praha hl.n.)"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {search && (
          <p className="mt-2 text-sm text-gray-500">
            {filteredStations.length} station{filteredStations.length !== 1 ? 's' : ''} found
          </p>
        )}
      </div>

      {filteredStations.length === 0 ? (
        <div className="text-center py-12 text-gray-500">{emptyMessage}</div>
      ) : (
        <>
          {/* Virtual/City Stations Section */}
          {virtualStations.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <span className="text-xl">🏙</span>
                City Stations
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {virtualStations.map((station) => (
                  <div key={station.id}>{renderCard(station)}</div>
                ))}
              </div>
            </div>
          )}

          {/* Czech Stations Section */}
          {czechStations.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">Czech Stations</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {czechStations.map((station) => (
                  <div key={station.id}>{renderCard(station)}</div>
                ))}
              </div>
            </div>
          )}

          {/* Other Countries Sections */}
          {otherCountries.map((country) => (
            <div key={country} className="mb-8">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">{country}</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {stationsByCountry[country].map((station) => (
                  <div key={station.id}>{renderCard(station)}</div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// Inline departure card for the departure variant
function DepartureCard({ station }: { station: Station }) {
  const isVirtual = station.isVirtual;

  return (
    <Link href={`/departures/${station.id}`}>
      <Card className={`hover:shadow-md transition-shadow cursor-pointer ${isVirtual ? 'ring-2 ring-amber-400' : ''}`}>
        <CardBody className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${
            isVirtual
              ? 'bg-amber-500 text-white'
              : 'bg-gray-900 text-amber-400'
          }`}>
            {isVirtual ? (
              <span className="text-lg">🏙</span>
            ) : (
              station.code
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{station.name}</h3>
            <p className="text-sm text-gray-500">
              {isVirtual
                ? `Combined departures (${station.memberStationIds?.length || 0} stations)`
                : station.country && station.country !== 'Czech'
                  ? station.country
                  : 'View departures →'}
            </p>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
