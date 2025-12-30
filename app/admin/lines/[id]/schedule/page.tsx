'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Line, Variant, Station, OperatingPattern, LineSchedule } from '@/types';
import { LineBadge } from '@/components/lines';
import { LineScheduleEditor } from '@/components/admin/LineScheduleEditor';

export default function LineSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [line, setLine] = useState<Line | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [patterns, setPatterns] = useState<OperatingPattern[]>([]);
  const [schedule, setSchedule] = useState<LineSchedule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id]);

  async function fetchData() {
    try {
      const [lineRes, variantsRes, stationsRes, patternsRes, scheduleRes] = await Promise.all([
        fetch(`/api/admin/lines/${id}`),
        fetch(`/api/admin/variants?lineId=${id}`),
        fetch('/api/admin/stations'),
        fetch('/api/admin/patterns'),
        fetch(`/api/admin/line-schedules?lineId=${id}`),
      ]);

      if (!lineRes.ok) {
        router.push('/admin/lines');
        return;
      }

      const [lineData, variantsData, stationsData, patternsData, scheduleData] = await Promise.all([
        lineRes.json(),
        variantsRes.json(),
        stationsRes.json(),
        patternsRes.json(),
        scheduleRes.json(),
      ]);

      setLine(lineData);
      setVariants(variantsData);
      setStations(stationsData);
      setPatterns(patternsData);
      setSchedule(scheduleData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(scheduleData: Omit<LineSchedule, 'id'>) {
    const method = schedule ? 'PUT' : 'POST';
    const url = schedule
      ? `/api/admin/line-schedules/${schedule.id}`
      : '/api/admin/line-schedules';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scheduleData),
    });

    if (!response.ok) {
      throw new Error('Failed to save schedule');
    }

    const saved = await response.json();
    setSchedule(saved);
    return saved;
  }

  async function handleGenerate(
    scheduleId: string,
    options: { clearExisting: boolean; shortTurnVariants?: Record<string, string> }
  ) {
    const response = await fetch(`/api/admin/line-schedules/${scheduleId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate timetables');
    }

    return response.json();
  }

  async function handleAnalyze(scheduleId: string) {
    const response = await fetch(`/api/admin/line-schedules/${scheduleId}/analyze`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to analyze schedule');
    }

    return response.json();
  }

  async function handleCreatePattern(patternData: Omit<OperatingPattern, 'id'>) {
    const response = await fetch('/api/admin/patterns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patternData),
    });

    if (!response.ok) {
      throw new Error('Failed to create pattern');
    }

    const pattern = await response.json();
    setPatterns((prev) => [...prev, pattern]);
    return pattern;
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
            <p className="text-sm text-gray-500">Schedule Configuration</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/admin/lines/${id}/variants`}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Variants
          </Link>
        </div>
      </div>

      {variants.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">
            You need at least one outbound and one inbound variant to configure a schedule.
          </p>
          <Link
            href={`/admin/lines/${id}/variants/new`}
            className="text-blue-600 hover:underline"
          >
            Create variants first →
          </Link>
        </div>
      ) : (
        <LineScheduleEditor
          line={line}
          variants={variants}
          stations={stations}
          patterns={patterns}
          initialSchedule={schedule || undefined}
          onSave={handleSave}
          onGenerate={handleGenerate}
          onAnalyze={handleAnalyze}
          onCreatePattern={handleCreatePattern}
        />
      )}
    </div>
  );
}
