'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardBody } from '@/components/ui';
import { PlatformAssignmentEditor } from '@/components/admin/PlatformAssignmentEditor';
import { Direction, Platform } from '@/types';

interface VariantInfo {
  id: string;
  code: string;
  name: string;
  lineId: string;
  direction: Direction;
  platform: string;
  routeDescription: string;
}

interface LineInfo {
  id: string;
  identifier: string;
  name: string;
  color: string;
  textColor: string;
}

interface StationInfo {
  id: string;
  code: string;
  name: string;
  platforms: Platform[];
}

interface PlatformDataResponse {
  station: StationInfo;
  variants: VariantInfo[];
  lines: LineInfo[];
}

export default function PlatformAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PlatformDataResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/admin/stations/${id}/platforms`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/admin/stations');
          return;
        }
        throw new Error('Failed to fetch platform data');
      }
      const platformData: PlatformDataResponse = await res.json();
      setData(platformData);
    } catch (err) {
      console.error('Failed to fetch platform data:', err);
      setError('Failed to load platform data');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(assignments: { variantId: string; platform: string }[]) {
    const res = await fetch(`/api/admin/stations/${id}/platforms`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignments }),
    });

    if (!res.ok) {
      throw new Error('Failed to save platform assignments');
    }

    // Refetch data to show updated state
    await fetchData();
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error || 'Failed to load data'}</p>
        <Link href="/admin/stations" className="text-blue-600 hover:underline">
          Back to Stations
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href={`/admin/stations/${id}`} className="text-sm text-blue-600 hover:underline">
          &larr; Back to {data.station.name}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div>
            <h1 className="text-xl font-bold">Platform Assignment</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {data.station.name} ({data.station.code}) - {data.station.platforms.length} platforms
            </p>
          </div>
        </CardHeader>
        <CardBody>
          {data.variants.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No lines serve this station yet.</p>
          ) : (
            <PlatformAssignmentEditor
              stationId={id}
              stationName={data.station.name}
              platforms={data.station.platforms}
              variants={data.variants}
              lines={data.lines}
              onSave={handleSave}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
