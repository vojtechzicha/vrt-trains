import { getRoutes, getStations, getVariantsReferencingRoute, getTimetablesByVariants } from '@/lib/data';
import { RouteCard } from '@/components/routes';
import { calculatePathDistance, calculatePathTime, getRouteEndpoints } from '@/lib/timetable';

export default async function RoutesPage() {
  const [routes, stations] = await Promise.all([getRoutes(), getStations()]);

  // Create station lookup
  const stationMap = new Map(stations.map((s) => [s.id, s]));

  // Build route stats for each route
  const routeStats = await Promise.all(
    routes.map(async (route) => {
      // Get variants using this route
      const variants = await getVariantsReferencingRoute(route.id);

      // Get timetables for those variants
      const timetables =
        variants.length > 0
          ? await getTimetablesByVariants(variants.map((v) => v.id))
          : [];

      // Count unique lines
      const uniqueLineIds = new Set(variants.map((v) => v.lineId));

      // Get endpoints
      const endpoints = getRouteEndpoints(route, stationMap);

      // Calculate distance and time from first path (if exists)
      const firstPath = route.paths[0];
      const totalDistance = firstPath ? calculatePathDistance(firstPath) : 0;
      const totalTime = firstPath ? calculatePathTime(firstPath) : 0;

      return {
        route,
        lineCount: uniqueLineIds.size,
        trainCount: timetables.length,
        endpoints: {
          from: endpoints.from?.name || 'Unknown',
          to: endpoints.to?.name || 'Unknown',
        },
        totalDistance,
        totalTime,
      };
    })
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Route Corridors</h1>
      {routes.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No routes available yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {routeStats.map(({ route, lineCount, trainCount, endpoints, totalDistance, totalTime }) => (
            <RouteCard
              key={route.id}
              route={route}
              lineCount={lineCount}
              trainCount={trainCount}
              endpoints={endpoints}
              totalDistance={totalDistance}
              totalTime={totalTime}
            />
          ))}
        </div>
      )}
    </div>
  );
}
