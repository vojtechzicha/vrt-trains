import Link from 'next/link';
import { getLines, getStations, getVariants } from '@/lib/data';
import { Card, CardHeader, CardBody } from '@/components/ui';
import { LineCard } from '@/components/lines';
import { StationCard } from '@/components/stations';

export default async function Home() {
  const [lines, stations, variants] = await Promise.all([
    getLines(),
    getStations(),
    getVariants(),
  ]);

  // Calculate actual variant counts from variants.json
  const variantCounts = new Map<string, number>();
  for (const variant of variants) {
    variantCounts.set(variant.lineId, (variantCounts.get(variant.lineId) || 0) + 1);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">VRT Train Network</h1>
        <p className="text-gray-500 mt-2">
          Fictional train line management system
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-blue-600">{lines.length}</div>
            <div className="text-gray-500">Train Lines</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-green-600">{stations.length}</div>
            <div className="text-gray-500">Stations</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {variants.length}
            </div>
            <div className="text-gray-500">Route Variants</div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Lines</h2>
            <Link href="/lines" className="text-sm text-blue-600 hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {lines.slice(0, 4).map((line) => (
              <LineCard key={line.id} line={line} variantCount={variantCounts.get(line.id) || 0} />
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Stations</h2>
            <Link href="/stations" className="text-sm text-blue-600 hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {stations.slice(0, 4).map((station) => (
              <StationCard key={station.id} station={station} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <Card className="bg-gray-900">
          <CardBody className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Departure Boards</h3>
              <p className="text-gray-400">View real-time departure information</p>
            </div>
            <Link
              href="/departures"
              className="px-4 py-2 bg-amber-500 text-gray-900 font-medium rounded-lg hover:bg-amber-400 transition-colors"
            >
              View Departures
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
