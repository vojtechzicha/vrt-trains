import Link from 'next/link';
import { DirectConnection, LineConnection } from '@/types';
import { LineBadge } from '@/components/lines';
import { formatTravelTime, formatFrequency } from '@/lib/connections';

interface DirectConnectionsProps {
  connections: DirectConnection[];
}

// Group lines by travel time
function groupLinesByTime(lines: LineConnection[]): LineConnection[][] {
  const groups: Map<number, LineConnection[]> = new Map();

  for (const line of lines) {
    const time = line.travelTimeMinutes;
    if (!groups.has(time)) {
      groups.set(time, []);
    }
    groups.get(time)!.push(line);
  }

  // Return groups sorted by travel time
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, lines]) => lines);
}

// Check if a station should be featured (own card) vs grouped by line
function isFeaturedStation(connection: DirectConnection): boolean {
  // Virtual stations, hubs, terminals, airports get their own card
  if (connection.isVirtual) return true;
  if (['hub', 'terminal', 'airport'].includes(connection.destinationType)) return true;
  // Stations with multiple line connections get their own card
  if (connection.lines.length > 1) return true;
  return false;
}

// Line-grouped station info
interface LineGroupedStation {
  stationId: string;
  stationName: string;
  travelTimeMinutes: number;
  trainsPerDay: number;
}

interface LineGroup {
  lineId: string;
  lineIdentifier: string;
  lineColor: string;
  lineTextColor: string;
  stations: LineGroupedStation[];
}

// Group minor single-line stations by their line
function groupByLine(connections: DirectConnection[]): LineGroup[] {
  const lineGroups = new Map<string, LineGroup>();

  for (const conn of connections) {
    const line = conn.lines[0]; // Single line connection

    if (!lineGroups.has(line.lineId)) {
      lineGroups.set(line.lineId, {
        lineId: line.lineId,
        lineIdentifier: line.lineIdentifier,
        lineColor: line.lineColor,
        lineTextColor: line.lineTextColor,
        stations: [],
      });
    }

    lineGroups.get(line.lineId)!.stations.push({
      stationId: conn.destinationStationId,
      stationName: conn.destinationStationName,
      travelTimeMinutes: line.travelTimeMinutes,
      trainsPerDay: line.trainsPerDay,
    });
  }

  // Sort stations within each group by travel time
  for (const group of lineGroups.values()) {
    group.stations.sort((a, b) => a.travelTimeMinutes - b.travelTimeMinutes);
  }

  // Sort groups by line identifier
  return [...lineGroups.values()].sort((a, b) =>
    a.lineIdentifier.localeCompare(b.lineIdentifier)
  );
}

export function DirectConnections({ connections }: DirectConnectionsProps) {
  if (connections.length === 0) {
    return <p className="text-gray-500">No direct connections from this station</p>;
  }

  // Separate featured stations from minor single-line stations
  const featuredConnections = connections.filter(isFeaturedStation);
  const minorConnections = connections.filter(c => !isFeaturedStation(c));
  const lineGroups = groupByLine(minorConnections);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {/* Featured stations (virtual, hubs, terminals, multi-line) */}
      {featuredConnections.map((connection) => {
        const lineGroupsByTime = groupLinesByTime(connection.lines);

        return (
          <div
            key={connection.destinationStationId}
            className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
          >
            <Link
              href={`/stations/${connection.destinationStationId}`}
              className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
            >
              {connection.destinationStationName}
              {connection.isVirtual && (
                <span className="ml-2 text-xs text-gray-400">(city)</span>
              )}
            </Link>
            <div className="mt-3 space-y-2">
              {lineGroupsByTime.map((group) => {
                const travelTime = group[0].travelTimeMinutes;
                const totalTrains = group.reduce((sum, line) => sum + line.trainsPerDay, 0);

                return (
                  <div key={travelTime} className="flex items-center gap-2 text-sm flex-wrap">
                    <div className="flex items-center gap-1">
                      {group.map((line) => (
                        <Link key={line.lineId} href={`/lines/${line.lineId}`}>
                          <LineBadge
                            identifier={line.lineIdentifier}
                            color={line.lineColor}
                            textColor={line.lineTextColor}
                            className="hover:opacity-80 transition-opacity cursor-pointer"
                          />
                        </Link>
                      ))}
                    </div>
                    <span className="text-gray-600">{formatTravelTime(travelTime)}</span>
                    <span className="text-gray-400 text-xs">({formatFrequency(totalTrains)})</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Line-grouped minor stations */}
      {lineGroups.map((lineGroup) => (
        <div
          key={lineGroup.lineId}
          className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
        >
          <Link href={`/lines/${lineGroup.lineId}`} className="inline-block">
            <LineBadge
              identifier={lineGroup.lineIdentifier}
              color={lineGroup.lineColor}
              textColor={lineGroup.lineTextColor}
              className="hover:opacity-80 transition-opacity cursor-pointer"
            />
          </Link>
          <div className="mt-3 space-y-1.5">
            {lineGroup.stations.map((station) => (
              <div key={station.stationId} className="flex items-center justify-between text-sm">
                <Link
                  href={`/stations/${station.stationId}`}
                  className="text-gray-700 hover:text-blue-600 transition-colors"
                >
                  {station.stationName}
                </Link>
                <span className="text-gray-500 ml-2">{formatTravelTime(station.travelTimeMinutes)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
