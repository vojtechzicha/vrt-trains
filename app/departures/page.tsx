import { getStations } from '@/lib/data';
import { StationSearchList } from '@/components/stations';

export default async function DeparturesPage() {
  const stations = await getStations();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Departure Boards</h1>
      <p className="text-gray-500 mb-6">Select a station to view its departure board</p>

      <StationSearchList stations={stations} variant="departure" />
    </div>
  );
}
