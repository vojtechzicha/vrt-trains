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
    <div className="space-y-6">
      {/* Featured stations (virtual, hubs, terminals, multi-line) */}
      {featuredConnections.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {featuredConnections.map((connection) => {
            const lineGroupsByTime = groupLinesByTime(connection.lines);

            return (
              <div
                key={connection.destinationStationId}
                className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
              >
                <Link
                  href={`/stations/${connection.destinationStationId}`}
                  className="font-medium text-gray-900 hover:text-blue-600 transition-colors text-sm"
                >
                  {connection.destinationStationName}
                  {connection.isVirtual && (
                    <span className="ml-1 text-xs text-gray-400">(city)</span>
                  )}
                </Link>
                <div className="mt-2 space-y-1">
                  {lineGroupsByTime.map((group) => {
                    const travelTime = group[0].travelTimeMinutes;

                    return (
                      <div key={travelTime} className="flex items-center gap-2 text-xs">
                        <div className="flex items-center gap-0.5">
                          {group.map((line) => (
                            <Link key={line.lineId} href={`/lines/${line.lineId}`}>
                              <LineBadge
                                identifier={line.lineIdentifier}
                                color={line.lineColor}
                                textColor={line.lineTextColor}
                                className="hover:opacity-80 transition-opacity cursor-pointer text-xs"
                              />
                            </Link>
                          ))}
                        </div>
                        <span className="text-gray-500">{formatTravelTime(travelTime)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All stops by line - full width table format */}
      {lineGroups.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700">All Stops</h3>
          {lineGroups.map((lineGroup) => (
            <div key={lineGroup.lineId}>
              <div className="flex items-center gap-2 mb-2">
                <Link href={`/lines/${lineGroup.lineId}`}>
                  <LineBadge
                    identifier={lineGroup.lineIdentifier}
                    color={lineGroup.lineColor}
                    textColor={lineGroup.lineTextColor}
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                  />
                </Link>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {lineGroup.stations.map((station, idx) => (
                  <span key={station.stationId} className="flex items-center gap-1 text-gray-600">
                    <Link
                      href={`/stations/${station.stationId}`}
                      className="hover:text-blue-600 transition-colors"
                    >
                      {station.stationName}
                    </Link>
                    <span className="text-gray-400 text-xs">{formatTravelTime(station.travelTimeMinutes)}</span>
                    {idx < lineGroup.stations.length - 1 && (
                      <span className="text-gray-300 ml-2">·</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
