'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RouteCorridor } from '@/types';
import { Card, CardBody, Button } from '@/components/ui';

export default function RoutesPage() {
  const [routes, setRoutes] = useState<RouteCorridor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchRoutes();
  }, []);

  async function fetchRoutes() {
    try {
      const response = await fetch('/api/admin/routes');
      const data = await response.json();
      setRoutes(data);
    } catch (error) {
      console.error('Failed to fetch routes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(routeId: string) {
    if (!confirm('Delete this route corridor?')) return;

    try {
      const response = await fetch(`/api/admin/routes/${routeId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to delete route');
        return;
      }

      await fetchRoutes();
    } catch (error) {
      console.error('Failed to delete route:', error);
    }
  }

  const filteredRoutes = routes.filter((route) =>
    search
      ? route.name.toLowerCase().includes(search.toLowerCase()) ||
        route.description?.toLowerCase().includes(search.toLowerCase())
      : true
  );

  // Sort alphabetically by name
  const sortedRoutes = [...filteredRoutes].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  function getRouteStationCount(route: RouteCorridor): number {
    // Return the maximum number of stations across all paths
    return Math.max(...route.paths.map((p) => p.stops.length), 0);
  }

  function getRouteEndpoints(route: RouteCorridor): string {
    if (route.paths.length === 0 || route.paths[0].stops.length < 2) {
      return 'No stops defined';
    }
    // Endpoints should be the same across all paths
    const firstPath = route.paths[0];
    const firstStopId = firstPath.stops[0].stationId;
    const lastStopId = firstPath.stops[firstPath.stops.length - 1].stationId;
    return `${firstStopId} → ${lastStopId}`;
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-blue-600 hover:underline">
          ← Back to Admin
        </Link>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Route Corridors</h1>
          <p className="text-sm text-gray-500">
            Define station sequences with base times and distances
          </p>
        </div>
        <Link href="/admin/routes/new">
          <Button>+ New Route</Button>
        </Link>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search routes..."
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-3">
        {sortedRoutes.map((route) => (
          <Card key={route.id} className="hover:shadow-md transition-shadow">
            <CardBody>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold text-gray-900">{route.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                      {route.paths.length} path{route.paths.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                      {getRouteStationCount(route)} stations
                    </span>
                  </div>
                  {route.description && (
                    <p className="text-sm text-gray-500 mb-1">{route.description}</p>
                  )}
                  <div className="text-sm text-gray-400">
                    {route.paths.map((p) => p.name).join(' | ')}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/routes/${route.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Edit
                  </Link>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => handleDelete(route.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
        {sortedRoutes.length === 0 && (
          <Card>
            <CardBody className="text-center py-8 text-gray-500">
              {search
                ? 'No routes match your search.'
                : 'No route corridors yet. Create your first route to get started.'}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
