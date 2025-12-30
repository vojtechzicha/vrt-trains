'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Station, RouteCorridor } from '@/types';
import { Card, CardBody } from '@/components/ui';
import { RouteCorridorEditor } from '@/components/admin/RouteCorridorEditor';
import { buildRoutePathLookup } from '@/components/admin/RoutePathEditor';

export default function NewRoutePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [routes, setRoutes] = useState<RouteCorridor[]>([]);
  const [loading, setLoading] = useState(true);

  const [routeData, setRouteData] = useState<
    Omit<RouteCorridor, 'id' | 'createdAt' | 'updatedAt'>
  >({
    name: '',
    description: '',
    paths: [],
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [stationsRes, routesRes] = await Promise.all([
          fetch('/api/admin/stations'),
          fetch('/api/admin/routes'),
        ]);
        const stationsData = await stationsRes.json();
        const routesData = await routesRes.json();
        // Filter to physical stations only
        setStations(stationsData.filter((s: Station) => !s.isVirtual));
        setRoutes(routesData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Build lookup for prefilling station data
  const routePathLookup = useMemo(() => buildRoutePathLookup(routes), [routes]);

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create route');
      }

      router.push('/admin/routes');
    } catch (error) {
      console.error('Failed to create route:', error);
      alert(error instanceof Error ? error.message : 'Failed to create route');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/routes" className="text-sm text-blue-600 hover:underline">
          ← Back to Routes
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">New Route Corridor</h1>
        <p className="text-sm text-gray-500">
          Define a station sequence with base times and distances
        </p>
      </div>

      <Card>
        <CardBody>
          <RouteCorridorEditor
            stations={stations}
            value={routeData}
            onChange={setRouteData}
            routePathLookup={routePathLookup}
            onSave={handleSave}
            onCancel={() => router.push('/admin/routes')}
            saving={saving}
          />
        </CardBody>
      </Card>
    </div>
  );
}
