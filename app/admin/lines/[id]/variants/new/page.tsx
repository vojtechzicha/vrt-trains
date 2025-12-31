'use client';

import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { ForkSelector } from '@/components/admin/ForkSelector';
import {
  RouteSequenceBuilder,
  RouteSegment,
  segmentsToRouteRefs,
  segmentsToRouteStops,
  reverseRouteStops,
  validateSegmentJunctions,
} from '@/components/admin/RouteSequenceBuilder';
import { calculateVariantTimes } from '@/lib/routeTimes';

const directionOptions = [
  { value: 'outbound', label: 'Outbound' },
  { value: 'inbound', label: 'Inbound' },
];

export default function NewVariantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const forkId = searchParams.get('fork');

  const [line, setLine] = useState<Line | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [routes, setRoutes] = useState<RouteCorridor[]>([]);
  const [durationLookup, setDurationLookup] = useState<DurationLookup>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Step state: 1 = route selection, 2 = variant customization, 3 = reverse variant
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Route selection
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);
  const [direction, setDirection] = useState<Direction>('outbound');

  // Step 2: Variant customization (forward)
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [routeRefs, setRouteRefs] = useState<VariantRouteRef[]>([]);

  // Step 3: Reverse variant
  const [savedForwardVariantId, setSavedForwardVariantId] = useState<string | null>(null);
  const [reverseCode, setReverseCode] = useState('');
  const [reverseName, setReverseName] = useState('');
  const [reverseStops, setReverseStops] = useState<RouteStop[]>([]);
  const [reverseRefs, setReverseRefs] = useState<VariantRouteRef[]>([]);

  const [showForkSelector, setShowForkSelector] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (forkId && variants.length > 0) {
      const sourceVariant = variants.find((v) => v.id === forkId);
      if (sourceVariant) {
        loadFromVariant(sourceVariant);
      }
    }
  }, [forkId, variants]);

  async function fetchData() {
    try {
      const [lineRes, stationsRes, lineVariantsRes, allVariantsRes, routesRes] = await Promise.all([
        fetch(`/api/admin/lines/${id}`),
        fetch('/api/admin/stations'),
        fetch(`/api/admin/variants?lineId=${id}`),
        fetch('/api/admin/variants'),
        fetch('/api/admin/routes'),
      ]);

      if (!lineRes.ok) {
        router.push('/admin/lines');
        return;
      }

      const [lineData, stationsData, lineVariantsData, allVariantsData, routesData] = await Promise.all([
        lineRes.json(),
        stationsRes.json(),
        lineVariantsRes.json(),
        allVariantsRes.json(),
        routesRes.json(),
      ]);

      setLine(lineData);
      setStations(stationsData.filter((s: Station) => !s.isVirtual));
      setVariants(lineVariantsData);
      setRoutes(routesData);
      setDurationLookup(buildDurationLookup(allVariantsData));
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  function loadFromVariant(variant: Variant) {
    // For forking, skip to step 2 directly with all data
    setCode(variant.code + '-fork');
    setName(variant.name + ' (forked)');
    setDirection(variant.direction);
    setRouteRefs(variant.routeRefs || []);

    // Convert VariantStop[] to RouteStop[] using calculated times from routes
    const calculatedStops = calculateVariantTimes(
      variant.stations,
      variant.routeRefs || [],
      routes
    );

    const stops: RouteStop[] = calculatedStops.map((stop) => ({
      stationId: stop.stationId,
      minutesFromPrevious: stop.travelTimeFromPrevious,
      dwellTime: stop.dwellTime,
      platform: stop.platform,
      stopType: stop.stopType,
    }));
    setRouteStops(stops);

    // If variant has route refs, reconstruct segments
    // Compute reversed by comparing ref direction to variant's base direction
    if (variant.routeRefs && variant.routeRefs.length > 0) {
      const segments: RouteSegment[] = variant.routeRefs.map((ref) => ({
        routeId: ref.routeId,
        pathId: ref.pathId,
        reversed: ref.direction !== variant.direction,
        speedCategory: ref.speedCategory || 'vrt',
        startStationId: ref.startStationId,
        endStationId: ref.endStationId,
      }));
      setRouteSegments(segments);
    }

    setStep(2);
  }

  function handleFork(
    sourceVariant: Variant,
    options?: { truncateAtStationId?: string; reverse?: boolean }
  ) {
    // Calculate times from routes
    const calculatedStops = calculateVariantTimes(
      sourceVariant.stations,
      sourceVariant.routeRefs || [],
      routes
    );

    let stationsToLoad = [...calculatedStops];

    if (options?.truncateAtStationId) {
      const truncateIndex = stationsToLoad.findIndex(
        (s) => s.stationId === options.truncateAtStationId
      );
      if (truncateIndex !== -1) {
        stationsToLoad = stationsToLoad.slice(0, truncateIndex + 1);
      }
    }

    if (options?.reverse) {
      stationsToLoad = [...stationsToLoad].reverse();
    }

    const stops: RouteStop[] = stationsToLoad.map((stop, index) => {
      let minutesFromPrevious = 0;
      if (index > 0) {
        if (options?.reverse) {
          const prevStationId = stationsToLoad[index - 1].stationId;
          const keyForward = `${prevStationId}:${stop.stationId}`;
          const keyBackward = `${stop.stationId}:${prevStationId}`;
          const duration =
            durationLookup.get(keyForward) ?? durationLookup.get(keyBackward);
          minutesFromPrevious = duration ?? 5;
        } else {
          minutesFromPrevious = stop.travelTimeFromPrevious;
        }
      }

      return {
        stationId: stop.stationId,
        minutesFromPrevious,
        dwellTime: stop.dwellTime,
        platform: stop.platform,
        stopType: stop.stopType,
      };
    });

    const newDirection = options?.reverse
      ? sourceVariant.direction === 'outbound'
        ? 'inbound'
        : 'outbound'
      : sourceVariant.direction;

    // For reverse, use same code and name; for others add suffix
    const suffix = options?.reverse ? '' : options?.truncateAtStationId ? '-short' : '-fork';
    const nameSuffix = options?.reverse
      ? ''
      : options?.truncateAtStationId
      ? ' (short)'
      : ' (forked)';

    setCode(sourceVariant.code + suffix);
    setName(sourceVariant.name + nameSuffix);
    setDirection(newDirection);
    setRouteStops(stops);

    // Handle route refs for fork
    if (sourceVariant.routeRefs && sourceVariant.routeRefs.length > 0) {
      const refs = sourceVariant.routeRefs.map((ref) => ({
        ...ref,
        direction: newDirection,
        // Update end station if truncating
        endStationId: options?.truncateAtStationId || ref.endStationId,
      }));
      setRouteRefs(refs);

      // Compute reversed by comparing ref direction to new direction
      const segments: RouteSegment[] = refs.map((ref) => ({
        routeId: ref.routeId,
        pathId: ref.pathId,
        reversed: ref.direction !== newDirection,
        speedCategory: ref.speedCategory || 'vrt',
        startStationId: ref.startStationId,
        endStationId: ref.endStationId,
      }));
      setRouteSegments(segments);
    }

    setShowForkSelector(false);
    setStep(2);
  }

  function handleProceedToStep2() {
    if (routeSegments.length === 0) {
      alert('Please add at least one route segment');
      return;
    }

    // Validate that all segments connect properly
    const junctionError = validateSegmentJunctions(routeSegments, routes, stations);
    if (junctionError) {
      alert(junctionError);
      return;
    }

    // Generate variant stops from route segments (combines all segments)
    const stops = segmentsToRouteStops(routeSegments, routes);

    if (stops.length === 0) {
      alert('No stops could be generated from the selected segments');
      return;
    }

    setRouteStops(stops);
    setRouteRefs(segmentsToRouteRefs(routeSegments, direction));
    setStep(2);
  }

  function handleBackToStep1() {
    if (
      routeStops.length > 0 &&
      !confirm('Going back will lose your customizations. Continue?')
    ) {
      return;
    }
    setStep(1);
  }

  // Convert RouteStop[] to VariantStop[] for saving
  // Note: VariantStop no longer stores arrivalOffset/departureOffset - times are calculated on-the-fly
  function routeStopsToVariantStops(stops: RouteStop[]): VariantStop[] {
    return stops.map((stop, index) => ({
      stationId: stop.stationId,
      sequence: index + 1,
      dwellTime: stop.dwellTime,
      platform: stop.platform,
      stopType: stop.stopType,
    }));
  }

  async function saveVariant(
    variantCode: string,
    variantName: string,
    variantDirection: Direction,
    variantRouteRefs: VariantRouteRef[],
    variantStops: RouteStop[]
  ): Promise<string | null> {
    const convertedStops = routeStopsToVariantStops(variantStops);

    const res = await fetch('/api/admin/variants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lineId: id,
        code: variantCode,
        name: variantName,
        direction: variantDirection,
        routeRefs: variantRouteRefs,
        stations: convertedStops,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.id;
    } else {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create variant');
    }
  }

  async function handleSaveForwardAndProceedToStep3() {
    if (!code.trim()) {
      alert('Code is required');
      return;
    }

    if (routeStops.length === 0) {
      alert('Please add at least one station');
      return;
    }

    if (routeRefs.length === 0) {
      alert('Route references are required');
      return;
    }

    setSaving(true);

    try {
      const variantId = await saveVariant(code, name, direction, routeRefs, routeStops);
      if (variantId) {
        setSavedForwardVariantId(variantId);

        // Prepare reverse variant data
        const reverseDir: Direction = direction === 'outbound' ? 'inbound' : 'outbound';
        const reversed = reverseRouteStops(routeStops, routeSegments, routes);

        // Use the same code and name for reverse variant
        setReverseCode(code);
        setReverseName(name);
        setReverseStops(reversed);

        // Update route refs for reverse direction:
        // 1. Reverse the array order (first routeRef becomes last)
        // 2. Flip each individual direction (outbound↔inbound)
        const revRefs = [...routeRefs].reverse().map(ref => ({
          ...ref,
          direction: (ref.direction === 'outbound' ? 'inbound' : 'outbound') as Direction,
        }));
        setReverseRefs(revRefs);

        setStep(3);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create variant');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveReverseVariant() {
    if (!reverseCode.trim()) {
      alert('Code is required');
      return;
    }

    if (reverseStops.length === 0) {
      alert('Please add at least one station');
      return;
    }

    setSaving(true);

    try {
      const reverseDir: Direction = direction === 'outbound' ? 'inbound' : 'outbound';
      await saveVariant(reverseCode, reverseName, reverseDir, reverseRefs, reverseStops);
      router.push(`/admin/lines/${id}/variants`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create reverse variant');
    } finally {
      setSaving(false);
    }
  }

  function handleSkipReverseVariant() {
    router.push(`/admin/lines/${id}/variants`);
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
  const reversePreviewStops = getPreviewStops(reverseStops);

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
          <h1 className="text-xl font-bold text-gray-900">New Variant</h1>
          <p className="text-sm text-gray-500">{line.name}</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className={`flex items-center gap-2 ${
            step === 1 ? 'text-blue-600' : 'text-gray-400'
          }`}
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 1
                ? 'bg-blue-600 text-white'
                : step > 1
                ? 'bg-green-500 text-white'
                : 'bg-gray-200'
            }`}
          >
            {step > 1 ? '✓' : '1'}
          </span>
          <span className="text-sm font-medium">Select Route</span>
        </div>
        <div className="w-8 h-px bg-gray-300" />
        <div
          className={`flex items-center gap-2 ${
            step === 2 ? 'text-blue-600' : 'text-gray-400'
          }`}
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 2
                ? 'bg-blue-600 text-white'
                : step > 2
                ? 'bg-green-500 text-white'
                : 'bg-gray-200'
            }`}
          >
            {step > 2 ? '✓' : '2'}
          </span>
          <span className="text-sm font-medium">Forward Variant</span>
        </div>
        <div className="w-8 h-px bg-gray-300" />
        <div
          className={`flex items-center gap-2 ${
            step === 3 ? 'text-blue-600' : 'text-gray-400'
          }`}
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
          >
            3
          </span>
          <span className="text-sm font-medium">Reverse Variant</span>
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-6">
          {/* No routes warning */}
          {routes.length === 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 font-medium">No routes available</p>
              <p className="text-sm text-yellow-700 mt-1">
                You need to create at least one route corridor before creating variants.{' '}
                <Link href="/admin/routes/new" className="underline">
                  Create a route
                </Link>
              </p>
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Select Route Sequence</h2>
                {variants.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowForkSelector(true)}
                  >
                    Fork from existing...
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <Select
                label="Direction"
                options={directionOptions}
                value={direction}
                onChange={(v) => setDirection(v as Direction)}
              />

              <RouteSequenceBuilder
                routes={routes}
                stations={stations}
                value={routeSegments}
                onChange={setRouteSegments}
                direction={direction}
              />
            </CardBody>
          </Card>

          <div className="flex gap-2">
            <Button
              onClick={handleProceedToStep2}
              disabled={routeSegments.length === 0}
            >
              Continue to Customization
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push(`/admin/lines/${id}/variants`)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Route reference info */}
            <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <span className="font-medium">Route:</span>{' '}
              {routeRefs
                .map((ref) => {
                  const route = routes.find((r) => r.id === ref.routeId);
                  const path = route?.paths.find((p) => p.id === ref.pathId);
                  return route ? `${route.name} (${path?.name || 'Unknown path'})` : 'Unknown';
                })
                .join(' + ')}
              <button
                type="button"
                onClick={handleBackToStep1}
                className="ml-2 text-blue-600 hover:underline"
              >
                Change
              </button>
            </div>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Variant Info</h2>
              </CardHeader>
              <CardBody className="space-y-4">
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
                <div className="text-sm text-gray-500">
                  Direction: {direction === 'outbound' ? 'Outbound' : 'Inbound'}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Customize Stops</h2>
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
              <Button onClick={handleSaveForwardAndProceedToStep3} disabled={saving}>
                {saving ? 'Saving...' : 'Save & Create Reverse'}
              </Button>
              <Button variant="secondary" onClick={handleBackToStep1}>
                Back
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
      )}

      {step === 3 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Success message */}
            <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              <span className="font-medium">Forward variant saved!</span>{' '}
              Now customize the reverse variant, or skip to finish.
            </div>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Reverse Variant Info</h2>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Code"
                    value={reverseCode}
                    onChange={(e) => setReverseCode(e.target.value)}
                    placeholder="Spr1a-rev"
                    required
                  />
                  <Input
                    label="Name (optional)"
                    value={reverseName}
                    onChange={(e) => setReverseName(e.target.value)}
                    placeholder="Return journey"
                  />
                </div>
                <div className="text-sm text-gray-500">
                  Direction: {direction === 'outbound' ? 'Inbound' : 'Outbound'}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Customize Reverse Stops</h2>
              </CardHeader>
              <CardBody>
                <RouteBuilder
                  stations={stations}
                  value={reverseStops}
                  onChange={setReverseStops}
                  durationLookup={durationLookup}
                  allowAddStations={false}
                />
              </CardBody>
            </Card>

            <div className="flex gap-2">
              <Button onClick={handleSaveReverseVariant} disabled={saving}>
                {saving ? 'Saving...' : 'Save Reverse Variant'}
              </Button>
              <Button variant="secondary" onClick={handleSkipReverseVariant}>
                Skip (Done)
              </Button>
            </div>
          </div>

          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <h2 className="text-lg font-semibold">Reverse Preview</h2>
              </CardHeader>
              <CardBody>
                <RoutePreview stops={reversePreviewStops} />
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {showForkSelector && (
        <ForkSelector
          variants={variants}
          stations={stations}
          onFork={handleFork}
          onClose={() => setShowForkSelector(false)}
        />
      )}
    </div>
  );
}
