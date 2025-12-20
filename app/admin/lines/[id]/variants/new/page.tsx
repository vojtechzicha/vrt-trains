'use client';

import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Line, Variant, Station, Direction, StopType, VariantStop } from '@/types';
import { Card, CardHeader, CardBody, Button, Input, Select } from '@/components/ui';
import { LineBadge } from '@/components/lines';
import { RouteBuilder, buildDurationLookup, DurationLookup } from '@/components/admin/RouteBuilder';
import { RoutePreview } from '@/components/admin/RoutePreview';
import { ForkSelector } from '@/components/admin/ForkSelector';

interface RouteStop {
  stationId: string;
  minutesFromPrevious: number;
  platform: string;
  stopType: StopType;
}

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
  const [durationLookup, setDurationLookup] = useState<DurationLookup>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<Direction>('outbound');
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);

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
      const [lineRes, stationsRes, lineVariantsRes, allVariantsRes] = await Promise.all([
        fetch(`/api/admin/lines/${id}`),
        fetch('/api/admin/stations'),
        fetch(`/api/admin/variants?lineId=${id}`),
        fetch('/api/admin/variants'), // Fetch all variants for duration lookup
      ]);

      if (!lineRes.ok) {
        router.push('/admin/lines');
        return;
      }

      const [lineData, stationsData, lineVariantsData, allVariantsData] = await Promise.all([
        lineRes.json(),
        stationsRes.json(),
        lineVariantsRes.json(),
        allVariantsRes.json(),
      ]);

      setLine(lineData);
      // Filter out virtual stations - only physical stations can be in variants
      setStations(stationsData.filter((s: Station) => !s.isVirtual));
      setVariants(lineVariantsData);
      setDurationLookup(buildDurationLookup(allVariantsData));
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  function loadFromVariant(variant: Variant) {
    setCode(variant.code + '-fork');
    setName(variant.name + ' (forked)');
    setDirection(variant.direction);

    // Convert VariantStop[] to RouteStop[]
    const stops: RouteStop[] = variant.stations.map((stop, index) => ({
      stationId: stop.stationId,
      minutesFromPrevious: index === 0 ? 0 : (stop.arrivalOffset || 0) - (variant.stations[index - 1].departureOffset || 0),
      platform: stop.platform,
      stopType: stop.stopType,
    }));
    setRouteStops(stops);
  }

  function handleFork(sourceVariant: Variant, options?: { truncateAtStationId?: string; reverse?: boolean }) {
    let stationsToLoad = [...sourceVariant.stations];

    if (options?.truncateAtStationId) {
      const truncateIndex = stationsToLoad.findIndex(
        (s) => s.stationId === options.truncateAtStationId
      );
      if (truncateIndex !== -1) {
        stationsToLoad = stationsToLoad.slice(0, truncateIndex + 1);
      }
    }

    // Reverse the stations if creating inbound from outbound (or vice versa)
    if (options?.reverse) {
      stationsToLoad = [...stationsToLoad].reverse();
    }

    // Calculate durations - need to recalculate for reversed routes
    const stops: RouteStop[] = stationsToLoad.map((stop, index) => {
      let minutesFromPrevious = 0;
      if (index > 0) {
        if (options?.reverse) {
          // For reversed routes, use the duration lookup or default
          const prevStationId = stationsToLoad[index - 1].stationId;
          const keyForward = `${prevStationId}:${stop.stationId}`;
          const keyBackward = `${stop.stationId}:${prevStationId}`;
          const duration = durationLookup.get(keyForward) ?? durationLookup.get(keyBackward);
          minutesFromPrevious = duration ?? 5;
        } else {
          // For non-reversed, calculate from original offsets
          const origIndex = sourceVariant.stations.findIndex(s => s.stationId === stop.stationId);
          if (origIndex > 0) {
            minutesFromPrevious = (stop.arrivalOffset || 0) - (sourceVariant.stations[origIndex - 1].departureOffset || 0);
          }
        }
      }
      return {
        stationId: stop.stationId,
        minutesFromPrevious,
        platform: stop.platform,
        stopType: stop.stopType,
      };
    });

    const newDirection = options?.reverse
      ? (sourceVariant.direction === 'outbound' ? 'inbound' : 'outbound')
      : sourceVariant.direction;

    const suffix = options?.reverse ? '-rev' : '-short';
    const nameSuffix = options?.reverse ? ' (reverse)' : ' (short)';

    setCode(sourceVariant.code + suffix);
    setName(sourceVariant.name + nameSuffix);
    setDirection(newDirection);
    setRouteStops(stops);
    setShowForkSelector(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (routeStops.length === 0) {
      alert('Please add at least one station');
      return;
    }

    setSaving(true);

    try {
      // Convert RouteStop[] to VariantStop[]
      let cumulativeMinutes = 0;
      const variantStops: VariantStop[] = routeStops.map((stop, index) => {
        if (index > 0) {
          cumulativeMinutes += stop.minutesFromPrevious;
        }
        const arrivalOffset = index === 0 ? null : cumulativeMinutes;
        const departureOffset = index === routeStops.length - 1 ? null : cumulativeMinutes + (index === 0 ? 0 : 1);
        if (index > 0 && index < routeStops.length - 1) {
          cumulativeMinutes += 1; // Add 1 min dwell time for intermediate stops
        }

        return {
          stationId: stop.stationId,
          sequence: index + 1,
          arrivalOffset,
          departureOffset,
          platform: stop.platform,
          stopType: stop.stopType,
        };
      });

      const res = await fetch('/api/admin/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineId: id,
          code,
          name,
          direction,
          stations: variantStops,
        }),
      });

      if (res.ok) {
        router.push(`/admin/lines/${id}/variants`);
      }
    } catch (error) {
      console.error('Failed to create variant:', error);
    } finally {
      setSaving(false);
    }
  }

  // Convert routeStops to preview format
  const previewStops = routeStops.map((stop, index) => {
    const station = stations.find((s) => s.id === stop.stationId);
    let cumulativeMinutes = 0;
    for (let i = 0; i <= index; i++) {
      if (i > 0) cumulativeMinutes += routeStops[i].minutesFromPrevious;
    }
    return {
      stationName: station?.name || 'Unknown',
      stationCode: station?.code || '???',
      cumulativeMinutes,
      platform: stop.platform,
    };
  });

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
          ← Back to Variants
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
                    label="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Sprinter 1 Express"
                    required
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
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Route</h2>
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
            <CardBody>
              <RouteBuilder
                stations={stations}
                value={routeStops}
                onChange={setRouteStops}
                durationLookup={durationLookup}
              />
            </CardBody>
          </Card>

          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Create Variant'}
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
