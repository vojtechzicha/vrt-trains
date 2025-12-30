import Link from 'next/link';
import { RouteCorridor, Station } from '@/types';
import { calculatePathDistance, calculatePathTime } from '@/lib/timetable';

interface StationRoutesProps {
  routes: RouteCorridor[];
  stationId: string;
  stationMap: Map<string, Station>;
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
}

export function StationRoutes({ routes, stationId, stationMap }: StationRoutesProps) {
  if (routes.length === 0) {
    return (
      <p className="text-gray-500 text-sm">No route corridors pass through this station.</p>
    );
  }

  return (
    <div className="space-y-3">
      {routes.map((route) => {
        // Find which path(s) include this station
        const pathsWithStation = route.paths.filter((path) =>
          path.stops.some((stop) => stop.stationId === stationId)
        );

        // Use first path for stats (they should be similar)
        const primaryPath = pathsWithStation[0] || route.paths[0];
        const distance = primaryPath ? calculatePathDistance(primaryPath) : 0;
        const time = primaryPath ? calculatePathTime(primaryPath) : 0;

        // Get endpoint stations
        const firstStop = primaryPath?.stops[0];
        const lastStop = primaryPath?.stops[primaryPath.stops.length - 1];
        const fromStation = firstStop ? stationMap.get(firstStop.stationId) : null;
        const toStation = lastStop ? stationMap.get(lastStop.stationId) : null;

        return (
          <Link
            key={route.id}
            href={`/routes/${route.id}`}
            className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-gray-900 group-hover:text-blue-600">
                  {route.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {fromStation?.name || 'Unknown'} — {toStation?.name || 'Unknown'}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  {pathsWithStation.length > 1 && (
                    <span>{pathsWithStation.length} paths</span>
                  )}
                  {pathsWithStation.length === 1 && primaryPath?.name && (
                    <span>via {primaryPath.name}</span>
                  )}
                  <span>{distance.toFixed(0)} km</span>
                  <span>{formatTime(time)}</span>
                </div>
              </div>
              <span className="text-gray-400 group-hover:text-blue-600 text-lg">
                →
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
