'use client';

import { useState, useMemo } from 'react';
import { OperatingPattern, ServicePeriod, OperatingDay } from '@/types';
import { Button, Input } from '@/components/ui';
import { OperatingDaysSelector } from './OperatingDaysSelector';

interface PatternEditorProps {
  initialPattern?: OperatingPattern;
  onSave: (pattern: Omit<OperatingPattern, 'id'>) => Promise<void>;
  onCancel?: () => void;
  saving?: boolean;
}

// Common interval options with labels
const INTERVAL_OPTIONS = [
  { value: 10, label: '10 min (6 tph)' },
  { value: 15, label: '15 min (4 tph)' },
  { value: 20, label: '20 min (3 tph)' },
  { value: 30, label: '30 min (2 tph)' },
  { value: 60, label: '60 min (1 tph)' },
  { value: 120, label: '120 min (1 per 2h)' },
  { value: 240, label: '240 min (1 per 4h)' },
];

function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function PatternEditor({
  initialPattern,
  onSave,
  onCancel,
  saving = false,
}: PatternEditorProps) {
  const [name, setName] = useState(initialPattern?.name || '');
  const [periods, setPeriods] = useState<ServicePeriod[]>(
    initialPattern?.periods || [
      { startTime: '06:00', endTime: '22:00', intervalMinutes: 60 },
    ]
  );
  const [operatingDays, setOperatingDays] = useState<OperatingDay[]>(
    initialPattern?.operatingDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  );

  function addPeriod() {
    const lastPeriod = periods[periods.length - 1];
    const newStartTime = lastPeriod?.endTime || '06:00';
    const newEndMinutes = timeToMinutes(newStartTime) + 120;
    setPeriods([
      ...periods,
      {
        startTime: newStartTime,
        endTime: minutesToTime(Math.min(newEndMinutes, 1439)),
        intervalMinutes: 60,
      },
    ]);
  }

  function updatePeriod(index: number, updates: Partial<ServicePeriod>) {
    const newPeriods = [...periods];
    newPeriods[index] = { ...newPeriods[index], ...updates };
    setPeriods(newPeriods);
  }

  function removePeriod(index: number) {
    if (periods.length <= 1) return;
    setPeriods(periods.filter((_, i) => i !== index));
  }

  function toggleOffPeakReduction(index: number) {
    const period = periods[index];
    if (period.offPeakReduction) {
      updatePeriod(index, { offPeakReduction: undefined });
    } else {
      // Default off-peak window: 09:00 - 16:00
      updatePeriod(index, {
        offPeakReduction: { startTime: '09:00', endTime: '16:00' },
      });
    }
  }

  async function handleSave() {
    await onSave({
      name,
      periods,
      operatingDays,
    });
  }

  // Calculate total departures preview
  const departureCount = useMemo(() => {
    let total = 0;
    for (const period of periods) {
      const startMins = timeToMinutes(period.startTime);
      const endMins = timeToMinutes(period.endTime);
      const interval = period.intervalMinutes;

      let count = 0;
      for (let t = startMins; t < endMins; t += interval) {
        if (period.offPeakReduction) {
          const offStart = timeToMinutes(period.offPeakReduction.startTime);
          const offEnd = timeToMinutes(period.offPeakReduction.endTime);
          if (t >= offStart && t < offEnd) {
            // In off-peak, count every other
            count += 0.5;
          } else {
            count += 1;
          }
        } else {
          count += 1;
        }
      }
      total += Math.floor(count);
    }
    return total;
  }, [periods]);

  // Generate departure preview times
  const departurePreview = useMemo(() => {
    const times: string[] = [];
    let offPeakCounter = 0;

    for (const period of periods) {
      const startMins = timeToMinutes(period.startTime);
      const endMins = timeToMinutes(period.endTime);
      const interval = period.intervalMinutes;

      for (let t = startMins; t < endMins && times.length < 10; t += interval) {
        if (period.offPeakReduction) {
          const offStart = timeToMinutes(period.offPeakReduction.startTime);
          const offEnd = timeToMinutes(period.offPeakReduction.endTime);
          if (t >= offStart && t < offEnd) {
            if (offPeakCounter % 2 === 0) {
              times.push(minutesToTime(t));
            }
            offPeakCounter++;
            continue;
          }
        }
        offPeakCounter = 0;
        times.push(minutesToTime(t));
      }
    }
    return times;
  }, [periods]);

  const isValid = name.trim() && periods.length > 0 && operatingDays.length > 0;

  return (
    <div className="space-y-6">
      <Input
        label="Pattern Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g., Weekday Express"
      />

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Time Periods
          </label>
          <Button variant="secondary" onClick={addPeriod}>
            + Add Period
          </Button>
        </div>

        <div className="space-y-3">
          {periods.map((period, index) => (
            <div
              key={index}
              className="p-4 border border-gray-200 rounded-lg bg-gray-50"
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 grid gap-3 md:grid-cols-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start</label>
                    <input
                      type="time"
                      value={period.startTime}
                      onChange={(e) =>
                        updatePeriod(index, { startTime: e.target.value })
                      }
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End</label>
                    <input
                      type="time"
                      value={period.endTime}
                      onChange={(e) =>
                        updatePeriod(index, { endTime: e.target.value })
                      }
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Interval
                    </label>
                    <select
                      value={period.intervalMinutes}
                      onChange={(e) =>
                        updatePeriod(index, {
                          intervalMinutes: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {INTERVAL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!period.offPeakReduction}
                        onChange={() => toggleOffPeakReduction(index)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Off-peak</span>
                    </label>
                  </div>
                </div>

                {periods.length > 1 && (
                  <button
                    onClick={() => removePeriod(index)}
                    className="p-1 text-gray-400 hover:text-red-500"
                    title="Remove period"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {period.offPeakReduction && (
                <div className="mt-3 pl-4 border-l-2 border-blue-200">
                  <div className="text-xs text-gray-500 mb-1">
                    Off-peak window (skip alternate trains)
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={period.offPeakReduction.startTime}
                      onChange={(e) =>
                        updatePeriod(index, {
                          offPeakReduction: {
                            ...period.offPeakReduction!,
                            startTime: e.target.value,
                          },
                        })
                      }
                      className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="time"
                      value={period.offPeakReduction.endTime}
                      onChange={(e) =>
                        updatePeriod(index, {
                          offPeakReduction: {
                            ...period.offPeakReduction!,
                            endTime: e.target.value,
                          },
                        })
                      }
                      className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <OperatingDaysSelector value={operatingDays} onChange={setOperatingDays} />

      <div className="p-4 bg-gray-100 rounded-lg">
        <div className="text-sm text-gray-600 mb-2">
          Preview: <strong>{departureCount}</strong> departures/day (per direction)
        </div>
        <div className="text-sm font-mono text-gray-500">
          {departurePreview.join(', ')}
          {departureCount > departurePreview.length && '...'}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSave} disabled={saving || !isValid}>
          {saving ? 'Saving...' : initialPattern ? 'Update Pattern' : 'Create Pattern'}
        </Button>
      </div>
    </div>
  );
}
