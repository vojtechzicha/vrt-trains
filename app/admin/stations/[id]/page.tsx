'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Station, StationType } from '@/types';
import { Card, CardHeader, CardBody, Button, Input, Select, NumberInput } from '@/components/ui';

const stationTypes: { value: StationType; label: string }[] = [
  { value: 'hub', label: 'Hub' },
  { value: 'terminal', label: 'Terminal' },
  { value: 'regular', label: 'Regular' },
  { value: 'airport', label: 'Airport' },
  { value: 'request', label: 'Request Stop' },
];

const countries: { value: string; label: string }[] = [
  { value: 'Czech', label: 'Czech' },
  { value: 'Germany', label: 'Germany' },
  { value: 'Austria', label: 'Austria' },
  { value: 'Poland', label: 'Poland' },
  { value: 'Slovakia', label: 'Slovakia' },
  { value: 'Hungary', label: 'Hungary' },
];

export default function EditStationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<StationType>('regular');
  const [platforms, setPlatforms] = useState(2);
  const [isTerminal, setIsTerminal] = useState(false);
  const [country, setCountry] = useState('Czech');

  useEffect(() => {
    fetchStation();
  }, [id]);

  async function fetchStation() {
    try {
      const res = await fetch(`/api/admin/stations/${id}`);
      if (!res.ok) {
        router.push('/admin/stations');
        return;
      }
      const station: Station = await res.json();
      setCode(station.code);
      setName(station.name);
      setType(station.type);
      setPlatforms(station.platforms);
      setIsTerminal(station.isTerminal);
      setCountry(station.country || 'Czech');
    } catch (error) {
      console.error('Failed to fetch station:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/admin/stations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, type, platforms, isTerminal, country }),
      });

      if (res.ok) {
        router.push('/admin/stations');
      }
    } catch (error) {
      console.error('Failed to update station:', error);
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
        <Link href="/admin/stations" className="text-sm text-blue-600 hover:underline">
          ← Back to Stations
        </Link>
      </div>

      <Card>
        <CardHeader>
          <h1 className="text-xl font-bold">Edit Station</h1>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="PHN"
                required
              />
              <Input
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Praha hlavní nádraží"
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <Select
                label="Type"
                options={stationTypes}
                value={type}
                onChange={(v) => setType(v as StationType)}
              />
              <Select
                label="Country"
                options={countries}
                value={country}
                onChange={(v) => setCountry(v)}
              />
              <NumberInput
                label="Platforms"
                value={platforms}
                onChange={setPlatforms}
                min={1}
                max={50}
              />
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTerminal}
                    onChange={(e) => setIsTerminal(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Terminal station</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/admin/stations')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
