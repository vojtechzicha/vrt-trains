'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { OperatingPattern } from '@/types';
import { Card, CardHeader, CardBody, Button } from '@/components/ui';

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<OperatingPattern[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPatterns();
  }, []);

  async function fetchPatterns() {
    try {
      const response = await fetch('/api/admin/patterns');
      const data = await response.json();
      setPatterns(data);
    } catch (error) {
      console.error('Failed to fetch patterns:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(patternId: string) {
    if (!confirm('Delete this pattern?')) return;

    try {
      const response = await fetch(`/api/admin/patterns/${patternId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to delete pattern');
        return;
      }

      await fetchPatterns();
    } catch (error) {
      console.error('Failed to delete pattern:', error);
    }
  }

  function formatPeriodSummary(pattern: OperatingPattern): string {
    return pattern.periods
      .map((p) => {
        const intervalLabel = p.intervalMinutes >= 60
          ? `${p.intervalMinutes / 60}h`
          : `${p.intervalMinutes}min`;
        const base = `${p.startTime}-${p.endTime} every ${intervalLabel}`;
        return p.offPeakReduction
          ? `${base} (off-peak ${p.offPeakReduction.startTime}-${p.offPeakReduction.endTime})`
          : base;
      })
      .join(', ');
  }

  function formatOperatingDays(days: string[]): string {
    if (days.includes('weekdays') && days.includes('weekends')) return 'Daily';
    if (days.includes('weekdays')) return 'Weekdays';
    if (days.includes('weekends')) return 'Weekends';
    if (days.length === 7) return 'Daily';
    return days.map((d) => d.slice(0, 3)).join(', ');
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-blue-600 hover:underline">
          ← Back to Admin
        </Link>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Operating Patterns</h1>
          <p className="text-sm text-gray-500">
            Reusable service patterns for timetable generation
          </p>
        </div>
        <Link href="/admin/patterns/new">
          <Button>+ New Pattern</Button>
        </Link>
      </div>

      <div className="space-y-3">
        {patterns.map((pattern) => (
          <Card key={pattern.id} className="hover:shadow-md transition-shadow">
            <CardBody>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold text-gray-900">{pattern.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                      {pattern.periods.length} period{pattern.periods.length > 1 ? 's' : ''}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                      {formatOperatingDays(pattern.operatingDays)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{formatPeriodSummary(pattern)}</p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/patterns/${pattern.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Edit
                  </Link>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => handleDelete(pattern.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
        {patterns.length === 0 && (
          <Card>
            <CardBody className="text-center py-8 text-gray-500">
              No patterns yet. Create your first operating pattern.
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
