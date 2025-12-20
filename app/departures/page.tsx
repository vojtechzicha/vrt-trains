import Link from 'next/link';
import { getVirtualStations, getPhysicalStations } from '@/lib/data';
import { Card, CardBody } from '@/components/ui';
import { Station } from '@/types';

function StationDepartureCard({ station, showCountry }: { station: Station; showCountry?: boolean }) {
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
                : showCountry && station.country && station.country !== 'Czech'
                  ? station.country
                  : 'View departures →'}
            </p>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

export default async function DeparturesPage() {
  const virtualStations = await getVirtualStations();
  const physicalStations = await getPhysicalStations();

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
  }, {} as Record<string, typeof otherStations>);

  const otherCountries = Object.keys(stationsByCountry).sort();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Departure Boards</h1>
      <p className="text-gray-500 mb-6">Select a station to view its departure board</p>

      {/* Virtual/City Stations Section */}
      {virtualStations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span className="text-xl">🏙</span>
            City Stations
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {virtualStations.map((station) => (
              <StationDepartureCard key={station.id} station={station} />
            ))}
          </div>
        </div>
      )}

      {/* Czech Stations Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Czech Stations</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {czechStations.map((station) => (
            <StationDepartureCard key={station.id} station={station} />
          ))}
        </div>
      </div>

      {/* Other Countries Sections */}
      {otherCountries.map((country) => (
        <div key={country} className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">{country}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stationsByCountry[country].map((station) => (
              <StationDepartureCard key={station.id} station={station} showCountry />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
