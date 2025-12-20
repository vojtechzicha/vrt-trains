import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getStation, getVariantsByStation, getLines, getTimetables, getStations } from '@/lib/data';
import { PlatformDiagram, DirectConnections } from '@/components/stations';
import { Card, CardHeader, CardBody, Badge } from '@/components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui';
import { LineBadge } from '@/components/lines';
import { compareTime } from '@/lib/utils';
import { getDirectConnections } from '@/lib/connections';
import { aggregatePlatformData } from '@/lib/platforms';

interface StationDetailPageProps {
  params: Promise<{ stationId: string }>;
}

const typeLabels: Record<string, string> = {
  hub: 'Major Hub',
  terminal: 'Terminal Station',
  regular: 'Station',
  airport: 'Airport Station',
  request: 'Request Stop',
};

export default async function StationDetailPage({ params }: StationDetailPageProps) {
  const { stationId } = await params;
  const station = await getStation(stationId);

  if (!station) {
    notFound();
  }

  const variants = await getVariantsByStation(stationId);
  const allLines = await getLines();
  const allTimetables = await getTimetables();
  const allStations = await getStations();

  // Get unique lines that serve this station
  const lineIds = [...new Set(variants.map((v) => v.lineId))];
  const lines = allLines.filter((l) => lineIds.includes(l.id));

  // Aggregate platform data for the diagram
  const platformData = aggregatePlatformData(stationId, variants, lines);

  // Get departures from this station
  type DepartureInfo = {
    time: string;
    trainNumber: string;
    lineId: string;
    variantCode: string;
    destination: string;
    platform: string;
  };

  const departures: DepartureInfo[] = [];

  // Create a variant lookup
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  allTimetables.forEach((tt) => {
    const variant = variantMap.get(tt.variantId);
    if (!variant) return;

    const stopIndex = tt.departures.findIndex((d) => d.stationId === stationId);
    if (stopIndex === -1) return;

    const stop = tt.departures[stopIndex];
    if (!stop.departure) return; // Skip if this is the terminal (no departure)

    // Get destination (last station in this timetable)
    const lastStop = tt.departures[tt.departures.length - 1];
    const destStation = allStations.find((s) => s.id === lastStop.stationId);

    // Get platform from variant (source of truth)
    const variantStop = variant.stations.find((s) => s.stationId === stationId);
    const platform = variantStop?.platform || '';

    departures.push({
      time: stop.departure,
      trainNumber: tt.trainNumber,
      lineId: variant.lineId,
      variantCode: variant.code,
      destination: destStation?.name || 'Unknown',
      platform,
    });
  });

  // Sort by departure time
  departures.sort((a, b) => compareTime(a.time, b.time));

  // Get direct connections from this station
  const directConnections = getDirectConnections({
    stationId,
    variants,
    timetables: allTimetables,
    lines: allLines,
    stations: allStations,
  });

  return (
    <div>
      <div className="mb-6">
        <Link href="/stations" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Stations
        </Link>
      </div>

      <div className="flex items-start gap-6 mb-8">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center font-bold text-2xl text-gray-600">
          {station.code}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{station.name}</h1>
          <p className="text-gray-500">{typeLabels[station.type]}</p>
          <p className="text-sm text-gray-400 mt-1">
            {station.platforms} platform{station.platforms !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Platforms</h2>
          </CardHeader>
          <CardBody>
            <PlatformDiagram platforms={platformData} stationPlatformCount={station.platforms} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Departures</h2>
            <Link
              href={`/departures/${station.id}`}
              className="text-sm text-blue-600 hover:underline"
            >
              View Departure Board →
            </Link>
          </CardHeader>
          <CardBody className="p-0">
            {departures.length === 0 ? (
              <p className="text-gray-500 p-4">No departures from this station</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Line</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Platform</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departures.slice(0, 10).map((dep, idx) => {
                    const line = lines.find((l) => l.id === dep.lineId);
                    return (
                      <TableRow key={`${dep.trainNumber}-${idx}`}>
                        <TableCell className="font-mono font-medium">
                          {dep.time}
                        </TableCell>
                        <TableCell>
                          {line && (
                            <LineBadge
                              identifier={line.identifier}
                              color={line.color}
                              textColor={line.textColor}
                            />
                          )}
                        </TableCell>
                        <TableCell>{dep.destination}</TableCell>
                        <TableCell className="font-medium">{dep.platform}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Direct Connections</h2>
          </CardHeader>
          <CardBody>
            <DirectConnections connections={directConnections} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
