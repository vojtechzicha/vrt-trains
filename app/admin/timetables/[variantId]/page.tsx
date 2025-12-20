'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Variant, Station, Line, Timetable, OperatingDay } from '@/types';
import { Card, CardHeader, CardBody, Button, Input } from '@/components/ui';
import { LineBadge } from '@/components/lines';
import { TimetableGenerator } from '@/components/admin/TimetableGenerator';
import { OperatingDaysSelector } from '@/components/admin/OperatingDaysSelector';

export default function TimetableEditorPage({
  params,
}: {
  params: Promise<{ variantId: string }>;
}) {
  const { variantId } = use(params);
  const router = useRouter();

  const [variant, setVariant] = useState<Variant | null>(null);
  const [line, setLine] = useState<Line | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTrainNumber, setNewTrainNumber] = useState('');
  const [newOperatingDays, setNewOperatingDays] = useState<OperatingDay[]>([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ]);
  const [newFirstDeparture, setNewFirstDeparture] = useState('06:00');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [variantId]);

  async function fetchData() {
    try {
      const [variantRes, stationsRes, timetablesRes] = await Promise.all([
        fetch(`/api/admin/variants/${variantId}`),
        fetch('/api/admin/stations'),
        fetch(`/api/admin/timetables?variantId=${variantId}`),
      ]);

      if (!variantRes.ok) {
        router.push('/admin/lines');
        return;
      }

      const [variantData, stationsData, timetablesData] = await Promise.all([
        variantRes.json(),
        stationsRes.json(),
        timetablesRes.json(),
      ]);

      setVariant(variantData);
      setStations(stationsData);
      setTimetables(timetablesData);

      // Fetch line data
      if (variantData.lineId) {
        const lineRes = await fetch(`/api/admin/lines/${variantData.lineId}`);
        if (lineRes.ok) {
          setLine(await lineRes.json());
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(params: {
    firstDeparture: string;
    interval: number;
    endTime: string;
    operatingDays: OperatingDay[];
    trainNumberPrefix: string;
    clearExisting: boolean;
  }) {
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/timetables/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId,
          ...params,
        }),
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to generate timetables:', error);
    } finally {
      setGenerating(false);
    }
  }

  async function handleAddManual() {
    if (!variant || !newTrainNumber) return;

    setSaving(true);
    try {
      // Calculate departures based on variant stops and first departure time
      const departures = variant.stations.map((stop) => {
        const [hours, mins] = newFirstDeparture.split(':').map(Number);
        const baseMinutes = hours * 60 + mins;

        const arrivalMinutes =
          stop.arrivalOffset !== null ? baseMinutes + stop.arrivalOffset : null;
        const departureMinutes =
          stop.departureOffset !== null ? baseMinutes + stop.departureOffset : null;

        const formatTime = (minutes: number | null) => {
          if (minutes === null) return null;
          const h = Math.floor(minutes / 60) % 24;
          const m = minutes % 60;
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        };

        return {
          stationId: stop.stationId,
          arrival: formatTime(arrivalMinutes),
          departure: formatTime(departureMinutes),
          platform: stop.platform,
        };
      });

      const res = await fetch('/api/admin/timetables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId,
          trainNumber: newTrainNumber,
          operatingDays: newOperatingDays,
          departures,
        }),
      });

      if (res.ok) {
        await fetchData();
        setShowAddForm(false);
        setNewTrainNumber('');
      }
    } catch (error) {
      console.error('Failed to add timetable:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this timetable?')) return;

    try {
      await fetch(`/api/admin/timetables/${id}`, { method: 'DELETE' });
      await fetchData();
    } catch (error) {
      console.error('Failed to delete timetable:', error);
    }
  }

  function getStationName(stationId: string): string {
    return stations.find((s) => s.id === stationId)?.name || 'Unknown';
  }

  function formatOperatingDays(days: OperatingDay[]): string {
    const allDays = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ];
    if (days.length === 7 && allDays.every((d) => days.includes(d as OperatingDay))) {
      return 'Daily';
    }
    const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    if (days.length === 5 && weekdays.every((d) => days.includes(d as OperatingDay))) {
      return 'Weekdays';
    }
    const weekends = ['saturday', 'sunday'];
    if (days.length === 2 && weekends.every((d) => days.includes(d as OperatingDay))) {
      return 'Weekends';
    }
    return days.map((d) => d.substring(0, 3)).join(', ');
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  if (!variant) {
    return null;
  }

  // Sort timetables by first departure
  const sortedTimetables = [...timetables].sort((a, b) => {
    const aTime = a.departures[0]?.departure || '99:99';
    const bTime = b.departures[0]?.departure || '99:99';
    return aTime.localeCompare(bTime);
  });

  return (
    <div>
      <div className="mb-6">
        {line && (
          <Link
            href={`/admin/lines/${line.id}/variants`}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to Variants
          </Link>
        )}
      </div>

      <div className="flex items-center gap-3 mb-6">
        {line && (
          <LineBadge
            identifier={line.identifier}
            color={line.color}
            textColor={line.textColor}
            className="text-lg px-3 py-1"
          />
        )}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Timetables</h1>
          <p className="text-sm text-gray-500">
            {variant.code} - {variant.name}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">
                  Timetable List ({sortedTimetables.length})
                </h2>
                <Button variant="secondary" size="sm" onClick={() => setShowAddForm(true)}>
                  + Add Train
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              {showAddForm && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-medium text-sm mb-3">Add New Train</h3>
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        label="Train Number"
                        value={newTrainNumber}
                        onChange={(e) => setNewTrainNumber(e.target.value)}
                        placeholder="SPR-001"
                        required
                      />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          First Departure
                        </label>
                        <input
                          type="time"
                          value={newFirstDeparture}
                          onChange={(e) => setNewFirstDeparture(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <OperatingDaysSelector
                      value={newOperatingDays}
                      onChange={setNewOperatingDays}
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleAddManual} disabled={saving || !newTrainNumber}>
                        {saving ? 'Adding...' : 'Add Train'}
                      </Button>
                      <Button variant="secondary" onClick={() => setShowAddForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {sortedTimetables.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No timetables yet. Generate or add manually.
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedTimetables.map((timetable) => (
                    <div
                      key={timetable.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-medium text-gray-900">
                          {timetable.trainNumber}
                        </span>
                        <span className="text-sm text-gray-600">
                          {timetable.departures[0]?.departure || '--:--'}
                        </span>
                        <span className="text-sm text-gray-400">→</span>
                        <span className="text-sm text-gray-600">
                          {timetable.departures[timetable.departures.length - 1]?.arrival ||
                            '--:--'}
                        </span>
                        <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded">
                          {formatOperatingDays(timetable.operatingDays)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDelete(timetable.id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Generate Timetables</h2>
            </CardHeader>
            <CardBody>
              <TimetableGenerator
                onGenerate={handleGenerate}
                defaultPrefix={variant.code.toUpperCase()}
                generating={generating}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Route Info</h2>
            </CardHeader>
            <CardBody>
              <div className="text-sm text-gray-600 space-y-1">
                {variant.stations.map((stop, index) => (
                  <div key={stop.stationId} className="flex items-center gap-2">
                    <span className="text-gray-400 w-4">{index + 1}.</span>
                    <span>{getStationName(stop.stationId)}</span>
                    {stop.arrivalOffset !== null && (
                      <span className="text-xs text-gray-400">+{stop.arrivalOffset}min</span>
                    )}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
