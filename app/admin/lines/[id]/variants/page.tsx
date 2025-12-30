'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Line, Variant, Station } from '@/types';
import { Card, CardHeader, CardBody, Button } from '@/components/ui';
import { LineBadge } from '@/components/lines';
import { BulkTimeAdjustModal } from '@/components/admin';

export default function VariantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [line, setLine] = useState<Line | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBulkAdjust, setShowBulkAdjust] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  async function fetchData() {
    try {
      const [lineRes, variantsRes, stationsRes] = await Promise.all([
        fetch(`/api/admin/lines/${id}`),
        fetch(`/api/admin/variants?lineId=${id}`),
        fetch('/api/admin/stations'),
      ]);

      if (!lineRes.ok) {
        router.push('/admin/lines');
        return;
      }

      const [lineData, variantsData, stationsData] = await Promise.all([
        lineRes.json(),
        variantsRes.json(),
        stationsRes.json(),
      ]);

      setLine(lineData);
      setVariants(variantsData);
      setStations(stationsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(variantId: string) {
    if (!confirm('Delete this variant?')) return;

    try {
      await fetch(`/api/admin/variants/${variantId}`, { method: 'DELETE' });
      await fetchData();
    } catch (error) {
      console.error('Failed to delete variant:', error);
    }
  }

  function getStationName(stationId: string): string {
    return stations.find((s) => s.id === stationId)?.name || 'Unknown';
  }

  function getRouteDescription(variant: Variant): string {
    if (variant.stations.length === 0) return 'No stations';
    const first = getStationName(variant.stations[0].stationId);
    const last = getStationName(variant.stations[variant.stations.length - 1].stationId);
    return `${first} → ${last}`;
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  if (!line) {
    return null;
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/lines" className="text-sm text-blue-600 hover:underline">
          ← Back to Lines
        </Link>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <LineBadge
            identifier={line.identifier}
            color={line.color}
            textColor={line.textColor}
            className="text-lg px-3 py-1"
          />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{line.name}</h1>
            <p className="text-sm text-gray-500">Variants</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/admin/lines/${id}/schedule`}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Schedule
          </Link>
          <Button variant="secondary" onClick={() => setShowBulkAdjust(true)}>
            Bulk Time Adjust
          </Button>
          <Button onClick={() => router.push(`/admin/lines/${id}/variants/new`)}>
            + New Variant
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {variants.map((variant) => (
          <Card key={variant.id} className="hover:shadow-md transition-shadow">
            <CardBody>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono font-semibold text-gray-900">
                      {variant.code}
                    </span>
                    <span className="text-sm text-gray-500">{variant.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        variant.direction === 'outbound'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {variant.direction}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {getRouteDescription(variant)} ({variant.stations.length} stops)
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/lines/${id}/variants/${variant.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Edit
                  </Link>
                  <span className="text-gray-300">|</span>
                  <Link
                    href={`/admin/lines/${id}/variants/new?fork=${variant.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Fork
                  </Link>
                  <span className="text-gray-300">|</span>
                  <Link
                    href={`/admin/timetables/${variant.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Timetables
                  </Link>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => handleDelete(variant.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
        {variants.length === 0 && (
          <Card>
            <CardBody className="text-center py-8 text-gray-500">
              No variants yet. Create your first variant.
            </CardBody>
          </Card>
        )}
      </div>

      <BulkTimeAdjustModal
        isOpen={showBulkAdjust}
        onClose={() => setShowBulkAdjust(false)}
        variants={variants}
        stations={stations}
        onApply={() => {
          // Refresh data after bulk update
          fetchData();
        }}
      />
    </div>
  );
}
