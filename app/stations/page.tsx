import { getStations, getVirtualStations, getPhysicalStations } from '@/lib/data';
import { StationCard } from '@/components/stations';

export default async function StationsPage() {
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Stations</h1>

      {/* Virtual/City Stations Section */}
      {virtualStations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span className="text-xl">🏙</span>
            City Stations
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {virtualStations.map((station) => (
              <StationCard
                key={station.id}
                station={station}
                memberCount={station.memberStationIds?.length}
              />
            ))}
          </div>
        </div>
      )}

      {/* Czech Stations Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Czech Stations</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {czechStations.map((station) => (
            <StationCard key={station.id} station={station} />
          ))}
        </div>
      </div>

      {/* Other Countries Sections */}
      {otherCountries.map((country) => (
        <div key={country} className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">{country}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stationsByCountry[country].map((station) => (
              <StationCard key={station.id} station={station} showCountry />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
