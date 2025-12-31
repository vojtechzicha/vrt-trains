import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getStation, getVariantsByStation, getLines, getTimetables, getStations, getRoutes, getMemberStations } from '@/lib/data';
import { PlatformDiagram, DirectConnections, StationRoutes } from '@/components/stations';
import { Card, CardHeader, CardBody } from '@/components/ui';
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

const countryNames: Record<string, string> = {
  Czech: 'Czech Republic',
  Germany: 'Germany',
  Austria: 'Austria',
  Poland: 'Poland',
  Slovakia: 'Slovakia',
  Hungary: 'Hungary',
};

export default async function StationDetailPage({ params }: StationDetailPageProps) {
  const { stationId } = await params;
  const station = await getStation(stationId);

  if (!station) {
    notFound();
  }

  const [allLines, allTimetables, allStations, allRoutes] = await Promise.all([
    getLines(),
    getTimetables(),
    getStations(),
    getRoutes(),
  ]);

  // Create station lookup
  const stationMap = new Map(allStations.map((s) => [s.id, s]));

  // Handle virtual stations - get member stations and aggregate data
  const memberStations = station.isVirtual && station.memberStationIds
    ? await getMemberStations(stationId)
    : [];

  // Get station IDs to query (member stations for virtual, just this station otherwise)
  const stationIdsToQuery = station.isVirtual && memberStations.length > 0
    ? memberStations.map(s => s.id)
    : [stationId];

  // Aggregate variants from all relevant stations
  const variantsArrays = await Promise.all(
    stationIdsToQuery.map(id => getVariantsByStation(id))
  );
  const variants = variantsArrays.flat();

  // Deduplicate variants by id (same variant might serve multiple member stations)
  const uniqueVariants = [...new Map(variants.map(v => [v.id, v])).values()];

  // Get unique lines that serve this station (or member stations)
  const lineIds = [...new Set(uniqueVariants.map((v) => v.lineId))];
  const lines = allLines.filter((l) => lineIds.includes(l.id));

  // Find routes that include this station (or any member station)
  const routesAtStation = allRoutes.filter((route) =>
    route.paths.some((path) =>
      path.stops.some((stop) => stationIdsToQuery.includes(stop.stationId))
    )
  );

  // Aggregate platform data for the diagram (only for physical stations)
  const platformData = station.isVirtual
    ? []
    : aggregatePlatformData(stationId, uniqueVariants, lines, station.platforms);

  // Get departures from this station (or member stations)
  type DepartureInfo = {
    time: string;
    trainNumber: string;
    lineId: string;
    variantCode: string;
    destination: string;
    platform: string;
    viaStations: string[];
    operatingDays: string[];
    fromStationName?: string;
  };

  const departures: DepartureInfo[] = [];
  const variantMap = new Map(uniqueVariants.map((v) => [v.id, v]));

  // Build departures for each relevant station
  for (const queryStationId of stationIdsToQuery) {
    const queryStation = stationMap.get(queryStationId);

    allTimetables.forEach((tt) => {
      const variant = variantMap.get(tt.variantId);
      if (!variant) return;

      const stopIndex = tt.departures.findIndex((d) => d.stationId === queryStationId);
      if (stopIndex === -1) return;

      const stop = tt.departures[stopIndex];
      if (!stop.departure) return; // Skip if this is the terminal (no departure)

      // Get destination (last station in this timetable)
      const lastStop = tt.departures[tt.departures.length - 1];
      const destStation = allStations.find((s) => s.id === lastStop.stationId);

      // Get platform from variant (source of truth)
      const variantStop = variant.stations.find((s) => s.stationId === queryStationId);
      const platform = variantStop?.platform || '';

      // Get via stations (major intermediate stops)
      const viaStations: string[] = [];
      for (let i = stopIndex + 1; i < tt.departures.length - 1; i++) {
        const intermediateStation = allStations.find((s) => s.id === tt.departures[i].stationId);
        if (intermediateStation && (intermediateStation.type === 'hub' || intermediateStation.type === 'terminal')) {
          viaStations.push(intermediateStation.name);
          if (viaStations.length >= 2) break; // Max 2 via stations
        }
      }

      departures.push({
        time: stop.departure,
        trainNumber: tt.trainNumber,
        lineId: variant.lineId,
        variantCode: variant.code,
        destination: destStation?.name || 'Unknown',
        platform,
        viaStations,
        operatingDays: tt.operatingDays,
        fromStationName: station.isVirtual ? queryStation?.name : undefined,
      });
    });
  }

  // Sort by departure time
  departures.sort((a, b) => compareTime(a.time, b.time));

  // Filter to show only future departures (from current time)
  const now = new Date();
  const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const futureDepartures = departures.filter((dep) => compareTime(dep.time, currentTimeStr) >= 0);

  // Get direct connections from this station (or all member stations for virtual)
  let directConnections = getDirectConnections({
    stationId: stationIdsToQuery[0],
    variants: uniqueVariants,
    timetables: allTimetables,
    lines: allLines,
    stations: allStations,
  });

  // For virtual stations, aggregate connections from all member stations
  if (station.isVirtual && stationIdsToQuery.length > 1) {
    const allConnections = new Map<string, typeof directConnections[0]>();

    for (const queryId of stationIdsToQuery) {
      const connections = getDirectConnections({
        stationId: queryId,
        variants: uniqueVariants,
        timetables: allTimetables,
        lines: allLines,
        stations: allStations,
      });

      for (const conn of connections) {
        // Skip connections to member stations of the same virtual station
        if (stationIdsToQuery.includes(conn.destinationStationId)) continue;

        const existing = allConnections.get(conn.destinationStationId);
        if (existing) {
          // Merge line connections
          for (const line of conn.lines) {
            const existingLine = existing.lines.find(l => l.lineId === line.lineId);
            if (!existingLine) {
              existing.lines.push(line);
            }
          }
        } else {
          allConnections.set(conn.destinationStationId, { ...conn });
        }
      }
    }

    directConnections = [...allConnections.values()];
  }

  // Check if train runs daily
  const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const isDaily = (days: string[]) => allDays.every((d) => days.includes(d));

  return (
    <div>
      <div className="mb-6">
        <Link href="/stations" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Stations
        </Link>
      </div>

      {/* Enhanced Header */}
      <div className="mb-8">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-xl text-gray-600 shrink-0">
            {station.code}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{station.name}</h1>
            <p className="text-gray-500">
              {station.isVirtual ? 'City Station' : typeLabels[station.type]}
              {station.country && ` · ${countryNames[station.country] || station.country}`}
              {!station.isVirtual && ` · ${station.platforms.length} platform${station.platforms.length !== 1 ? 's' : ''}`}
              {station.isVirtual && memberStations.length > 0 && ` · ${memberStations.length} station${memberStations.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* Line badges */}
        {lines.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {lines.map((line) => (
              <Link key={line.id} href={`/lines/${line.id}`}>
                <LineBadge
                  identifier={line.identifier}
                  color={line.color}
                  textColor={line.textColor}
                />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Next Departures */}
      <Card className="mb-6">
        <CardHeader className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Next Departures</h2>
          <Link
            href={`/departures/${station.id}`}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            Full Departure Board →
          </Link>
        </CardHeader>
        <CardBody className="p-0">
          {futureDepartures.length === 0 ? (
            <p className="text-gray-500 p-4">No upcoming departures from this station</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Time</TableHead>
                  <TableHead className="w-16">Line</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead className="hidden md:table-cell">Via</TableHead>
                  {station.isVirtual ? (
                    <TableHead className="w-32">From</TableHead>
                  ) : (
                    <TableHead className="w-16 text-center">Plat.</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {futureDepartures.slice(0, 8).map((dep, idx) => {
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
                      <TableCell>
                        <span className="font-medium">{dep.destination}</span>
                        {!isDaily(dep.operatingDays) && (
                          <span className="ml-2 text-xs text-gray-400">
                            ({dep.operatingDays.join(', ')})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-gray-500 text-sm">
                        {dep.viaStations.length > 0 ? dep.viaStations.join(', ') : '—'}
                      </TableCell>
                      {station.isVirtual ? (
                        <TableCell className="text-sm text-gray-600">
                          {dep.fromStationName || '—'}
                        </TableCell>
                      ) : (
                        <TableCell className="text-center font-medium">
                          {dep.platform || '—'}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Platforms/Stations and Routes side by side */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {station.isVirtual ? (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Stations</h2>
            </CardHeader>
            <CardBody>
              {memberStations.length > 0 ? (
                <div className="space-y-2">
                  {memberStations.map((memberStation) => (
                    <Link
                      key={memberStation.id}
                      href={`/stations/${memberStation.id}`}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center font-medium text-sm text-gray-600">
                          {memberStation.code}
                        </span>
                        <div>
                          <span className="font-medium text-gray-900 group-hover:text-blue-600">
                            {memberStation.name}
                          </span>
                          <p className="text-xs text-gray-500">
                            {typeLabels[memberStation.type]} · {memberStation.platforms.length} platform{memberStation.platforms.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <span className="text-gray-400 group-hover:text-blue-600">→</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No member stations configured.</p>
              )}
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Platforms</h2>
            </CardHeader>
            <CardBody>
              <PlatformDiagram platforms={platformData} stationPlatforms={station.platforms} />
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Routes</h2>
          </CardHeader>
          <CardBody>
            {routesAtStation.length > 0 ? (
              <StationRoutes
                routes={routesAtStation}
                stationId={stationId}
                stationMap={stationMap}
              />
            ) : (
              <p className="text-gray-500 text-sm">No route corridors pass through this station.</p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Direct Connections - Full Width */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Direct Connections</h2>
        </CardHeader>
        <CardBody>
          <DirectConnections connections={directConnections} />
        </CardBody>
      </Card>
    </div>
  );
}
