import { getStations } from '@/lib/data';
import { StationSearchList } from '@/components/stations';

export default async function StationsPage() {
  const stations = await getStations();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Stations</h1>

      <StationSearchList stations={stations} variant="station" />
    </div>
  );
}
