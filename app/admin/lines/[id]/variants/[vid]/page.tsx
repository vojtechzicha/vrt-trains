'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Line,
  Variant,
  Station,
  Direction,
  VariantStop,
  RouteCorridor,
  VariantRouteRef,
} from '@/types';
import { Card, CardHeader, CardBody, Button, Input, Select } from '@/components/ui';
import { LineBadge } from '@/components/lines';
import { RouteBuilder, buildDurationLookup, DurationLookup, RouteStop } from '@/components/admin/RouteBuilder';
import { RoutePreview } from '@/components/admin/RoutePreview';
import { segmentsToRouteStops, RouteSegment } from '@/components/admin/RouteSequenceBuilder';
import { calculateVariantTimes } from '@/lib/routeTimes';

const directionOptions = [
  { value: 'outbound', label: 'Outbound' },
  { value: 'inbound', label: 'Inbound' },
];

export default function EditVariantPage({
  params,
}: {
  params: Promise<{ id: string; vid: string }>;
}) {
  const { id, vid } = use(params);
  const router = useRouter();

  const [line, setLine] = useState<Line | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [routes, setRoutes] = useState<RouteCorridor[]>([]);
  const [durationLookup, setDurationLookup] = useState<DurationLookup>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resyncing, setResyncing] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<Direction>('outbound');
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [routeRefs, setRouteRefs] = useState<VariantRouteRef[]>([]);
  const [outOfSync, setOutOfSync] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id, vid]);

  async function fetchData() {
    try {
      const [lineRes, stationsRes, variantRes, allVariantsRes, routesRes] = await Promise.all([
        fetch(`/api/admin/lines/${id}`),
        fetch('/api/admin/stations'),
        fetch(`/api/admin/variants/${vid}`),
        fetch('/api/admin/variants'),
        fetch('/api/admin/routes'),
      ]);

      if (!lineRes.ok || !variantRes.ok) {
        router.push(`/admin/lines/${id}/variants`);
        return;
      }

      const [lineData, stationsData, variantData, allVariantsData, routesData] = await Promise.all([
        lineRes.json(),
        stationsRes.json(),
        variantRes.json(),
        allVariantsRes.json(),
        routesRes.json(),
      ]);

      setLine(lineData);
      setStations(stationsData.filter((s: Station) => !s.isVirtual));
      setRoutes(routesData);
      setDurationLookup(buildDurationLookup(allVariantsData));

      // Load variant data
      setCode(variantData.code);
      setName(variantData.name);
      setDirection(variantData.direction);
      setRouteRefs(variantData.routeRefs || []);
      setOutOfSync(variantData.outOfSync || false);

      // Convert VariantStop[] to RouteStop[] using calculated times from routes
      // Calculate travel times on-the-fly using route references
      const calculatedStops = calculateVariantTimes(
        variantData.stations,
        variantData.routeRefs || [],
        routesData
      );

      const stops: RouteStop[] = calculatedStops.map((stop, index) => ({
        stationId: stop.stationId,
        minutesFromPrevious: stop.travelTimeFromPrevious,
        dwellTime: stop.dwellTime,
        platform: stop.platform,
        stopType: stop.stopType,
      }));
      setRouteStops(stops);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleResyncFromRoute() {
    if (
      !confirm(
        'This will reset all times to the base values from the route. Platform assignments will be preserved. Continue?'
      )
    ) {
      return;
    }

    if (routeRefs.length === 0) {
      alert('No route references found for this variant');
      return;
    }

    setResyncing(true);

    try {
      // Convert route refs to segments format
      // Compute reversed by comparing ref direction to variant's base direction
      const segments: RouteSegment[] = routeRefs.map((ref) => ({
        routeId: ref.routeId,
        pathId: ref.pathId,
        reversed: ref.direction !== direction,
        speedCategory: ref.speedCategory || 'vrt',
        startStationId: ref.startStationId,
        endStationId: ref.endStationId,
      }));

      // Generate fresh stops from route using the new function
      const freshStops = segmentsToRouteStops(segments, routes);

      // Preserve platform assignments from current stops
      const platformMap = new Map(routeStops.map((s) => [s.stationId, s.platform]));
      const stops: RouteStop[] = freshStops.map((stop) => ({
        ...stop,
        platform: platformMap.get(stop.stationId) || stop.platform,
      }));

      setRouteStops(stops);
      setOutOfSync(false);

      // Save immediately to clear the out-of-sync flag
      await saveVariant(stops, false);
    } catch (error) {
      console.error('Failed to resync:', error);
      alert('Failed to resync from route');
    } finally {
      setResyncing(false);
    }
  }

  // Convert RouteStop[] to VariantStop[] for saving
  // Note: VariantStop no longer stores arrivalOffset/departureOffset - times are calculated on-the-fly
  function routeStopsToVariantStops(stops: RouteStop[]): VariantStop[] {
    return stops.map((stop, index) => ({
      stationId: stop.stationId,
      sequence: index + 1,
      dwellTime: stop.dwellTime,
      platform: stop.platform,
      stopType: 'regular' as const,
    }));
  }

  async function saveVariant(stops: RouteStop[], clearOutOfSync: boolean = false) {
    const variantStops = routeStopsToVariantStops(stops);

    const payload: Record<string, unknown> = {
      code,
      name,
      direction,
      routeRefs,
      stations: variantStops,
    };

    if (clearOutOfSync) {
      payload.outOfSync = false;
    }

    const res = await fetch(`/api/admin/variants/${vid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return res.ok;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      alert('Code is required');
      return;
    }

    if (routeStops.length === 0) {
      alert('Please add at least one station');
      return;
    }

    setSaving(true);

    try {
      const success = await saveVariant(routeStops);
      if (success) {
        router.push(`/admin/lines/${id}/variants`);
      }
    } catch (error) {
      console.error('Failed to update variant:', error);
    } finally {
      setSaving(false);
    }
  }

  function getRouteRefsDisplay(): string {
    if (routeRefs.length === 0) return 'No route references';

    return routeRefs
      .map((ref) => {
        const route = routes.find((r) => r.id === ref.routeId);
        const path = route?.paths.find((p) => p.id === ref.pathId);
        if (!route) return 'Unknown route';
        return `${route.name}${path ? ` (${path.name})` : ''}`;
      })
      .join(' + ');
  }

  // Convert routeStops to preview format
  function getPreviewStops(stops: RouteStop[]) {
    let cumulativeMinutes = 0;
    return stops.map((stop, index) => {
      const station = stations.find((s) => s.id === stop.stationId);
      if (index > 0) {
        cumulativeMinutes += stop.minutesFromPrevious;
      }
      const result = {
        stationName: station?.name || 'Unknown',
        stationCode: station?.code || '???',
        cumulativeMinutes,
        platform: stop.platform,
      };
      cumulativeMinutes += stop.dwellTime;
      return result;
    });
  }

  const previewStops = getPreviewStops(routeStops);

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  if (!line) {
    return null;
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/admin/lines/${id}/variants`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to Variants
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <LineBadge
          identifier={line.identifier}
          color={line.color}
          textColor={line.textColor}
          className="text-lg px-3 py-1"
        />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Edit Variant</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{line.name}</p>
        </div>
      </div>

      {/* Out of sync warning */}
      {outOfSync && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-yellow-600 text-xl">!</span>
            <div className="flex-1">
              <p className="font-medium text-yellow-800">
                This variant is out of sync with its source route
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                The route corridor has been modified since this variant was last updated.
                Review the changes and resync if needed.
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleResyncFromRoute}
                disabled={resyncing}
                className="mt-3"
              >
                {resyncing ? 'Resyncing...' : 'Resync times from route'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Route references info */}
      {routeRefs.length > 0 && (
        <div className="mb-6 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <span className="font-medium text-blue-800">Route: </span>
          <span className="text-blue-700">{getRouteRefsDisplay()}</span>
          {!outOfSync && (
            <button
              type="button"
              onClick={handleResyncFromRoute}
              disabled={resyncing}
              className="ml-3 text-blue-600 hover:underline"
            >
              Resync times
            </button>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Variant Info</h2>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Spr1a"
                    required
                  />
                  <Input
                    label="Name (optional)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Sprinter 1 Express"
                  />
                </div>
                <Select
                  label="Direction"
                  options={directionOptions}
                  value={direction}
                  onChange={(v) => setDirection(v as Direction)}
                />
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Route</h2>
            </CardHeader>
            <CardBody>
              <RouteBuilder
                stations={stations}
                value={routeStops}
                onChange={setRouteStops}
                durationLookup={durationLookup}
                allowAddStations={false}
              />
            </CardBody>
          </Card>

          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/admin/lines/${id}/variants`)}
            >
              Cancel
            </Button>
          </div>
        </div>

        <div>
          <Card className="sticky top-4">
            <CardHeader>
              <h2 className="text-lg font-semibold">Route Preview</h2>
            </CardHeader>
            <CardBody>
              <RoutePreview stops={previewStops} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
