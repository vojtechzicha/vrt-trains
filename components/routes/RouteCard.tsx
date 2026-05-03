import Link from 'next/link';
import { RouteCorridor } from '@/types';
import { Card, CardBody } from '@/components/ui';

interface RouteCardProps {
  route: RouteCorridor;
  lineCount: number;
  trainCount: number;
  endpoints: { from: string; to: string };
  totalDistance?: number;
  totalTime?: number;
}

export function RouteCard({
  route,
  lineCount,
  trainCount,
  endpoints,
  totalDistance,
  totalTime,
}: RouteCardProps) {
  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  return (
    <Link href={`/routes/${route.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardBody>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{route.name}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {endpoints.from} - {endpoints.to}
          </p>
          {route.description && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2">{route.description}</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500 dark:text-gray-400">
            <span>
              {lineCount} line{lineCount !== 1 ? 's' : ''}
            </span>
            <span>
              {trainCount} train{trainCount !== 1 ? 's' : ''}
            </span>
            {totalDistance !== undefined && totalDistance > 0 && (
              <span>{totalDistance} km</span>
            )}
            {totalTime !== undefined && totalTime > 0 && (
              <span>{formatTime(totalTime)}</span>
            )}
          </div>
          {route.paths.length > 1 && (
            <div className="mt-2 text-xs text-blue-600">
              {route.paths.length} path variants
            </div>
          )}
        </CardBody>
      </Card>
    </Link>
  );
}
