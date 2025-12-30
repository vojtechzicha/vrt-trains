import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getRoute,
  getVariantsReferencingRoute,
  getTimetablesByVariants,
  getStations,
  getLines,
} from '@/lib/data';
import { RouteTimetable } from '@/components/routes';
import { calculatePathDistance, calculatePathTime, getRouteEndpoints } from '@/lib/timetable';

interface RouteDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RouteDetailPage({ params }: RouteDetailPageProps) {
  const { id } = await params;
  const route = await getRoute(id);

  if (!route) {
    notFound();
  }

  // Fetch all required data in parallel
  const [variants, stations, lines] = await Promise.all([
    getVariantsReferencingRoute(id),
    getStations(),
    getLines(),
  ]);

  // Get timetables for variants
  const timetables =
    variants.length > 0
      ? await getTimetablesByVariants(variants.map((v) => v.id))
      : [];

  // Create station lookup
  const stationMap = new Map(stations.map((s) => [s.id, s]));

  // Get endpoints
  const endpoints = getRouteEndpoints(route, stationMap);

  // Calculate distance and time from first path (if exists)
  const firstPath = route.paths[0];
  const totalDistance = firstPath ? calculatePathDistance(firstPath) : 0;
  const totalTime = firstPath ? calculatePathTime(firstPath) : 0;

  // Calculate commercial speed (km/h)
  const commercialSpeed = totalTime > 0 ? Math.round((totalDistance / totalTime) * 60) : 0;

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  return (
    <div>
      <div className="mb-6">
        <Link href="/routes" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Routes
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{route.name}</h1>
        <p className="text-gray-500 mt-1">
          {endpoints.from?.name || 'Unknown'} - {endpoints.to?.name || 'Unknown'}
        </p>
        {route.description && (
          <p className="text-sm text-gray-400 mt-2 whitespace-pre-line">{route.description}</p>
        )}
      </div>

      {/* Route stats */}
      <div className="flex flex-wrap gap-6 mb-8 text-sm">
        {totalDistance > 0 && (
          <div>
            <span className="text-gray-500">Distance:</span>{' '}
            <span className="font-medium">{totalDistance} km</span>
          </div>
        )}
        {totalTime > 0 && (
          <div>
            <span className="text-gray-500">Travel time:</span>{' '}
            <span className="font-medium">{formatTime(totalTime)}</span>
          </div>
        )}
        {commercialSpeed > 0 && (
          <div>
            <span className="text-gray-500">Commercial speed:</span>{' '}
            <span className="font-medium">{commercialSpeed} km/h</span>
          </div>
        )}
        {route.paths.length > 1 && (
          <div>
            <span className="text-gray-500">Path variants:</span>{' '}
            <span className="font-medium">{route.paths.length}</span>
          </div>
        )}
      </div>

      {/* Timetable */}
      <RouteTimetable
        route={route}
        variants={variants}
        timetables={timetables}
        stations={stations}
        lines={lines}
      />
    </div>
  );
}
