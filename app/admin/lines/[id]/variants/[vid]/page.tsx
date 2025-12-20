'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Line, Variant, Station, Direction, StopType, VariantStop } from '@/types';
import { Card, CardHeader, CardBody, Button, Input, Select } from '@/components/ui';
import { LineBadge } from '@/components/lines';
import { RouteBuilder, buildDurationLookup, DurationLookup } from '@/components/admin/RouteBuilder';
import { RoutePreview } from '@/components/admin/RoutePreview';

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

export default function EditVariantPage({
  params,
}: {
  params: Promise<{ id: string; vid: string }>;
}) {
  const { id, vid } = use(params);
  const router = useRouter();

  const [line, setLine] = useState<Line | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [durationLookup, setDurationLookup] = useState<DurationLookup>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<Direction>('outbound');
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);

  useEffect(() => {
    fetchData();
  }, [id, vid]);

  async function fetchData() {
    try {
      const [lineRes, stationsRes, variantRes, allVariantsRes] = await Promise.all([
        fetch(`/api/admin/lines/${id}`),
        fetch('/api/admin/stations'),
        fetch(`/api/admin/variants/${vid}`),
        fetch('/api/admin/variants'), // Fetch all variants for duration lookup
      ]);

      if (!lineRes.ok || !variantRes.ok) {
        router.push(`/admin/lines/${id}/variants`);
        return;
      }

      const [lineData, stationsData, variantData, allVariantsData] = await Promise.all([
        lineRes.json(),
        stationsRes.json(),
        variantRes.json(),
        allVariantsRes.json(),
      ]);

      setLine(lineData);
      // Filter out virtual stations - only physical stations can be in variants
      setStations(stationsData.filter((s: Station) => !s.isVirtual));
      setDurationLookup(buildDurationLookup(allVariantsData));

      // Load variant data
      setCode(variantData.code);
      setName(variantData.name);
      setDirection(variantData.direction);

      // Convert VariantStop[] to RouteStop[]
      const stops: RouteStop[] = variantData.stations.map(
        (stop: VariantStop, index: number) => ({
          stationId: stop.stationId,
          minutesFromPrevious:
            index === 0
              ? 0
              : (stop.arrivalOffset || 0) -
                (variantData.stations[index - 1].departureOffset || 0),
          platform: stop.platform,
          stopType: stop.stopType,
        })
      );
      setRouteStops(stops);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
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
        const departureOffset =
          index === routeStops.length - 1 ? null : cumulativeMinutes + (index === 0 ? 0 : 1);
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

      const res = await fetch(`/api/admin/variants/${vid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
      console.error('Failed to update variant:', error);
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
          <h1 className="text-xl font-bold text-gray-900">Edit Variant</h1>
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
              <h2 className="text-lg font-semibold">Route</h2>
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
