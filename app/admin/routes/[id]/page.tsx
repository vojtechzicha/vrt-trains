'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Station, RouteCorridor, RoutePath, Variant } from '@/types';
import { Card, CardBody } from '@/components/ui';
import { RouteCorridorEditor } from '@/components/admin/RouteCorridorEditor';
import { buildRoutePathLookup } from '@/components/admin/RoutePathEditor';

export default function EditRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [route, setRoute] = useState<RouteCorridor | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [allRoutes, setAllRoutes] = useState<RouteCorridor[]>([]);
  const [lockedPathIds, setLockedPathIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [routeData, setRouteData] = useState<
    Omit<RouteCorridor, 'id' | 'createdAt' | 'updatedAt'>
  >({
    name: '',
    description: '',
    paths: [],
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  async function fetchData() {
    try {
      const [routeRes, stationsRes, variantsRes, allRoutesRes] = await Promise.all([
        fetch(`/api/admin/routes/${id}`),
        fetch('/api/admin/stations'),
        fetch('/api/admin/variants'),
        fetch('/api/admin/routes'),
      ]);

      if (!routeRes.ok) {
        router.push('/admin/routes');
        return;
      }

      const routeData = await routeRes.json();
      const stationsData = await stationsRes.json();
      const variantsData: Variant[] = await variantsRes.json();
      const allRoutesData: RouteCorridor[] = await allRoutesRes.json();

      setRoute(routeData);
      setRouteData({
        name: routeData.name,
        description: routeData.description,
        paths: routeData.paths.map((p: RoutePath) => ({
          ...p,
          stops: p.stops.map((s) => ({ ...s })),
          reverseTimeAdjustments: p.reverseTimeAdjustments?.map((a) => ({ ...a })),
        })),
      });

      // Filter to physical stations only
      setStations(stationsData.filter((s: Station) => !s.isVirtual));
      setAllRoutes(allRoutesData);

      // Find which paths are locked (used by variants)
      const locked: string[] = [];
      for (const path of routeData.paths) {
        const isUsed = variantsData.some((v) =>
          v.routeRefs?.some((ref) => ref.routeId === id && ref.pathId === path.id)
        );
        if (isUsed) {
          locked.push(path.id);
        }
      }
      setLockedPathIds(locked);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      router.push('/admin/routes');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/routes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update route');
      }

      const result = await response.json();

      // Show warning if variants were flagged
      if (result._meta?.variantsFlagged > 0) {
        alert(
          `Route updated. ${result._meta.variantsFlagged} variant(s) have been marked as out-of-sync and need review.`
        );
      }

      router.push('/admin/routes');
    } catch (error) {
      console.error('Failed to update route:', error);
      alert(error instanceof Error ? error.message : 'Failed to update route');
    } finally {
      setSaving(false);
    }
  }

  // Build lookup for prefilling station data
  const routePathLookup = useMemo(() => buildRoutePathLookup(allRoutes), [allRoutes]);

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  if (!route) {
    return null;
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/routes" className="text-sm text-blue-600 hover:underline">
          ← Back to Routes
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Edit Route: {route.name}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Modify the route corridor settings
        </p>
      </div>

      {lockedPathIds.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          Some paths are used by variants. Structural changes (add/remove/reorder stations)
          are locked for those paths. Time and distance edits are still allowed.
        </div>
      )}

      <Card>
        <CardBody>
          <RouteCorridorEditor
            stations={stations}
            value={routeData}
            onChange={setRouteData}
            lockedPathIds={lockedPathIds}
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
